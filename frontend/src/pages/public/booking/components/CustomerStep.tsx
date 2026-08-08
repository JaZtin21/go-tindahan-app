import React, { useState } from 'react';
import { CalendarCheck, Users } from 'lucide-react';
import { useMutation } from '@apollo/client/react';
import {
    CREATE_BOOKING_MUTATION,
    FIND_OR_CREATE_CUSTOMER_MUTATION,
} from '~/api/queries/graphql/restaurant';
import type { AvailableSlot, Booking, Customer, Restaurant } from '~/types/restaurant';
import { formatFull, tzAbbrev } from './timeFormat';

// ============================================================================
// STEP 3 — YOUR DETAILS + CONFIRM
// findOrCreateCustomer → createBooking (idempotencyKey guards retries).
// ============================================================================

interface CustomerStepProps {
    restaurant: Restaurant;
    slot: AvailableSlot;
    partySize: number;
    requestedTime: string;
    onDone: (booking: Booking, customer: Customer) => void;
    onBack: () => void;
}

const inputCls =
    'w-full rounded-xl border border-border-main/70 bg-bg-primary px-4 py-2.5 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all';

export const CustomerStep = ({ restaurant, slot, partySize, requestedTime, onDone, onBack }: CustomerStepProps) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [specialRequests, setSpecialRequests] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Stable per-submission idempotency key: if the createBooking response is
    // lost (network flap) and the user retries, reusing the SAME key prevents
    // the backend from creating a duplicate booking. Regenerated only when the
    // step remounts (new table pick).
    const [idempotencyKey] = useState(() => crypto.randomUUID());

    const [findOrCreate, { loading: finding }] = useMutation(FIND_OR_CREATE_CUSTOMER_MUTATION);
    const [createBooking, { loading: creating }] = useMutation(CREATE_BOOKING_MUTATION);

    const submitting = finding || creating;

    const extractError = (e: any) =>
        e?.graphQLErrors?.[0]?.message ?? e?.message ?? 'Something went wrong while booking. Please try again.';

    const handleConfirm = async () => {
        setError(null);
        if (!name.trim() || phone.trim().length < 7) {
            setError('Please enter your name and a valid phone number.');
            return;
        }

        try {
            // 1. Get-or-create the customer record (public mutation)
            const { data: custData }: any = await findOrCreate({
                variables: {
                    input: {
                        phone: phone.trim(),
                        name: name.trim(),
                        email: email.trim() || null,
                    },
                },
            });
            const customer: Customer = custData?.findOrCreateCustomer;
            if (!customer?.id) throw new Error('No customer returned');

            // 2. Create the booking with a fresh idempotency key so retries
            // (network flap, double-click) can never double-book.
            const { data: bookData }: any = await createBooking({
                variables: {
                    input: {
                        restaurantId: restaurant.id,
                        customerId: customer.id,
                        tableId: slot.table.id,
                        partySize,
                        bookingTime: requestedTime,
                        specialRequests: specialRequests.trim() || null,
                        source: 'WEB',
                        idempotencyKey,
                    },
                },
            });
            const booking: Booking = bookData?.createBooking;
            if (!booking?.id) throw new Error('No booking returned');

            onDone(booking, customer);
        } catch (e: any) {
            setError(extractError(e));
        }
    };

    return (
        <div>
            {/* Summary of the chosen table */}
            <div className="mb-6 rounded-2xl border border-brand-green/30 bg-brand-green/10 backdrop-blur-sm px-4 py-3.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <p className="flex items-center gap-1.5 text-sm font-black text-text-main">
                            <CalendarCheck size={14} strokeWidth={2.2} className="text-brand-green" />
                            {restaurant.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                            <Users size={12} strokeWidth={2.2} className="text-brand-green" />
                            Table {slot.table.tableNumber} · {partySize} guests · {formatFull(requestedTime)}{' '}
                            <span className="font-bold text-text-sub">{tzAbbrev(new Date(requestedTime))}</span>
                        </p>
                    </div>
                    <span className="rounded-lg bg-brand-green/15 px-2.5 py-1 text-[11px] font-bold text-brand-green">
                        {slot.table.capacityMin}–{slot.table.capacityMax} seats
                    </span>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-1">
                    <label className="mb-1.5 block text-xs font-bold text-text-muted">Full name *</label>
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="sm:col-span-1">
                    <label className="mb-1.5 block text-xs font-bold text-text-muted">Phone *</label>
                    <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0400 000 000" inputMode="tel" />
                </div>
                <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-text-muted">Email (optional)</label>
                    <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" inputMode="email" />
                </div>
                <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-text-muted">Special requests (optional)</label>
                    <textarea
                        className={`${inputCls} resize-none`}
                        rows={2}
                        value={specialRequests}
                        onChange={(e) => setSpecialRequests(e.target.value)}
                        placeholder="Window seat, birthday cake, high chair…"
                    />
                </div>
            </div>

            {error && (
                <div className="mt-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</div>
            )}

            <div className="mt-6 flex items-center gap-3">
                <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="flex-1 cursor-pointer rounded-xl bg-brand-gold px-4 py-3 text-sm font-black text-text-white shadow-xs shadow-brand-gold/20 transition-all duration-200 hover:bg-brand-gold-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {submitting ? 'Booking your table…' : 'Confirm booking'}
                </button>
                <button
                    onClick={onBack}
                    className="rounded-xl border border-border-main bg-bg-secondary px-4 py-3 text-sm font-bold text-text-muted hover:text-text-main transition-all duration-200 cursor-pointer"
                >
                    Back
                </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-text-muted">
                No payment required. We'll text you a confirmation — this flow mirrors the phone (Vapi) booking path.
            </p>
        </div>
    );
};
