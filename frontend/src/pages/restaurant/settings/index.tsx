import React, { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_OPERATING_HOURS_QUERY, GET_CLOSURES_QUERY } from '~/api/queries/graphql/restaurant';
import { useAppDispatch, useAppSelector } from '~/store';
import { setOperatingHours, setClosures } from '~/store';
import { useRestaurantId } from '~/utils/useRestaurantId';
import type { Closure, OperatingHours } from '~/types/restaurant';
import { OperatingHoursEditor } from './components/OperatingHoursEditor';
import { ClosuresPanel } from './components/ClosuresPanel';

export const SettingsPage = () => {
    const dispatch = useAppDispatch();
    const activeRestaurantId = useRestaurantId();
    const hours = useAppSelector((s) => s.settings.hours);
    const closures = useAppSelector((s) => s.settings.closures);

    const { data: hoursData, loading: hoursLoading } = useQuery(GET_OPERATING_HOURS_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
        fetchPolicy: 'network-only',
    });

    const { data: closuresData, loading: closuresLoading } = useQuery(GET_CLOSURES_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
        fetchPolicy: 'network-only',
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

    const loading = hoursLoading || closuresLoading;

    return (
        <div>
            <h2 className="text-xl font-black text-text-main tracking-tight m-0">Operational Hours & Closures</h2>
            <p className="mt-1 mb-5 text-xs font-bold text-text-muted">
                Set the baseline timeline constraints so the AI engine knows exactly when the kitchen accepts reservations.
            </p>

            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading settings…</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                    <OperatingHoursEditor restaurantId={activeRestaurantId} hours={hours} />
                    <ClosuresPanel restaurantId={activeRestaurantId} closures={closures} />
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
