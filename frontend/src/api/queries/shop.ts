// shopHooks.ts (TinyBase — complete, all queries + mutations)
//
// ============================================================================
// READ MODEL: TinyBase is the ONLY thing components read from. Full stop.
// ============================================================================
// Every query hook below follows the same shape:
//   1. If isSubscribed, imperatively fetch from the backend (client.query,
//      fetchPolicy: 'no-cache' so Apollo's own cache is never consulted).
//   2. Write whatever comes back into TinyBase via upsertServerRow(), which
//      refuses to clobber any row that's still _dirty (unsynced local edit).
//   3. Read the result for rendering from TinyBase itself — the exact same
//      read path whether isSubscribed is true or false.
//
// This is what actually "merges" server + local data: the merge happens at
// WRITE time (step 2), not at read time. There is no separate merge pass to
// maintain, no duplicated logic, and no fragile totalCount arithmetic.
//
// ============================================================================
// WRITE MODEL: dual-write when isSubscribed
// ============================================================================
// isSubscribed true  -> hit the backend AND upsert the server's authoritative
//                        response into TinyBase (_dirty:false, _serverSynced:true)
//                        so offline reads work immediately, no manual sync needed.
// isSubscribed false -> write to TinyBase only, marked _dirty:true, so
//                        syncEngine.ts picks it up on the next "Sync now".
//
// syncEngine.ts (unchanged) is what reconciles _dirty rows on manual sync,
// pushing local changes first and then pulling the server's state back down
// — see that file for the push-then-pull ordering rationale.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore, useTable, useRow, useValue } from 'tinybase/ui-react';
import type { Store } from 'tinybase';
import client from '../../config/apolloClient';
import type { Shop } from '~/types';
import type { Item, CartItem } from '~/types';
import type { ShopDashboardMetrics, DailySalesMetric } from '~/types/shop';

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
    const store = useStore() as Store;
    const shopsTable = useTable('shops', store);
    const serverTotalCount = (useValue('shopsTotalCount', store) as number) ?? 0;
    const [state, setState] = useState<{ loading: boolean; error: any }>({ loading: false, error: null });

    useEffect(() => {
        if (!isSubscribed) return;
        let cancelled = false;
        setState({ loading: true, error: null });

        // Snapshot which local shop ids currently occupy THIS page window,
        // before the fetch resolves. This is our orphan-candidate set: if a
        // shop that used to sit in this exact page doesn't come back in the
        // fresh response, it was deleted server-side (by this tab or another
        // tab/session) and the stale local row needs to go too — otherwise
        // it sits in TinyBase forever, since upsertServerRow only ever
        // adds/updates rows, it never removes ones the server stopped
        // returning. Scoped to this page (not "delete anything missing from
        // the response") so shops that are simply on a different page don't
        // get wrongly wiped.
        const priorPageIds = Object.entries(store.getTable('shops'))
            .filter(([, row]: any) => !row._deleted)
            .map(([id, row]) => ({ id, row }))
            .sort((a, b) => new Date((b.row as any).createdAt).getTime() - new Date((a.row as any).createdAt).getTime())
            .slice(offset, offset + limit)
            .map(({ id }) => id);

        client
            .query({
                query: GET_MY_SHOPS_QUERY,
                variables: { limit, offset },
                fetchPolicy: 'no-cache', // never read Apollo's own cache — TinyBase is the source of truth
            })
            .then(({ data }: any) => {
                if (cancelled) return;
                const fetchedShops = data?.getMyShops?.shops ?? [];
                const fetchedIds = new Set(fetchedShops.map((s: any) => s.id));

                fetchedShops.forEach((shop: any) => {
                    upsertServerRow(store, 'shops', shop.id, toShopRow(shop));
                });

                // Orphan cleanup, scoped to priorPageIds only (see comment above).
                priorPageIds.forEach((id) => {
                    if (fetchedIds.has(id)) return;
                    const row = store.getRow('shops', id);
                    if (row && Object.keys(row).length > 0 && !(row as any)._dirty && (row as any)._serverSynced) {
                        store.delRow('shops', id);
                    }
                });

                store.setValue('shopsTotalCount', data?.getMyShops?.totalCount ?? 0);
                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, limit, offset, store]);

    // Single read path, online or offline: everything server-fetched has
    // already landed in TinyBase (upsertServerRow above), and anything
    // created/edited locally is already sitting here too.
    const allShops = useMemo(() => {
        return Object.entries(shopsTable)
            .filter(([, row]: any) => !row._deleted)
            .map(([id, row]) => fromShopRow(id, row))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [shopsTable]);

    // totalCount: prefer the real local count once we have it; fall back to
    // whatever the server last reported so pagination doesn't flicker to 0
    // while a fetch is in flight.
    const totalCount = isSubscribed ? Math.max(serverTotalCount, allShops.length) : allShops.length;

    // IMPORTANT: memoize the returned object. Without this, every render of
    // a *consuming* component builds a brand-new `data` object here — even
    // when nothing in TinyBase actually changed — which breaks referential
    // equality for any effect downstream that lists `data` as a dependency
    // (e.g. MyShops.tsx dispatching into Redux). That effect then fires on
    // every render, dispatches, the dispatch triggers a re-render via
    // useSelector, which calls this hook again, which builds a new object
    // again... "Maximum update depth exceeded".
    return useMemo(() => {
        const page = allShops.slice(offset, offset + limit);
        return {
            loading: state.loading,
            error: state.error,
            data: {
                getMyShops: {
                    shops: page,
                    totalCount,
                    hasNextPage: offset + limit < totalCount,
                },
            },
        };
    }, [allShops, offset, limit, totalCount, state.loading, state.error]);
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
                (data?.getShopInventory?.items ?? []).forEach((item: any) => {
                    upsertServerRow(store, 'inventory', item.id, toItemRow(item));
                });
                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, shopId, itemsPerPage, offset, search, sortBy, sortOrder, store]);

    const items = useMemo(() => {
        let result = Object.entries(inventoryTable)
            .filter(([, row]: any) => !row._deleted)
            .map(([id, row]) => fromItemRow(id, row))
            .filter((i) => i.shopId === shopId);

        if (search) {
            const re = new RegExp(search, 'i');
            result = result.filter((i) => re.test(i.itemName));
        }
        if (sortBy) {
            result = [...result].sort((a: any, b: any) => {
                const dir = sortOrder === 'desc' ? -1 : 1;
                return a[sortBy] > b[sortBy] ? dir : a[sortBy] < b[sortBy] ? -dir : 0;
            });
        }
        return result;
    }, [inventoryTable, shopId, search, sortBy, sortOrder]);

    return useMemo(() => {
        const page = items.slice(offset, offset + itemsPerPage);
        return {
            loading: state.loading,
            error: state.error,
            data: { getShopInventory: { items: page, totalCount: items.length } },
        };
    }, [items, offset, itemsPerPage, state.loading, state.error]);
}

// ---- 3. useSearchShopProducts (SEARCH_SHOP_PRODUCTS_QUERY) ----
export function useSearchShopProducts(isSubscribed: boolean) {
    const store = useStore() as Store;
    const [result, setResult] = useState<{ loading: boolean; error: any; data?: any }>({ loading: false, error: null });

    const search = useCallback(
        async (options: { variables: { shopId: string; query: string } }) => {
            const { shopId, query } = options.variables;

            if (!isSubscribed) {
                const re = new RegExp(query, 'i');
                const inventoryTable = store.getTable('inventory');
                const results = Object.entries(inventoryTable)
                    .filter(([, row]: any) => !row._deleted)
                    .map(([id, row]) => fromItemRow(id, row))
                    .filter((i) => i.shopId === shopId && re.test(i.itemName));
                const data = { searchShopProducts: results };
                setResult({ loading: false, error: null, data });
                return { data };
            }

            setResult((prev) => ({ ...prev, loading: true }));
            try {
                const { data } = await client.query({
                    query: SEARCH_SHOP_PRODUCTS_QUERY,
                    variables: { shopId, query },
                    fetchPolicy: 'no-cache',
                });
                setResult({ loading: false, error: null, data });
                return { data };
            } catch (error) {
                setResult({ loading: false, error });
                throw error;
            }
        },
        [isSubscribed, store]
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
                (data?.getCheckoutHistory?.batches ?? []).forEach((batch: any) => {
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
                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, shopId, activeTab, offset, pageLimit, store]);

    const batches = useMemo(() => {
        if (activeTab !== 'checkout') return [];
        return Object.entries(checkoutTable)
            .filter(([, row]: any) => row.shopId === shopId && !row._deleted)
            .map(([id, row]) => fromCheckoutRow(id, row))
            .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime()); // matches ORDER BY sold_at DESC
    }, [checkoutTable, shopId, activeTab]);

    return useMemo(() => {
        if (activeTab !== 'checkout') return { loading: state.loading, error: state.error, data: undefined };
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
    }, [batches, activeTab, offset, pageLimit, state.loading, state.error]);
}

// ---- 5. useItemActionHistory (GET_ITEM_ACTION_HISTORY_QUERY) ----
// Pull-only on purpose: your backend writes these rows itself as a side
// effect of other mutations (AddInventoryItem/UpdateInventoryItem/
// DeleteInventoryItem/IncrementStock). There's no client mutation that
// creates a local-only unsynced action record, so there's no _dirty case
// to worry about here — a plain upsert is all this table ever needs.
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
                (data?.getItemActionHistory?.records ?? []).forEach((record: any) => {
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
                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, shopId, activeTab, offset, pageLimit, store]);

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
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // matches ORDER BY created_at DESC
    }, [actionsTable, shopId, activeTab]);

    return useMemo(() => {
        if (activeTab !== 'actions') return { loading: state.loading, error: state.error, data: undefined };
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
    }, [records, activeTab, offset, pageLimit, state.loading, state.error]);
}

// ---- 6. useShopById (GET_SHOP_BY_ID_QUERY) ----
export function useShopById(shopId: string, shop: Shop | undefined, isSubscribed: boolean) {
    const store = useStore() as Store;
    const row = useRow('shops', shopId, store);
    const [state, setState] = useState<{ loading: boolean; error: any }>({ loading: false, error: null });

    useEffect(() => {
        if (!isSubscribed || !shopId || shop) return;
        let cancelled = false;
        setState({ loading: true, error: null });

        client
            .query({ query: GET_SHOP_BY_ID_QUERY, variables: { shopId }, fetchPolicy: 'no-cache' })
            .then(({ data }: any) => {
                if (cancelled) return;
                if (data?.getShopById) {
                    upsertServerRow(store, 'shops', shopId, toShopRow(data.getShopById));
                }
                setState({ loading: false, error: null });
            })
            .catch((error: any) => {
                if (!cancelled) setState({ loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, [isSubscribed, shopId, shop, store]);

    return useMemo(() => {
        const hasRow = row && Object.keys(row).length > 0;
        return {
            loading: state.loading,
            error: state.error,
            data: hasRow ? { getShopById: fromShopRow(shopId, row) } : undefined,
        };
    }, [row, shopId, state.loading, state.error]);
}

// ---- 7. useShopDashboardMetrics (GET_SHOP_DASHBOARD_METRICS_QUERY) ----
// Computed locally from inventory + checkoutHistory to MATCH your Go
// resolver's SQL as closely as JS date math allows:
//   - todaysGrossSales / todaysSalesGrowthPct: today vs the exact same
//     calendar day 7 days ago (a 1-day window each), per your salesQuery.
//   - weeklyRevenueGrowthIndex: trailing 7 days vs the 7 days before that,
//     per your weeklyQuery. 100 when there's no prior-period baseline.
//   - averageTicketSize: AVG(gross_sale) across ALL checkout batches ever
//     for this shop — NOT just today's — matching your aovQuery exactly.
//   - inventoryCapitalRatio: sum(cost*qty) / sum(price*qty) * 100.
//   - weeklySalesTrend: last 7 calendar days, oldest -> newest, matching
//     your RECURSIVE calendar series query.
//
// NOT merged with local deltas when isSubscribed: true — this is a
// server-computed SQL aggregate, not a list of rows. An offline sale won't
// show in the ONLINE metrics view until it's actually pushed via "Sync now".
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
                fetchPolicy: 'no-cache', // was previously defaulting to cache-first — real bug, fixed here
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
// MUTATIONS — dual-write when isSubscribed. All mutations now call Apollo
// imperatively (client.mutate) instead of useMutation, since nothing reads
// from Apollo's cache anymore — refetchQueries/awaitRefetchQueries are gone
// because there's no cache-bound UI left for them to refresh.
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
    const { loading, setLoading } = useMutationState();

    const deleteShop = useCallback(
        async (options: { variables: { shopId: string } }) => {
            const { shopId } = options.variables;
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    await client.mutate({ mutation: DELETE_SHOP_MUTATION, variables: { shopId } });
                    store.delRow('shops', shopId);
                } else {
                    const existing = store.getRow('shops', shopId);
                    if (existing && Object.keys(existing).length > 0 && existing._serverSynced) {
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
        [opts.isSubscribed, store]
    );

    return [deleteShop, { loading }] as const;
}

// ---- useCreateShop ----
export function useCreateShop(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const { loading, setLoading } = useMutationState();

    const createShop = useCallback(
        async (options: { variables: { input: Partial<Shop> & { photo?: File | string | null; newPhoto?: File } } }) => {
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    const { data } = await client.mutate({ mutation: CREATE_SHOP_MUTATION, variables: options.variables });
                    const serverShop = data?.createShop;
                    if (serverShop) {
                        store.setRow('shops', serverShop.id, {
                            ...toShopRow(serverShop),
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
                    const row = { ...toShopRow(input), _dirty: true, _serverSynced: false, _deleted: false };
                    store.setRow('shops', id, row);
                    opts.onCompleted?.({ createShop: fromShopRow(id, row) });
                }
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store]
    );

    return [createShop, { loading }] as const;
}

// ---- useUpdateShop ----
// FIX: the offline branch used to only ever look at `input.photo` (a
// string) when building the local row, so a newly-picked cover image sent
// as `input.newPhoto` (a File — matching UpdateShopInput's photo:String +
// newPhoto:Upload split) was silently dropped. Now newPhoto is preferred
// and converted to a storable base64 string, same as the create path, so
// syncEngine's splitPhotoForUpdate() finds it and uploads it on next sync.
export function useUpdateShop(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const { loading, setLoading } = useMutationState();

    const updateShop = useCallback(
        async (options: {
            variables: { shopId: string; input: Partial<Shop> & { photo?: string | null; newPhoto?: File; photos?: string[] } };
        }) => {
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    const { data } = await client.mutate({
                        mutation: UPDATE_SHOP_MUTATION,
                        variables: { input: { shopId: options.variables.shopId, ...options.variables.input } },
                    });
                    const serverShop = data?.updateShop;
                    if (serverShop) {
                        store.setRow('shops', options.variables.shopId, {
                            ...toShopRow(serverShop),
                            _dirty: false,
                            _serverSynced: true,
                            _deleted: false,
                        });
                    }
                    opts.onCompleted?.(data);
                } else {
                    const input: any = { ...options.variables.input };

                    // FIX: newPhoto (a File) takes priority over photo (an existing
                    // URL string) — this is the field that actually changed.
                    if (input.newPhoto instanceof File) {
                        input.photo = await fileToStorableBase64(input.newPhoto);
                    } else if (input.photo instanceof File) {
                        // defensive: some callers may still pass a raw File as `photo`
                        input.photo = await fileToStorableBase64(input.photo);
                    }
                    delete input.newPhoto;

                    const existing = store.getRow('shops', options.variables.shopId);
                    const merged = { ...existing, ...toShopRow(input), _dirty: true };
                    store.setRow('shops', options.variables.shopId, merged);
                    opts.onCompleted?.({ updateShop: fromShopRow(options.variables.shopId, merged) });
                }
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store]
    );

    return [updateShop, { loading }] as const;
}

// ---- useAddInventoryItem ----
// FIX: the offline branch used to pass options.variables.input straight into
// toItemRow(), which only keeps `photo` when it's already a string
// (`typeof item.photo === 'string' ? item.photo : ''`). A freshly-picked
// File was silently discarded, so newly-added offline items always saved
// with no photo — invisible until you looked at the edit form. Now we
// convert the File to a storable base64 string first, same pattern as
// useCreateShop.
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
                    if (serverItem) {
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
// FIX (two bugs):
//  1. Photo: same File-dropping issue as useAddInventoryItem — plus this
//     hook now honors `newPhoto` (a File, sent when the user picks a new
//     photo while editing) the same way useUpdateShop does. If neither
//     `newPhoto` nor `photo` is present in the input (user didn't touch the
//     photo field at all), we keep whatever the item already had instead of
//     wiping it.
//  2. shopId clobbering (the "item disappears after save" bug): toItemRow()
//     defaults shopId to '' when it's not present on the input — and the
//     edit form's payload never includes shopId. Since `{ ...existing,
//     ...toItemRow(input) }` spreads toItemRow's result AFTER existing, that
//     '' was overwriting the item's real shopId, so useShopInventory's
//     `i.shopId === shopId` filter stopped matching and the item vanished
//     from the list (it was never actually deleted). Fix: always resolve
//     shopId from `existing` unless the input explicitly overrides it.
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
                    if (serverItem) {
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
                        // Field genuinely absent from this call (caller didn't send it
                        // at all) — keep the existing photo instead of letting
                        // toItemRow() default it to ''.
                        // IMPORTANT: this is NOT the same as input.photo === '' — an
                        // explicit empty string means the user actively removed the
                        // photo and it must be cleared, not restored.
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
// FIX: previously passed `awaitRefetchQueries: opts.isSubscribed` to
// useMutation without ever supplying a `refetchQueries` list, which did
// nothing — dead code, now removed along with useMutation itself.
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
                    if (serverItem) {
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
        [opts.isSubscribed, store]
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
                    store.delRow('inventory', options.variables.itemId);
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

// ---- useCheckoutCart ----
export function useCheckoutCart(opts: MutationCallbacks & { shopId: string }) {
    const store = useStore() as Store;
    const { loading, setLoading } = useMutationState();

    const checkoutCart = useCallback(
        async (options: { variables: { items: CartItem[] } }) => {
            setLoading(true);
            try {
                if (opts.isSubscribed) {
                    const { data } = await client.mutate({
                        mutation: CHECKOUT_CART_MUTATION,
                        variables: {
                            input: {
                                shopId: opts.shopId,
                                items: options.variables.items.map((i) => ({ itemId: i.id, quantity: i.quantity })),
                            },
                        },
                    });
                    const serverBatch = data?.checkoutCart;
                    if (serverBatch) {
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
                        // The server already decremented stock authoritatively — sync
                        // TinyBase's copy so the dashboard/inventory views agree with it.
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
                } else {
                    const id = crypto.randomUUID();

                    const lineItems = options.variables.items.map((cartItem) => {
                        const invRow = store.getRow('inventory', cartItem.id) as any;
                        const costPrice = invRow?.costPrice || 0;
                        return {
                            id: crypto.randomUUID(),
                            inventoryItemId: cartItem.id,
                            itemName: cartItem.itemName,
                            quantity: cartItem.quantity,
                            costPrice,
                            sellingPrice: cartItem.sellingPrice,
                            lineCostTotal: costPrice * cartItem.quantity,
                            lineSaleTotal: cartItem.sellingPrice * cartItem.quantity,
                        };
                    });

                    const totalItems = lineItems.reduce((sum, i) => sum + i.quantity, 0);
                    const totalCost = lineItems.reduce((sum, i) => sum + i.lineCostTotal, 0);
                    const grossSale = lineItems.reduce((sum, i) => sum + i.lineSaleTotal, 0);
                    const grossProfit = grossSale - totalCost;

                    const record = {
                        shopId: opts.shopId,
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

                    // NOTE: intentionally NOT marking these inventory cells `_dirty`
                    // as part of a checkout-driven decrement — see syncEngine.ts
                    // syncAll() comment for why (avoids a double-decrement once the
                    // checkout itself pushes and the server does its own decrement).
                    options.variables.items.forEach((cartItem) => {
                        const existing = store.getRow('inventory', cartItem.id);
                        if (existing && Object.keys(existing).length > 0) {
                            const newStock = ((existing.stockQuantity as number) || 0) - cartItem.quantity;
                            store.setCell('inventory', cartItem.id, 'stockQuantity', Math.max(0, newStock));
                            store.setCell('inventory', cartItem.id, 'updatedAt', new Date().toISOString());
                        }
                    });

                    opts.onCompleted?.({ checkoutCart: { id, ...record, items: lineItems } });
                }
            } catch (err) {
                opts.onError?.(err);
            } finally {
                setLoading(false);
            }
        },
        [opts.isSubscribed, store, opts.shopId]
    );

    return [checkoutCart, { loading }] as const;
}