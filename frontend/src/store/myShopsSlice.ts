import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Shop } from "~/types/shop";


interface MyShopsState {
    shops: Shop[];
    totalCount: number;
    loading: boolean;
    error: string | null;
}

// 2. Establish baseline initial state layout
const initialState: MyShopsState = {
    shops: [],
    totalCount: 0,
    loading: false,
    error: null,
};

const myShopsSlice = createSlice({
    name: 'myShops',
    initialState,
    reducers: {
        // Call this action when loading shops from your GraphQL Query query hook
        setShops: (state, action: PayloadAction<{ shops: Shop[]; totalCount: number }>) => {
            state.shops = action.payload.shops;
            state.totalCount = action.payload.totalCount;
            state.loading = false;
            state.error = null;
        },

        // Call this inside your CreateShop mutation callback to push the new entry to cache
        addShop: (state, action: PayloadAction<Shop>) => {
            state.shops.unshift(action.payload); // Adds new shop to the beginning of the list
            state.totalCount += 1;
        },

        // Call this inside your UpdateShop mutation callback to update local tracking
        updateShop: (state, action: PayloadAction<Shop>) => {
            const index = state.shops.findIndex(shop => shop.id === action.payload.id);
            if (index !== -1) {
                // 🔄 Case A: It exists already -> Overwrite it in place
                state.shops[index] = action.payload;
            } else {
                // 📥 Case B: Array is empty (F5 Reload) -> Insert it fresh into state
                state.shops.push(action.payload);
                state.totalCount += 1;
            }
        },

        // Call this inside your DeleteShop mutation callback to strip it out instantly
        deleteShop: (state, action: PayloadAction<string>) => {
            state.shops = state.shops.filter(shop => shop.id !== action.payload);
            if (state.totalCount > 0) {
                state.totalCount -= 1;
            }
        },

        // Standard helper actions to toggle loader layout indicators easily
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearShopsCache: (state) => {
            state.shops = [];
            state.totalCount = 0;
            state.error = null;
        },
        replaceLocalShop(state, action: PayloadAction<{ localId: string; shop: Shop }>) {
            const idx = state.shops.findIndex(s => s.id === action.payload.localId);
            if (idx !== -1) {
                state.shops[idx] = action.payload.shop; // swap in place — count never changes
            } else {
                // temp entry already gone (e.g. page changed) — fall back to upsert by real id
                const existing = state.shops.findIndex(s => s.id === action.payload.shop.id);
                if (existing !== -1) state.shops[existing] = action.payload.shop;
                else state.shops.unshift(action.payload.shop);
            }
        },
    },
});

// Export reducers and action hooks to hook up into UI actions loops
export const {
    setShops,
    addShop,
    updateShop,
    deleteShop,
    setLoading,
    setError,
    clearShopsCache,
    replaceLocalShop
} = myShopsSlice.actions;

export default myShopsSlice.reducer;
