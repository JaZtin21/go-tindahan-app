import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { initScannerAssets, getCachedScannerAssets, clearScannerCache } from '~/utils/scannerModelManager';
import { TriangleAlert, ImageIcon, RotateCcw } from 'lucide-react';

interface ProductScannerCameraProps {
    onCaptureComplete: (file: File, previewUrl: string, matchedName: string, unitOfMeasure: string) => void;
    // 🚀 NEW: when true, a result is currently showing over the live feed.
    // Capture/gallery disable and a Retry button takes their place.
    hasResult?: boolean;
    // 🚀 NEW: fired when the Retry button is tapped — parent clears the result state.
    onRetry?: () => void;
}

const IMG_SIZE = 224;
const COLOR_WEIGHT = 1.5;

export const ProductScannerCamera = ({ onCaptureComplete, hasResult = false, onRetry }: ProductScannerCameraProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isPredicting, setIsPredicting] = useState(false);
    const [loadPhase, setLoadPhase] = useState<'model' | 'names' | 'embeddings' | 'ready' | 'error'>('model');
    const [loadProgress, setLoadProgress] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const assets = getCachedScannerAssets();
    const isReady = assets.isLoaded;

    useEffect(() => {
        initScannerAssets((status) => {
            if (status.phase === 'ready') {
                setTimeout(() => setLoadPhase(status.phase), 200);
            } else {
                setLoadPhase(status.phase)
            }
            ;

            setLoadProgress(status.progress);
        }).catch((err) => {
            console.error(err);
            setLoadPhase('error');
        });
    }, [retryCount]);

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

    const matchProductImage = async (imgElement: HTMLImageElement): Promise<string> => {
        const { model, names, embeddings } = getCachedScannerAssets();
        if (!model || !names || !embeddings) {
            return 'Captured Item';
        }

        const inputTensor = preprocessImage(imgElement);
        const predictions = model.predict(inputTensor);

        if (!Array.isArray(predictions) || predictions.length < 2) {
            inputTensor.dispose();
            return 'Captured Item';
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

        let minIndex = 0;
        let minDistance = distancesArray[0];

        for (let i = 1; i < distancesArray.length; i++) {
            if (distancesArray[i] < minDistance) {
                minDistance = distancesArray[i];
                minIndex = i;
            }
        }

        return names[minIndex] || 'Unknown Product';
    };

    const handleCameraCapture = () => {
        if (!videoRef.current || !isReady || isPredicting || hasResult) return;

        setIsPredicting(true);

        const video = videoRef.current;

        // 1. Get raw hardware video track sizes
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // 2. Get the visual container rendering sizes from the DOM bounding rect
        const containerWidth = video.clientWidth || 480;
        const containerHeight = video.clientHeight || 640;

        // 3. Create a canvas matching the EXACT aspect ratio proportions of your screen container box
        const canvas = document.createElement('canvas');
        canvas.width = containerWidth;
        canvas.height = containerHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setIsPredicting(false);
            return;
        }

        // 4. Compute CSS 'object-cover' scaling factor match boundaries
        const scaleX = containerWidth / videoWidth;
        const scaleY = containerHeight / videoHeight;
        const scale = Math.max(scaleX, scaleY);

        // 5. Determine the precise center crop offset pixel coordinates on the raw hardware track frame
        const sourceWidth = containerWidth / scale;
        const sourceHeight = containerHeight / scale;
        const sourceX = (videoWidth - sourceWidth) / 2;
        const sourceY = (videoHeight - sourceHeight) / 2;

        // 6. Draw ONLY the centered cropped box onto your canvas context area canvas sheet
        ctx.drawImage(
            video,
            sourceX, sourceY, sourceWidth, sourceHeight, // Source crop bounds on the raw video stream
            0, 0, containerWidth, containerHeight        // Destination bounds matching the visible box layout
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
                const matchedName = await matchProductImage(tempImg);

                // 🚀 NOTE: camera is intentionally left running here.
                // The live feed should keep going behind the AI Result card —
                // it only stops when this component unmounts (e.g. moving to the manual form)
                // or the user backs out of the scanner entirely.

                let cleanName = matchedName;
                let unitOfMeasure = '';

                const measureRegex = /(\d+(?:\.\d+)?\s*(?:g|kg|ml|l|oz|pcs|pc|pack|pk|bx|bags))$/i;
                const match = matchedName.match(measureRegex);

                if (match) {
                    unitOfMeasure = match[1].toLowerCase().replace(/\s+/g, '');
                    cleanName = matchedName.replace(measureRegex, '').trim();
                }

                if (cleanName.endsWith('-') || cleanName.endsWith(',')) {
                    cleanName = cleanName.slice(0, -1).trim();
                }

                setIsPredicting(false); // 🚀 reset so buttons re-enable correctly once retry happens
                onCaptureComplete(capturedFile, previewUrl, cleanName, unitOfMeasure);
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
            const matchedName = await matchProductImage(tempImg);

            // 🚀 Camera intentionally left running — same as handleCameraCapture above.

            let cleanName = matchedName;
            let unitOfMeasure = '';

            const measureRegex = /(\d+(?:\.\d+)?\s*(?:g|kg|ml|l|oz|pcs|pc|pack|pk|bx|bags))$/i;
            const match = matchedName.match(measureRegex);

            if (match) {
                unitOfMeasure = match[1].toLowerCase().replace(/\s+/g, '');
                cleanName = matchedName.replace(measureRegex, '').trim();
            }

            if (cleanName.endsWith('-') || cleanName.endsWith(',')) {
                cleanName = cleanName.slice(0, -1).trim();
            }

            setIsPredicting(false); // 🚀 reset so buttons re-enable correctly once retry happens
            onCaptureComplete(file, previewUrl, cleanName, unitOfMeasure);
        };
    };

    const handleRetryTap = () => {
        // Reset the file input so re-selecting the same gallery file later still fires onChange
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onRetry?.();
    };


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

                            {/* 🚀 NEW: Retry button — takes the place of the third (help) slot,
                                only appears once a result is showing over the live feed. */}
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