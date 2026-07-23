import type { Store } from 'tinybase';
import client from '../../config/apolloClient';
import { UNIFIED_BATCH_SYNC_MUTATION } from '~/api/graphql';
import { store as reduxStore } from '~/store';
import { replaceLocalShop, deleteShop } from '~/store/myShopsSlice';
import { WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED } from '~/api/queries';

// ============================================================================
// WHO OWNS REDUX, AND WHY replaceLocalShop INSTEAD OF addShop/updateShop
// ============================================================================
// shopHooks.ts's mutation hooks (useCreateShop, useUpdateShop, ...) do IO
// and TinyBase writes ONLY — they never dispatch to Redux themselves. The
// component that calls them (e.g. ShopForm.tsx) is the one that dispatches
// an optimistic addShop/updateShop from the shop returned via onCompleted.
// That's the single writer for "a shop was just created/edited locally."
//
// By the time syncAll() runs, that optimistic entry is already in Redux
// once, under its temporary localId. This file's only job during
// reconciliation is to SWAP that entry for the server-confirmed one, in
// the same array slot, under the same count — never to add a second one.
// `replaceLocalShop` does exactly that: find the row by localId and
// overwrite it in place; if it's not found (e.g. the user navigated away
// and it's not currently in the slice), fall back to an upsert by real id.
//
// Both `addShop` and `replaceLocalShop` in myShopsSlice.ts are ALSO written
// defensively (dedupe/filter by id before inserting), so even if some
// future change accidentally causes a double-dispatch, the slice can't end
// up with two rows sharing an id — it self-heals on the next write instead
// of leaving a permanent duplicate.

let isSyncRunning = false;

function makeLogger() {
    const runId = Math.random().toString(36).slice(2, 8);
    const t0 = performance.now();
    return (msg: string, extra?: any) => {
        const dt = (performance.now() - t0).toFixed(1);
        if (extra !== undefined) {
            console.log(`[syncEngine #${runId} +${dt}ms] ${msg}`, extra);
        } else {
            console.log(`[syncEngine #${runId} +${dt}ms] ${msg}`);
        }
    };
}

export async function syncAll(store: Store): Promise<void> {
    if (isSyncRunning) {
        console.log('Sync already in progress — skipping this call.');
        return;
    }
    isSyncRunning = true;
    const log = makeLogger();
    log('=== sync started ===');

    try {
        const metadata = store.getRow('sync_metadata', 'global_anchor');
        const lastSyncedAt = metadata?.lastSyncedAt || '1970-01-01T00:00:00.000Z';

        const payload = {
            lastSyncedAt,
            shops: [] as any[],
            inventory: [] as any[],
            checkouts: [] as any[],
            actionHistories: [] as any[],
        };

        // =========================================================================
        // PHASE 1: GATHER DIRTY CHANGES FROM TINYBASE FOR BATCH PUSH
        // =========================================================================

        const localShops = store.getTable('shops') || {};
        for (const [id, row] of Object.entries(localShops) as [string, any][]) {
            if (!row._dirty && !row._deleted) continue;
            payload.shops.push({
                localId: id,
                isDeleted: !!row._deleted,
                isServerSynced: !!row._serverSynced,
                clientCreatedAt: row.createdAt || new Date().toISOString(),
                shopName: row.shopName || '',
                address: row.address || '',
                description: row.description || '',
                coordinates: JSON.parse(row.coordinatesJson || '{"lat":0,"lng":0}'),
                businessHours: JSON.parse(row.businessHoursJson || '{"openTime":"","closeTime":"","days":[]}'),
                paymentMethods: JSON.parse(row.paymentMethodsJson || '{"cash":false,"gcash":false,"paymaya":false,"card":false}'),
                delivery: JSON.parse(row.deliveryJson || '{"available":false}'),
                socialMedia: JSON.parse(row.socialMediaJson || '{}'),
                contactDetails: JSON.parse(row.contactDetailsJson || '{}'),
                photo: row.photo || '',
                photos: JSON.parse(row.photosJson || '[]'),
            });
        }
        log(`PHASE 1: gathered ${payload.shops.length} dirty shop(s)`, payload.shops.map((s) => ({ localId: s.localId, shopName: s.shopName })));

        const localInventory = store.getTable('inventory') || {};
        for (const [id, row] of Object.entries(localInventory) as [string, any][]) {
            if (!row._dirty && !row._deleted) continue;
            payload.inventory.push({
                localId: id,
                shopId: row.shopId,
                isDeleted: !!row._deleted,
                isServerSynced: !!row._serverSynced,
                clientCreatedAt: row.createdAt || new Date().toISOString(),
                itemName: row.itemName || '',
                description: row.description || '',
                barcode: row.barcode || '',
                category: row.category || '',
                unitOfMeasure: row.unitOfMeasure || '',
                costPrice: Number(row.costPrice || 0),
                sellingPrice: Number(row.sellingPrice || 0),
                stockQuantity: Number(row.stockQuantity || 0),
                reorderLevel: Number(row.reorderLevel || 0),
                photo: row.photo || '',
            });
        }

        const localCheckouts = store.getTable('checkoutHistory') || {};
        for (const [id, row] of Object.entries(localCheckouts) as [string, any][]) {
            if (!row._dirty) continue;
            payload.checkouts.push({
                localId: id,
                shopId: row.shopId,
                clientCreatedAt: row.soldAt || new Date().toISOString(),
                items: JSON.parse(row.itemsJson || '[]').map((i: any) => ({
                    itemId: i.inventoryItemId || i.itemId,
                    quantity: Number(i.quantity || 0),
                })),
            });
        }

        const localHistories = store.getTable('itemActionHistory') || {};
        for (const [id, row] of Object.entries(localHistories) as [string, any][]) {
            if (!row._dirty) continue;
            payload.actionHistories.push({
                localId: id,
                shopId: row.shopId,
                inventoryItemId: row.inventoryItemId || null,
                itemName: row.itemName || '',
                action: row.action || '',
                quantity: row.quantity ? Number(row.quantity) : null,
                clientCreatedAt: row.date || new Date().toISOString(),
            });
        }

        // =========================================================================
        // PHASE 2: EXECUTE BATCH MUTATION
        // =========================================================================
        log('PHASE 2: sending unifiedBatchSync mutation...');
        const { data } = await client.mutate({
            mutation: UNIFIED_BATCH_SYNC_MUTATION,
            variables: { input: payload },
        });

        const response = data?.unifiedBatchSync;
        if (!response) throw new Error('Sync engine failure: empty network response payload.');
        log('PHASE 2: response received', {
            shopsUpserted: response.shopsDelta?.upserted?.map((s: any) => ({ localId: s.localId, id: s.id, shopName: s.shopName })),
            shopsDeleted: response.shopsDelta?.deletedIds,
        });

        // =========================================================================
        // PHASE 3: RECONCILIATION
        // =========================================================================
        store.transaction(() => {
            const { shopsDelta, inventoryDelta, checkoutsDelta, actionHistoriesDelta, serverTime } = response;

            // -----------------------------------------------------------------------
            // 1. SHOPS
            // -----------------------------------------------------------------------
            for (const remoteId of shopsDelta.deletedIds || []) {
                log(`shops: deleting confirmed-deleted row ${remoteId}`);
                store.delRow('shops', remoteId);
                reduxStore.dispatch(deleteShop(remoteId));
            }

            for (const shop of shopsDelta.upserted || []) {
                const { localId, id: realId } = shop;
                const wasNewOfflineRecord = !!localId && localId !== realId;
                log(`shops: processing "${shop.shopName}"`, { localId, realId, wasNewOfflineRecord });

                if (shop.isDeleted) {
                    log(`shops: "${shop.shopName}" marked isDeleted, removing both ids`);
                    store.delRow('shops', localId);
                    store.delRow('shops', realId);
                    reduxStore.dispatch(deleteShop(realId));
                    continue;
                }

                // Step 1: always clear local dirty state first (TinyBase is
                // just the sync queue here — this is pure bookkeeping and,
                // as of this rewrite, has no wired path to Redux, so it
                // can't trigger a stray dispatch elsewhere).
                if (wasNewOfflineRecord) {
                    log(`shops: STEP 1 — delRow('shops', '${localId}') [clearing temp local id]`);
                    store.delRow('shops', localId);
                    cascadeUpdateForeignKeys(store, 'inventory', 'shopId', localId, realId);
                    cascadeUpdateForeignKeys(store, 'checkoutHistory', 'shopId', localId, realId);
                    cascadeUpdateForeignKeys(store, 'itemActionHistory', 'shopId', localId, realId);
                } else {
                    log(`shops: STEP 1 — delRow('shops', '${realId}') [clearing dirty state on existing id]`);
                    store.delRow('shops', realId);
                }

                // Step 2: swap the optimistic Redux entry for the
                // server-confirmed one — SAME array slot, SAME count.
                // replaceLocalShop looks the row up by localId (the id the
                // optimistic dispatch used) and overwrites it in place; if
                // it can't find it (e.g. the page changed shops list in the
                // meantime) it falls back to an upsert by realId. Neither
                // path can ever append a duplicate.
                const formattedUIModel = {
                    id: realId,
                    ownerId: shop.ownerId || '',
                    shopName: shop.shopName || '',
                    address: shop.address || '',
                    description: shop.description || '',
                    photo: shop.photo || '',
                    photos: shop.photos || [],
                    createdAt: shop.createdAt || shop.clientCreatedAt || '',
                    coordinates: shop.coordinates || { lat: 0, lng: 0 },
                    businessHours: shop.businessHours || { openTime: '', closeTime: '', days: [] },
                    paymentMethods: shop.paymentMethods || { cash: false, gcash: false, paymaya: false, card: false },
                    delivery: shop.delivery || { available: false, radius: 0, fee: 0, minOrder: 0 },
                    socialMedia: shop.socialMedia || {},
                    contactDetails: shop.contactDetails || {},
                    status: { isActive: shop.status?.isActive ?? true },
                    verification: shop.verification || { isVerified: false },
                };

                log(`shops: STEP 2 — dispatch(replaceLocalShop) localId=${localId} -> id=${realId}`);
                reduxStore.dispatch(replaceLocalShop({ localId, shop: formattedUIModel as any }));

                // Step 3: conditionally mirror into TinyBase (Condition 2
                // only — when the flag is off this is skipped, same as
                // before, and correctly so: TinyBase is write-only here).
                log(`shops: STEP 3 — WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED=${WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED}, ${WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED ? 'writing' : 'skipping'} TinyBase mirror for ${realId}`);
                if (WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED) {
                    store.setRow('shops', realId, {
                        shopName: shop.shopName,
                        description: shop.description,
                        address: shop.address,
                        coordinatesJson: JSON.stringify(shop.coordinates),
                        photo: shop.photo,
                        photosJson: JSON.stringify(shop.photos),
                        businessHoursJson: JSON.stringify(shop.businessHours),
                        paymentMethodsJson: JSON.stringify(shop.paymentMethods),
                        deliveryJson: JSON.stringify(shop.delivery),
                        socialMediaJson: JSON.stringify(shop.socialMedia),
                        contactDetailsJson: JSON.stringify(shop.contactDetails),
                        createdAt: shop.clientCreatedAt || shop.createdAt,
                        createdBy: shop.ownerId,
                        status: shop.status?.isActive ? 'ACTIVE' : 'INACTIVE',
                        _dirty: false,
                        _serverSynced: true,
                        _deleted: false,
                    });
                }
            }

            // -----------------------------------------------------------------------
            // 2. INVENTORY
            // -----------------------------------------------------------------------
            for (const remoteId of inventoryDelta.deletedIds || []) {
                store.delRow('inventory', remoteId);
            }

            for (const item of inventoryDelta.upserted || []) {
                const { localId, id: realId } = item;
                const wasNewOfflineRecord = !!localId && localId !== realId;

                if (item.isDeleted) {
                    store.delRow('inventory', localId);
                    store.delRow('inventory', realId);
                    continue;
                }

                if (wasNewOfflineRecord) {
                    store.delRow('inventory', localId);
                    cascadeUpdateForeignKeys(store, 'itemActionHistory', 'inventoryItemId', localId, realId);
                } else {
                    store.delRow('inventory', realId);
                }

                if (WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED) {
                    store.setRow('inventory', realId, {
                        shopId: item.shopId,
                        itemName: item.itemName,
                        description: item.description,
                        barcode: item.barcode,
                        category: item.category,
                        unitOfMeasure: item.unitOfMeasure,
                        photo: item.photo,
                        sellingPrice: item.sellingPrice,
                        stockQuantity: item.stockQuantity,
                        costPrice: item.costPrice,
                        reorderLevel: item.reorderLevel,
                        updatedAt: item.updatedAt,
                        _dirty: false,
                        _serverSynced: true,
                        _deleted: false,
                    });
                }
            }

            // -----------------------------------------------------------------------
            // 3. APPEND-ONLY TABLES
            // -----------------------------------------------------------------------
            for (const batch of checkoutsDelta.upserted || []) {
                if (batch.localId) store.delRow('checkoutHistory', batch.localId);
                if (WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED) {
                    store.setRow('checkoutHistory', batch.id, {
                        shopId: batch.shopId,
                        soldAt: batch.soldAt,
                        totalItems: batch.totalItems,
                        totalCost: batch.totalCost,
                        grossSale: batch.grossSale,
                        grossProfit: batch.grossProfit,
                        itemsJson: JSON.stringify(batch.items || []),
                        _dirty: false,
                        _serverSynced: true,
                        _deleted: false,
                    });
                }
            }

            for (const logRecord of actionHistoriesDelta.upserted || []) {
                if (logRecord.localId) store.delRow('itemActionHistory', logRecord.localId);
                if (WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED) {
                    store.setRow('itemActionHistory', logRecord.id, {
                        shopId: logRecord.shopId,
                        inventoryItemId: logRecord.inventoryItemId || '',
                        itemName: logRecord.itemName,
                        action: logRecord.action,
                        quantity: logRecord.quantity,
                        date: logRecord.date,
                        _serverSynced: true,
                    });
                }
            }

            if (serverTime) {
                store.setRow('sync_metadata', 'global_anchor', { lastSyncedAt: serverTime });
                log(`sync_metadata.global_anchor.lastSyncedAt -> ${serverTime}`);
            }
        });

        log('=== transaction committed ===');
        console.log('🎉 Offline engine and Redux synchronization complete!');
    } catch (error) {
        console.error('🔴 Sync execution pipeline failure:', error);
    } finally {
        isSyncRunning = false;
    }
}

function cascadeUpdateForeignKeys(store: Store, tableName: string, fieldKey: string, oldId: string, newId: string) {
    const table = store.getTable(tableName) || {};
    for (const [id, row] of Object.entries(table) as [string, any][]) {
        if (row[fieldKey] === oldId) {
            store.setPartialRow(tableName, id, { [fieldKey]: newId });
        }
    }
}