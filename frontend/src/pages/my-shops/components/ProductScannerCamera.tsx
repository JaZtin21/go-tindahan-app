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
import { TriangleAlert, ImageIcon, RotateCcw, WifiOff, ScanLine } from 'lucide-react';
import { useSearchShopProducts } from '~/api/queries';
import type { Product } from '~/types/item';
import { detectBarcodeFromImage, watchVideoForBarcode, type DetectedBarcode, type BarcodeScanControls } from '~/utils/barcodeDetection';

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
        scannedBarcode?: string; // set only when this came from a barcode that didn't match anything
    };

interface ProductScannerCameraProps {
    shopId: string;
    isSubscribed: boolean;
    onCaptureComplete: (outcome: ScanOutcome) => void;
    hasResult?: boolean;
    onRetry?: () => void;
    // false for flows where a match is meaningless (Add Item — the whole
    // point is the item doesn't exist yet). Defaults true so
    // ScannerTab/RestockScannerTab need no changes.
    searchInventory?: boolean;
    // parent-controlled kill switch. Whatever ultimately owns the
    // "is this modal/screen open" boolean (Checkout, Restock, InventoryForm,
    // etc.) should pass that boolean straight through here, all the way
    // down, no matter how many components sit in between. The moment it
    // flips to false, the camera hardware is released — regardless of
    // whether this component happens to unmount at the same time or not.
    // This is necessary because some Modal implementations keep children
    // mounted and only hide them visually, which means unmount-based
    // cleanup (the effect below) would otherwise never run.
    active?: boolean;
}

const IMG_SIZE = 224;
const COLOR_WEIGHT = 1.5;
const TOP_N_CANDIDATES = 10;
const VISUAL_CANDIDATE_KEY_LIMIT = 5;
const SEARCH_RESULT_LIMIT = 7;

export const ProductScannerCamera = ({
    shopId,
    isSubscribed,
    onCaptureComplete,
    hasResult = false,
    onRetry,
    searchInventory = true,
    active = true,
}: ProductScannerCameraProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // streamRef mirrors `stream` state but is mutated synchronously and in
    // place. `stopCamera` reads from this instead of the `stream` state
    // variable, because a closure over `stream` captured at effect-setup
    // time can go stale (startCamera is async — by the time getUserMedia
    // resolves and setStream(...) fires, an earlier-captured cleanup closure
    // may still be holding a null `stream` and silently no-op). Reading a
    // ref always gets the true current value regardless of which render's
    // closure is calling stopCamera.
    const streamRef = useRef<MediaStream | null>(null);

    // Single source of truth for "a capture is currently in flight" — set
    // synchronously the instant either the manual shutter or the live
    // barcode watcher decides to capture. This replaces three separate refs
    // from an earlier pass (isPredictingRef, hasResultRef,
    // autoCaptureTriggeredRef): those mirrored state via a useEffect, which
    // lags one tick behind the actual change and left a real race window —
    // e.g. a burst of frames from the video watcher, or a manual tap landing
    // in the same instant the watcher auto-fires, could both slip through.
    // Setting this flag directly at the decision point (not via a state
    // mirror) closes that gap. It's reset to false wherever a fresh capture
    // cycle is armed: at the top of startBarcodeWatch, and implicitly
    // whenever the arming effect below re-runs after hasResult/isPredicting
    // clear.
    const captureInFlightRef = useRef(false);

    // holds the live barcode watcher's stop handle, same category as
    // streamRef above — an imperative handle to an ongoing operation, not
    // render data.
    const barcodeScanControlsRef = useRef<BarcodeScanControls | null>(null);
    const [barcodeArmed, setBarcodeArmed] = useState(false);

    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isPredicting, setIsPredicting] = useState(false);
    const [loadPhase, setLoadPhase] = useState<'model' | 'names' | 'embeddings' | 'ocr' | 'ready' | 'error' | 'offline'>('model');
    const [loadProgress, setLoadProgress] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [searchProducts] = useSearchShopProducts(isSubscribed);

    const assets = getCachedScannerAssets();
    const isReady = assets.isLoaded;

    // Auto-capture-on-barcode only makes sense when a detected code can
    // actually be looked up against something — matches the existing gate
    // in identifyAndSearch (`searchInventory && shopId`). Without it a
    // detected barcode wouldn't be used for anything anyway.
    const canAutoScanBarcode = searchInventory && !!shopId;

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

    // Starts continuously decoding frames straight off the live <video> feed
    // (not a still photo), so a barcode gets many chances per second instead
    // of depending on one sharp capture. The moment a code is found we stop
    // the watcher and hand it straight to handleCameraCapture, which reuses
    // it instead of re-decoding the (possibly blurrier) frozen frame it grabs.
    const startBarcodeWatch = () => {
        if (!videoRef.current || !canAutoScanBarcode) return;
        stopBarcodeWatch();
        captureInFlightRef.current = false; // arming a fresh watch — clear any prior guard

        watchVideoForBarcode(videoRef.current, (barcode) => {
            // Guards against: (a) a burst of frames from the same barcode
            // firing this callback multiple times before .stop() takes
            // effect, and (b) a manual shutter tap landing in the same
            // instant the watcher fires. Single synchronous check, no
            // state-mirror lag.
            if (captureInFlightRef.current) return;
            captureInFlightRef.current = true;
            stopBarcodeWatch();
            handleCameraCapture(barcode);
        })
            .then((controls) => {
                // Watch may have already fired (and captureInFlightRef
                // flipped true) while the reader was still spinning up —
                // don't hang onto a stale controls handle in that case.
                if (captureInFlightRef.current) {
                    controls.stop();
                    return;
                }
                barcodeScanControlsRef.current = controls;
                setBarcodeArmed(true);
            })
            .catch((err) => {
                console.error('[ProductScannerCamera] failed to start live barcode watch:', err);
            });
    };

    const stopBarcodeWatch = () => {
        if (barcodeScanControlsRef.current) {
            barcodeScanControlsRef.current.stop();
            barcodeScanControlsRef.current = null;
        }
        setBarcodeArmed(false);
    };

    const startCamera = async () => {
        // Guard: never open the camera on behalf of a parent that has
        // already told us it's inactive (e.g. loadPhase flips to 'ready'
        // right as/after the parent modal closes).
        if (!active) return;

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

            // If `active` flipped to false while we were awaiting permission,
            // don't attach the stream — immediately release it instead.
            if (!active) {
                mediaStream.getTracks().forEach(track => track.stop());
                return;
            }

            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.srcObject = null;
            }

            streamRef.current = mediaStream;

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
        stopBarcodeWatch();
        if (streamRef.current) {
            console.log('[ProductScannerCamera] stopping camera tracks');
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    useEffect(() => {
        if (isReady && loadPhase === 'ready' && active) {
            console.log('[ProductScannerCamera] starting camera');
            startCamera();
        }
        return () => stopCamera();
    }, [isReady, loadPhase]);

    // Parent-driven stop, independent of our own mount lifecycle. This is
    // what actually fixes "modal closes but camera light stays on" when the
    // Modal component keeps children mounted and only hides them visually —
    // that scenario never runs the effect cleanup above, so we need a
    // dedicated effect that reacts to `active` directly.
    useEffect(() => {
        if (!active) {
            stopCamera();
        }
    }, [active]);

    // Keeps the live barcode watcher's on/off state in sync with
    // isPredicting/hasResult/active. This is what makes the watcher resume
    // after a retry (hasResult flips back to false) or after a finished
    // capture (isPredicting flips back to false) — cases where the video
    // element is already playing and never fires another native `playing`
    // event, so something has to explicitly kick the watch back on.
    useEffect(() => {
        if (!canAutoScanBarcode) {
            stopBarcodeWatch();
            return;
        }
        if (!active || hasResult || isPredicting) {
            stopBarcodeWatch();
            return;
        }
        if (videoRef.current && streamRef.current) {
            startBarcodeWatch();
        }
        return () => stopBarcodeWatch();
    }, [canAutoScanBarcode, active, hasResult, isPredicting]);

    // Fires once the live stream actually starts rendering frames — the
    // most reliable point to arm the watcher on first camera start (before
    // this, video.videoWidth/height are still 0 and there's nothing to
    // decode yet). Subsequent restarts (retry, post-capture) are handled by
    // the effect above instead, since `playing` won't fire again for an
    // already-playing element.
    const handleVideoPlaying = () => {
        if (canAutoScanBarcode && active && !hasResult && !isPredicting) {
            startBarcodeWatch();
        }
    };

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
     *
     * `preDetectedBarcode`, when provided, comes from the live-feed watcher
     * (startBarcodeWatch) that already found a clean decode from the video
     * stream itself — in that case we trust it outright and skip re-running
     * detectBarcodeFromImage against the just-captured still frame, since
     * that frame can be blurrier than the live frame the watcher actually
     * decoded (motion blur from the capture itself, JPEG re-encode, etc).
     */
    const identifyAndSearch = async (
        file: File,
        previewUrl: string,
        imgElement: HTMLImageElement,
        preDetectedBarcode?: DetectedBarcode | null
    ): Promise<ScanOutcome> => {
        // If preDetectedBarcode was passed at all, this capture was
        // AUTO-TRIGGERED by the live barcode watcher — meaning the entire
        // point of this capture is the barcode. Vision/OCR must NEVER run for
        // this path, period — not as a fallback, not on a failed lookup, not
        // on a network error. Vision/OCR only ever runs for a MANUAL capture
        // (shutter tap / gallery pick), where preDetectedBarcode is always
        // undefined and detectBarcodeFromImage() is what decides if a barcode
        // is even in play.
        const isAutoBarcodeCapture = preDetectedBarcode !== undefined && preDetectedBarcode !== null;

        console.log('scanning image for barcode...');

        const detectedBarcode = isAutoBarcodeCapture
            ? preDetectedBarcode
            : await detectBarcodeFromImage(imgElement);

        if (detectedBarcode) {
            console.log('[Identify] Barcode detected:', detectedBarcode.rawValue, detectedBarcode.format);
        }

        if (detectedBarcode && searchInventory && shopId) {
            try {
                const barcodeResult: any = await searchProducts({
                    variables: {
                        shopId: String(shopId),
                        query: detectedBarcode.rawValue,
                        limit: SEARCH_RESULT_LIMIT,
                        offset: 0,
                        // Sentinel — tells the backend this is an exclusive
                        // barcode-mode search (Layer 0 in SearchShopProducts),
                        // not a vision-candidate array. Backend returns either
                        // exactly one product or empty; never falls through to
                        // Layer 1/2 for this request.
                        visualCandidates: ['barcode'],
                    },
                });

                const barcodeProducts: Product[] = barcodeResult?.data?.searchShopProducts?.products || [];

                if (barcodeProducts.length > 0) {
                    const barcodeHit = barcodeProducts[0];
                    return {
                        status: 'matched',
                        product: barcodeHit,
                        variants: [barcodeHit], // a barcode is 1:1 with a specific SKU — no itemName grouping needed
                        file,
                        previewUrl,
                        visualCandidateKeys: [], // not a vision guess — nothing worth binding/teaching the model
                        confidenceTier: 'barcode',
                    };
                }

                // Valid barcode, nothing registered to it in this shop yet.
                // For a MANUAL capture, old behavior stands: fall through to
                // vision+OCR so the user still gets a suggested name. For an
                // AUTO barcode capture, that fallback is exactly what you don't
                // want — bail out here with the barcode itself so the caller
                // can prefill an "add new item" form, and stop.
                if (isAutoBarcodeCapture) {
                    return {
                        status: 'unmatched',
                        file,
                        previewUrl,
                        suggestedName: '',
                        unitOfMeasure: '',
                        visualCandidateKeys: [],
                        confidenceTier: 'barcode',
                        scannedBarcode: detectedBarcode.rawValue,
                    };
                }
            } catch (err) {
                console.error('[Identify] Barcode search failed:', err);
                if (isAutoBarcodeCapture) {
                    // Same rule applies to a network hiccup — auto-capture
                    // still does not fall through to vision.
                    return {
                        status: 'unmatched',
                        file,
                        previewUrl,
                        suggestedName: '',
                        unitOfMeasure: '',
                        visualCandidateKeys: [],
                        confidenceTier: 'barcode',
                        scannedBarcode: detectedBarcode.rawValue,
                    };
                }
                // fall through to vision+OCR below for MANUAL captures only —
                // don't strand the user on a network hiccup
            }
        }

        // Hard stop: an auto-triggered capture should always have returned
        // above (matched, or unmatched-with-scannedBarcode). This guard
        // exists only so a future refactor can't accidentally let an
        // auto-capture fall through to vision/OCR below by mistake.
        if (isAutoBarcodeCapture) {
            return {
                status: 'unmatched',
                file,
                previewUrl,
                suggestedName: '',
                unitOfMeasure: '',
                visualCandidateKeys: [],
                confidenceTier: 'barcode',
                scannedBarcode: preDetectedBarcode?.rawValue,
            };
        }

        console.log('running visual model and OCR instead');

        // --- existing vision + OCR pipeline, UNCHANGED below this line, and
        // now ONLY reachable from a manual capture ---

        const ocrCanvas = imageElementToCanvas(imgElement);

        const [topCandidates, ocrText] = await Promise.all([
            getTopVisualMatches(imgElement),
            isOcrEngineReady() ? recognizeProductText(ocrCanvas) : Promise.resolve(''),
        ]);

        console.log('[Identify] Visual top candidates:', topCandidates.map(c => `${c.name} (${c.distance.toFixed(3)})`));
        console.log('[Identify] OCR text:', ocrText);

        const { name: suggestedName, unitOfMeasure, confidenceTier } = resolveProductIdentity(topCandidates, ocrText);

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

    // Accepts an optional pre-detected barcode so the live watcher
    // (startBarcodeWatch) can trigger a capture and hand its already-decoded
    // result straight through, instead of forcing identifyAndSearch to
    // re-decode the freshly-captured (potentially blurrier) still frame.
    // Manual taps on the shutter button still call this with no argument.
    //
    // Note: captureInFlightRef is set by the CALLER (startBarcodeWatch, or
    // the shutter button's onClick) before this runs, not inside this
    // function — that's what makes the guard synchronous relative to the
    // event that triggered the capture, closing the race the earlier
    // multi-ref version had.
    const handleCameraCapture = (preDetectedBarcode?: DetectedBarcode) => {
        if (!videoRef.current || !isReady) return;

        setIsPredicting(true);
        stopBarcodeWatch();

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
            captureInFlightRef.current = false;
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
                captureInFlightRef.current = false;
                return;
            }

            const capturedFile = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(capturedFile);

            const tempImg = new Image();
            tempImg.src = previewUrl;
            tempImg.onload = async () => {
                // Camera intentionally left running — behind the AI Result card.
                const outcome = await identifyAndSearch(capturedFile, previewUrl, tempImg, preDetectedBarcode);
                setIsPredicting(false);
                onCaptureComplete(outcome);
                // Deliberately NOT resetting captureInFlightRef here — hasResult
                // will flip true from the caller's outcome handling, which the
                // arming effect treats as "stay stopped" anyway. It gets reset
                // back to false at the top of startBarcodeWatch the next time
                // arming actually happens (e.g. after onRetry).
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

        captureInFlightRef.current = true;
        setIsPredicting(true);
        stopBarcodeWatch();
        const previewUrl = URL.createObjectURL(file);

        const tempImg = new Image();
        tempImg.src = previewUrl;
        tempImg.onload = async () => {
            // Camera intentionally left running — same as handleCameraCapture above.
            // No pre-detected barcode here — this is a static picked image, not
            // the live feed, so identifyAndSearch falls back to its own
            // detectBarcodeFromImage call on it.
            const outcome = await identifyAndSearch(file, previewUrl, tempImg);
            setIsPredicting(false);
            onCaptureComplete(outcome);
        };
    };

    const handleShutterTap = () => {
        if (isPredicting || hasResult || captureInFlightRef.current) return;
        captureInFlightRef.current = true;
        handleCameraCapture();
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
                    <span className="text-3xl text-brand-red"><TriangleAlert /></span>
                    <p className="text-sm text-text-main font-semibold opacity-90">{cameraError}</p>
                    <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-1.5 text-xs font-bold text-text-white bg-brand-gold hover:bg-brand-gold-hover rounded-md transition-colors cursor-pointer"
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
                        onPlaying={handleVideoPlaying}
                        className="absolute inset-0 w-full h-full object-cover bg-bg-secondary"
                    />

                    {/* Subtle indicator that live barcode auto-capture is
                        armed, so the auto-trigger doesn't feel invisible/magic. */}
                    {barcodeArmed && !isPredicting && (
                        <div className="absolute top-4 inset-x-0 flex justify-center z-10 pointer-events-none">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 text-white/90 text-[11px] font-semibold tracking-wide">
                                <ScanLine className="w-3.5 h-3.5" />
                                Point at a barcode or product
                            </div>
                        </div>
                    )}

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
                                onClick={handleShutterTap}
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