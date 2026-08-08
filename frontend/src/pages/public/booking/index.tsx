import React, { useState } from 'react';
import { Check, CalendarCheck2 } from 'lucide-react';
import type { AvailableSlot, Booking, Customer, Restaurant } from '~/types/restaurant';
import { PublicHeader, StepShell } from './components/Shared';
import { tzAbbrev } from './components/timeFormat';
import { RestaurantPicker } from './components/RestaurantPicker';
import { AvailabilityStep } from './components/AvailabilityStep';
import { CustomerStep } from './components/CustomerStep';

// ============================================================================
// PUBLIC BOOKING FLOW  (/book)
// No auth required — mirrors what a website customer (or the Vapi phone
// agent) goes through: find → check availability → confirm → done.
// ============================================================================

type Step = 'pick' | 'availability' | 'details' | 'done';

const STEP_LABELS: Record<Step, string> = {
    pick: 'Find a restaurant',
    availability: 'Pick a table',
    details: 'Your details',
    done: 'Confirmed',
};

export const PublicBookingPage = () => {
    const [step, setStep] = useState<Step>('pick');
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [slot, setSlot] = useState<AvailableSlot | null>(null);
    const [partySize, setPartySize] = useState(2);
    const [requestedTime, setRequestedTime] = useState('');
    const [result, setResult] = useState<{ booking: Booking; customer: Customer } | null>(null);

    const handlePickRestaurant = (r: Restaurant) => {
        setRestaurant(r);
        setStep('availability');
    };

    const handleSlotPicked = (s: AvailableSlot, size: number, time: string) => {
        setSlot(s);
        setPartySize(size);
        setRequestedTime(time);
        setStep('details');
    };

    const handleDone = (booking: Booking, customer: Customer) => {
        setResult({ booking, customer });
        setStep('done');
    };

    return (
        <div className="min-h-screen ambient-bg text-text-main transition-colors duration-300">
            <PublicHeader stepLabel={STEP_LABELS[step]} stepCount={step === 'done' ? 3 : ['pick', 'availability', 'details'].indexOf(step) + 1} />

            <main className="mx-auto w-full max-w-3xl px-4 md:px-6 py-8">
                {/* Stepper indicator */}
                <div className="mb-6 flex items-center gap-2">
                    {(['pick', 'availability', 'details'] as Step[]).map((s, i) => {
                        const idx = step === 'done' ? 3 : ['pick', 'availability', 'details'].indexOf(step);
                        const active = i === idx;
                        const passed = i < idx || step === 'done';
                        return (
                            <React.Fragment key={s}>
                                <div
                                    className={`flex items-center gap-2 ${
                                        active ? 'text-brand-gold' : passed ? 'text-brand-green' : 'text-text-muted'
                                    }`}
                                >
                                    <span
                                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black border ${
                                            active
                                                ? 'border-brand-gold bg-brand-gold/15'
                                                : passed
                                                ? 'border-brand-green bg-brand-green/15'
                                                : 'border-border-main bg-bg-secondary'
                                        }`}
                                    >
                                        {passed ? '✓' : i + 1}
                                    </span>
                                    <span className="hidden sm:block text-xs font-bold">{STEP_LABELS[s]}</span>
                                </div>
                                {i < 2 && <div className="h-px flex-1 bg-border-main" />}
                            </React.Fragment>
                        );
                    })}
                </div>

                {step === 'pick' && (
                    <StepShell
                        title="Book a table"
                        subtitle="Find a restaurant and check live availability — no login needed."
                    >
                        <RestaurantPicker onSelect={handlePickRestaurant} />
                    </StepShell>
                )}

                {step === 'availability' && restaurant && (
                    <StepShell
                        title={restaurant.name}
                        subtitle={`${restaurant.cuisineType ?? 'Restaurant'} · ${restaurant.suburb}, ${restaurant.state}`}
                        onBack={() => setStep('pick')}
                    >
                        <AvailabilityStep
                            restaurant={restaurant}
                            onSlotPicked={handleSlotPicked}
                        />
                    </StepShell>
                )}

                {step === 'details' && restaurant && slot && (
                    <StepShell title="Almost there" subtitle="Tell us who's coming so we can hold your table." onBack={() => setStep('availability')}>
                        <CustomerStep
                            restaurant={restaurant}
                            slot={slot}
                            partySize={partySize}
                            requestedTime={requestedTime}
                            onDone={handleDone}
                            onBack={() => setStep('availability')}
                        />
                    </StepShell>
                )}

                {step === 'done' && result && (
                    <div className="glass-panel rounded-3xl border-brand-green/40 p-8 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/15 text-brand-green">
                            <Check size={28} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-xl font-black tracking-tight text-text-main">Table booked!</h2>
                        <p className="mt-1 text-sm text-text-muted">
                            {result.customer.name || 'You'} · {result.booking.partySize} guests ·{' '}
                            {new Date(result.booking.bookingTime).toLocaleString([], {
                                weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })}{' '}
                            <span className="font-bold text-text-sub">{tzAbbrev(new Date(result.booking.bookingTime))}</span>
                        </p>
                        <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border-main/70 bg-bg-secondary/70 px-4 py-2 text-xs font-bold text-text-sub">
                            <CalendarCheck2 size={13} strokeWidth={2.2} className="text-brand-green" />
                            Booking ref: <span className="text-brand-green">{result.booking.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <p className="mt-4 text-xs text-text-muted">
                            A staff member will confirm shortly — check your phone for a message.
                        </p>
                        <button
                            onClick={() => {
                                setStep('pick');
                                setRestaurant(null);
                                setSlot(null);
                                setResult(null);
                            }}
                            className="mt-6 cursor-pointer rounded-xl bg-brand-gold px-6 py-3 text-sm font-black text-text-white shadow-lg shadow-brand-gold/20 transition-all duration-200 hover:bg-brand-gold-hover active:scale-[0.99]"
                        >
                            Book another table
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};
