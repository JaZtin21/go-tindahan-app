// ~/utils/barcodeDetection.ts
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat, NotFoundException, ChecksumException, FormatException } from '@zxing/library';

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
        readerInstance = new BrowserMultiFormatReader(hints);
    }
    return readerInstance;
};

export interface DetectedBarcode {
    rawValue: string;
    format: string;
}

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