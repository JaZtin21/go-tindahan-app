import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { MenuItem } from '~/types/restaurant';

interface MenuState {
    /** Menu items for the active restaurant, kept in sync with mutations. */
    items: MenuItem[];
    loading: boolean;
    error: string | null;
}

const initialState: MenuState = {
    items: [],
    loading: false,
    error: null,
};

const menuSlice = createSlice({
    name: 'menu',
    initialState,
    reducers: {
        setMenuItems: (state, action: PayloadAction<MenuItem[]>) => {
            state.items = action.payload;
            state.loading = false;
            state.error = null;
        },
        upsertMenuItem: (state, action: PayloadAction<MenuItem>) => {
            const idx = state.items.findIndex((m) => m.id === action.payload.id);
            if (idx !== -1) {
                state.items[idx] = action.payload;
            } else {
                state.items.push(action.payload);
            }
        },
        removeMenuItem: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter((m) => m.id !== action.payload);
        },
        setMenuItemsLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setMenuItemsError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearMenuItems: (state) => {
            state.items = [];
            state.error = null;
        },
    },
});

export const {
    setMenuItems,
    upsertMenuItem,
    removeMenuItem,
    setMenuItemsLoading,
    setMenuItemsError,
    clearMenuItems,
} = menuSlice.actions;

export default menuSlice.reducer;
