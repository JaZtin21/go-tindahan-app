import React, { useEffect, useMemo, useState } from 'react';
import { Clock, CalendarX2 } from 'lucide-react';
import { useQuery } from '@apollo/client/react';
import { GET_OPERATING_HOURS_QUERY, GET_CLOSURES_QUERY } from '~/api/queries/graphql/restaurant';
import { useAppDispatch, useAppSelector } from '~/store';
import { setOperatingHours, setClosures, setSettingsError } from '~/store';
import { ErrorState } from '~/components';
import { useRestaurantId } from '~/utils/useRestaurantId';
import type { Closure, OperatingHours } from '~/types/restaurant';
import { OperatingHoursEditor } from './components/OperatingHoursEditor';
import { ClosuresPanel } from './components/ClosuresPanel';

type SettingsTab = 'hours' | 'closures';

export const SettingsPage = () => {
    const dispatch = useAppDispatch();
    const activeRestaurantId = useRestaurantId();
    const [tab, setTab] = useState<SettingsTab>('hours');
    const hours = useAppSelector((s) => s.settings.hours);
    const closures = useAppSelector((s) => s.settings.closures);
    const settingsStoreError = useAppSelector((s) => s.settings.error);

    const { data: hoursData, loading: hoursLoading, error: hoursError, refetch: refetchHours } = useQuery(GET_OPERATING_HOURS_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
        fetchPolicy: 'no-cache',
    });

    const { data: closuresData, loading: closuresLoading, error: closuresError, refetch: refetchClosures } = useQuery(GET_CLOSURES_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
        fetchPolicy: 'no-cache',
    });

    // Sync fetched settings into Redux whenever they arrive.
    useEffect(() => {
        const fetchedHours = (hoursData as any)?.operatingHours as OperatingHours[] | undefined;
        const fetchedClosures = (closuresData as any)?.closures as Closure[] | undefined;
        if (fetchedHours) dispatch(setOperatingHours(fetchedHours));
        if (fetchedClosures) dispatch(setClosures(fetchedClosures));
    }, [hoursData, closuresData, dispatch]);

    if (!activeRestaurantId) {
        return <p className="py-16 text-center text-text-muted text-sm font-bold">Select a restaurant to adjust settings.</p>;
    }

    // Gate per tab so one query in flight doesn't spin the other tab's content.
    const loading = tab === 'hours' ? hoursLoading : closuresLoading;
    const queryError = tab === 'hours' ? hoursError : closuresError;
    const retryQuery = tab === 'hours' ? refetchHours : refetchClosures;

    const nextClosure = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return closures
            .map((c) => ({ c, d: new Date(`${c.closureDate}T00:00:00`) }))
            .filter(({ d }) => d >= today)
            .sort((a, b) => a.d.getTime() - b.d.getTime())[0];
    }, [closures]);

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
                        <Clock size={18} strokeWidth={2.2} />
                    </span>
                    <div>
                        <h2 className="m-0 text-xl font-black tracking-tight text-text-main">Operational Hours & Closures</h2>
                        <p className="m-0 mt-0.5 text-xs font-bold text-text-muted">
                            Set the baseline timeline constraints so the AI engine knows exactly when the kitchen accepts reservations.
                        </p>
                    </div>
                </div>
                {nextClosure && (
                    <span className="flex items-center gap-1.5 rounded-full border border-brand-red/30 bg-brand-red/10 px-3 py-1.5 text-[11px] font-black text-brand-red">
                        <CalendarX2 size={13} strokeWidth={2.2} />
                        Closed {nextClosure.d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {nextClosure.c.reason ? ` · ${nextClosure.c.reason}` : ''}
                    </span>
                )}
            </div>

            {/* Tab selector */}
            <div className="mb-5 flex w-fit gap-1.5 rounded-2xl border border-border-main/60 bg-bg-primary/60 p-1.5 backdrop-blur-sm">
                <button
                    onClick={() => setTab('hours')}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs transition-all duration-200 active:scale-95 ${
                        tab === 'hours'
                            ? 'bg-brand-gold font-black text-text-white shadow-xs shadow-brand-gold/20'
                            : 'font-bold text-text-sub hover:bg-item-hover hover:text-text-main'
                    }`}
                >
                    <Clock size={15} strokeWidth={2.2} />
                    Weekly Operating Hours
                </button>
                <button
                    onClick={() => setTab('closures')}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs transition-all duration-200 active:scale-95 ${
                        tab === 'closures'
                            ? 'bg-brand-gold font-black text-text-white shadow-xs shadow-brand-gold/20'
                            : 'font-bold text-text-sub hover:bg-item-hover hover:text-text-main'
                    }`}
                >
                    <CalendarX2 size={15} strokeWidth={2.2} />
                    Closures
                </button>
            </div>

            {settingsStoreError && (
                <div className="mb-4">
                    <ErrorState compact title="Action failed" message={settingsStoreError} onDismiss={() => dispatch(setSettingsError(null))} />
                </div>
            )}

            {queryError ? (
                <ErrorState title="Couldn't load settings" message={queryError.message} onRetry={() => retryQuery()} />
            ) : loading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading settings…</p>
                </div>
            ) : tab === 'hours' ? (
                <OperatingHoursEditor restaurantId={activeRestaurantId} hours={hours} />
            ) : (
                <ClosuresPanel restaurantId={activeRestaurantId} closures={closures} />
            )}
        </div>
    );
};

export default SettingsPage;
