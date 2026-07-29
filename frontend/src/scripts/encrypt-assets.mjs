// scripts/encrypt-assets.mjs
//
// Build-time step: run this BEFORE deploying, whenever the source reference
// files change. Reads the plaintext reference class names file, encrypts it
// with AES-256-GCM, and writes an opaque renamed .bin file into /public.
//
// Output layout: [12-byte IV][ciphertext][16-byte auth tag]
// (Node's GCM cipher appends the tag automatically via cipher.getAuthTag()
// after final() — we append it ourselves so the browser side can slice it
// back out without any extra metadata/manifest file.)
//
// Usage:
//   node scripts/encrypt-assets.mjs
//
// Add this as a pre-deploy / prebuild npm script, e.g.:
//   "scripts": { "prebuild": "node scripts/encrypt-assets.mjs" }

import { createCipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getRawKeyBytes } from '../utils/assetCryptoKey.mjs';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // standard/recommended for GCM

// Map: [source plaintext path, output opaque path]
// Renamed filename is intentionally generic/non-descriptive — no "ref",
// "class", "names" etc. in the name, so the Network tab gives no hint
// about what the file is or what it's for.
//
// reference_embeddings.bin is intentionally NOT in this list — it's 19MB
// and, unlike the class names, is not by itself useful to a scraper without
// the model + names to interpret it. Only the small, high-value file gets
// encrypted.
const FILES_TO_ENCRYPT = [
    ['public/reference_class_names.json', 'public/ref-a1.bin'],
];

const encryptFile = async (srcPath, outPath, keyBytes) => {
    const plaintext = await readFile(resolve(srcPath));
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGO, keyBytes, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag(); // 16 bytes

    const output = Buffer.concat([iv, ciphertext, authTag]);
    await writeFile(resolve(outPath), output);

    console.log(
        `[encrypt-assets] ${srcPath} (${plaintext.length}B) -> ${outPath} (${output.length}B)`
    );
};

const main = async () => {
    const keyBytes = Buffer.from(getRawKeyBytes());
    if (keyBytes.length !== 32) {
        throw new Error(`Expected 32-byte key for AES-256, got ${keyBytes.length} bytes`);
    }

    for (const [src, out] of FILES_TO_ENCRYPT) {
        try {
            await encryptFile(src, out, keyBytes);
        } catch (err) {
            console.error(`[encrypt-assets] FAILED for ${src}:`, err.message);
            process.exitCode = 1;
        }
    }
};

main();