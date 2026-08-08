import React, { useEffect } from 'react';
import {
    X,
    Phone,
    Mail,
    Users,
    Clock,
    Armchair,
    CalendarDays,
    AlignLeft,
    ShieldCheck,
} from 'lucide-react';
import type { Booking, RestaurantTable } from '~/types/restaurant';

interface BookingDetailModalProps {
    booking: Booking;
    tables: RestaurantTable[];
    onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-brand-gold/90 text-text-white',
    CONFIRMED: 'bg-brand-green/90 text-bg-black',
    SEATED: 'bg-brand-green/20 text-brand-green border border-brand-green/50',
    COMPLETED: 'bg-item-hover text-text-muted border border-border-main',
    CANCELLED: 'bg-brand-red/90 text-text-white',
    NO_SHOW: 'bg-brand-red/60 text-text-white',
};

function fmtTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtHour(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const BookingDetailModal = ({ booking, tables, onClose }: BookingDetailModalProps) => {
    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const customer = booking.customer ?? null;
    const table = tables.find((t) => t.id === booking.tableId);
    const statusStyle = STATUS_STYLES[booking.status] ?? STATUS_STYLES.PENDING;

    const meta = [
        { icon: Users, label: 'Party', value: `${booking.partySize} ${booking.partySize === 1 ? 'guest' : 'guests'}` },
        { icon: Clock, label: 'Duration', value: `${booking.durationMinutes} min` },
        { icon: Armchair, label: 'Table', value: table ? `${table.section ? `${table.section} · ` : ''}${table.tableNumber}` : 'Unassigned' },
        { icon: ShieldCheck, label: 'Source', value: booking.source.replace('_', ' ').toLowerCase() },
    ];

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md sm:p-5"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="glass-strong animate-[modal-pop_0.18s_ease-out] max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-3xl p-6 sm:p-7"
            >
                {/* Header */}
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/25 to-brand-green/25 text-brand-gold ring-1 ring-brand-gold/20">
                            <CalendarDays size={20} strokeWidth={2.2} />
                        </span>
                        <div>
                            <h3 className="m-0 text-lg font-bold tracking-tight text-text-main">
                                {fmtTime(booking.bookingTime)}
                            </h3>
                            <p className="m-0 text-[11px] font-bold text-text-muted">Booking details</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusStyle}`}>
                            {booking.status.replace('_', ' ')}
                        </span>
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-item-hover hover:text-text-main"
                            aria-label="Close"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Customer */}
                <div className="mb-4 rounded-2xl border border-brand-gold/25 bg-gradient-to-br from-brand-gold/10 to-transparent p-4 backdrop-blur-sm">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-muted">Customer</p>
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-base font-black text-brand-gold ring-1 ring-brand-gold/30">
                            {(customer?.name ?? 'G')[0].toUpperCase()}
                        </span>
                        <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-black text-text-main">
                                {customer?.name || 'Guest (no name)'}
                            </p>
                            <div className="mt-0.5 flex flex-col gap-1">
                                {customer?.phone && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-text-sub">
                                        <Phone size={12} strokeWidth={2.2} className="text-brand-gold" />
                                        {customer.phone}
                                    </span>
                                )}
                                {customer?.email && (
                                    <span className="flex items-center gap-1.5 truncate text-xs font-bold text-text-sub">
                                        <Mail size={12} strokeWidth={2.2} className="text-brand-gold" />
                                        {customer.email}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Meta tiles */}
                <div className="mb-4 grid grid-cols-2 gap-2.5">
                    {meta.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-center gap-2.5 rounded-xl border border-border-main/60 bg-bg-primary/60 px-3 py-2.5 backdrop-blur-sm">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-green/15 text-brand-green">
                                <Icon size={14} strokeWidth={2.2} />
                            </span>
                            <div className="min-w-0">
                                <p className="m-0 text-[10px] font-black uppercase tracking-wider text-text-muted">{label}</p>
                                <p className="m-0 truncate text-xs font-bold text-text-main">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Notes */}
                <div className="rounded-xl border border-border-main/60 bg-bg-primary/60 p-3.5 backdrop-blur-sm">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-muted">
                        <AlignLeft size={12} strokeWidth={2.2} className="text-brand-gold" />
                        Notes / special requests
                    </p>
                    {booking.specialRequests ? (
                        <p className="m-0 text-[13px] leading-relaxed text-text-sub font-medium">{booking.specialRequests}</p>
                    ) : (
                        <p className="m-0 text-xs font-bold text-text-muted">No special requests.</p>
                    )}
                </div>

                <p className="mt-4 text-center text-[10px] font-bold text-text-muted">
                    Booked via {booking.source.replace('_', ' ').toLowerCase()} · {booking.paymentStatus.replace('_', ' ').toLowerCase()} payment
                </p>
            </div>
        </div>
    );
};

export default BookingDetailModal;
