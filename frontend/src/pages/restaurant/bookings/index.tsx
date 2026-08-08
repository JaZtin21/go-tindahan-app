import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Armchair, ClipboardList } from 'lucide-react';
import { DatePickerDropdown } from '~/components/DatePickerDropdown';
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
import { ErrorState } from '~/components';
import { useRestaurantId } from '~/utils/useRestaurantId';
import type { Booking, OperatingHours, RestaurantTable } from '~/types/restaurant';
import { BookingTimeline } from './components/BookingTimeline';
import { BookingDetailModal } from './components/BookingDetailModal';

export const BookingsPage = () => {
    const dispatch = useAppDispatch();
    const activeRestaurantId = useRestaurantId();
    const bookings = useAppSelector((s) => s.bookings.bookings);
    const bookingsStoreError = useAppSelector((s) => s.bookings.error);
    const selectedDate = useAppSelector((s) => s.bookings.selectedDate);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const { data: tablesData, loading: tablesLoading } = useQuery(GET_TABLES_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
    });

    const { data: bookingsData, loading: bookingsLoading, error: bookingsQueryError, refetch: refetchBookings } = useQuery(GET_BOOKINGS_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '', date: selectedDate },
        skip: !activeRestaurantId,
        fetchPolicy: 'no-cache',
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

    const [cancelBooking] = useMutation(CANCEL_BOOKING_MUTATION);
    const [assignTable] = useMutation(ASSIGN_TABLE_MUTATION);

    useEffect(() => {
        dispatch(setBookingsLoading(bookingsLoading));
    }, [bookingsLoading, dispatch]);

    const tables: RestaurantTable[] = useMemo(() => (tablesData as any)?.tables ?? [], [tablesData]);

    const activeBookings = bookings.filter((b) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW');
    const unassignedCount = activeBookings.filter((b) => !b.tableId).length;
    const kpis = [
        { icon: CalendarCheck, label: 'Bookings', value: activeBookings.length, tint: 'text-brand-gold' },
        { icon: ClipboardList, label: 'Unassigned', value: unassignedCount, tint: 'text-brand-green' },
        { icon: Armchair, label: 'Tables', value: tables.length, tint: 'text-brand-gold' },
    ];

    // Resolve operating hours for the day-of-week of the selected date
    // (backend stores 0 = Sunday … 6 = Saturday, matching JS getDay()).
    const dayHours: OperatingHours | null | undefined = useMemo(() => {
        if (!selectedDate) return null;
        const dow = new Date(selectedDate + 'T00:00:00').getDay();
        const allHours = (hoursData as any)?.operatingHours as OperatingHours[] | undefined;
        return allHours?.find((h) => h.dayOfWeek === dow) ?? null;
    }, [hoursData, selectedDate]);

    const handleCancel = async (id: string) => {
        setCancellingId(id);
        try {
            const { data }: any = await cancelBooking({ variables: { id } });
            if (data?.cancelBooking) {
                dispatch(upsertBooking(data.cancelBooking as Booking));
            } else {
                dispatch(removeBooking(id));
            }
        } catch (err: any) {
            dispatch(setBookingsError(err?.message ?? 'Failed to cancel booking'));
        } finally {
            setCancellingId(null);
        }
    };

    const handleAssignTable = async (bookingId: string, tableId: string) => {
        setAssigningId(bookingId);
        try {
            const { data }: any = await assignTable({ variables: { bookingId, tableId } });
            if (data?.assignTable) {
                dispatch(upsertBooking(data.assignTable as Booking));
            }
        } catch (err: any) {
            dispatch(setBookingsError(err?.message ?? 'Failed to assign table'));
        } finally {
            setAssigningId(null);
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
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-75"></span>
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-green"></span>
                        </span>
                        <span className="text-xs font-black uppercase tracking-wider text-brand-green">Live</span>
                    </div>
                    <DatePickerDropdown value={selectedDate} onChange={(date) => dispatch(setSelectedDate(date))} />
                </div>
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2.5 sm:max-w-md">
                {kpis.map(({ icon: Icon, label, value, tint }) => (
                    <div key={label} className="glass-panel flex items-center gap-2.5 rounded-xl px-3.5 py-2.5">
                        <Icon size={16} strokeWidth={2.2} className={`shrink-0 ${tint}`} />
                        <div className="min-w-0">
                            <p className="m-0 text-[10px] font-black uppercase tracking-wider text-text-muted">{label}</p>
                            <p className="m-0 truncate text-sm font-black text-text-main">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {bookingsStoreError && (
                <div className="mb-4">
                    <ErrorState compact title="Action failed" message={bookingsStoreError} onDismiss={() => dispatch(setBookingsError(null))} />
                </div>
            )}

            {bookingsQueryError ? (
                <ErrorState title="Couldn't load bookings" message={bookingsQueryError.message} onRetry={() => refetchBookings()} />
            ) : bookingsLoading || tablesLoading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading bookings…</p>
                </div>
            ) : (
                <BookingTimeline
                    tables={tables}
                    bookings={bookings}
                    dayHours={dayHours}
                    onSelect={setSelectedBooking}
                    onCancel={handleCancel}
                    onAssignTable={handleAssignTable}
                    cancellingId={cancellingId}
                    assigningId={assigningId}
                />
            )}

            {selectedBooking && (
                <BookingDetailModal
                    booking={selectedBooking}
                    tables={tables}
                    onClose={() => setSelectedBooking(null)}
                />
            )}
        </div>
    );
};

export default BookingsPage;
