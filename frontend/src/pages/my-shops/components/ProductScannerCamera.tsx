import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { initScannerAssets, getCachedScannerAssets, clearScannerCache } from '~/utils/scannerModelManager';
import { isOcrEngineReady, recognizeProductText, imageElementToCanvas } from '~/utils/ocrEngine';
import {
    resolveProductIdentity,
    getTopVisualCandidateNames,
    shouldBindVisualClassKeys,
    type VisualMatch,
    type ConfidenceTier,
} from '~/utils/productMatching';
import { TriangleAlert, ImageIcon, RotateCcw, WifiOff } from 'lucide-react';
import { useSearchShopProducts } from '~/api/queries';
import type { Product } from '~/types/item';

// ============================================================================
// SCAN OUTCOME CONTRACT
// ============================================================================
// The camera now owns the full "photo in -> identity -> DB lookup" pipeline,
// not just identification. Callers no longer run their own searchShopProducts
// call after getting a name back — they get told directly whether the scan
// matched something already in this shop's inventory.
//
//  - 'matched'   : the resolved identity found an existing product in this
//                  shop. `variants` is every product sharing that same
//                  itemName (same grouping ScannerTab used to compute itself
//                  from the raw search results), for unit-of-measure capsule
//                  UI. `product` is the first/primary one.
//  - 'unmatched' : nothing found. `suggestedName`/`unitOfMeasure` are what
//                  resolveProductIdentity came up with, for prefilling a
//                  manual form.
//
// Both variants carry `visualCandidateKeys` and `confidenceTier`. The keys
// array is ALREADY gated by shouldBindVisualClassKeys — callers that persist
// it (e.g. AddInventoryItem/UpdateInventoryItem's `visualClassKeys` input)
// don't need to re-check the tier themselves; it'll simply be empty when the
// scan wasn't confident enough to bind. `confidenceTier` is still exposed in
// case a caller wants to log a low-confidence scan for retraining (e.g. via
// the optional recordScanEvent mutation) or show the user a "not sure about
// this one" hint.
// ============================================================================
export type ScanOutcome =
    | {
        status: 'matched';
        product: Product;
        variants: Product[];
        file: File;
        previewUrl: string;
        visualCandidateKeys: string[];
        confidenceTier: ConfidenceTier;
    }
    | {
        status: 'unmatched';
        file: File;
        previewUrl: string;
        suggestedName: string;
        unitOfMeasure: string;
        visualCandidateKeys: string[];
        confidenceTier: ConfidenceTier;
    };

interface ProductScannerCameraProps {
    shopId: string;
    isSubscribed: boolean;
    onCaptureComplete: (outcome: ScanOutcome) => void;
    hasResult?: boolean;
    onRetry?: () => void;
    // NEW: false for flows where a match is meaningless (Add Item — the
    // whole point is the item doesn't exist yet). Defaults true so
    // ScannerTab/RestockScannerTab need no changes.
    searchInventory?: boolean;
}

const IMG_SIZE = 224;
const COLOR_WEIGHT = 1.5;
const TOP_N_CANDIDATES = 10;
const VISUAL_CANDIDATE_KEY_LIMIT = 5;
const SEARCH_RESULT_LIMIT = 7;

export const ProductScannerCamera = ({ shopId, isSubscribed, onCaptureComplete, hasResult = false, onRetry, searchInventory = true }: ProductScannerCameraProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isPredicting, setIsPredicting] = useState(false);
    const [loadPhase, setLoadPhase] = useState<'model' | 'names' | 'embeddings' | 'ocr' | 'ready' | 'error' | 'offline'>('model');
    const [loadProgress, setLoadProgress] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [searchProducts] = useSearchShopProducts(isSubscribed);

    const assets = getCachedScannerAssets();
    const isReady = assets.isLoaded;

    useEffect(() => {
        initScannerAssets((status) => {
            if (status.phase === 'ready') {
                setTimeout(() => setLoadPhase(status.phase), 200);
            } else {
                setLoadPhase(status.phase);
            }
            setLoadProgress(status.progress);
        }).catch((err) => {
            console.error(err);
            // 'offline' is already set via the onProgress callback above right
            // before this rejection fires — don't stomp it back to 'error'.
            if (err?.name !== 'OfflineRequiredError') {
                setLoadPhase('error');
            }
        });
    }, [retryCount]);

    // While waiting on connectivity, retry automatically the moment the
    // browser reports it's back online — no user action required. A manual
    // "Retry now" button is still offered in case the online/offline event
    // doesn't fire reliably (some browsers are inconsistent about this,
    // especially on flaky connections where the OS thinks it's online but
    // requests still fail — that case will just loop back to 'offline' again).
    useEffect(() => {
        if (loadPhase !== 'offline') return;

        const handleOnline = () => {
            setLoadPhase('model');
            setLoadProgress(0);
            setRetryCount((prev) => prev + 1);
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [loadPhase]);

    const handleManualOfflineRetry = () => {
        // Deliberately does NOT call clearScannerCache() — whatever loaded
        // successfully before the offline failure is still valid and cached;
        // re-running init will skip straight past it and only re-attempt the
        // piece that actually needs the network.
        setLoadPhase('model');
        setLoadProgress(0);
        setRetryCount((prev) => prev + 1);
    };

    const startCamera = async () => {
        setCameraError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError("Webcams are blocked unless using localhost or HTTPS.");
            return;
        }

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.srcObject = null;
            }

            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.setAttribute("playsinline", "true");

                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        if (e.name !== "AbortError") {
                            console.error("Actual hardware playback failure:", e);
                        }
                    });
                }
            }
        } catch (err: any) {
            console.error(err);
            setCameraError("Camera access denied or device unavailable.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    useEffect(() => {
        if (isReady && loadPhase === 'ready') {
            startCamera();
        }
        return () => stopCamera();
    }, [isReady, loadPhase]);

    const preprocessImage = (imgElement: HTMLImageElement) => {
        return tf.tidy(() => {
            return tf.browser.fromPixels(imgElement)
                .resizeBilinear([IMG_SIZE, IMG_SIZE])
                .toFloat()
                .expandDims(0);
        });
    };

    /** Returns the visual model's top-N candidate product names, ranked closest-first. */
    const getTopVisualMatches = async (
        imgElement: HTMLImageElement,
        topN = TOP_N_CANDIDATES
    ): Promise<VisualMatch[]> => {
        const { model, names, embeddings } = getCachedScannerAssets();
        if (!model || !names || !embeddings) return [];

        const inputTensor = preprocessImage(imgElement);
        const predictions = model.predict(inputTensor);

        if (!Array.isArray(predictions) || predictions.length < 2) {
            inputTensor.dispose();
            return [];
        }

        const [layoutRaw, colorRaw] = predictions;

        const normalizedEmbedding = tf.tidy(() => {
            const layoutNorm = layoutRaw.div(layoutRaw.norm());
            const colorNorm = colorRaw.div(colorRaw.norm()).mul(COLOR_WEIGHT);
            const combined = tf.concat([layoutNorm, colorNorm], 1);
            return combined.div(combined.norm());
        });

        const distances = tf.tidy(() => {
            const diff = normalizedEmbedding.sub(embeddings);
            return diff.square().sum(1).sqrt();
        });

        const distancesArray = await distances.array() as number[];

        inputTensor.dispose();
        layoutRaw.dispose();
        colorRaw.dispose();
        normalizedEmbedding.dispose();
        distances.dispose();

        return distancesArray
            .map((distance, i) => ({ name: names[i], distance }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, topN);
    };

    /**
     * Runs the visual model and OCR in parallel off the same decoded image
     * element, resolves the final product identity, THEN searches this shop's
     * inventory for it — visual keys first, text fallback second (handled
     * server-side by searchShopProducts). Returns a single ScanOutcome so
     * callers never touch the search API themselves.
     */
    const identifyAndSearch = async (file: File, previewUrl: string, imgElement: HTMLImageElement): Promise<ScanOutcome> => {
        const ocrCanvas = imageElementToCanvas(imgElement);

        const [topCandidates, ocrText] = await Promise.all([
            getTopVisualMatches(imgElement),
            isOcrEngineReady() ? recognizeProductText(ocrCanvas) : Promise.resolve(''),
        ]);

        console.log('[Identify] Visual top candidates:', topCandidates.map(c => `${c.name} (${c.distance.toFixed(3)})`));
        console.log('[Identify] OCR text:', ocrText);

        const { name: suggestedName, unitOfMeasure, confidenceTier } = resolveProductIdentity(topCandidates, ocrText);

        // Send the full candidate list for SEARCH regardless of tier — a bad
        // guess here just fails to match and falls through to server-side
        // text search, no harm done. WRITING these as visual_class_keys is a
        // separate, stricter decision made below via shouldBindVisualClassKeys.
        const searchCandidateKeys = getTopVisualCandidateNames(topCandidates, VISUAL_CANDIDATE_KEY_LIMIT);
        const visualCandidateKeys = shouldBindVisualClassKeys(confidenceTier) ? searchCandidateKeys : [];

        if (!searchInventory || !shopId) {
            return {
                status: 'unmatched',
                file,
                previewUrl,
                suggestedName,
                unitOfMeasure,
                visualCandidateKeys,
                confidenceTier,
            };
        }

        try {
            const result: any = await searchProducts({
                variables: {
                    shopId: String(shopId),
                    query: suggestedName,
                    limit: SEARCH_RESULT_LIMIT,
                    offset: 0,
                    visualCandidates: searchCandidateKeys,
                },
            });

            const products: Product[] = result?.data?.searchShopProducts?.products || [];

            if (products.length > 0) {
                const firstProduct = products[0];
                const variants = products.filter(
                    (p) => p.itemName.toLowerCase() === firstProduct.itemName.toLowerCase()
                );

                return {
                    status: 'matched',
                    product: firstProduct,
                    variants,
                    file,
                    previewUrl,
                    visualCandidateKeys,
                    confidenceTier,
                };
            }
        } catch (err) {
            console.error('[Identify] Post-scan inventory search failed:', err);
            // Fall through to 'unmatched' below — don't strand the user.
        }

        return {
            status: 'unmatched',
            file,
            previewUrl,
            suggestedName,
            unitOfMeasure,
            visualCandidateKeys,
            confidenceTier,
        };
    };

    const handleCameraCapture = () => {
        if (!videoRef.current || !isReady || isPredicting || hasResult) return;

        setIsPredicting(true);

        const video = videoRef.current;

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        const containerWidth = video.clientWidth || 480;
        const containerHeight = video.clientHeight || 640;

        const canvas = document.createElement('canvas');
        canvas.width = containerWidth;
        canvas.height = containerHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setIsPredicting(false);
            return;
        }

        const scaleX = containerWidth / videoWidth;
        const scaleY = containerHeight / videoHeight;
        const scale = Math.max(scaleX, scaleY);

        const sourceWidth = containerWidth / scale;
        const sourceHeight = containerHeight / scale;
        const sourceX = (videoWidth - sourceWidth) / 2;
        const sourceY = (videoHeight - sourceHeight) / 2;

        ctx.drawImage(
            video,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, containerWidth, containerHeight
        );

        canvas.toBlob((blob) => {
            if (!blob) {
                setIsPredicting(false);
                return;
            }

            const capturedFile = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(capturedFile);

            const tempImg = new Image();
            tempImg.src = previewUrl;
            tempImg.onload = async () => {
                // 🚀 Camera intentionally left running — behind the AI Result card.
                const outcome = await identifyAndSearch(capturedFile, previewUrl, tempImg);
                setIsPredicting(false);
                onCaptureComplete(outcome);
            };
        }, 'image/jpeg', 0.85);
    };

    const handleRetryLoading = async () => {
        setLoadPhase('model');
        setLoadProgress(0);
        setCameraError(null);
        await clearScannerCache();
        setRetryCount(prev => prev + 1);
    };

    const handleGalleryUploadClick = () => {
        if (hasResult) return;
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || isPredicting || hasResult) return;

        setIsPredicting(true);
        const previewUrl = URL.createObjectURL(file);

        const tempImg = new Image();
        tempImg.src = previewUrl;
        tempImg.onload = async () => {
            // 🚀 Camera intentionally left running — same as handleCameraCapture above.
            const outcome = await identifyAndSearch(file, previewUrl, tempImg);
            setIsPredicting(false);
            onCaptureComplete(outcome);
        };
    };

    const handleRetryTap = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onRetry?.();
    };

    if (loadPhase === 'offline') {
        return (
            <div className="relative flex flex-col flex-1 w-full bg-bg-secondary h-full min-h-[400px] items-center justify-center text-white px-8">
                <div className="w-full max-w-xs flex flex-col items-center gap-3 text-center">
                    <WifiOff className="w-8 h-8 text-amber-400" />
                    <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                        Internet Required
                    </div>
                    <p className="text-[11px] text-text-main leading-normal">
                        The scanner needs to redownload some files and can't reach the network right now.
                        It'll resume automatically as soon as you're back online.
                    </p>
                    <button
                        type="button"
                        onClick={handleManualOfflineRetry}
                        className="mt-2 px-5 py-2 text-xs font-bold text-[#3f3f3f] bg-[#d9d9d9] hover:bg-white active:scale-95 transition-all rounded-md cursor-pointer shadow-md focus:outline-none"
                    >
                        Retry Now
                    </button>
                </div>
            </div>
        );
    }

    if (loadPhase !== 'ready') {
        return (
            <div className="relative flex flex-col flex-1 w-full bg-bg-secondary h-full min-h-[400px] items-center justify-center text-white px-8">
                <div className="w-full max-w-xs flex flex-col items-center gap-3">
                    {loadPhase === 'error' ? (
                        <div className="flex flex-col items-center gap-3 text-center w-full">
                            <TriangleAlert className="w-8 h-8 text-red-400" />
                            <div className="text-xs font-semibold uppercase tracking-wider text-red-400">
                                Initialization Failed
                            </div>
                            <p className="text-[11px] text-text-main leading-normal">
                                Failed to stream neural network assets or reference vectors from server channels.
                            </p>
                            <button
                                type="button"
                                onClick={handleRetryLoading}
                                className="mt-2 px-5 py-2 text-xs font-bold text-[#3f3f3f] bg-[#d9d9d9] hover:bg-white active:scale-95 transition-all rounded-md cursor-pointer shadow-md focus:outline-none"
                            >
                                Retry Connection
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-main"></div>
                            <div className="text-xs font-semibold text-text-main uppercase tracking-wider opacity-70">
                                {loadPhase === 'model' && 'Downloading Neural Weights...'}
                                {loadPhase === 'names' && 'Syncing Registry Catalog...'}
                                {loadPhase === 'embeddings' && 'Loading Vector Gallery...'}
                                {loadPhase === 'ocr' && 'Preparing Text Recognition...'}
                            </div>
                            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className="bg-[var(--color-brand-gold)] h-full transition-all duration-150 ease-out" style={{ width: `${loadProgress}%` }} />
                            </div>
                            <span className="text-[11px] font-bold text-text-main/50">{loadProgress}%</span>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col flex-1 w-full bg-bg-secondary h-full min-h-0">
            {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3 text-white">
                    <span className="text-3xl"><TriangleAlert /></span>
                    <p className="text-sm font-semibold opacity-90">{cameraError}</p>
                    <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-1.5 text-xs font-bold text-text-main bg-bg-primary hover:bg-bg-primary-hover rounded-md transition-colors cursor-pointer"
                    >
                        Try Again
                    </button>
                </div>
            ) : (
                <div className="relative flex-1 w-full h-full min-h-0 ">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover bg-bg-secondary"
                    />

                    {isPredicting && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-20 flex flex-col items-center justify-center text-white gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            <p className="text-sm font-bold tracking-wide">Matching product identity...</p>
                        </div>
                    )}

                    <div className="absolute bottom-6 inset-x-0 flex justify-center items-center z-10 px-8">
                        <div className="relative w-full max-w-[280px] flex items-center justify-center">

                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleGalleryFileChange}
                                className="hidden"
                            />

                            <button
                                type="button"
                                disabled={isPredicting || hasResult}
                                onClick={handleGalleryUploadClick}
                                className="absolute left-0 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white/90 transition-all border border-white/10 cursor-pointer shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ImageIcon className="w-5 h-5" />
                            </button>

                            <button
                                type="button"
                                disabled={isPredicting || hasResult}
                                onClick={handleCameraCapture}
                                className="w-14 h-14 rounded-full bg-[#d9d9d9] hover:bg-white border-4 border-[#3f3f3f]/40 shadow-lg transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                            />

                            {hasResult && (
                                <button
                                    type="button"
                                    onClick={handleRetryTap}
                                    className="absolute right-0 p-2.5 rounded-full bg-brand-gold/90 hover:bg-brand-gold text-white transition-all border border-white/10 cursor-pointer shadow-md active:scale-95"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};