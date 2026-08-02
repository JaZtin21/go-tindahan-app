
import type { Store } from 'tinybase';

export function makeBarcodeConflictError() {
    const err: any = new Error('This barcode is already used by another item in this shop');
    // mirror the server's error shape so onError handlers don't need to
    // branch on online vs offline — same extensions.code either way
    err.extensions = { code: 'BARCODE_ALREADY_EXISTS' };
    return err;
}

export function findLocalBarcodeConflict(
    store: Store,
    shopId: string,
    barcode: string,
    excludeId?: string
): string | null {
    const normalized = barcode.trim();
    if (!normalized) return null; // empty/blank barcodes never conflict, same as the DB partial index

    const table = store.getTable('inventory') || {};
    for (const rowId of Object.keys(table)) {
        if (rowId === excludeId) continue;
        const row = table[rowId] as any;
        if (row._deleted) continue;
        if (row.shopId !== shopId) continue;
        if ((row.barcode ?? '').trim() === normalized) return rowId;
    }
    return null;
}