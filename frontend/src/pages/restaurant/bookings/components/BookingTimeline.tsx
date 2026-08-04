import React, { useMemo } from 'react';
import type { Booking, OperatingHours, RestaurantTable } from '~/types/restaurant';

interface BookingTimelineProps {
    tables: RestaurantTable[];
    bookings: Booking[];
    // Operating hours for the *selected day* (already resolved by the page).
    dayHours?: OperatingHours | null;
    onCancel: (id: string) => void;
    onAssignTable: (bookingId: string, tableId: string) => void;
    cancelling: boolean;
}

const MIN_HOUR = 0;
const MAX_HOUR = 23;

// Backend TIME values come back as "HH:MM:SS.micros" (e.g. "11:00:00.000000").
const parseHour = (t?: string | null): number | null => {
    if (!t) return null;
    const h = parseInt(t.split(':')[0], 10);
    return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
};

// Build the hourly grid for the selected day:
//  - Prefer the restaurant's operating hours (open → close) for that day.
//  - Fall back to a default 11:00–22:00 window.
//  - Always expand to cover any booking outside the window so nothing hides.
const buildHourRange = (bookings: Booking[], dayHours?: OperatingHours | null): number[] => {
    const bookingHours = bookings
        .map((b) => new Date(b.bookingTime).getHours())
        .filter((h) => h >= MIN_HOUR && h <= MAX_HOUR);

    let first = 11;
    let last = 22;

    if (dayHours && !dayHours.isClosed) {
        const open = parseHour(dayHours.openTime);
        const close = parseHour(dayHours.closeTime);
        if (open !== null && close !== null && close > open) {
            first = open;
            last = close;
        }
    }

    if (bookingHours.length) {
        first = Math.min(first, ...bookingHours);
        last = Math.max(last, ...bookingHours);
    }

    const range: number[] = [];
    for (let h = first; h <= last; h++) range.push(h);
    return range;
};

const STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-amber-500/90',
    CONFIRMED: 'bg-blue-500/90',
    SEATED: 'bg-emerald-500/90',
    COMPLETED: 'bg-gray-500/90',
    CANCELLED: 'bg-brand-red',
    NO_SHOW: 'bg-brand-red',
};

function fmtTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const BookingTimeline = ({ tables, bookings, dayHours, onCancel, onAssignTable, cancelling }: BookingTimelineProps) => {
    const unassigned = bookings.filter((b) => !b.tableId && b.status !== 'CANCELLED' && b.status !== 'NO_SHOW');
    const HOURS = useMemo(() => buildHourRange(bookings, dayHours), [bookings, dayHours]);

    return (
        <div>
            {/* Unassigned bookings strip */}
            {unassigned.length > 0 && (
                <div className="mb-5">
                    <h3 className="text-xs font-black text-text-sub uppercase tracking-wider mb-2">Unassigned bookings</h3>
                    <div className="flex gap-2.5 flex-wrap">
                        {unassigned.map((b) => (
                            <div
                                key={b.id}
                                className="border border-brand-gold/60 rounded-xl px-3 py-2.5 bg-brand-gold/10 min-w-[180px]"
                            >
                                <div className="font-black text-sm text-text-main">
                                    {fmtTime(b.bookingTime)} · {b.partySize} pax
                                </div>
                                <div className="text-xs font-bold text-text-muted my-1.5">
                                    {b.specialRequests || b.source || 'No notes'}
                                </div>
                                {tables.length > 0 && (
                                    <select
                                        value=""
                                        onChange={(e) => e.target.value && onAssignTable(b.id, e.target.value)}
                                        className="px-2 py-1.5 rounded-lg border border-border-main bg-bg-primary text-text-sub text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-gold/40 cursor-pointer"
                                    >
                                        <option value="">Assign table…</option>
                                        {tables.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.section ? `${t.section} · ` : ''}{t.tableNumber}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tables.length === 0 ? (
                <p className="text-text-muted text-sm font-bold">No tables configured yet — add tables in the Table Layout page.</p>
            ) : (
                <div
                    className="grid gap-2.5 overflow-x-auto pb-2"
                    style={{ gridTemplateColumns: `repeat(${tables.length}, minmax(140px, 1fr))` }}
                >
                    {tables.map((table) => {
                        const tableBookings = bookings.filter((b) => b.tableId === table.id && b.status !== 'CANCELLED' && b.status !== 'NO_SHOW');
                        return (
                            <div key={table.id} className="border border-border-main rounded-xl min-w-[140px] bg-bg-primary">
                                <div className="px-2.5 py-2 border-b border-border-sub bg-bg-secondary rounded-t-xl">
                                    <div className="font-black text-xs text-text-main">
                                        {table.section ? `${table.section} · ` : ''}{table.tableNumber}
                                    </div>
                                    <div className="text-[10px] font-bold text-text-muted">
                                        {table.capacityMin}–{table.capacityMax} seats
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 p-2">
                                    {HOURS.map((h) => {
                                        const slotBookings = tableBookings.filter((b) => {
                                            const d = new Date(b.bookingTime);
                                            return d.getHours() === h;
                                        });
                                        return (
                                            <div key={h} className="min-h-[36px] flex flex-col gap-1">
                                                <div className="text-[10px] font-bold text-border-muted">{String(h).padStart(2, '0')}:00</div>
                                                {slotBookings.map((b) => (
                                                    <div
                                                        key={b.id}
                                                        className={`rounded-lg px-1.5 py-1 text-[11px] relative text-white ${STATUS_STYLES[b.status] ?? 'bg-blue-500/90'}`}
                                                        title={b.specialRequests ?? ''}
                                                    >
                                                        <div className="font-bold">
                                                            {fmtTime(b.bookingTime)} · {b.partySize}p
                                                        </div>
                                                        <div className="text-[9px] opacity-90">
                                                            {b.source} · {b.status}
                                                        </div>
                                                        {b.status !== 'COMPLETED' && b.status !== 'SEATED' && (
                                                            <button
                                                                onClick={() => onCancel(b.id)}
                                                                disabled={cancelling}
                                                                className="absolute top-0.5 right-0.5 bg-white/25 border-none text-white rounded px-1 text-[10px] cursor-pointer hover:bg-white/40 transition-colors duration-150"
                                                                title="Cancel booking"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default BookingTimeline;
