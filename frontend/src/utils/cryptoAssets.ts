// ~/utils/cryptoAssets.ts
//
// Runtime counterpart to scripts/encrypt-assets.mjs. Decrypts the opaque
// .bin files produced by that script, entirely in-memory, using the native
// Web Crypto API (crypto.subtle) — no dependency, works offline, fast.
//
// Layout assumed per file (must match encrypt-assets.mjs's output):
//   [12-byte IV][ciphertext][16-byte auth tag]
//
// IMPORTANT: callers should decrypt AFTER cachedTrackDownload/getAsset,
// never store the decrypted result back into the durable asset store.
// Only ciphertext should ever land in IndexedDB — see initScannerAssets.ts
// for the intended call order.

import { getRawKeyBytes } from './assetCryptoKey.mjs';

const IV_LENGTH = 12;
const MIN_ENCRYPTED_LENGTH = IV_LENGTH + 16; // IV + auth tag, ciphertext can be 0 bytes

let cryptoKeyPromise: Promise<CryptoKey> | null = null;

const getCryptoKey = (): Promise<CryptoKey> => {
    if (cryptoKeyPromise) return cryptoKeyPromise;
    const keyBytes = new Uint8Array(getRawKeyBytes()); // re-wrap: guarantees ArrayBuffer-backed, not ArrayBufferLike
    cryptoKeyPromise = crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    );
    return cryptoKeyPromise;
};

/**
 * Quick shape check before attempting decryption — lets cachedTrackDownload's
 * `validate` callback reject a truncated/corrupted cached entry the same way
 * it already does for the unencrypted assets, before we even try WebCrypto.
 */
export const isValidEncryptedShape = (data: unknown): data is ArrayBuffer =>
    data instanceof ArrayBuffer && data.byteLength >= MIN_ENCRYPTED_LENGTH;

/**
 * Decrypts an encrypted asset buffer (IV + ciphertext + tag) back to its
 * original ArrayBuffer. Throws if the key/tag don't match — GCM is
 * authenticated, so any corruption or tampering fails loudly here rather
 * than silently returning garbage bytes.
 */
export const decryptToArrayBuffer = async (encrypted: ArrayBuffer): Promise<ArrayBuffer> => {
    if (!isValidEncryptedShape(encrypted)) {
        throw new Error('Encrypted asset too short to contain IV + auth tag');
    }

    const bytes = new Uint8Array(encrypted);
    const iv = bytes.slice(0, IV_LENGTH);
    const ciphertextAndTag = bytes.slice(IV_LENGTH); // WebCrypto expects tag appended to ciphertext — matches our layout

    const key = await getCryptoKey();
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextAndTag);
};

/** Convenience wrapper for the common case: decrypt then JSON.parse. */
export const decryptToJson = async <T = unknown>(encrypted: ArrayBuffer): Promise<T> => {
    const plainBuf = await decryptToArrayBuffer(encrypted);
    const text = new TextDecoder('utf-8').decode(plainBuf);
    const parsed = JSON.parse(text) as T;

    // TEMP: confirms decryption actually ran and produced valid JSON.
    // Remove or gate behind a dev flag before shipping to prod.
    console.log('[cryptoAssets] Decrypted payload OK:', {
        encryptedBytes: encrypted.byteLength,
        decryptedBytes: plainBuf.byteLength,
        preview: JSON.stringify(parsed).slice(0, 100) + '...',
    });

    return parsed;
};