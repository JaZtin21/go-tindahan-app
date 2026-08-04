import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RestaurantTable } from '~/types/restaurant';

interface TablesState {
    tables: RestaurantTable[];
    loading: boolean;
    error: string | null;
}

const initialState: TablesState = {
    tables: [],
    loading: false,
    error: null,
};

const tablesSlice = createSlice({
    name: 'tables',
    initialState,
    reducers: {
        setTables: (state, action: PayloadAction<RestaurantTable[]>) => {
            state.tables = action.payload;
            state.loading = false;
            state.error = null;
        },
        upsertTable: (state, action: PayloadAction<RestaurantTable>) => {
            const idx = state.tables.findIndex((t) => t.id === action.payload.id);
            if (idx !== -1) {
                state.tables[idx] = action.payload;
            } else {
                state.tables.push(action.payload);
            }
        },
        removeTable: (state, action: PayloadAction<string>) => {
            state.tables = state.tables.filter((t) => t.id !== action.payload);
        },
        setTablesLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setTablesError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearTables: (state) => {
            state.tables = [];
            state.error = null;
        },
    },
});

export const {
    setTables,
    upsertTable,
    removeTable,
    setTablesLoading,
    setTablesError,
    clearTables,
} = tablesSlice.actions;

export default tablesSlice.reducer;
