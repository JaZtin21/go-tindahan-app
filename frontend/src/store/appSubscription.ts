import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
    isSubscribed: boolean;
    isWriteToOfflineDBWhenSubscribed: boolean;
}

const initialState: UiState = {
    isSubscribed: true,
    isWriteToOfflineDBWhenSubscribed: true,
};

export const appSubscriptionSlice = createSlice({
    name: 'appSubscription',
    initialState,
    reducers: {
        setIsSubscribed: (state, action: PayloadAction<boolean>) => {
            state.isSubscribed = action.payload;
        },
        setIsWriteToOfflineDBWhenSubscribed: (state, action: PayloadAction<boolean>) => {
            state.isWriteToOfflineDBWhenSubscribed = action.payload;
        }

    },
});

export const { setIsSubscribed, setIsWriteToOfflineDBWhenSubscribed } = appSubscriptionSlice.actions;

export default appSubscriptionSlice.reducer;
