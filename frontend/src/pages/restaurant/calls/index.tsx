import React, { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_CALL_LOGS_QUERY } from '~/api/queries/graphql/restaurant';
import { useAppDispatch, useAppSelector } from '~/store';
import { setCallLogs, setCallLogsError } from '~/store';
import { useRestaurantId } from '~/utils/useRestaurantId';
import type { CallLog } from '~/types/restaurant';
import { CallLogTable } from './components/CallLogTable';
import { CallDetailPanel } from './components/CallDetailPanel';

export const CallsPage = () => {
    const dispatch = useAppDispatch();
    const activeRestaurantId = useRestaurantId();
    const logs = useAppSelector((s) => s.callLogs.logs);
    const [selected, setSelected] = useState<CallLog | null>(null);

    const { data, loading, error } = useQuery(GET_CALL_LOGS_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
        fetchPolicy: 'network-only',
    });

    // Sync the fetched logs into Redux whenever they arrive.
    useEffect(() => {
        const fetched = (data as any)?.callLogs as CallLog[] | undefined;
        if (fetched) {
            dispatch(setCallLogs(fetched));
        }
    }, [data, dispatch]);

    if (!activeRestaurantId) {
        return <p className="py-16 text-center text-text-muted text-sm font-bold">Select a restaurant to view AI call logs.</p>;
    }

    return (
        <div>
            <h2 className="text-xl font-black text-text-main tracking-tight m-0">AI Voice Logs</h2>
            <p className="mt-1 mb-4 text-xs font-bold text-text-muted">
                Review transcripts and analyze how well the automated phone system converts customers.
            </p>

            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading call logs…</p>
                </div>
            ) : error ? (
                <p className="text-brand-red text-sm font-bold">{error.message}</p>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
                    <CallLogTable logs={logs} onSelect={setSelected} selectedId={selected?.id ?? null} />
                    <CallDetailPanel call={selected} />
                </div>
            )}
        </div>
    );
};

export default CallsPage;
