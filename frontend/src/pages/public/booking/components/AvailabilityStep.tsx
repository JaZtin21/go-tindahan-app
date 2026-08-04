import React, { useState } from 'react';
import { useLazyQuery, useQuery } from '@apollo/client/react';
import { CHECK_AVAILABILITY_QUERY, GET_PUBLIC_RESTAURANT_QUERY } from '~/api/queries/graphql/restaurant';
import type { AvailableSlot, OperatingHours, Restaurant } from '~/types/restaurant';

// ============================================================================
// STEP 2 — CHECK AVAILABILITY
// Party size + requested time → public checkAvailability → free table slots.
// Also shows the restaurant's weekly opening hours so customers know when
// they can book (data comes from the public restaurant(id) query).
// ============================================================================

interface AvailabilityStepProps {
    restaurant: Restaurant;
    onSlotPicked: (slot: AvailableSlot, partySize: number, requestedTime: string) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatHoursTime = (t?: string | null) => {
    if (!t) return '—';
    // Backend returns TIME as "HH:MM:SS"
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m ?? 0, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const toLocalInputValue = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const AvailabilityStep = ({ restaurant, onSlotPicked }: AvailabilityStepProps) => {
    const [partySize, setPartySize] = useState(2);
    const [requestedTime, setRequestedTime] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(19, 0, 0, 0);
        return toLocalInputValue(d);
    });

    const [check, { data, loading, error }] = useLazyQuery(CHECK_AVAILABILITY_QUERY);

    // NOTE: the picked datetime-local value is the *user's* local wall-clock
    // time; toISOString() converts it to UTC RFC3339, which the backend parses
    // as timestamptz for its tstzrange overlap checks. Fine for this demo — a
    // multi-timezone rollout would render back in the restaurant's timezone.
    const { data: detailData } = useQuery(GET_PUBLIC_RESTAURANT_QUERY, {
        variables: { id: restaurant.id },
    });
    const operatingHours: OperatingHours[] = (detailData as any)?.restaurant?.operatingHours ?? [];
    const closures: { closureDate: string; reason?: string | null }[] = (detailData as any)?.restaurant?.closures ?? [];

    const slots: AvailableSlot[] = (data as any)?.checkAvailability ?? [];
    const maxParty = restaurant.maxPartySize;

    const runCheck = () => {
        const iso = new Date(requestedTime).toISOString();
        check({ variables: { input: { restaurantId: restaurant.id, partySize, requestedTime: iso } } });
    };

    return (
        <div>
            {/* Opening hours strip — public data, no login needed */}
            <div className="mb-5 rounded-2xl border border-border-main bg-bg-secondary/50 px-4 py-3">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-text-muted">Opening hours</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                    {operatingHours.map((h) => (
                        <div key={h.id} className="flex items-center justify-between text-xs">
                            <span className="font-bold text-text-sub">{DAY_NAMES[h.dayOfWeek]}</span>
                            <span className={h.isClosed ? 'font-bold text-brand-red' : 'text-text-muted'}>
                                {h.isClosed ? 'Closed' : `${formatHoursTime(h.openTime)}–${formatHoursTime(h.closeTime)}`}
                            </span>
                        </div>
                    ))}
                    {operatingHours.length === 0 && (
                        <p className="text-xs text-text-muted col-span-2 sm:col-span-4">Hours not set yet.</p>
                    )}
                </div>
                {closures.length > 0 && (
                    <p className="mt-2 text-[11px] font-bold text-brand-red">
                        Closed: {closures.map((c) => new Date(c.closureDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })).join(', ')}
                    </p>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mb-5">
                {/* Party size */}
                <div>
                    <label className="mb-1.5 block text-xs font-bold text-text-muted">Party size</label>
                    <div className="flex items-center rounded-xl border border-border-main bg-bg-secondary overflow-hidden">
                        <button
                            onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                            className="px-3 py-2.5 text-sm font-black text-text-muted hover:text-text-main hover:bg-item-hover transition-colors cursor-pointer"
                        >
                            −
                        </button>
                        <span className="flex-1 text-center text-sm font-black text-text-main">{partySize}</span>
                        <button
                            onClick={() => setPartySize((p) => Math.min(maxParty, p + 1))}
                            className="px-3 py-2.5 text-sm font-black text-text-muted hover:text-text-main hover:bg-item-hover transition-colors cursor-pointer"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Date + time */}
                <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-text-muted">Date & time</label>
                    <input
                        type="datetime-local"
                        value={requestedTime}
                        min={toLocalInputValue(new Date())}
                        onChange={(e) => setRequestedTime(e.target.value)}
                        className="w-full rounded-xl border border-border-main bg-bg-secondary px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
                    />
                </div>
            </div>

            <button
                onClick={runCheck}
                disabled={loading || !requestedTime}
                className="w-full rounded-xl bg-brand-gold px-4 py-3 text-sm font-black text-bg-black hover:bg-brand-gold-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer active:scale-[0.99]"
            >
                {loading ? 'Checking availability…' : 'Check availability'}
            </button>

            {error && (
                <div className="mt-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
                    Couldn't check availability. Please try again.
                </div>
            )}

            {!loading && !error && slots.length > 0 && (
                <div className="mt-6">
                    <h3 className="mb-3 text-sm font-black text-text-main">
                        {slots.length} available {slots.length === 1 ? 'table' : 'tables'} for {partySize} ·{' '}
                        {new Date(requestedTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </h3>
                    <ul className="flex flex-col gap-2.5">
                        {slots.map((slot) => (
                            <li key={slot.table.id}>
                                <button
                                    onClick={() => onSlotPicked(slot, partySize, new Date(requestedTime).toISOString())}
                                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-border-main bg-bg-secondary/60 px-4 py-3 text-left hover:border-brand-green/60 hover:bg-item-hover transition-all duration-200 cursor-pointer group"
                                >
                                    <div>
                                        <p className="text-sm font-black text-text-main">
                                            Table {slot.table.tableNumber}
                                        </p>
                                        <p className="text-xs text-text-muted mt-0.5">
                                            Seats {slot.table.capacityMin}–{slot.table.capacityMax}
                                            {slot.table.section ? ` · ${slot.table.section}` : ''}
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded-lg bg-brand-green/10 px-3 py-1.5 text-xs font-black text-brand-green group-hover:bg-brand-green group-hover:text-bg-black transition-colors duration-200">
                                        {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {!loading && !error && !!data && slots.length === 0 && (
                <div className="mt-6 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-4 py-4 text-center text-sm text-text-sub">
                    <span className="font-black text-brand-gold">No availability</span> for {partySize} at that
                    time — try another time or a smaller party.
                </div>
            )}
        </div>
    );
};
