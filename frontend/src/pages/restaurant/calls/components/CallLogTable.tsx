import React from 'react';
import { PhoneCall } from 'lucide-react';
import type { CallLog } from '~/types/restaurant';

interface CallLogTableProps {
    logs: CallLog[];
    onSelect: (log: CallLog) => void;
    selectedId: string | null;
}

const OUTCOME_STYLES: Record<string, string> = {
    BOOKED: 'bg-brand-green/90 text-bg-black',
    NO_AVAILABILITY: 'bg-brand-red/90 text-text-white',
    TRANSFERRED: 'bg-brand-gold/90 text-text-white',
    ABANDONED: 'bg-item-hover text-text-muted',
};

function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-AU', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export const CallLogTable = ({ logs, onSelect, selectedId }: CallLogTableProps) => {
    if (logs.length === 0) {
        return (
            <div className="glass-panel rounded-3xl border-dashed px-6 py-16 text-center text-sm font-bold text-text-muted">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold/10 text-brand-gold">
                    <PhoneCall size={26} strokeWidth={2} />
                </div>
                No calls logged yet. Calls from the AI voice agent will appear here.
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] min-w-[560px]">
                <thead>
                    <tr className="bg-bg-secondary text-left">
                        <th className="px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-text-muted">Time</th>
                        <th className="px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-text-muted">Caller</th>
                        <th className="px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-text-muted">Booking</th>
                        <th className="px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-text-muted">Outcome</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log) => {
                        const style = OUTCOME_STYLES[log.outcome ?? ''] ?? OUTCOME_STYLES.ABANDONED;
                        return (
                            <tr
                                key={log.id}
                                onClick={() => onSelect(log)}
                                className={`border-t border-border-sub cursor-pointer transition-colors duration-150 ${
                                    log.id === selectedId ? 'bg-brand-gold/10' : 'hover:bg-item-hover'
                                }`}
                            >
                                <td className="px-3 py-2.5 whitespace-nowrap font-bold text-text-sub">{fmtDateTime(log.createdAt)}</td>
                                <td className="px-3 py-2.5 font-bold text-text-sub">{log.customerPhone || '—'}</td>
                                <td className="px-3 py-2.5">
                                    {log.bookingId ? (
                                        <span className="font-mono text-[11px] font-bold text-text-muted">
                                            {log.bookingId.slice(0, 8)}
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className="px-3 py-2.5">
                                    {log.outcome && (
                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${style}`}>
                                            {log.outcome.replace('_', ' ')}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
        </div>
    );
};

export default CallLogTable;
