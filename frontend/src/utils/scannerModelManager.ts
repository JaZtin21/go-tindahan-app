import * as tf from '@tensorflow/tfjs';

interface LoadingProgress {
    phase: 'model' | 'names' | 'embeddings' | 'ready' | 'error';
    progress: number;
}

let modelCache: tf.LayersModel | null = null;
let namesCache: string[] | null = null;
let embeddingsCache: tf.Tensor2D | null = null;
let activeLoadingPromise: Promise<void> | null = null;

const trackDownload = (url: string, onProgress: (pct: number) => void): Promise<any> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);

        if (url.endsWith('.bin')) {
            xhr.responseType = 'arraybuffer';
        } else if (url.endsWith('.json')) {
            xhr.responseType = 'json';
        }

        xhr.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
                const percentage = Math.round((event.loaded / event.total) * 100);
                onProgress(percentage);
            } else {
                onProgress(50);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress(100);
                if (url === '/reference_embeddings.bin') {
                    setTimeout(() => resolve(xhr.response), 500);
                } else {
                    // Instantly resolve all other supporting files with zero delay!
                    resolve(xhr.response);
                }
            } else {
                reject(new Error(`Failed to load ${url}`));
            }
        };

        xhr.onerror = () => reject(new Error(`Network error loading ${url}`));
        xhr.send();
    });
};

export const getCachedScannerAssets = () => {
    return {
        model: modelCache,
        names: namesCache,
        embeddings: embeddingsCache,
        isLoaded: !!(modelCache && namesCache && embeddingsCache)
    };
};

export const clearScannerCache = async (): Promise<void> => {
    modelCache = null;
    namesCache = null;
    embeddingsCache = null;
    activeLoadingPromise = null;

    try {
        await tf.io.removeModel('indexeddb://product-matcher-model');
    } catch (err) {
        console.warn("No IndexedDB model to delete:", err);
    }
};


export const initScannerAssets = (onProgress: (status: LoadingProgress) => void): Promise<void> => {
    if (modelCache && namesCache && embeddingsCache) {
        onProgress({ phase: 'ready', progress: 100 });
        return Promise.resolve();
    }

    if (activeLoadingPromise) {
        return activeLoadingPromise;
    }

    activeLoadingPromise = (async () => {
        try {
            try {
                modelCache = await tf.loadLayersModel('indexeddb://product-matcher-model');
                onProgress({ phase: 'model', progress: 33 });
            } catch (e) {
                onProgress({ phase: 'model', progress: 5 });
                modelCache = await tf.loadLayersModel('/tfjs_model/model.json');
                await modelCache.save('indexeddb://product-matcher-model');
                onProgress({ phase: 'model', progress: 33 });
            }

            onProgress({ phase: 'names', progress: 33 });
            const namesData = await trackDownload('/reference_class_names.json', (pct) => {
                const scaledProgress = 33 + Math.round((pct / 100) * 33);
                onProgress({ phase: 'names', progress: Math.min(scaledProgress, 66) });
            });
            namesCache = namesData.class_names;
            onProgress({ phase: 'names', progress: 66 });

            onProgress({ phase: 'embeddings', progress: 66 });
            const binBuffer = await trackDownload('/reference_embeddings.bin', (pct) => {
                const scaledProgress = 66 + Math.round((pct / 100) * 34);
                onProgress({ phase: 'embeddings', progress: Math.min(scaledProgress, 99) });
            });

            const flatEmbeddings = new Float32Array(binBuffer);
            embeddingsCache = tf.tensor2d(flatEmbeddings, [
                namesData.num_classes,
                namesData.embedding_dim
            ]);

            // 🎯 HERE IS THE CLEAN TIMEOUT: Holds the 100% state exactly where you need it 
            onProgress({ phase: 'embeddings', progress: 100 });

            // Finally trigger the transition step flag
            onProgress({ phase: 'ready', progress: 100 });
        } catch (err) {
            activeLoadingPromise = null;
            modelCache = null;
            namesCache = null;
            embeddingsCache = null;
            onProgress({ phase: 'error', progress: 0 });
            throw err;
        }
    })();

    return activeLoadingPromise;
};
