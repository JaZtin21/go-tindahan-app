import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Closure, OperatingHours } from '~/types/restaurant';

interface SettingsState {
    hours: OperatingHours[];
    closures: Closure[];
    loading: boolean;
    error: string | null;
}

const initialState: SettingsState = {
    hours: [],
    closures: [],
    loading: false,
    error: null,
};

const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setOperatingHours: (state, action: PayloadAction<OperatingHours[]>) => {
            state.hours = action.payload;
            state.loading = false;
            state.error = null;
        },
        setClosures: (state, action: PayloadAction<Closure[]>) => {
            state.closures = action.payload;
            state.loading = false;
            state.error = null;
        },
        addClosure: (state, action: PayloadAction<Closure>) => {
            const exists = state.closures.some((c) => c.id === action.payload.id);
            if (!exists) {
                state.closures.push(action.payload);
            }
        },
        removeClosure: (state, action: PayloadAction<string>) => {
            state.closures = state.closures.filter((c) => c.id !== action.payload);
        },
        setSettingsLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setSettingsError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearSettings: (state) => {
            state.hours = [];
            state.closures = [];
            state.error = null;
        },
    },
});

export const {
    setOperatingHours,
    setClosures,
    addClosure,
    removeClosure,
    setSettingsLoading,
    setSettingsError,
    clearSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
