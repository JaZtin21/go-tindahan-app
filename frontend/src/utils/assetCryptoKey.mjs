// ~/utils/assetCryptoKey.mjs
//
// Shared AES-256-GCM key for asset-at-rest obfuscation, used by BOTH:
//   - scripts/encrypt-assets.mjs (Node, build time)
//   - utils/cryptoAssets.ts       (browser, runtime)
//
// This key ships inside your JS bundle. Anyone who runs the app and sets a
// breakpoint after decryption (or greps the built bundle for this array)
// gets the key and the plaintext. That's expected — this stops "download
// one file from the Network tab," not a determined reverse engineer.
//
// Split into two halves and combined at import time purely so the full key
// doesn't appear as one contiguous 32-byte literal to a naive text search
// of the bundle. This is cosmetic, not cryptographic.

const KEY_PART_A = [
    0x4e, 0x2b, 0x7a, 0x9c, 0x1d, 0x88, 0x33, 0x5f,
    0xa1, 0x6e, 0xc4, 0x02, 0x77, 0x9b, 0x1a, 0xf0,
];

const KEY_PART_B = [
    0x63, 0xd8, 0x0e, 0x5c, 0x91, 0x2f, 0xba, 0x44,
    0x17, 0xe9, 0x3d, 0x8a, 0x6b, 0x00, 0xcf, 0x59,
];

/** @returns {Uint8Array} 32-byte (256-bit) AES key */
export const getRawKeyBytes = () => new Uint8Array([...KEY_PART_A, ...KEY_PART_B]);