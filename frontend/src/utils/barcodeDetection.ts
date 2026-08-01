// ~/utils/barcodeDetection.ts
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat, NotFoundException, ChecksumException, FormatException } from '@zxing/library';
import type { IScannerControls } from '@zxing/browser';

let readerInstance: BrowserMultiFormatReader | null = null;

const getReader = (): BrowserMultiFormatReader => {
    if (!readerInstance) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
        ]);
        // 🚀 REMOVED: TRY_HARDER. Its 1D-rotation attempt (rotating the
        // frame to try scanning at different angles) triggers a crash in
        // this environment — "Could not create a Canvas element" inside
        // ZXing's internal rotate() step. Not needed for a clear,
        // reasonably-aligned shot; a plain single-pass decode handles that
        // fine, and this sidesteps the buggy code path entirely.
        //
        // Even less needed now that live scanning gets many frames a
        // second instead of one still photo — re-adding it here would just
        // reintroduce the crash risk on every frame instead of once.
        readerInstance = new BrowserMultiFormatReader(hints);
    }
    return readerInstance;
};

export interface DetectedBarcode {
    rawValue: string;
    format: string;
}

export interface BarcodeScanControls {
    stop: () => void;
}

/** One-shot decode from a static image (existing behavior — still used as
 *  a fallback for gallery-picked images, where there's no live feed to watch). */
export const detectBarcodeFromImage = async (imgElement: HTMLImageElement): Promise<DetectedBarcode | null> => {
    console.log('[Barcode] Attempting to detect barcode from image element:', imgElement);
    try {
        const result = await getReader().decodeFromImageElement(imgElement);

        console.log('[Barcode] Detected:', result.getText(), 'format:', BarcodeFormat[result.getBarcodeFormat()]);
        return {
            rawValue: result.getText(),
            format: BarcodeFormat[result.getBarcodeFormat()],
        };
    } catch (err) {
        if (err instanceof NotFoundException || err instanceof ChecksumException || err instanceof FormatException) {
            return null;
        }
        console.error('[Barcode] Unexpected decode error:', err);
        return null;
    }
};

/**
 * NEW: continuously decodes frames from an already-playing <video> element
 * (your existing camera stream — this does NOT request its own camera or
 * touch getUserMedia, it just reads whatever is already on the element).
 * `onDetected` fires once per successful decode; call `.stop()` on the
 * returned controls as soon as you get a hit you're acting on, since the
 * reader keeps decoding frames until told to stop.
 */
export const watchVideoForBarcode = async (
    videoElement: HTMLVideoElement,
    onDetected: (barcode: DetectedBarcode) => void
): Promise<BarcodeScanControls> => {
    const controls: IScannerControls = await getReader().decodeFromVideoElement(
        videoElement,
        (result, err) => {
            if (result) {
                console.log('[Barcode] Live detect:', result.getText(), 'format:', BarcodeFormat[result.getBarcodeFormat()]);
                onDetected({
                    rawValue: result.getText(),
                    format: BarcodeFormat[result.getBarcodeFormat()],
                });
                return;
            }
            // NotFoundException fires on basically every frame with no
            // barcode in view — that's expected noise, not an error.
            if (err && !(err instanceof NotFoundException || err instanceof ChecksumException || err instanceof FormatException)) {
                console.error('[Barcode] Unexpected live decode error:', err);
            }
        }
    );

    return { stop: () => controls.stop() };
};