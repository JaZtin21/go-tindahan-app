import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
    isSidebarOpen: boolean;
}

const initialState: UiState = {
    isSidebarOpen: false,
};

export const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        toggleSidebar: (state) => {
            state.isSidebarOpen = !state.isSidebarOpen;
        },
        setSidebarOpen: (state, action: PayloadAction<boolean>) => {
            state.isSidebarOpen = action.payload;
        },
    },
});

// Export the actions so your buttons can trigger them
export const { toggleSidebar, setSidebarOpen } = uiSlice.actions;

// Export the reducer to register it in the main store
export default uiSlice.reducer;
