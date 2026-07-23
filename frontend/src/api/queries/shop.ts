// shopHooks.ts (TinyBase — complete, all queries + mutations)
//
// ============================================================================
// READ MODEL
// ============================================================================
// Two distinct regimes, chosen by shouldPersistLocally(isSubscribed):
//
// Condition 1/2 (persistLocally === true — offline, or online with
// WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED on): TinyBase IS the read model.
// Components read from it via useTable/useRow, and a single reconcile
// effect mirrors whatever TinyBase currently holds into Redux. Any dirty
// local edit is visible immediately because it's *in* the table that's
// being watched.
//
// Condition 3 (isSubscribed === true && persistLocally === false): TinyBase
// is WRITE-ONLY here — a queue of _dirty rows for syncEngine.ts to drain.
// It is never read from for display, and nothing in this hook subscribes
// to it for the purpose of deciding what Redux shows. The only writer of
// Redux in this mode is:
//   (a) this hook's own fetch effect, when a server response comes back, or
//   (b) the mutation hook that created/changed the dirty row (optimistic
//       dispatch, done once, at the moment of the write), or
//   (c) syncEngine.ts, when a dirty row is confirmed by the server — it
//       swaps the optimistic entry in place (see replaceLocalShop) rather
//       than appending, so the count never drifts.
//
// This is the fix for the "shop count goes 5 -> 6 -> 4" bug: previously a
// live useTable('shops') subscription in Condition 3 ALSO drove a
// dispatch(setShops(...)) any time TinyBase changed for any reason
// (including syncEngine just clearing a dirty row as bookkeeping), and that
// dispatch raced with — and stomped — whatever syncEngine or the mutation
// hook had just written. Condition 3 now has exactly one writer per event:
// no two things ever disagree about what the list is.
//
// ============================================================================
// WRITE MODEL: dual-write when isSubscribed (configurable)
// ============================================================================
// isSubscribed true  -> hit the backend AND (if WRITE_TO_OFFLINE_DB_WHEN_
//                        SUBSCRIBED is true) upsert the server's authoritative
//                        response into TinyBase (_dirty:false, _serverSynced:true).
// isSubscribed false -> write to TinyBase only, marked _dirty:true, so
//                        syncEngine.ts picks it up on the next "Sync now".
//                        This path is UNCONDITIONAL — it's the only way an
//                        offline change can ever reach the server.
//
// Additionally, any branch that writes a _dirty row now ALSO dispatches an
// optimistic Redux update immediately (addShop / updateShop-style), because
// in Condition 3 nothing else is watching TinyBase to notice that write.
//
// syncEngine.ts is what reconciles _dirty rows on manual sync, pushing
// local changes first and then pulling the server's state back down.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore, useTable, useRow, useValue } from 'tinybase/ui-react';
import type { Store } from 'tinybase';
import client from '../../config/apolloClient';
import type { Item, CheckoutBatchResult, Shop, ShopDashboardMetrics, DailySalesMetric } from '~/types';

import {
    SEARCH_SHOP_PRODUCTS_QUERY,
    GET_MY_SHOPS_QUERY,
    GET_SHOP_INVENTORY_QUERY,
    GET_CHECKOUT_HISTORY_QUERY,
    GET_ITEM_ACTION_HISTORY_QUERY,
    GET_SHOP_BY_ID_QUERY,
    GET_SHOP_DASHBOARD_METRICS_QUERY,
    DELETE_SHOP_MUTATION,
    CHECKOUT_CART_MUTATION,
    ADD_INVENTORY_ITEM_MUTATION,
    UPDATE_INVENTORY_ITEM_MUTATION,
    INCREMENT_STOCK_MUTATION,
    CREATE_SHOP_MUTATION,
    UPDATE_SHOP_MUTATION,
    DELETE_INVENTORY_ITEM_MUTATION,
} from '../graphql';
import { fileToStorableBase64 } from '~/utils';
import { useDispatch } from 'react-redux';
import {
    setError as setErrorMyShops,
    setShops,
} from '~/store/myShopsSlice';

// ============================================================================
// OFFLINE PERSISTENCE TOGGLE
// ============================================================================
// true  (default, original behavior): every hook dual-writes into TinyBase
//        even while isSubscribed is true. The local DB is always a full
//        mirror of the server, so it stays useful the instant connectivity
//        drops, but it also grows even when you're online the whole time.
//
// false: while isSubscribed is true, hooks/mutations skip writing to
//        TinyBase — only the online (server) copy of the data exists.
//        Changes made while OFFLINE still write locally as normal (that's
//        the only way they can ever reach the server), so flipping this
//        flag never affects the offline path, only the online one.
export const WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED = true;

// Central gate every hook below calls before touching TinyBase. Offline
// writes (isSubscribed === false) are never gated — see the toggle comment
// above for why.
function shouldPersistLocally(isSubscribed: boolean): boolean {
    return !isSubscribed || WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED;
}

export function upsertServerRow(
    store: Store,
    table: string,
    id: string,
    row: Record<string, any>
) {
    const local = store.getRow(table, id);
    if (local && Object.keys(local).length > 0 && (local as any)._dirty) {
        // Unsynced local edit/create/delete in progress — leave it alone.
        // It'll reconcile the next time "Sync now" runs.
        return;
    }
    store.setRow(table, id, { ...row, _dirty: false, _serverSynced: true, _deleted: false });
}

export function upsertServerCell(
    store: Store,
    table: string,
    id: string,
    cell: string,
    value: any
) {
    const local = store.getRow(table, id);
    if (local && Object.keys(local).length > 0 && (local as any)._dirty) return;
    store.setCell(table, id, cell, value);
}

// =========================================================================
// ROW <-> DOMAIN MAPPERS
// =========================================================================

function toShopRow(shop: Partial<Shop>) {
    return {
        shopName: shop.shopName ?? '',
        description: shop.description ?? '',
        address: shop.address ?? '',
        coordinatesJson: JSON.stringify(shop.coordinates ?? { lat: 0, lng: 0 }),
        photo: typeof shop.photo === 'string' ? shop.photo : '', // File objects can't persist offline
        photosJson: JSON.stringify(shop.photos ?? []),
        businessHoursJson: JSON.stringify(shop.businessHours ?? { openTime: '', closeTime: '', days: [] }),
        businessType: shop.businessType ?? '',
        paymentMethodsJson: JSON.stringify(shop.paymentMethods ?? { cash: false, gcash: false, paymaya: false, card: false }),
        deliveryJson: JSON.stringify(shop.delivery ?? { available: false }),
        socialMediaJson: JSON.stringify(shop.socialMedia ?? {}),
        verificationJson: JSON.stringify(shop.verification ?? { isVerified: false }),
        contactDetailsJson: JSON.stringify(shop.contactDetails ?? { phone: '', email: '', address: '' }),
        rating: shop.rating ?? 0,
        createdAt: shop.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: shop.createdBy ?? '',
        status: shop.status ?? 'ACTIVE',
    };
}

function fromShopRow(id: string, row: any): Shop {
    return {
        id,
        shopName: row.shopName,
        description: row.description,
        address: row.address,
        coordinates: JSON.parse(row.coordinatesJson || '{"lat":0,"lng":0}'),
        photo: row.photo,
        photos: JSON.parse(row.photosJson || '[]'),
        businessHours: JSON.parse(row.businessHoursJson || '{"openTime":"","closeTime":"","days":[]}'),
        businessType: row.businessType || undefined,
        paymentMethods: JSON.parse(row.paymentMethodsJson || '{"cash":false,"gcash":false,"paymaya":false,"card":false}'),
        delivery: JSON.parse(row.deliveryJson || '{"available":false}'),
        socialMedia: JSON.parse(row.socialMediaJson || '{}'),
        verification: JSON.parse(row.verificationJson || '{"isVerified":false}'),
        contactDetails: JSON.parse(row.contactDetailsJson || '{"phone":"","email":"","address":""}'),
        rating: row.rating,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        status: row.status as Shop['status'],
    };
}

function toItemRow(item: Partial<Item>) {
    return {
        shopId: item.shopId ?? '',
        itemName: item.itemName ?? '',
        description: item.description ?? '',
        barcode: item.barcode ?? '',
        category: item.category ?? '',
        unitOfMeasure: item.unitOfMeasure ?? '',
        photo: typeof item.photo === 'string' ? item.photo : '', // File objects can't persist offline — same rule as toShopRow
        sellingPrice: item.sellingPrice ?? 0,
        stockQuantity: item.stockQuantity ?? 0,
        costPrice: item.costPrice ?? 0,
        reorderLevel: item.reorderLevel ?? 0,
        updatedAt: new Date().toISOString(),
    };
}

function fromItemRow(id: string, row: any): Item {
    return {
        id,
        shopId: row.shopId,
        itemName: row.itemName,
        description: row.description,
        barcode: row.barcode,
        category: row.category,
        unitOfMeasure: row.unitOfMeasure,
        photo: row.photo,
        sellingPrice: row.sellingPrice,
        stockQuantity: row.stockQuantity,
        costPrice: row.costPrice,
        reorderLevel: row.reorderLevel,
        updatedAt: row.updatedAt,
    };
}

function fromCheckoutRow(id: string, row: any) {
    return {
        id,
        shopId: row.shopId,
        soldAt: row.soldAt,
        totalItems: row.totalItems,
        totalCost: row.totalCost,
        grossSale: row.grossSale,
        grossProfit: row.grossProfit,
        items: JSON.parse(row.itemsJson || '[]'),
    };
}

// =========================================================================
// QUERIES
// =========================================================================

// ---- 1. useMyShops (GET_MY_SHOPS_QUERY) ----
export function useMyShops(opts: { limit: number; offset: number; isSubscribed: boolean }) {
    const { limit, offset, isSubscribed } = opts;
    const dispatch = useDispatch();

    const store = useStore() as Store;
    const shopsTable = useTable('shops', store);
    const serverTotalCount = (useValue('shopsTotalCount', store) as number) ?? 0;

    const [state, setState] = useState<{ loading: boolean; error: any }>({
        loading: false,
        error: null,
    });

    const [remoteOnly, setRemoteOnly] = useState<{ shops: Shop[]; totalCount: number } | null>(null);

    const persistLocally = shouldPersistLocally(isSubscribed);

    // 1. NETWORK FETCH EFFECT.
    // In Condition 3 this is the ONLY place a fetch result reaches Redux —
    // dispatched inline, once, right here. It is never re-derived from a
    // TinyBase subscription, so it can't be raced by syncEngine or a
    // mutation hook's optimistic dispatch.
    useEffect(() => {
        if (!isSubscribed) return;

        let cancelled = false;
        setState({ loading: true, error: null });

        const priorPageIds = persistLocally
            ? Object.entries(store.getTable('shops'))
                .filter(([, row]: any) => !row._deleted)
                .map(([id, row]) => ({ id, row }))
                .sort((a, b) => new Date((b.row as any).createdAt).getTime() - new Date((a.row as any).createdAt).getTime())
                .slice(offset, offset + limit)
                .map(({ id }) => id)
            : [];

        client
            .query({
                query: GET_MY_SHOPS_QUERY,
                variables: { limit, offset },
                fetchPolicy: 'no-cache',
            })
            .then(({ data }: any) => {
                if (cancelled) return;
                const fetchedShops = data?.getMyShops?.shops ?? [];
                const totalCount = data?.getMyShops?.totalCount ?? 0;

                if (persistLocally) {
                    // Condition 1/2: TinyBase is the read model. Mirror the
                    // server response into it; Redux is kept in sync by the
                    // reconcile effect below, which watches this same table.
                    const fetchedIds = new Set(fetchedShops.map((s: any) => s.id));

                    fetchedShops.forEach((shop: any) => {
                        upsertServerRow(store, 'shops', shop.id, toShopRow(shop));
                    });

                    priorPageIds.forEach((id) => {
                        if (fetchedIds.has(id)) return;
                        const row = store.getRow('shops', id);
                        if (row && Object.keys(row).length > 0 && !(row as any)._dirty && (row as any)._serverSynced) {
                            store.delRow('shops', id);
                        }
                    });
                    store.setValue('shopsTotalCount', totalCount);
                } else {
                    // Condition 3: TinyBase is write-only here. Dispatch
                    // straight to Redux — this is the single writer for
                    // "server truth" in this mode.
                    setRemoteOnly({ shops: fetchedShops, totalCount });
                    dispatch(setShops({ shops: fetchedShops, totalCount }));
                }
                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, limit, offset, store, persistLocally, dispatch]);

    // 2. TINYBASE READ PATH — only meaningful for Condition 1/2. In
    // Condition 3 nothing reads shopsTable for display purposes; it exists
    // solely as syncEngine's dirty-row queue.
    const allShopsFromTinyBase = useMemo(() => {
        return Object.entries(shopsTable)
            .filter(([, row]: any) => !row._deleted)
            .map(([id, row]) => fromShopRow(id, row))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [shopsTable]);

    // 3. OUTPUT RESOLVER
    const resolvedPayload = useMemo(() => {
        if (isSubscribed && !persistLocally) {
            // Condition 3: purely a reflection of the last fetch — no
            // TinyBase blending. Local creations/edits are represented in
            // Redux directly by the mutation hooks and syncEngine, not here.
            const serverShops = remoteOnly?.shops ?? [];
            const serverCount = remoteOnly?.totalCount ?? 0;
            return {
                loading: state.loading,
                error: state.error,
                shops: serverShops,
                totalCount: serverCount,
                hasNextPage: offset + limit < serverCount,
            };
        }

        const page = allShopsFromTinyBase.slice(offset, offset + limit);
        const totalCount = isSubscribed ? Math.max(serverTotalCount, allShopsFromTinyBase.length) : allShopsFromTinyBase.length;

        return {
            loading: state.loading,
            error: state.error,
            shops: page,
            totalCount,
            hasNextPage: offset + limit < totalCount,
        };
    }, [allShopsFromTinyBase, offset, limit, serverTotalCount, state.loading, state.error, isSubscribed, persistLocally, remoteOnly]);

    // 4. REDUX RECONCILE EFFECT — Condition 1/2 ONLY. This is what keeps
    // Redux in sync with TinyBase-as-read-model whenever a local dirty edit
    // changes the table. Condition 3 must never run this: it already
    // dispatched from the fetch effect above, and letting this effect ALSO
    // dispatch (keyed off the same shopsTable subscription) is exactly what
    // caused the previous bug — a second writer racing the first.
    const stableShopIdsString = JSON.stringify(resolvedPayload.shops.map((s) => s.id));

    useEffect(() => {
        if (isSubscribed && !persistLocally) return; // Condition 3 — handled in the fetch effect only

        if (resolvedPayload.error) {
            dispatch(setErrorMyShops(resolvedPayload.error.message));
            return;
        }

        dispatch(
            setShops({
                shops: resolvedPayload.shops,
                totalCount: resolvedPayload.totalCount,
            })
        );
    }, [stableShopIdsString, resolvedPayload.totalCount, resolvedPayload.error, dispatch, isSubscribed, persistLocally]);

    // 5. Return payload for Apollo-shape consumers
    return useMemo(() => ({
        loading: resolvedPayload.loading,
        error: resolvedPayload.error,
        data: {
            getMyShops: {
                shops: resolvedPayload.shops,
                totalCount: resolvedPayload.totalCount,
                hasNextPage: resolvedPayload.hasNextPage,
            },
        },
    }), [resolvedPayload]);
}

// ---- 2. useShopInventory (GET_SHOP_INVENTORY_QUERY) ----
export function useShopInventory(opts: {
    shopId: string;
    itemsPerPage: number;
    offset: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    isSubscribed: boolean;
}) {
    const { shopId, itemsPerPage, offset, search, sortBy, sortOrder, isSubscribed } = opts;
    const store = useStore() as Store;
    const inventoryTable = useTable('inventory', store);
    const [state, setState] = useState<{ loading: boolean; error: any }>({ loading: false, error: null });
    const [remoteOnly, setRemoteOnly] = useState<{ items: Item[]; totalCount: number } | null>(null);
    const persistLocally = shouldPersistLocally(isSubscribed);

    useEffect(() => {
        if (!isSubscribed || !shopId) return;
        let cancelled = false;
        setState({ loading: true, error: null });

        client
            .query({
                query: GET_SHOP_INVENTORY_QUERY,
                variables: {
                    shopId,
                    limit: itemsPerPage,
                    offset,
                    search: search || undefined,
                    sortBy: sortBy || undefined,
                    sortOrder: sortOrder || undefined,
                },
                fetchPolicy: 'no-cache',
            })
            .then(({ data }: any) => {
                if (cancelled) return;
                const fetchedItems = data?.getShopInventory?.items ?? [];

                if (persistLocally) {
                    fetchedItems.forEach((item: any) => {
                        upsertServerRow(store, 'inventory', item.id, toItemRow(item));
                    });
                } else {
                    setRemoteOnly({
                        items: fetchedItems,
                        totalCount: data?.getShopInventory?.totalCount ?? fetchedItems.length,
                    });
                }

                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, shopId, itemsPerPage, offset, search, sortBy, sortOrder, store, persistLocally]);

    const localItems = useMemo(() => {
        let result = Object.entries(inventoryTable)
            .filter(([, row]: any) => !row._deleted)
            .map(([id, row]) => fromItemRow(id, row))
            .filter((i) => i.shopId === shopId);

        if (search) {
            const re = new RegExp(search, 'i');
            result = result.filter((i) => re.test(i.itemName));
        }
        if (sortBy) {
            // Callers pass snake_case keys (matching the backend's column
            // naming) but Item/fromItemRow use camelCase. Map between the
            // two so a[key] resolves to a real field.
            const fieldMap: Record<string, keyof Item> = {
                item_name: 'itemName',
                itemName: 'itemName',
                unit_of_measure: 'unitOfMeasure',
                unitOfMeasure: 'unitOfMeasure',
                category: 'category',
                cost_price: 'costPrice',
                costPrice: 'costPrice',
                selling_price: 'sellingPrice',
                sellingPrice: 'sellingPrice',
                stock_quantity: 'stockQuantity',
                stockQuantity: 'stockQuantity',
                reorder_level: 'reorderLevel',
                reorderLevel: 'reorderLevel',
                updated_at: 'updatedAt',
                updatedAt: 'updatedAt',
            };
            const field = fieldMap[sortBy] ?? (sortBy as keyof Item);
            const dir = String(sortOrder).toUpperCase() === 'DESC' ? -1 : 1;

            result = [...result].sort((a: any, b: any) => {
                const av = a[field];
                const bv = b[field];
                if (av == null && bv == null) return 0;
                if (av == null) return 1; // nulls last, regardless of direction
                if (bv == null) return -1;
                if (typeof av === 'string' && typeof bv === 'string') {
                    return dir * av.localeCompare(bv);
                }
                return av > bv ? dir : av < bv ? -dir : 0;
            });
        }
        return result;
    }, [inventoryTable, shopId, search, sortBy, sortOrder]);

    return useMemo(() => {
        if (isSubscribed && !persistLocally) {
            const items = remoteOnly?.items ?? [];
            return {
                loading: state.loading,
                error: state.error,
                data: { getShopInventory: { items, totalCount: remoteOnly?.totalCount ?? items.length } },
            };
        }

        const page = localItems.slice(offset, offset + itemsPerPage);
        return {
            loading: state.loading,
            error: state.error,
            data: { getShopInventory: { items: page, totalCount: localItems.length } },
        };
    }, [localItems, offset, itemsPerPage, state.loading, state.error, isSubscribed, persistLocally, remoteOnly]);
}

// ---- 3. useSearchShopProducts (SEARCH_SHOP_PRODUCTS_QUERY) ----
// Search results ARE inventory rows (same shape as useShopInventory's),
// so this now mirrors them into TinyBase on the online path too, gated by
// the same persistLocally flag — consistent with every other query hook.
// Previously this hook ignored the flag entirely and never mirrored
// anything regardless of its value, which was the actual inconsistency.
export function useSearchShopProducts(isSubscribed: boolean) {
    const store = useStore() as Store;
    const persistLocally = shouldPersistLocally(isSubscribed);
    const [result, setResult] = useState<{ loading: boolean; error: any; data?: any }>({
        loading: false,
        error: null,
    });

    const search = useCallback(
        async (options: {
            variables: {
                shopId: string;
                query: string;
                limit: number;
                offset: number;
            };
        }) => {
            const { shopId, query, limit, offset } = options.variables;

            if (!isSubscribed) {
                const re = new RegExp(query, 'i');
                const inventoryTable = store.getTable('inventory');

                const allResults = Object.entries(inventoryTable)
                    .filter(([, row]: any) => !row._deleted)
                    .map(([id, row]) => fromItemRow(id, row))
                    .filter((i) => i.shopId === shopId && re.test(i.itemName));

                const slicedResults = allResults.slice(offset, offset + limit);

                const data = {
                    searchShopProducts: {
                        products: slicedResults,
                        totalCount: allResults.length,
                    },
                };

                setResult({ loading: false, error: null, data });
                return { data };
            }

            setResult((prev) => ({ ...prev, loading: true }));
            try {
                const { data } = await client.query({
                    query: SEARCH_SHOP_PRODUCTS_QUERY,
                    variables: { shopId, query, limit, offset },
                    fetchPolicy: 'no-cache',
                });

                if (persistLocally) {
                    const products = data?.searchShopProducts?.products ?? [];
                    products.forEach((item: any) => {
                        upsertServerRow(store, 'inventory', item.id, toItemRow(item));
                    });
                }

                setResult({ loading: false, error: null, data });
                return { data };
            } catch (error) {
                setResult({ loading: false, error });
                throw error;
            }
        },
        [isSubscribed, store, persistLocally]
    );

    return [search, result] as const;
}

// ---- 4. useCheckoutHistory (GET_CHECKOUT_HISTORY_QUERY) ----
export function useCheckoutHistory(opts: {
    shopId: string;
    offset: number;
    pageLimit: number;
    activeTab: string;
    isSubscribed: boolean;
}) {
    const { shopId, offset, pageLimit, activeTab, isSubscribed } = opts;
    const store = useStore() as Store;
    const checkoutTable = useTable('checkoutHistory', store);
    const [state, setState] = useState<{ loading: boolean; error: any }>({ loading: false, error: null });
    const [remoteOnly, setRemoteOnly] = useState<{ batches: any[]; totalCount: number } | null>(null);
    const persistLocally = shouldPersistLocally(isSubscribed);

    useEffect(() => {
        if (!isSubscribed || !shopId || activeTab !== 'checkout') return;
        let cancelled = false;
        setState({ loading: true, error: null });

        client
            .query({
                query: GET_CHECKOUT_HISTORY_QUERY,
                variables: { shopId, limit: pageLimit, offset },
                fetchPolicy: 'no-cache',
            })
            .then(({ data }: any) => {
                if (cancelled) return;
                const fetchedBatches = data?.getCheckoutHistory?.batches ?? [];

                if (persistLocally) {
                    fetchedBatches.forEach((batch: any) => {
                        upsertServerRow(store, 'checkoutHistory', batch.id, {
                            shopId: batch.shopId,
                            soldAt: batch.soldAt,
                            totalItems: batch.totalItems,
                            totalCost: batch.totalCost,
                            grossSale: batch.grossSale,
                            grossProfit: batch.grossProfit,
                            itemsJson: JSON.stringify(batch.items ?? []),
                        });
                    });
                } else {
                    setRemoteOnly({
                        batches: fetchedBatches,
                        totalCount: data?.getCheckoutHistory?.totalCount ?? fetchedBatches.length,
                    });
                }

                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, shopId, activeTab, offset, pageLimit, store, persistLocally]);

    const batches = useMemo(() => {
        if (activeTab !== 'checkout') return [];
        return Object.entries(checkoutTable)
            .filter(([, row]: any) => row.shopId === shopId && !row._deleted)
            .map(([id, row]) => fromCheckoutRow(id, row))
            .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime());
    }, [checkoutTable, shopId, activeTab]);

    return useMemo(() => {
        if (activeTab !== 'checkout') return { loading: state.loading, error: state.error, data: undefined };

        if (isSubscribed && !persistLocally) {
            const list = remoteOnly?.batches ?? [];
            const totalCount = remoteOnly?.totalCount ?? list.length;
            return {
                loading: state.loading,
                error: state.error,
                data: {
                    getCheckoutHistory: {
                        batches: list,
                        totalCount,
                        hasNextPage: offset + pageLimit < totalCount,
                    },
                },
            };
        }

        const page = batches.slice(offset, offset + pageLimit);
        return {
            loading: state.loading,
            error: state.error,
            data: {
                getCheckoutHistory: {
                    batches: page,
                    totalCount: batches.length,
                    hasNextPage: offset + pageLimit < batches.length,
                },
            },
        };
    }, [batches, activeTab, offset, pageLimit, state.loading, state.error, isSubscribed, persistLocally, remoteOnly]);
}

// ---- 5. useItemActionHistory (GET_ITEM_ACTION_HISTORY_QUERY) ----
// Pull-only on purpose: the backend writes these rows itself as a side
// effect of other mutations. There's no client mutation that creates a
// local-only unsynced action record, so there's no _dirty case to worry
// about here.
export function useItemActionHistory(opts: {
    shopId: string;
    offset: number;
    pageLimit: number;
    activeTab: string;
    isSubscribed: boolean;
}) {
    const { shopId, offset, pageLimit, activeTab, isSubscribed } = opts;
    const store = useStore() as Store;
    const actionsTable = useTable('itemActionHistory', store);
    const [state, setState] = useState<{ loading: boolean; error: any }>({ loading: false, error: null });
    const [remoteOnly, setRemoteOnly] = useState<{ records: any[]; totalCount: number } | null>(null);
    const persistLocally = shouldPersistLocally(isSubscribed);

    useEffect(() => {
        if (!isSubscribed || !shopId || activeTab !== 'actions') return;
        let cancelled = false;
        setState({ loading: true, error: null });

        client
            .query({
                query: GET_ITEM_ACTION_HISTORY_QUERY,
                variables: { shopId, limit: pageLimit, offset },
                fetchPolicy: 'no-cache',
            })
            .then(({ data }: any) => {
                if (cancelled) return;
                const fetchedRecords = data?.getItemActionHistory?.records ?? [];

                if (persistLocally) {
                    fetchedRecords.forEach((record: any) => {
                        store.setRow('itemActionHistory', record.id, {
                            shopId: record.shopId ?? shopId,
                            inventoryItemId: record.inventoryItemId ?? '',
                            itemName: record.itemName ?? '',
                            action: record.action ?? '',
                            quantity: record.quantity ?? 0,
                            date: record.date ?? '',
                            _serverSynced: true,
                        });
                    });
                } else {
                    setRemoteOnly({
                        records: fetchedRecords,
                        totalCount: data?.getItemActionHistory?.totalCount ?? fetchedRecords.length,
                    });
                }

                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, shopId, activeTab, offset, pageLimit, store, persistLocally]);

    const records = useMemo(() => {
        if (activeTab !== 'actions') return [];
        return Object.entries(actionsTable)
            .filter(([, row]: any) => row.shopId === shopId)
            .map(([id, row]: any) => ({
                id,
                shopId: row.shopId,
                inventoryItemId: row.inventoryItemId,
                itemName: row.itemName,
                action: row.action,
                quantity: row.quantity,
                date: row.date,
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [actionsTable, shopId, activeTab]);

    return useMemo(() => {
        if (activeTab !== 'actions') return { loading: state.loading, error: state.error, data: undefined };

        if (isSubscribed && !persistLocally) {
            const list = remoteOnly?.records ?? [];
            const totalCount = remoteOnly?.totalCount ?? list.length;
            return {
                loading: state.loading,
                error: state.error,
                data: {
                    getItemActionHistory: {
                        records: list,
                        totalCount,
                        hasNextPage: offset + pageLimit < totalCount,
                    },
                },
            };
        }

        const page = records.slice(offset, offset + pageLimit);
        return {
            loading: state.loading,
            error: state.error,
            data: {
                getItemActionHistory: {
                    records: page,
                    totalCount: records.length,
                    hasNextPage: offset + pageLimit < records.length,
                },
            },
        };
    }, [records, activeTab, offset, pageLimit, state.loading, state.error, isSubscribed, persistLocally, remoteOnly]);
}

// ---- 6. useShopById (GET_SHOP_BY_ID_QUERY) ----
export function useShopById(shopId: string, shop: Shop | undefined, isSubscribed: boolean) {
    const store = useStore() as Store;
    const row = useRow('shops', shopId, store);
    const [state, setState] = useState<{ loading: boolean; error: any }>({ loading: false, error: null });
    const [remoteOnly, setRemoteOnly] = useState<Shop | null>(null);
    const persistLocally = shouldPersistLocally(isSubscribed);

    useEffect(() => {
        if (!isSubscribed || !shopId || shop) return;
        let cancelled = false;
        setState({ loading: true, error: null });

        client
            .query({ query: GET_SHOP_BY_ID_QUERY, variables: { shopId }, fetchPolicy: 'no-cache' })
            .then(({ data }: any) => {
                if (cancelled) return;
                if (data?.getShopById) {
                    if (persistLocally) {
                        upsertServerRow(store, 'shops', shopId, toShopRow(data.getShopById));
                    } else {
                        setRemoteOnly(data.getShopById);
                    }
                }
                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, shopId, shop, store, persistLocally]);

    return useMemo(() => {
        if (isSubscribed && !persistLocally) {
            return {
                loading: state.loading,
                error: state.error,
                data: remoteOnly ? { getShopById: remoteOnly } : undefined,
            };
        }

        const hasRow = row && Object.keys(row).length > 0;
        return {
            loading: state.loading,
            error: state.error,
            data: hasRow ? { getShopById: fromShopRow(shopId, row) } : undefined,
        };
    }, [row, shopId, state.loading, state.error, isSubscribed, persistLocally, remoteOnly]);
}

// ---- 7. useShopDashboardMetrics (GET_SHOP_DASHBOARD_METRICS_QUERY) ----
// Like useSearchShopProducts, this hook already never writes to TinyBase on
// the isSubscribed path — it returns `remote` (the raw Apollo response)
// directly. The offline-computed version below is only used when
// isSubscribed is false.
export function useShopDashboardMetrics(shopId: string, isSubscribed: boolean) {
    const store = useStore() as Store;
    const inventoryTable = useTable('inventory', store);
    const checkoutTable = useTable('checkoutHistory', store);
    const [remote, setRemote] = useState<{ loading: boolean; error: any; data?: any }>({ loading: false, error: null });

    useEffect(() => {
        if (!isSubscribed || !shopId) return;
        let cancelled = false;
        setRemote({ loading: true, error: null });

        client
            .query({
                query: GET_SHOP_DASHBOARD_METRICS_QUERY,
                variables: { shopId },
                fetchPolicy: 'no-cache',
            })
            .then(({ data }: any) => {
                if (!cancelled) setRemote({ loading: false, error: null, data });
            })
            .catch((error: any) => {
                if (!cancelled) setRemote({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, shopId]);

    const offlineResult = useMemo(() => {
        const items = Object.values(inventoryTable).filter((r: any) => r.shopId === shopId && !r._deleted) as any[];
        const checkouts = Object.values(checkoutTable).filter((r: any) => r.shopId === shopId && !r._deleted) as any[];

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const todaysCheckouts = checkouts.filter((c) => new Date(c.soldAt) >= startOfToday);
        const todaysGrossSales = todaysCheckouts.reduce((sum, c) => sum + (c.grossSale || 0), 0);

        const sevenDaysAgoStart = new Date(startOfToday);
        sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 7);
        const sixDaysAgoStart = new Date(startOfToday);
        sixDaysAgoStart.setDate(sixDaysAgoStart.getDate() - 6);

        const sameDayLastWeekSales = checkouts
            .filter((c) => {
                const d = new Date(c.soldAt);
                return d >= sevenDaysAgoStart && d < sixDaysAgoStart;
            })
            .reduce((sum, c) => sum + (c.grossSale || 0), 0);

        const todaysSalesGrowthPct =
            sameDayLastWeekSales === 0 ? 0 : ((todaysGrossSales - sameDayLastWeekSales) / sameDayLastWeekSales) * 100;

        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        const previousWeekStart = new Date(now);
        previousWeekStart.setDate(previousWeekStart.getDate() - 14);

        const current7DaysTotal = checkouts
            .filter((c) => new Date(c.soldAt) >= currentWeekStart)
            .reduce((sum, c) => sum + (c.grossSale || 0), 0);
        const previous7DaysTotal = checkouts
            .filter((c) => {
                const d = new Date(c.soldAt);
                return d >= previousWeekStart && d < currentWeekStart;
            })
            .reduce((sum, c) => sum + (c.grossSale || 0), 0);

        const weeklyRevenueGrowthIndex = previous7DaysTotal === 0 ? 100 : (current7DaysTotal / previous7DaysTotal) * 100;

        const averageTicketSize = checkouts.length
            ? checkouts.reduce((sum, c) => sum + (c.grossSale || 0), 0) / checkouts.length
            : 0;

        const inventoryValue = items.reduce((sum, i) => sum + (i.costPrice || 0) * (i.stockQuantity || 0), 0);
        const inventoryRetailValue = items.reduce((sum, i) => sum + (i.sellingPrice || 0) * (i.stockQuantity || 0), 0);
        const inventoryCapitalRatio = inventoryRetailValue > 0 ? (inventoryValue / inventoryRetailValue) * 100 : 0;

        const weeklySalesTrend: DailySalesMetric[] = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(startOfToday);
            dayStart.setDate(dayStart.getDate() - i);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const dayCheckouts = checkouts.filter((c) => {
                const d = new Date(c.soldAt);
                return d >= dayStart && d < dayEnd;
            });

            weeklySalesTrend.push({
                dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                formattedDate: `${String(dayStart.getMonth() + 1).padStart(2, '0')}/${String(dayStart.getDate()).padStart(2, '0')}`,
                grossSale: dayCheckouts.reduce((sum, c) => sum + (c.grossSale || 0), 0),
                grossProfit: dayCheckouts.reduce((sum, c) => sum + (c.grossProfit || 0), 0),
            });
        }

        const metrics: ShopDashboardMetrics = {
            todaysGrossSales,
            todaysSalesGrowthPct,
            weeklyRevenueGrowthIndex,
            averageTicketSize,
            inventoryCapitalRatio,
            weeklySalesTrend,
        };

        return { loading: false, error: null, data: { getShopDashboardMetrics: metrics } };
    }, [inventoryTable, checkoutTable, shopId]);

    return isSubscribed ? remote : offlineResult;
}

// =========================================================================
// MUTATIONS — dual-write when isSubscribed (gated by
// WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED). All mutations call Apollo
// imperatively (client.mutate) instead of useMutation, since nothing reads
// from Apollo's cache anymore.
//
// IMPORTANT: any branch that writes a _dirty row to TinyBase now ALSO
// dispatches an optimistic Redux update immediately. In Condition 3
// (isSubscribed && !persistLocally) TinyBase is write-only — nothing
// subscribes to it for display — so if a mutation hook doesn't push its
// own optimistic change into Redux, that change is invisible until
// syncEngine confirms it, and even then only if syncEngine's dispatch
// doesn't get raced by something else. Dispatching here, once, at the
// moment of the write, is what makes the count stay correct end to end.
// =========================================================================

type MutationCallbacks = {
    isSubscribed: boolean;
    onCompleted?: (data?: any) => void;
    onError?: (error: any) => void;
};

function useMutationState() {
    const [loading, setLoading] = useState(false);
    return { loading, setLoading };
}

// ---- useDeleteShop ----
export function useDeleteShop(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [loading, setLoading] = useState<boolean>(false);

    const deleteShop = useCallback(
        async (options: { variables: { shopId: string } }) => {
            const { shopId } = options.variables;
            setLoading(true);

            try {
                if (opts.isSubscribed) {
                    await client.mutate({
                        mutation: DELETE_SHOP_MUTATION,
                        variables: { shopId },
                    });

                    if (shouldPersistLocally(opts.isSubscribed)) {
                        store.delRow('shops', shopId);
                    }
                    // Redux removal for Condition 3 is done by the caller
                    // (MyShops.tsx already dispatches deleteShopAction in its
                    // onCompleted — that's the single writer here, so it's
                    // left as-is rather than duplicated in this hook).
                } else {
                    const existing = store.getRow('shops', shopId);
                    if (existing && Object.keys(existing).length > 0 && (existing as any)._serverSynced) {
                        store.setPartialRow('shops', shopId, { _deleted: true, _dirty: true });
                    } else {
                        store.delRow('shops', shopId);
                    }
                }

                opts.onCompleted?.();
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, opts.onCompleted, opts.onError, store]
    );

    return [deleteShop, { loading }] as const;
}

// ---- useCreateShop ----
export function useCreateShop(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [loading, setLoading] = useState<boolean>(false);

    const createShop = useCallback(
        async (options: { variables: { input: Partial<Shop> & { photo?: File | string | null; newPhoto?: File } } }) => {
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    const { data } = await client.mutate({
                        mutation: CREATE_SHOP_MUTATION,
                        variables: options.variables,
                    });
                    const serverShop = data?.createShop;

                    if (serverShop && shouldPersistLocally(opts.isSubscribed)) {
                        // Condition 2: TinyBase is the read model — write the
                        // clean server row there; the reconcile effect in
                        // useMyShops picks it up and dispatches it.
                        store.setRow('shops', serverShop.id, {
                            ...toShopRow(serverShop),
                            _dirty: false,
                            _serverSynced: true,
                            _deleted: false,
                        });
                    }
                    // Condition 3 (flag off): nothing to mirror into
                    // TinyBase. Redux is NOT dispatched here — this hook's
                    // only job is IO + TinyBase; the caller dispatches from
                    // onCompleted's returned `data`, same convention as
                    // useDeleteShop. Dispatching here too would duplicate
                    // whatever the caller already does.

                    opts.onCompleted?.(data);
                } else {
                    // --- PURE OFFLINE MODE (also used when isSubscribed is
                    // true but the caller treats this as a queued/local
                    // write) ---
                    const id = crypto.randomUUID();
                    const input: any = { ...options.variables.input };

                    if (input.photo instanceof File) {
                        input.photo = await fileToStorableBase64(input.photo);
                    }

                    const row = {
                        ...toShopRow(input),
                        _dirty: true,
                        _serverSynced: false,
                        _deleted: false,
                    };

                    store.setRow('shops', id, row);
                    const optimisticShop = fromShopRow(id, row);

                    // No dispatch here — hand the optimistic shop back via
                    // onCompleted and let the caller add it to Redux (same
                    // shape whether this was the online or offline branch,
                    // so the caller can dispatch uniformly either way).
                    // syncEngine.replaceLocalShop later swaps this same
                    // entry in place (by id === localId) once the server
                    // confirms it, so the count never drifts — as long as
                    // there's exactly one dispatch per event, which this
                    // hook no longer competes for.
                    opts.onCompleted?.({ createShop: optimisticShop });
                }
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store, opts.onCompleted, opts.onError]
    );

    return [createShop, { loading }] as const;
}

// ---- useUpdateShop ----
export function useUpdateShop(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [loading, setLoading] = useState<boolean>(false);

    const updateShop = useCallback(
        async (options: { variables: { shopId: string; input: Partial<Shop> & { photo?: string | null; newPhoto?: File; photos?: string[] } } }) => {
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    const { data } = await client.mutate({
                        mutation: UPDATE_SHOP_MUTATION,
                        variables: { input: { shopId: options.variables.shopId, ...options.variables.input } },
                    });
                    const serverShop = data?.updateShop;

                    if (serverShop && shouldPersistLocally(opts.isSubscribed)) {
                        store.setRow('shops', options.variables.shopId, {
                            ...toShopRow(serverShop),
                            _dirty: false,
                            _serverSynced: true,
                            _deleted: false,
                        });
                    }
                    // Condition 3 (flag off): no TinyBase mirror, and no
                    // dispatch here — caller owns Redux via onCompleted.

                    opts.onCompleted?.(data);
                } else {
                    const input: any = { ...options.variables.input };

                    if (input.newPhoto instanceof File) {
                        input.photo = await fileToStorableBase64(input.newPhoto);
                    } else if (input.photo instanceof File) {
                        input.photo = await fileToStorableBase64(input.photo);
                    }
                    delete input.newPhoto;

                    const existing = store.getRow('shops', options.variables.shopId);

                    const merged = {
                        ...existing,
                        ...toShopRow(input),
                        _dirty: true,
                    };

                    store.setRow('shops', options.variables.shopId, merged);
                    const optimisticShop = fromShopRow(options.variables.shopId, merged);

                    // No dispatch here — same reasoning as useCreateShop.
                    opts.onCompleted?.({ updateShop: optimisticShop });
                }
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store, opts.onCompleted, opts.onError]
    );

    return [updateShop, { loading }] as const;
}

// ---- useAddInventoryItem ----
export function useAddInventoryItem(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const { loading, setLoading } = useMutationState();

    const addInventoryItem = useCallback(
        async (options: { variables: { input: Partial<Item> & { photo?: File | string | null } } }) => {
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    const { data } = await client.mutate({ mutation: ADD_INVENTORY_ITEM_MUTATION, variables: options.variables });
                    const serverItem = data?.addInventoryItem;
                    if (serverItem && shouldPersistLocally(opts.isSubscribed)) {
                        store.setRow('inventory', serverItem.id, {
                            ...toItemRow(serverItem),
                            _dirty: false,
                            _serverSynced: true,
                            _deleted: false,
                        });
                    }
                    opts.onCompleted?.(data);
                } else {
                    const id = crypto.randomUUID();
                    const input: any = { ...options.variables.input };
                    if (input.photo instanceof File) {
                        input.photo = await fileToStorableBase64(input.photo);
                    }
                    const row = { ...toItemRow(input), _dirty: true, _serverSynced: false, _deleted: false };
                    store.setRow('inventory', id, row);
                    opts.onCompleted?.({ addInventoryItem: fromItemRow(id, row) });
                }
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store]
    );

    return [addInventoryItem, { loading }] as const;
}

// ---- useUpdateInventoryItem ----
export function useUpdateInventoryItem(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const { loading, setLoading } = useMutationState();

    const updateInventoryItem = useCallback(
        async (options: {
            variables: { itemId: string; input: Partial<Item> & { photo?: File | string | null; newPhoto?: File | null } };
        }) => {
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    const { data } = await client.mutate({
                        mutation: UPDATE_INVENTORY_ITEM_MUTATION,
                        variables: { input: { itemId: options.variables.itemId, ...options.variables.input } },
                    });
                    const serverItem = data?.updateInventoryItem;
                    if (serverItem && shouldPersistLocally(opts.isSubscribed)) {
                        store.setRow('inventory', options.variables.itemId, {
                            ...toItemRow(serverItem),
                            _dirty: false,
                            _serverSynced: true,
                            _deleted: false,
                        });
                    }
                    opts.onCompleted?.(data);
                } else {
                    const existing = store.getRow('inventory', options.variables.itemId);
                    if (!existing || Object.keys(existing).length === 0) throw new Error('Item not found locally');

                    const input: any = { ...options.variables.input };

                    if (input.newPhoto instanceof File) {
                        input.photo = await fileToStorableBase64(input.newPhoto);
                    } else if (input.photo instanceof File) {
                        input.photo = await fileToStorableBase64(input.photo);
                    } else if (input.photo === undefined && input.newPhoto === undefined) {
                        input.photo = existing.photo;
                    }
                    delete input.newPhoto;

                    const merged = {
                        ...existing,
                        ...toItemRow({ ...input, shopId: input.shopId ?? (existing.shopId as string) }),
                        _dirty: true,
                    };
                    store.setRow('inventory', options.variables.itemId, merged);
                    opts.onCompleted?.({ updateInventoryItem: fromItemRow(options.variables.itemId, merged) });
                }
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store]
    );

    return [updateInventoryItem, { loading }] as const;
}

// ---- useIncrementStock ----
export function useIncrementStock(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const { loading, setLoading } = useMutationState();

    const incrementStock = useCallback(
        async (options: { variables: { itemId: string; amount: number } }) => {
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    const { data } = await client.mutate({
                        mutation: INCREMENT_STOCK_MUTATION,
                        variables: { input: { itemId: options.variables.itemId, quantityToAdd: options.variables.amount } },
                    });
                    const serverItem = data?.incrementStock;
                    if (serverItem && shouldPersistLocally(opts.isSubscribed)) {
                        store.setRow('inventory', options.variables.itemId, {
                            ...toItemRow(serverItem),
                            _dirty: false,
                            _serverSynced: true,
                            _deleted: false,
                        });
                    }
                    opts.onCompleted?.(data);
                } else {
                    const existing = store.getRow('inventory', options.variables.itemId);
                    if (!existing || Object.keys(existing).length === 0) throw new Error('Item not found locally');
                    const newStock = ((existing.stockQuantity as number) || 0) + options.variables.amount;
                    store.setCell('inventory', options.variables.itemId, 'stockQuantity', newStock);
                    store.setCell('inventory', options.variables.itemId, 'updatedAt', new Date().toISOString());
                    store.setCell('inventory', options.variables.itemId, '_dirty', true);
                    const updated = store.getRow('inventory', options.variables.itemId);
                    opts.onCompleted?.({ incrementStock: fromItemRow(options.variables.itemId, updated) });
                }
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store, opts.onCompleted, opts.onError]
    );

    return [incrementStock, { loading }] as const;
}

// ---- useDeleteInventoryItem ----
export function useDeleteInventoryItem(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const { loading, setLoading } = useMutationState();

    const deleteInventoryItem = useCallback(
        async (options: { variables: { itemId: string } }) => {
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    await client.mutate({ mutation: DELETE_INVENTORY_ITEM_MUTATION, variables: { itemId: options.variables.itemId } });
                    if (shouldPersistLocally(opts.isSubscribed)) {
                        store.delRow('inventory', options.variables.itemId);
                    }
                } else {
                    const existing = store.getRow('inventory', options.variables.itemId);
                    if (existing && Object.keys(existing).length > 0 && existing._serverSynced) {
                        store.setPartialRow('inventory', options.variables.itemId, { _deleted: true, _dirty: true });
                    } else {
                        store.delRow('inventory', options.variables.itemId);
                    }
                }
                opts.onCompleted?.();
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store]
    );

    return [deleteInventoryItem, { loading }] as const;
}

export function useCheckoutCart(opts: MutationCallbacks & { shopId: string; isSubscribed?: boolean }) {
    const store = useStore() as Store;
    const { loading, setLoading } = useMutationState();

    const checkoutCart = useCallback(
        async (options: {
            variables: {
                input: {
                    shopId: string;
                    items: { itemId: string; quantity: number }[];
                };
            };
        }): Promise<CheckoutBatchResult | undefined> => {
            setLoading(true);
            const { shopId, items } = options.variables.input;

            try {
                if (opts.isSubscribed) {
                    const { data } = await client.mutate({
                        mutation: CHECKOUT_CART_MUTATION,
                        variables: {
                            input: options.variables.input,
                        },
                        fetchPolicy: 'no-cache',
                    });

                    const serverBatch = data?.checkoutCart;
                    if (serverBatch && shouldPersistLocally(opts.isSubscribed)) {
                        store.setRow('checkoutHistory', serverBatch.id, {
                            shopId: serverBatch.shopId,
                            soldAt: serverBatch.soldAt,
                            totalItems: serverBatch.totalItems,
                            totalCost: serverBatch.totalCost,
                            grossSale: serverBatch.grossSale,
                            grossProfit: serverBatch.grossProfit,
                            itemsJson: JSON.stringify(serverBatch.items ?? []),
                            _dirty: false,
                            _serverSynced: true,
                            _deleted: false,
                        });

                        (serverBatch.items ?? []).forEach((lineItem: any) => {
                            const existing = store.getRow('inventory', lineItem.inventoryItemId);
                            if (existing && Object.keys(existing).length > 0 && !existing._dirty) {
                                store.setCell(
                                    'inventory',
                                    lineItem.inventoryItemId,
                                    'stockQuantity',
                                    Math.max(0, ((existing.stockQuantity as number) || 0) - lineItem.quantity)
                                );
                                store.setCell('inventory', lineItem.inventoryItemId, '_serverSynced', true);
                            }
                        });
                    }

                    opts.onCompleted?.(data);
                    return { data };
                } else {
                    const id = crypto.randomUUID();

                    const lineItems = items.map((cartItem) => {
                        const invRow = store.getRow('inventory', cartItem.itemId) as any;
                        const costPrice = invRow?.costPrice || 0;
                        const itemName = invRow?.itemName || 'Unknown Item';
                        const sellingPrice = invRow?.sellingPrice || 0;

                        return {
                            id: crypto.randomUUID(),
                            inventoryItemId: cartItem.itemId,
                            itemName,
                            quantity: cartItem.quantity,
                            costPrice,
                            sellingPrice,
                            lineCostTotal: costPrice * cartItem.quantity,
                            lineSaleTotal: sellingPrice * cartItem.quantity,
                        };
                    });

                    const totalItems = lineItems.reduce((sum, i) => sum + i.quantity, 0);
                    const totalCost = lineItems.reduce((sum, i) => sum + i.lineCostTotal, 0);
                    const grossSale = lineItems.reduce((sum, i) => sum + i.lineSaleTotal, 0);
                    const grossProfit = grossSale - totalCost;

                    const record = {
                        shopId: shopId,
                        soldAt: new Date().toISOString(),
                        totalItems,
                        totalCost,
                        grossSale,
                        grossProfit,
                        itemsJson: JSON.stringify(lineItems),
                        _dirty: true,
                        _serverSynced: false,
                        _deleted: false,
                    };

                    store.setRow('checkoutHistory', id, record);

                    items.forEach((cartItem) => {
                        const existing = store.getRow('inventory', cartItem.itemId);
                        if (existing && Object.keys(existing).length > 0) {
                            const newStock = ((existing.stockQuantity as number) || 0) - cartItem.quantity;
                            store.setCell('inventory', cartItem.itemId, 'stockQuantity', Math.max(0, newStock));
                            store.setCell('inventory', cartItem.itemId, 'updatedAt', new Date().toISOString());
                        }
                    });

                    const mockResponse: CheckoutBatchResult = {
                        data: {
                            checkoutCart: {
                                id,
                                ...record,
                                items: lineItems,
                            },
                        },
                    };

                    opts.onCompleted?.(mockResponse.data);
                    return mockResponse;
                }
            } catch (err) {
                opts.onError?.(err);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store, opts.shopId, opts.onCompleted, opts.onError]
    );

    return [checkoutCart, { loading }] as const;
}