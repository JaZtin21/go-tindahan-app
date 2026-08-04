import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CallLog } from '~/types/restaurant';

interface CallLogsState {
    logs: CallLog[];
    loading: boolean;
    error: string | null;
}

const initialState: CallLogsState = {
    logs: [],
    loading: false,
    error: null,
};

const callLogsSlice = createSlice({
    name: 'callLogs',
    initialState,
    reducers: {
        setCallLogs: (state, action: PayloadAction<CallLog[]>) => {
            state.logs = action.payload;
            state.loading = false;
            state.error = null;
        },
        upsertCallLog: (state, action: PayloadAction<CallLog>) => {
            const idx = state.logs.findIndex((l) => l.id === action.payload.id);
            if (idx !== -1) {
                state.logs[idx] = action.payload;
            } else {
                state.logs.unshift(action.payload);
            }
        },
        setCallLogsLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setCallLogsError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearCallLogs: (state) => {
            state.logs = [];
            state.error = null;
        },
    },
});

export const {
    setCallLogs,
    upsertCallLog,
    setCallLogsLoading,
    setCallLogsError,
    clearCallLogs,
} = callLogsSlice.actions;

export default callLogsSlice.reducer;
