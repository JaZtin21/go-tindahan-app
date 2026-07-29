import * as tf from '@tensorflow/tfjs';
import { initOcrEngine } from '~/utils/ocrEngine';
import {
    getAsset,
    setAsset,
    clearAllAssets,
    requestPersistentStorage,
    cachedTrackDownload,
    withCachedFetch,
    OfflineRequiredError,
    isOnline,
} from '~/utils/assetStore';
import { decryptToJson, isValidEncryptedShape } from '~/utils/cryptoAssets';


interface LoadingProgress {
    phase: 'model' | 'names' | 'embeddings' | 'ocr' | 'ready' | 'error' | 'offline';
    progress: number;
}

let modelCache: tf.LayersModel | null = null;
let namesCache: string[] | null = null;
let embeddingsCache: tf.Tensor2D | null = null;
let ocrLoaded = false;
let activeLoadingPromise: Promise<void> | null = null;

// TODO: verify against DevTools → Network which URL(s) ppu-paddle-ocr actually
// requests (model weights / wasm / config), then tighten this matcher.
// It's intentionally broad for now so nothing slips through uncached, but a
// broad matcher risks accidentally intercepting unrelated fetches if your
// app fetches other things from the same host during OCR init.
const isOcrAssetUrl = (url: string): boolean => /paddle|ocr[-_./]|\.onnx($|\?)|\.wasm($|\?)/i.test(url);

export const getCachedScannerAssets = () => {
    return {
        model: modelCache,
        names: namesCache,
        embeddings: embeddingsCache,
        isLoaded: !!(modelCache && namesCache && embeddingsCache && ocrLoaded)
    };
};

export const clearScannerCache = async (): Promise<void> => {
    modelCache = null;
    namesCache = null;
    embeddingsCache = null;
    ocrLoaded = false;
    activeLoadingPromise = null;

    try {
        await tf.io.removeModel('indexeddb://product-matcher-model');
    } catch (err) {
        console.warn("No IndexedDB model to delete:", err);
    }

    try {
        await clearAllAssets();
    } catch (err) {
        console.warn("Failed to clear durable asset store:", err);
    }
};

export const initScannerAssets = (onProgress: (status: LoadingProgress) => void): Promise<void> => {
    if (modelCache && namesCache && embeddingsCache && ocrLoaded) {
        onProgress({ phase: 'ready', progress: 100 });
        return Promise.resolve();
    }

    if (activeLoadingPromise) {
        return activeLoadingPromise;
    }

    // Four phases share the bar: model / names / embeddings / ocr, each a quarter.
    activeLoadingPromise = (async () => {
        try {
            // Ask for durable storage once, up front, for the whole origin.
            // This — not which storage API is used — is what actually stops
            // the browser from evicting these assets under disk pressure.
            // Covers this store and any Cache Storage entries (e.g. map
            // tiles) the app keeps elsewhere. Non-fatal if unsupported/denied
            // (e.g. iOS Safari) — loading still proceeds, just less durably.
            const persisted = await requestPersistentStorage();
            if (!persisted) {
                console.warn('[ScannerAssets] Persistent storage not granted — assets may still be evicted under storage pressure.');
            }

            try {
                modelCache = await tf.loadLayersModel('indexeddb://product-matcher-model');
                onProgress({ phase: 'model', progress: 25 });
            } catch (e) {
                // Missing OR corrupted — either way, clear whatever's there
                // before re-saving so a stale partial entry can't conflict.
                console.warn('[ScannerAssets] Cached model missing/corrupted — redownloading.', e);
                await tf.io.removeModel('indexeddb://product-matcher-model').catch(() => { });
                onProgress({ phase: 'model', progress: 5 });
                if (!isOnline()) {
                    throw new OfflineRequiredError('Offline — cannot download vision model');
                }
                try {
                    modelCache = await tf.loadLayersModel('/tfjs_model/model.json');
                } catch (fetchErr) {
                    // tf.loadLayersModel uses its own internal fetch, not our
                    // trackDownload — classify offline failures here too.
                    throw isOnline() ? fetchErr : new OfflineRequiredError('Offline — cannot download vision model');
                }
                await modelCache.save('indexeddb://product-matcher-model');
                onProgress({ phase: 'model', progress: 25 });
            }

            onProgress({ phase: 'names', progress: 25 });
            const encryptedNames = await cachedTrackDownload(
                '/ref-a1.bin',
                'ref-a1.bin',
                (pct) => {
                    const scaledProgress = 25 + Math.round((pct / 100) * 25);
                    onProgress({ phase: 'names', progress: Math.min(scaledProgress, 50) });
                },
                isValidEncryptedShape
            );

            const namesData = await decryptToJson<{
                class_names: string[];
                num_classes: number;
                embedding_dim: number;
            }>(encryptedNames);

            if (
                !Array.isArray(namesData?.class_names) || namesData.class_names.length === 0 ||
                typeof namesData?.num_classes !== 'number' || typeof namesData?.embedding_dim !== 'number'
            ) {
                throw new Error('Decrypted reference_class_names payload failed shape validation');
            }

            namesCache = namesData.class_names;
            onProgress({ phase: 'names', progress: 50 });

            onProgress({ phase: 'embeddings', progress: 50 });
            const expectedByteLength = namesData.num_classes * namesData.embedding_dim * 4; // Float32
            const binBuffer = await cachedTrackDownload(
                '/reference_embeddings.bin',
                'reference_embeddings.bin',
                (pct) => {
                    const scaledProgress = 50 + Math.round((pct / 100) * 25);
                    onProgress({ phase: 'embeddings', progress: Math.min(scaledProgress, 75) });
                },
                // Byte-length check catches truncation/corruption that would
                // otherwise silently produce a wrong-shaped tensor below.
                (data) => data instanceof ArrayBuffer && data.byteLength === expectedByteLength
            );

            const flatEmbeddings = new Float32Array(binBuffer);
            embeddingsCache = tf.tensor2d(flatEmbeddings, [
                namesData.num_classes,
                namesData.embedding_dim
            ]);
            onProgress({ phase: 'embeddings', progress: 75 });

            // OCR engine: the library manages its own downloads internally, so
            // we can't call cachedTrackDownload directly. Instead we wrap the
            // init call so any fetch() it issues for matching URLs is
            // transparently cached in the same durable store. See the caveat
            // in withCachedFetch's docstring re: XHR-based libraries.
            onProgress({ phase: 'ocr', progress: 80 });
            await withCachedFetch(isOcrAssetUrl, () => initOcrEngine());
            ocrLoaded = true;
            onProgress({ phase: 'ocr', progress: 100 });

            onProgress({ phase: 'ready', progress: 100 });
        } catch (err) {
            activeLoadingPromise = null;

            if (err instanceof OfflineRequiredError) {
                // Don't null out caches that already loaded successfully this
                // pass (e.g. model was fine, only embeddings needed a
                // redownload) — a retry should only redo the piece that
                // actually failed, not re-walk everything from indexeddb
                // again unnecessarily. initScannerAssets's early-return check
                // only fires when *all four* are set, so a retry will still
                // correctly resume from whatever's missing.
                console.warn('[ScannerAssets] Redownload needed but offline.', err);
                onProgress({ phase: 'offline', progress: 0 });
                throw err;
            }

            modelCache = null;
            namesCache = null;
            embeddingsCache = null;
            ocrLoaded = false;
            onProgress({ phase: 'error', progress: 0 });
            throw err;
        }
    })();

    return activeLoadingPromise;
};