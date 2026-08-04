import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { WaitlistEntry } from '~/types/restaurant';

interface WaitlistState {
    entries: WaitlistEntry[];
    loading: boolean;
    error: string | null;
}

const initialState: WaitlistState = {
    entries: [],
    loading: false,
    error: null,
};

const waitlistSlice = createSlice({
    name: 'waitlist',
    initialState,
    reducers: {
        setWaitlist: (state, action: PayloadAction<WaitlistEntry[]>) => {
            state.entries = action.payload;
            state.loading = false;
            state.error = null;
        },
        upsertWaitlistEntry: (state, action: PayloadAction<WaitlistEntry>) => {
            const idx = state.entries.findIndex((e) => e.id === action.payload.id);
            if (idx !== -1) {
                state.entries[idx] = action.payload;
            } else {
                state.entries.push(action.payload);
            }
        },
        removeWaitlistEntry: (state, action: PayloadAction<string>) => {
            state.entries = state.entries.filter((e) => e.id !== action.payload);
        },
        setWaitlistLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setWaitlistError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearWaitlist: (state) => {
            state.entries = [];
            state.error = null;
        },
    },
});

export const {
    setWaitlist,
    upsertWaitlistEntry,
    removeWaitlistEntry,
    setWaitlistLoading,
    setWaitlistError,
    clearWaitlist,
} = waitlistSlice.actions;

export default waitlistSlice.reducer;
