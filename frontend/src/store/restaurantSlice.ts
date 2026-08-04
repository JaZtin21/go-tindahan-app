import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Restaurant, RestaurantOwner, RestaurantStaffRole } from '~/types/restaurant';

interface RestaurantState {
    /** All restaurants the logged-in owner has a role on. */
    roles: RestaurantStaffRole[];
    /** Id of the restaurant currently being managed in the dashboard. */
    activeRestaurantId: string | null;
    /** Fresh owner payload from the backend (kept in sync with auth context). */
    owner: RestaurantOwner | null;
    loading: boolean;
    error: string | null;
}

const initialState: RestaurantState = {
    roles: [],
    activeRestaurantId: null,
    owner: null,
    loading: false,
    error: null,
};

const restaurantSlice = createSlice({
    name: 'restaurant',
    initialState,
    reducers: {
        // Populate roles + pick a sensible default active restaurant (first role).
        setRestaurantRoles: (state, action: PayloadAction<RestaurantStaffRole[]>) => {
            state.roles = action.payload;
            state.error = null;
            if (!state.activeRestaurantId || !action.payload.some((r) => r.restaurant.id === state.activeRestaurantId)) {
                state.activeRestaurantId = action.payload[0]?.restaurant?.id ?? null;
            }
        },
        setOwner: (state, action: PayloadAction<RestaurantOwner | null>) => {
            state.owner = action.payload;
            if (action.payload) {
                state.roles = action.payload.restaurants ?? [];
                if (!state.activeRestaurantId || !state.roles.some((r) => r.restaurant.id === state.activeRestaurantId)) {
                    state.activeRestaurantId = state.roles[0]?.restaurant?.id ?? null;
                }
            } else {
                state.roles = [];
                state.activeRestaurantId = null;
            }
        },
        setActiveRestaurant: (state, action: PayloadAction<string>) => {
            state.activeRestaurantId = action.payload;
        },
        // After createRestaurant succeeds, append the new role so the
        // dashboard reflects it without a refetch.
        addRestaurantRole: (state, action: PayloadAction<Restaurant>) => {
            const exists = state.roles.some((r) => r.restaurant.id === action.payload.id);
            if (!exists) {
                state.roles.unshift({ role: 'OWNER', restaurant: action.payload });
                state.activeRestaurantId = action.payload.id;
            }
        },
        updateRestaurantInState: (state, action: PayloadAction<Restaurant>) => {
            const idx = state.roles.findIndex((r) => r.restaurant.id === action.payload.id);
            if (idx !== -1) {
                state.roles[idx] = { ...state.roles[idx], restaurant: action.payload };
            }
        },
        setRestaurantLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setRestaurantError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearRestaurantState: (state) => {
            state.roles = [];
            state.activeRestaurantId = null;
            state.owner = null;
            state.error = null;
        },
    },
});

export const {
    setRestaurantRoles,
    setOwner,
    setActiveRestaurant,
    addRestaurantRole,
    updateRestaurantInState,
    setRestaurantLoading,
    setRestaurantError,
    clearRestaurantState,
} = restaurantSlice.actions;

export default restaurantSlice.reducer;
