import React, { useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
    GET_BOOKINGS_QUERY,
    GET_TABLES_QUERY,
    GET_OPERATING_HOURS_QUERY,
    CANCEL_BOOKING_MUTATION,
    ASSIGN_TABLE_MUTATION,
} from '~/api/queries/graphql/restaurant';
import { useAppDispatch, useAppSelector } from '~/store';
import { setBookings, setBookingsLoading, setBookingsError, setSelectedDate, removeBooking, upsertBooking } from '~/store';
import type { Booking, OperatingHours, RestaurantTable } from '~/types/restaurant';
import { BookingTimeline } from './components/BookingTimeline';

export const BookingsPage = () => {
    const dispatch = useAppDispatch();
    const activeRestaurantId = useAppSelector((s) => s.restaurant.activeRestaurantId);
    const bookings = useAppSelector((s) => s.bookings.bookings);
    const selectedDate = useAppSelector((s) => s.bookings.selectedDate);

    const { data: tablesData, loading: tablesLoading } = useQuery(GET_TABLES_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
    });

    const { data: bookingsData, loading: bookingsLoading } = useQuery(GET_BOOKINGS_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '', date: selectedDate },
        skip: !activeRestaurantId,
        fetchPolicy: 'network-only',
    });

    // Operating hours for the selected day — the timeline window should match
    // when the kitchen actually accepts reservations, not a hardcoded range.
    const { data: hoursData } = useQuery(GET_OPERATING_HOURS_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
    });

    // Sync the fetched bookings into Redux whenever they arrive.
    useEffect(() => {
        const fetched = (bookingsData as any)?.bookings as Booking[] | undefined;
        if (fetched) {
            dispatch(setBookings(fetched));
        }
    }, [bookingsData, dispatch]);

    const [cancelBooking, { loading: cancelling }] = useMutation(CANCEL_BOOKING_MUTATION);
    const [assignTable] = useMutation(ASSIGN_TABLE_MUTATION);

    useEffect(() => {
        dispatch(setBookingsLoading(bookingsLoading));
    }, [bookingsLoading, dispatch]);

    const tables: RestaurantTable[] = useMemo(() => (tablesData as any)?.tables ?? [], [tablesData]);

    // Resolve operating hours for the day-of-week of the selected date
    // (backend stores 0 = Sunday … 6 = Saturday, matching JS getDay()).
    const dayHours: OperatingHours | null | undefined = useMemo(() => {
        if (!selectedDate) return null;
        const dow = new Date(selectedDate + 'T00:00:00').getDay();
        const allHours = (hoursData as any)?.operatingHours as OperatingHours[] | undefined;
        return allHours?.find((h) => h.dayOfWeek === dow) ?? null;
    }, [hoursData, selectedDate]);

    const handleCancel = async (id: string) => {
        try {
            const { data }: any = await cancelBooking({ variables: { id } });
            if (data?.cancelBooking) {
                dispatch(upsertBooking(data.cancelBooking as Booking));
            } else {
                dispatch(removeBooking(id));
            }
        } catch (err: any) {
            dispatch(setBookingsError(err?.message ?? 'Failed to cancel booking'));
        }
    };

    const handleAssignTable = async (bookingId: string, tableId: string) => {
        try {
            const { data }: any = await assignTable({ variables: { bookingId, tableId } });
            if (data?.assignTable) {
                dispatch(upsertBooking(data.assignTable as Booking));
            }
        } catch (err: any) {
            dispatch(setBookingsError(err?.message ?? 'Failed to assign table'));
        }
    };

    if (!activeRestaurantId) {
        return <p className="py-16 text-center text-text-muted text-sm font-bold">Select a restaurant to view bookings.</p>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-black text-text-main tracking-tight m-0">Live Bookings</h2>
                    <p className="m-0 mt-1 text-xs font-bold text-text-muted">
                        Daily grid timeline — what the AI voice agent has booked.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-75"></span>
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-green"></span>
                    </span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => dispatch(setSelectedDate(e.target.value))}
                        className="px-3 py-2 rounded-xl border border-border-main bg-bg-primary text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200"
                    />
                </div>
            </div>

            {bookingsLoading || tablesLoading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading bookings…</p>
                </div>
            ) : (
                <BookingTimeline
                    tables={tables}
                    bookings={bookings}
                    dayHours={dayHours}
                    onCancel={handleCancel}
                    onAssignTable={handleAssignTable}
                    cancelling={cancelling}
                />
            )}
        </div>
    );
};

export default BookingsPage;
