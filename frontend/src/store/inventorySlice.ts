import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Item } from '~/types';


interface InventoryState {
    items: Item[];
    totalCount: number;
    loading: boolean;
    error: string | null;
}

// Establish baseline initial state layout
const initialState: InventoryState = {
    items: [],
    totalCount: 0,
    loading: false,
    error: null,
};

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {
        // Call this action when loading item data from your GraphQL query hook
        setInventory: (state, action: PayloadAction<{ items: Item[]; totalCount: number }>) => {
            state.items = action.payload.items;
            state.totalCount = action.payload.totalCount;
            state.loading = false;
            state.error = null;
        },

        // Call this inside your AddInventoryItem mutation callback to push the new entry to cache
        addInventoryItem: (state, action: PayloadAction<Item>) => {
            state.items.unshift(action.payload); // Prepends the brand new item to the list view array
            state.totalCount += 1;
        },

        // Call this inside your UpdateInventoryItem mutation callback to update local tracking
        updateInventoryItem: (state, action: PayloadAction<Item>) => {
            const index = state.items.findIndex(item => item.id === action.payload.id);
            if (index !== -1) {
                state.items[index] = action.payload;
            }
        },

        // Call this inside your DeleteInventoryItem mutation callback to strip it out instantly
        deleteInventoryItem: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter(item => item.id !== action.payload);
            if (state.totalCount > 0) {
                state.totalCount -= 1;
            }
        },

        // Standard helper actions to toggle loader layout indicators easily
        setInventoryLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setInventoryError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearInventoryCache: (state) => {
            state.items = [];
            state.totalCount = 0;
            state.error = null;
        }
    },
});

// Export reducers and action hooks to hook up into UI actions loops
export const {
    setInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    setInventoryLoading,
    setInventoryError,
    clearInventoryCache
} = inventorySlice.actions;

export default inventorySlice.reducer;
