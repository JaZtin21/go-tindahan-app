import React, { useEffect, useMemo, useState } from 'react';
import { PhoneCall, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { useQuery } from '@apollo/client/react';
import { GET_CALL_LOGS_QUERY } from '~/api/queries/graphql/restaurant';
import { useAppDispatch, useAppSelector } from '~/store';
import { setCallLogs, setCallLogsError } from '~/store';
import { useRestaurantId } from '~/utils/useRestaurantId';
import type { CallLog } from '~/types/restaurant';
import { CallLogTable } from './components/CallLogTable';
import { CallDetailModal } from './components/CallDetailModal';

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

    const summary = useMemo(() => {
        const booked = logs.filter((l) => l.outcome === 'BOOKED').length;
        const abandoned = logs.filter((l) => l.outcome === 'ABANDONED').length;
        const rate = logs.length ? Math.round((booked / logs.length) * 100) : 0;
        return [
            { icon: PhoneCall, label: 'Total calls', value: logs.length, tint: 'text-text-main' },
            { icon: CheckCircle2, label: 'Booked', value: booked, tint: 'text-brand-green' },
            { icon: TrendingUp, label: 'Conversion', value: `${rate}%`, tint: 'text-brand-gold' },
            { icon: XCircle, label: 'Abandoned', value: abandoned, tint: 'text-brand-red' },
        ];
    }, [logs]);

    if (!activeRestaurantId) {
        return <p className="py-16 text-center text-text-muted text-sm font-bold">Select a restaurant to view AI call logs.</p>;
    }

    return (
        <div>
            <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
                    <PhoneCall size={18} strokeWidth={2.2} />
                </span>
                <div>
                    <h2 className="m-0 text-xl font-black tracking-tight text-text-main">AI Voice Logs</h2>
                    <p className="m-0 mt-0.5 text-xs font-bold text-text-muted">
                        Review transcripts and analyze how well the automated phone system converts customers.
                    </p>
                </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {summary.map(({ icon: Icon, label, value, tint }) => (
                    <div key={label} className="glass-panel flex items-center gap-2.5 rounded-xl px-3.5 py-2.5">
                        <Icon size={16} strokeWidth={2.2} className={`shrink-0 ${tint}`} />
                        <div className="min-w-0">
                            <p className="m-0 text-[10px] font-black uppercase tracking-wider text-text-muted">{label}</p>
                            <p className="m-0 truncate text-sm font-black text-text-main">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading call logs…</p>
                </div>
            ) : error ? (
                <p className="text-brand-red text-sm font-bold">{error.message}</p>
            ) : (
                <CallLogTable logs={logs} onSelect={setSelected} selectedId={selected?.id ?? null} />
            )}

            {selected && <CallDetailModal call={selected} onClose={() => setSelected(null)} />}
        </div>
    );
};

export default CallsPage;
