import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
    GET_WAITLIST_QUERY,
    GET_TABLES_QUERY,
    CONVERT_WAITLIST_TO_BOOKING_MUTATION,
    UPDATE_WAITLIST_STATUS_MUTATION,
} from '~/api/queries/graphql/restaurant';
import { useAppDispatch, useAppSelector } from '~/store';
import { setWaitlist, removeWaitlistEntry, setWaitlistError } from '~/store';
import { useRestaurantId } from '~/utils/useRestaurantId';
import type { RestaurantTable, WaitlistEntry } from '~/types/restaurant';
import { WaitlistRow } from './components/WaitlistRow';

export const WaitlistPage = () => {
    const dispatch = useAppDispatch();
    const activeRestaurantId = useRestaurantId();
    const entries = useAppSelector((s) => s.waitlist.entries);
    const [statusFilter, setStatusFilter] = useState<'WAITING' | 'NOTIFIED' | null>('WAITING');

    const { data, loading } = useQuery(GET_WAITLIST_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '', status: statusFilter },
        skip: !activeRestaurantId,
        fetchPolicy: 'network-only',
    });

    // Sync fetched entries into Redux whenever they arrive.
    useEffect(() => {
        const fetched = (data as any)?.waitlist as WaitlistEntry[] | undefined;
        if (fetched) {
            dispatch(setWaitlist(fetched));
        }
    }, [data, dispatch]);

    const { data: tablesData } = useQuery(GET_TABLES_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
    });

    const [convert] = useMutation(CONVERT_WAITLIST_TO_BOOKING_MUTATION);
    const [updateStatus] = useMutation(UPDATE_WAITLIST_STATUS_MUTATION);

    const tables: RestaurantTable[] = (tablesData as any)?.tables ?? [];

    const handleConvert = async (entryId: string, tableId: string) => {
        try {
            const { data }: any = await convert({ variables: { id: entryId, tableId } });
            if (data?.convertWaitlistToBooking) {
                dispatch(removeWaitlistEntry(entryId));
            }
        } catch (err: any) {
            dispatch(setWaitlistError(err?.message ?? 'Failed to convert to booking'));
        }
    };

    const handleNotify = async (entryId: string) => {
        try {
            const { data }: any = await updateStatus({ variables: { id: entryId, status: 'NOTIFIED' } });
            // The mutation only returns { id, status } — the party is no
            // longer WAITING, so drop it from the current filtered queue.
            // A refetch on the NOTIFIED tab will show it with full detail.
            if (data?.updateWaitlistStatus?.status === 'NOTIFIED') {
                dispatch(removeWaitlistEntry(entryId));
            }
        } catch (err: any) {
            dispatch(setWaitlistError(err?.message ?? 'Failed to update waitlist status'));
        }
    };

    if (!activeRestaurantId) {
        return <p className="py-16 text-center text-text-muted text-sm font-bold">Select a restaurant to view the waitlist.</p>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2.5">
                <div>
                    <h2 className="text-xl font-black text-text-main tracking-tight m-0">Live Waitlist</h2>
                    <p className="mt-1 text-xs font-bold text-text-muted m-0">
                        Overflow queue when the system is full — assign a table the moment one opens.
                    </p>
                </div>
                <div className="flex gap-1.5">
                    {(['WAITING', 'NOTIFIED'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all duration-200 cursor-pointer active:scale-95 ${
                                statusFilter === s
                                    ? 'bg-brand-gold text-bg-black'
                                    : 'border border-border-main bg-bg-primary text-text-sub hover:bg-item-hover'
                            }`}
                        >
                            {s === 'WAITING' ? 'Waiting' : 'Notified'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading waitlist…</p>
                </div>
            ) : entries.length === 0 ? (
                <div className="border border-dashed border-border-main rounded-2xl py-16 text-center text-text-muted text-sm font-bold">
                    {statusFilter === 'WAITING' ? 'No one is on the waitlist right now.' : 'No notified parties.'}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {entries.map((entry, i) => (
                        <WaitlistRow
                            key={entry.id}
                            entry={entry}
                            position={i + 1}
                            tables={tables}
                            onConvert={handleConvert}
                            onNotify={() => handleNotify(entry.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default WaitlistPage;
