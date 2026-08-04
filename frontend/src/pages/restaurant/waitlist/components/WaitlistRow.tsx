import React, { useState } from 'react';
import type { RestaurantTable, WaitlistEntry } from '~/types/restaurant';

interface WaitlistRowProps {
    entry: WaitlistEntry;
    position: number;
    tables: RestaurantTable[];
    onConvert: (entryId: string, tableId: string) => void;
    onNotify: () => void;
}

function fmtTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

export const WaitlistRow = ({ entry, position, tables, onConvert, onNotify }: WaitlistRowProps) => {
    const [selectedTable, setSelectedTable] = useState('');

    const handleAssign = () => {
        if (!selectedTable) return;
        onConvert(entry.id, selectedTable);
        setSelectedTable('');
    };

    return (
        <div className="flex items-center gap-4 px-4 py-3 border border-border-main rounded-xl bg-bg-primary hover:border-brand-gold/40 transition-colors duration-200">
            <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
                    entry.status === 'NOTIFIED' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-gold text-bg-black'
                }`}
            >
                {position}
            </div>

            <div className="flex-1 min-w-0">
                <div className="font-black text-sm text-text-main">
                    Party of {entry.partySize}
                    <span className="font-bold text-text-muted ml-2 text-xs">
                        requested {fmtTime(entry.requestedTime)}
                    </span>
                </div>
                <div className="text-xs font-bold text-text-muted">
                    {entry.status === 'NOTIFIED' ? '🔔 Notified — waiting for reply' : 'Waiting for a table'}
                </div>
            </div>

            {entry.status === 'WAITING' && (
                <div className="flex gap-2 items-center">
                    <button
                        onClick={onNotify}
                        className="px-3.5 py-2 rounded-xl border border-border-main bg-bg-primary text-text-sub text-[13px] font-bold hover:bg-item-hover cursor-pointer transition-colors duration-150 active:scale-95"
                    >
                        Notify
                    </button>
                    {tables.length > 0 && (
                        <>
                            <select
                                value={selectedTable}
                                onChange={(e) => setSelectedTable(e.target.value)}
                                className="px-2.5 py-2 rounded-xl border border-border-main bg-bg-primary text-text-sub text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-brand-gold/40 cursor-pointer"
                            >
                                <option value="">Assign table…</option>
                                {tables.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.section ? `${t.section} · ` : ''}{t.tableNumber}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleAssign}
                                disabled={!selectedTable}
                                className={`px-3.5 py-2 rounded-xl text-[13px] font-black transition-all duration-200 active:scale-95 ${
                                    selectedTable
                                        ? 'bg-brand-green text-bg-black hover:bg-brand-green-hover cursor-pointer'
                                        : 'bg-brand-green/25 text-bg-black/40 cursor-not-allowed'
                                }`}
                            >
                                Seat now
                            </button>
                        </>
                    )}
                </div>
            )}

            {entry.status === 'NOTIFIED' && (
                <button
                    onClick={onNotify}
                    disabled
                    className="px-3.5 py-2 rounded-xl border border-border-main bg-bg-secondary text-text-muted text-[13px] font-bold"
                >
                    Awaiting reply
                </button>
            )}
        </div>
    );
};

export default WaitlistRow;
