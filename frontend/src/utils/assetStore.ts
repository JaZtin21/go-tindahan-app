// ~/utils/assetStore.ts
//
// Durable, general-purpose binary/JSON asset cache backed by IndexedDB.
// Used for: scanner reference data (class names, embeddings), and — via
// withCachedFetch below — third-party downloads we don't control the
// loading code for (e.g. the OCR engine's model/wasm files).
//
// Why a dedicated store instead of the Cache Storage API:
// this app also uses Cache Storage for map tiles. Both APIs share the same
// per-origin storage bucket and the same eviction policy, so moving assets
// here doesn't by itself change durability — see requestPersistentStorage()
// below, which is the part that actually matters. Keeping scanner assets in
// their own IndexedDB store just means a high-churn, frequently-evicted-by-
// design cache (tiles) isn't sharing bookkeeping with a small set of
// one-time, must-not-refetch assets (model reference data, OCR weights).

const DB_NAME = 'scanner-asset-store';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
};

interface StoredAsset {
    key: string;
    value: ArrayBuffer | string | object;
    storedAt: number;
}

export const getAsset = async <T = ArrayBuffer>(key: string): Promise<T | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result ? ((req.result as StoredAsset).value as T) : null);
        req.onerror = () => reject(req.error);
    });
};

export const setAsset = async (key: string, value: ArrayBuffer | string | object): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ key, value, storedAt: Date.now() } as StoredAsset);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const deleteAsset = async (key: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const clearAllAssets = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

/**
 * Requests durable storage for the whole origin — this is what actually
 * prevents automatic eviction under disk pressure (as opposed to which API
 * you use to store things). Call this once, early, for the app as a whole;
 * it benefits map tile Cache Storage entries just as much as this store.
 *
 * Returns whether the origin is (now, or already) persisted. Chrome/Edge/
 * Firefox honor this reliably once granted. iOS Safari can still evict all
 * site data after ~7 days of inactivity regardless — that's an OS policy
 * this call can't override, so treat iOS as needing its own fallback plan
 * (silent re-download + re-cache) if it's a target platform.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
    if (!navigator.storage?.persist) return false;
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return navigator.storage.persist();
};

export const getStorageEstimate = async (): Promise<{ usageMB: number; quotaMB: number } | null> => {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usageMB: usage / (1024 * 1024), quotaMB: quota / (1024 * 1024) };
};

// ---------------------------------------------------------------------------
// Offline detection
// ---------------------------------------------------------------------------

/**
 * Thrown when an asset is missing/invalid from cache AND a real network
 * fetch is needed AND the browser reports no connection. Distinct from a
 * generic download failure — this specifically means "redownload is
 * required and cannot proceed right now for lack of connectivity," so
 * callers can show connectivity-specific messaging instead of a generic
 * error screen.
 */
export class OfflineRequiredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OfflineRequiredError';
    }
}

export const isOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine);

// ---------------------------------------------------------------------------
// XHR download helper with progress, results stored raw (caller decides format)
// ---------------------------------------------------------------------------

export const trackDownload = (url: string, onProgress: (pct: number) => void): Promise<ArrayBuffer | any> => {
    if (!isOnline()) {
        return Promise.reject(new OfflineRequiredError(`Offline — cannot download ${url}`));
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);

        if (url.endsWith('.bin') || url.endsWith('.wasm') || url.endsWith('.onnx')) {
            xhr.responseType = 'arraybuffer';
        } else if (url.endsWith('.json')) {
            xhr.responseType = 'json';
        }

        xhr.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            } else {
                onProgress(50);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress(100);
                resolve(xhr.response);
            } else {
                reject(new Error(`Failed to load ${url}`));
            }
        };

        xhr.onerror = () => {
            // A network-level XHR error while navigator.onLine is false is
            // almost certainly connectivity, not a server/CORS problem.
            reject(isOnline() ? new Error(`Network error loading ${url}`) : new OfflineRequiredError(`Offline — network error loading ${url}`));
        };
        xhr.send();
    });
};

/**
 * Cache-first wrapper around trackDownload, keyed by URL.
 *
 * Self-healing: if the cached entry can't be read (IndexedDB error,
 * corrupted record) or fails `validate` (e.g. wrong byte length), it's
 * treated as if it were never cached — deleted and silently redownloaded.
 * No error is thrown for that case; the caller just gets a fresh copy.
 *
 * If a *freshly downloaded* result fails `validate`, that's a real problem
 * (bad server response, wrong file, etc.) rather than a storage issue, so
 * that case does throw.
 */
export const cachedTrackDownload = async (
    url: string,
    cacheKey: string,
    onProgress: (pct: number) => void,
    validate?: (data: any) => boolean
): Promise<ArrayBuffer | any> => {
    try {
        const cached = await getAsset(cacheKey);
        if (cached) {
            if (!validate || validate(cached)) {
                onProgress(100);
                return cached;
            }
            console.warn(`[assetStore] Cached "${cacheKey}" failed validation — redownloading.`);
            await deleteAsset(cacheKey).catch(() => { });
        }
    } catch (err) {
        console.warn(`[assetStore] Cached "${cacheKey}" unreadable/corrupted — redownloading.`, err);
        await deleteAsset(cacheKey).catch(() => { });
    }

    const result = await trackDownload(url, onProgress);

    if (validate && !validate(result)) {
        throw new Error(`Downloaded asset "${cacheKey}" failed validation`);
    }

    try {
        await setAsset(cacheKey, result);
    } catch (err) {
        // Couldn't persist (quota, IDB unavailable, etc.) — not fatal, the
        // app can still use `result` this session; it'll just redownload
        // again next load. Don't block on it.
        console.warn(`[assetStore] Failed to persist "${cacheKey}" — will redownload next load.`, err);
    }

    return result;
};

// ---------------------------------------------------------------------------
// fetch() interception — for caching downloads issued by code we don't own
// ---------------------------------------------------------------------------

type UrlMatcher = (url: string) => boolean;

/**
 * Temporarily wraps the global `fetch` so any GET request whose URL matches
 * `shouldCache` is served from / saved to the durable asset store,
 * transparent to whatever calls fetch() internally — including third-party
 * libraries like the OCR engine. Restores the original fetch afterward,
 * including if `fn` throws.
 *
 * IMPORTANT CAVEAT: this only catches fetch()-based downloads. If the
 * library you're wrapping uses XMLHttpRequest instead, this won't see those
 * requests at all. Verify which one applies to you: open DevTools → Network,
 * reload the app twice, and check whether the OCR model/wasm files are
 * fetched again on the second load. If they are (and you've applied this
 * wrapper), the library isn't using fetch — ping me and I'll add the XHR
 * equivalent (same idea, patching XMLHttpRequest.prototype.open/send).
 */
export const withCachedFetch = async <T>(shouldCache: UrlMatcher, fn: () => Promise<T>): Promise<T> => {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if ((init?.method && init.method !== 'GET') || !shouldCache(url)) {
            return originalFetch(input, init);
        }

        const cacheKey = `fetch:${url}`;

        try {
            const cached = await getAsset<{ buf: ArrayBuffer; contentType: string }>(cacheKey);
            if (cached?.buf && cached.buf.byteLength > 0) {
                return new Response(cached.buf, {
                    headers: { 'Content-Type': cached.contentType || 'application/octet-stream' },
                });
            }
            if (cached) {
                console.warn(`[assetStore] Cached fetch "${url}" was empty — refetching.`);
                await deleteAsset(cacheKey).catch(() => { });
            }
        } catch (err) {
            console.warn(`[assetStore] Cached fetch "${url}" unreadable/corrupted — refetching.`, err);
            await deleteAsset(cacheKey).catch(() => { });
        }

        const response = await originalFetch(input, init).catch((err) => {
            throw isOnline() ? err : new OfflineRequiredError(`Offline — cannot fetch ${url}`);
        });
        if (response.ok) {
            const buf = await response.clone().arrayBuffer();
            if (buf.byteLength > 0) {
                const contentType = response.headers.get('content-type') || 'application/octet-stream';
                await setAsset(cacheKey, { buf, contentType }).catch((err) => {
                    console.warn(`[assetStore] Failed to persist fetch "${url}" — will refetch next load.`, err);
                });
            }
        }
        return response;
    };

    try {
        return await fn();
    } finally {
        window.fetch = originalFetch;
    }
};