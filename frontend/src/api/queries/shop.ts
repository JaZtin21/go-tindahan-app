// shopHooks.ts (TinyBase — complete, all queries + mutations)
//
// isSubscribed picks Apollo (cloud) vs TinyBase (local). No sync/outbox yet
// by design — that's a later step. useTable/useRow are reactive on their
// own, so no manual subscribe/unsubscribe anywhere below.

import { useQuery, useLazyQuery, useMutation } from '@apollo/client/react';
import { useCallback, useMemo } from 'react';
import { useStore, useTable, useRow } from 'tinybase/ui-react';
import type { Store } from 'tinybase';
import type { Shop } from '~/types'; // adjust path to your actual types file
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


async function fileToStorableBase64(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    if (!file.type.startsWith('image/')) return dataUrl; // non-image files: skip resizing

    return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(dataUrl); // fallback to unresized original
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

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
        photo: item.photo ?? '',
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

// =========================================================================
// QUERIES
// =========================================================================

// ---- 1. useMyShops (GET_MY_SHOPS_QUERY) ----
export function useMyShops(opts: { limit: number; offset: number; isSubscribed: boolean }) {
    const { limit, offset, isSubscribed } = opts;
    const store = useStore() as Store;
    const shopsTable = useTable('shops', store);

    const apolloResult = useQuery(GET_MY_SHOPS_QUERY, {
        variables: { limit, offset },
        fetchPolicy: 'cache-and-network',
        skip: !isSubscribed,
    }) as { loading: boolean; error: any; data: any | undefined };

    // IMPORTANT: memoized so this object keeps the same reference across renders
    // where shopsTable/offset/limit haven't actually changed. Without this, a new
    // `data` object gets built every render, which breaks any consumer's
    // `useEffect(() => {...}, [data])` — data "changes" every render even though
    // its contents are identical, causing an infinite dispatch/re-render loop.
    const offlineResult = useMemo(() => {
        const allShops = Object.entries(shopsTable).map(([id, row]) => fromShopRow(id, row));
        const page = allShops.slice(offset, offset + limit);
        return {
            loading: false,
            error: null,
            data: {
                getMyShops: {
                    shops: page,
                    totalCount: allShops.length,
                    hasNextPage: offset + limit < allShops.length,
                },
            },
        };
    }, [shopsTable, offset, limit]);

    // Both hooks above always run, every render, regardless of isSubscribed —
    // only the returned VALUE branches. Never return early before a hook call.
    return isSubscribed ? apolloResult : offlineResult;
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

    const apolloResult = useQuery(GET_SHOP_INVENTORY_QUERY, {
        variables: {
            shopId,
            limit: itemsPerPage,
            offset,
            search: search || undefined,
            sortBy: sortBy || undefined,
            sortOrder: sortOrder || undefined,
        },
        fetchPolicy: 'no-cache',
        skip: !isSubscribed || !shopId,
    }) as { loading: boolean; error: any; data: { getShopInventory: { items: Item[]; totalCount: number } } };

    const offlineResult = useMemo(() => {
        let items = Object.entries(inventoryTable)
            .map(([id, row]) => fromItemRow(id, row))
            .filter((i) => i.shopId === shopId);

        if (search) {
            const re = new RegExp(search, 'i');
            items = items.filter((i) => re.test(i.itemName));
        }
        if (sortBy) {
            items = [...items].sort((a: any, b: any) => {
                const dir = sortOrder === 'desc' ? -1 : 1;
                return a[sortBy] > b[sortBy] ? dir : a[sortBy] < b[sortBy] ? -dir : 0;
            });
        }
        const page = items.slice(offset, offset + itemsPerPage);

        return {
            loading: false,
            error: null,
            data: { getShopInventory: { items: page, totalCount: items.length } },
        };
    }, [inventoryTable, shopId, search, sortBy, sortOrder, offset, itemsPerPage]);

    return isSubscribed ? apolloResult : offlineResult;
}

// ---- 3. useSearchShopProducts (SEARCH_SHOP_PRODUCTS_QUERY, was useLazyQuery) ----
export function useSearchShopProducts(isSubscribed: boolean) {
    const store = useStore() as Store;

    const [apolloSearch, apolloResult] = useLazyQuery(SEARCH_SHOP_PRODUCTS_QUERY, {
        fetchPolicy: 'network-only',
    });

    const search = useCallback(
        (options: { variables: { shopId: string; query: string } }) => {
            if (isSubscribed) return apolloSearch(options);

            const { shopId, query } = options.variables;
            const re = new RegExp(query, 'i');
            const inventoryTable = store.getTable('inventory');
            const results = Object.entries(inventoryTable)
                .map(([id, row]) => fromItemRow(id, row))
                .filter((i) => i.shopId === shopId && re.test(i.itemName));

            return Promise.resolve({ data: { searchShopProducts: results } });
        },
        [isSubscribed, store]
    );

    return isSubscribed ? ([apolloSearch, apolloResult] as const) : ([search, { loading: false, error: null }] as const);
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

    const apolloResult = useQuery(GET_CHECKOUT_HISTORY_QUERY, {
        variables: { shopId, limit: pageLimit, offset },
        skip: !isSubscribed || !shopId || activeTab !== 'checkout',
        fetchPolicy: 'no-cache',
    }) as { loading: boolean; error: any; data?: any };

    const offlineResult = useMemo(() => {
        if (activeTab !== 'checkout') return { loading: false, error: null, data: undefined };

        const records = Object.entries(checkoutTable)
            .filter(([, row]: any) => row.shopId === shopId)
            .map(([id, row]: any) => ({
                id,
                shopId: row.shopId,
                items: JSON.parse(row.itemsJson || '[]') as CartItem[],
                total: row.total,
                createdAt: row.createdAt,
            }));
        const page = records.slice(offset, offset + pageLimit);

        return {
            loading: false,
            error: null,
            data: { getCheckoutHistory: { records: page, totalCount: records.length } },
        };
    }, [checkoutTable, shopId, activeTab, offset, pageLimit]);

    return isSubscribed ? apolloResult : offlineResult;
}

// ---- 5. useItemActionHistory (GET_ITEM_ACTION_HISTORY_QUERY) ----
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

    const apolloResult = useQuery(GET_ITEM_ACTION_HISTORY_QUERY, {
        variables: { shopId, limit: pageLimit, offset },
        skip: !isSubscribed || !shopId || activeTab !== 'actions',
        fetchPolicy: 'no-cache',
    }) as { loading: boolean; error: any; data?: any };

    const offlineResult = useMemo(() => {
        if (activeTab !== 'actions') return { loading: false, error: null, data: undefined };

        const records = Object.entries(actionsTable)
            .filter(([, row]: any) => row.shopId === shopId)
            .map(([id, row]: any) => ({ id, ...row }));
        const page = records.slice(offset, offset + pageLimit);

        return {
            loading: false,
            error: null,
            data: { getItemActionHistory: { records: page, totalCount: records.length } },
        };
    }, [actionsTable, shopId, activeTab, offset, pageLimit]);

    return isSubscribed ? apolloResult : offlineResult;
}

// ---- 6. useShopById (GET_SHOP_BY_ID_QUERY) ----
export function useShopById(shopId: string, shop: Shop | undefined, isSubscribed: boolean) {
    const store = useStore() as Store;
    const row = useRow('shops', shopId, store);

    const apolloResult = useQuery(GET_SHOP_BY_ID_QUERY, {
        variables: { shopId },
        skip: !isSubscribed || !shopId || !!shop,
        fetchPolicy: 'no-cache',
    }) as { loading: boolean; error: any; data: { getShopById: Shop } | undefined };

    const offlineResult = useMemo(() => {
        const hasRow = row && Object.keys(row).length > 0;
        return {
            loading: false,
            error: null,
            data: hasRow ? { getShopById: fromShopRow(shopId, row) } : undefined,
        };
    }, [row, shopId]);

    return isSubscribed ? apolloResult : offlineResult;
}

// ---- 7. useShopDashboardMetrics (GET_SHOP_DASHBOARD_METRICS_QUERY) ----
// Computed locally from inventory + checkoutHistory — this is an approximation,
// not a synced copy of your backend's calculation. Adjust the math to match
// whatever your Go resolver actually does if exact parity matters offline.
export function useShopDashboardMetrics(shopId: string, isSubscribed: boolean) {
    const store = useStore() as Store;
    const inventoryTable = useTable('inventory', store);
    const checkoutTable = useTable('checkoutHistory', store);

    const apolloResult = useQuery(GET_SHOP_DASHBOARD_METRICS_QUERY, {
        variables: { shopId },
        skip: !isSubscribed || !shopId,
    }) as { data: { getShopDashboardMetrics: ShopDashboardMetrics }; loading: boolean; error: any };

    const offlineResult = useMemo(() => {
        const items = Object.values(inventoryTable).filter((r: any) => r.shopId === shopId) as any[];
        const checkouts = Object.values(checkoutTable).filter((r: any) => r.shopId === shopId) as any[];

        const today = new Date().toDateString();
        const todaysCheckouts = checkouts.filter((c) => new Date(c.createdAt).toDateString() === today);
        const todaysGrossSales = todaysCheckouts.reduce((sum, c) => sum + (c.total || 0), 0);
        const inventoryValue = items.reduce((sum, i) => sum + (i.costPrice || 0) * (i.stockQuantity || 0), 0);

        const metrics: ShopDashboardMetrics = {
            todaysGrossSales,
            todaysSalesGrowthPct: 0, // needs yesterday's figure — not computed here
            weeklyRevenueGrowthIndex: 0,
            averageTicketSize: todaysCheckouts.length ? todaysGrossSales / todaysCheckouts.length : 0,
            inventoryCapitalRatio: inventoryValue,
            weeklySalesTrend: [] as DailySalesMetric[], // build from `checkouts` grouped by day if you need this offline
        };

        return { loading: false, error: null, data: { getShopDashboardMetrics: metrics } };
    }, [inventoryTable, checkoutTable, shopId]);

    return isSubscribed ? apolloResult : offlineResult;
}

// =========================================================================
// MUTATIONS
// =========================================================================

type MutationCallbacks = {
    isSubscribed: boolean;
    onCompleted?: (data?: any) => void;
    onError?: (error: any) => void;
    refetchQueries?: any; // ignored offline — useTable/useRow already update live on write
    awaitRefetchQueries?: boolean; // ignored offline
};

// ---- useDeleteShop ----
export function useDeleteShop(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [mutate, { loading }] = useMutation(DELETE_SHOP_MUTATION, {
        refetchQueries: opts.refetchQueries,
        onCompleted: opts.onCompleted,
        onError: opts.onError,
    });

    const deleteShop = useCallback(
        async (options: { variables: { shopId: string } }) => {
            if (opts.isSubscribed) return mutate(options);
            try {
                store.delRow('shops', options.variables.shopId);
                opts.onCompleted?.();
            } catch (err) {
                opts.onError?.(err);
            }
        },
        [opts.isSubscribed, store]
    );

    return [deleteShop, { loading: opts.isSubscribed ? loading : false }] as const;
}

// ---- useCreateShop ----
export function useCreateShop(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [mutate, { loading }] = useMutation(CREATE_SHOP_MUTATION, {
        onCompleted: opts.onCompleted,
        onError: opts.onError,
    });

    const createShop = useCallback(
        async (options: { variables: { input: Partial<Shop> } }) => {
            if (opts.isSubscribed) return mutate(options);
            try {
                const id = crypto.randomUUID();
                const input = { ...options.variables.input };
                // photo may arrive as a File (from an <input type="file">) — TinyBase
                // can't store that directly, so convert it to a base64 string first.
                if (input.photo instanceof File) {
                    input.photo = await fileToStorableBase64(input.photo);
                }
                const row = toShopRow(input);
                store.setRow('shops', id, row);
                opts.onCompleted?.({ createShop: fromShopRow(id, row) });
            } catch (err) {
                opts.onError?.(err);
            }
        },
        [opts.isSubscribed, store]
    );

    return [createShop, { loading: opts.isSubscribed ? loading : false }] as const;
}

// ---- useUpdateShop ----
export function useUpdateShop(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [mutate, { loading }] = useMutation(UPDATE_SHOP_MUTATION, {
        onCompleted: opts.onCompleted,
        onError: opts.onError,
    });

    const updateShop = useCallback(
        async (options: { variables: { shopId: string; input: Partial<Shop> } }) => {
            if (opts.isSubscribed) return mutate(options);
            try {
                const input = { ...options.variables.input };
                if (input.photo instanceof File) {
                    input.photo = await fileToStorableBase64(input.photo);
                }
                const existing = store.getRow('shops', options.variables.shopId);
                const merged = { ...existing, ...toShopRow(input) };
                store.setRow('shops', options.variables.shopId, merged);
                opts.onCompleted?.({ updateShop: fromShopRow(options.variables.shopId, merged) });
            } catch (err) {
                opts.onError?.(err);
            }
        },
        [opts.isSubscribed, store]
    );

    return [updateShop, { loading: opts.isSubscribed ? loading : false }] as const;
}

// ---- useAddInventoryItem ----
export function useAddInventoryItem(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [mutate, { loading }] = useMutation(ADD_INVENTORY_ITEM_MUTATION, {
        refetchQueries: ['GetShopInventory'],
        onCompleted: opts.onCompleted,
        onError: opts.onError,
    });

    const addInventoryItem = useCallback(
        async (options: { variables: { input: Partial<Item> } }) => {
            if (opts.isSubscribed) return mutate(options);
            try {
                const id = crypto.randomUUID();
                const row = toItemRow(options.variables.input);
                store.setRow('inventory', id, row);
                opts.onCompleted?.({ addInventoryItem: fromItemRow(id, row) });
            } catch (err) {
                opts.onError?.(err);
            }
        },
        [opts.isSubscribed, store]
    );

    return [addInventoryItem, { loading: opts.isSubscribed ? loading : false }] as const;
}

// ---- useUpdateInventoryItem ----
export function useUpdateInventoryItem(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [mutate, { loading }] = useMutation(UPDATE_INVENTORY_ITEM_MUTATION, {
        refetchQueries: ['GetShopInventory'],
        onCompleted: opts.onCompleted,
        onError: opts.onError,
    });

    const updateInventoryItem = useCallback(
        async (options: { variables: { itemId: string; input: Partial<Item> } }) => {
            if (opts.isSubscribed) return mutate(options);
            try {
                const existing = store.getRow('inventory', options.variables.itemId);
                if (!existing || Object.keys(existing).length === 0) throw new Error('Item not found locally');
                const merged = { ...existing, ...toItemRow(options.variables.input) };
                store.setRow('inventory', options.variables.itemId, merged);
                opts.onCompleted?.({ updateInventoryItem: fromItemRow(options.variables.itemId, merged) });
            } catch (err) {
                opts.onError?.(err);
            }
        },
        [opts.isSubscribed, store]
    );

    return [updateInventoryItem, { loading: opts.isSubscribed ? loading : false }] as const;
}

// ---- useIncrementStock ----
export function useIncrementStock(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [mutate, { loading }] = useMutation(INCREMENT_STOCK_MUTATION, {
        awaitRefetchQueries: true,
        onCompleted: opts.onCompleted,
        onError: opts.onError,
    });

    const incrementStock = useCallback(
        async (options: { variables: { itemId: string; amount: number } }) => {
            if (opts.isSubscribed) return mutate(options);
            try {
                const existing = store.getRow('inventory', options.variables.itemId);
                if (!existing || Object.keys(existing).length === 0) throw new Error('Item not found locally');
                const newStock = (existing.stockQuantity as number || 0) + options.variables.amount;
                store.setCell('inventory', options.variables.itemId, 'stockQuantity', newStock);
                store.setCell('inventory', options.variables.itemId, 'updatedAt', new Date().toISOString());
                const updated = store.getRow('inventory', options.variables.itemId);
                opts.onCompleted?.({ incrementStock: fromItemRow(options.variables.itemId, updated) });
            } catch (err) {
                opts.onError?.(err);
            }
        },
        [opts.isSubscribed, store]
    );

    return [incrementStock, { loading: opts.isSubscribed ? loading : false }] as const;
}

// ---- useDeleteInventoryItem ----
export function useDeleteInventoryItem(opts: MutationCallbacks) {
    const store = useStore() as Store;
    const [mutate, { loading }] = useMutation(DELETE_INVENTORY_ITEM_MUTATION, {
        refetchQueries: ['GetShopInventory'],
        onCompleted: opts.onCompleted,
        onError: opts.onError,
    });

    const deleteInventoryItem = useCallback(
        async (options: { variables: { itemId: string } }) => {
            if (opts.isSubscribed) return mutate(options);
            try {
                store.delRow('inventory', options.variables.itemId);
                opts.onCompleted?.();
            } catch (err) {
                opts.onError?.(err);
            }
        },
        [opts.isSubscribed, store]
    );

    return [deleteInventoryItem, { loading: opts.isSubscribed ? loading : false }] as const;
}

// ---- useCheckoutCart ----
// Writes a checkout record AND decrements stock for each cart item locally,
// mirroring what your CHECKOUT_CART_MUTATION presumably does server-side.
export function useCheckoutCart(opts: MutationCallbacks & { shopId: string }) {
    const store = useStore() as Store;
    const [mutate, { loading }] = useMutation(CHECKOUT_CART_MUTATION, {
        refetchQueries: [{ query: GET_SHOP_DASHBOARD_METRICS_QUERY, variables: { shopId: opts.shopId } }],
        awaitRefetchQueries: true,
        onCompleted: opts.onCompleted,
        onError: opts.onError,
    });

    const checkoutCart = useCallback(
        async (options: { variables: { items: CartItem[]; total: number } }) => {
            if (opts.isSubscribed) return mutate(options);
            try {
                const id = crypto.randomUUID();
                const record = {
                    shopId: opts.shopId,
                    itemsJson: JSON.stringify(options.variables.items),
                    total: options.variables.total,
                    createdAt: new Date().toISOString(),
                };
                store.setRow('checkoutHistory', id, record);

                // decrement stock for each purchased item
                options.variables.items.forEach((cartItem) => {
                    const existing = store.getRow('inventory', cartItem.id);
                    if (existing && Object.keys(existing).length > 0) {
                        const newStock = (existing.stockQuantity as number || 0) - cartItem.quantity;
                        store.setCell('inventory', cartItem.id, 'stockQuantity', Math.max(0, newStock));
                        store.setCell('inventory', cartItem.id, 'updatedAt', new Date().toISOString());
                    }
                });

                opts.onCompleted?.({ checkoutCart: { id, ...record, items: options.variables.items } });
            } catch (err) {
                opts.onError?.(err);
            }
        },
        [opts.isSubscribed, store, opts.shopId]
    );

    return [checkoutCart, { loading: opts.isSubscribed ? loading : false }] as const;
}