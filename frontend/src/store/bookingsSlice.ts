import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Booking } from '~/types/restaurant';

interface BookingsState {
    /** Bookings for the currently selected date (restaurant scoped). */
    bookings: Booking[];
    /** Selected calendar date in yyyy-MM-dd. */
    selectedDate: string;
    loading: boolean;
    error: string | null;
}

function todayLocalISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const initialState: BookingsState = {
    bookings: [],
    selectedDate: todayLocalISO(),
    loading: false,
    error: null,
};

const bookingsSlice = createSlice({
    name: 'bookings',
    initialState,
    reducers: {
        setBookings: (state, action: PayloadAction<Booking[]>) => {
            state.bookings = action.payload;
            state.loading = false;
            state.error = null;
        },
        setSelectedDate: (state, action: PayloadAction<string>) => {
            state.selectedDate = action.payload;
        },
        upsertBooking: (state, action: PayloadAction<Booking>) => {
            const idx = state.bookings.findIndex((b) => b.id === action.payload.id);
            if (idx !== -1) {
                state.bookings[idx] = action.payload;
            } else {
                state.bookings.push(action.payload);
            }
        },
        removeBooking: (state, action: PayloadAction<string>) => {
            state.bookings = state.bookings.filter((b) => b.id !== action.payload);
        },
        setBookingsLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setBookingsError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearBookings: (state) => {
            state.bookings = [];
            state.error = null;
        },
    },
});

export const {
    setBookings,
    setSelectedDate,
    upsertBooking,
    removeBooking,
    setBookingsLoading,
    setBookingsError,
    clearBookings,
} = bookingsSlice.actions;

export default bookingsSlice.reducer;
