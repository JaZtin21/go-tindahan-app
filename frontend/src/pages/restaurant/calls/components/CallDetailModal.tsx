import React, { useEffect } from 'react';
import { X, PhoneCall, User, CalendarCheck, Activity, FileText } from 'lucide-react';
import type { CallLog } from '~/types/restaurant';

interface CallDetailModalProps {
    call: CallLog;
    onClose: () => void;
}

const OUTCOME_STYLES: Record<string, string> = {
    BOOKED: 'bg-brand-green/15 text-brand-green',
    NO_AVAILABILITY: 'bg-brand-red/15 text-brand-red',
    TRANSFERRED: 'bg-brand-gold/15 text-brand-gold',
    ABANDONED: 'bg-item-hover text-text-muted',
};

/**
 * Scrollable modal showing a call's details and transcript. Opens when a
 * row in the calls table is clicked — the table itself stays full-width.
 */
export const CallDetailModal = ({ call, onClose }: CallDetailModalProps) => {
    const outcomeStyle = OUTCOME_STYLES[call.outcome ?? ''] ?? OUTCOME_STYLES.ABANDONED;

    const details = [
        { icon: User, label: 'Caller', value: call.customerPhone || 'Not captured', chip: 'bg-brand-gold/15 text-brand-gold' },
        { icon: CalendarCheck, label: 'Booking', value: call.bookingId ? call.bookingId.slice(0, 8) : 'None created', chip: 'bg-brand-green/15 text-brand-green' },
        { icon: Activity, label: 'Outcome', value: call.outcome ? call.outcome.replace('_', ' ') : '—', chip: outcomeStyle },
    ];

    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md sm:p-6"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="glass-strong animate-[modal-pop_0.18s_ease-out] flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-3xl"
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-main/60 bg-bg-secondary/70 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
                            <PhoneCall size={18} strokeWidth={2.2} />
                        </span>
                        <div>
                            <h3 className="m-0 text-sm font-bold tracking-tight text-text-main">
                                Call {call.vapiCallId.slice(0, 8)}
                            </h3>
                            <p className="m-0 mt-0.5 text-xs font-bold text-text-muted">
                                {new Date(call.createdAt).toLocaleString('en-AU')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-item-hover hover:text-text-main"
                        aria-label="Close call details"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Details */}
                <div className="grid shrink-0 grid-cols-1 gap-2.5 border-b border-border-main/60 px-5 py-4 sm:grid-cols-3">
                    {details.map(({ icon: Icon, label, value, chip }) => (
                        <div key={label} className="flex items-center gap-2.5 rounded-xl border border-border-main/60 bg-bg-primary/60 px-3 py-2.5 backdrop-blur-sm">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chip}`}>
                                <Icon size={14} strokeWidth={2.2} />
                            </span>
                            <div className="min-w-0">
                                <p className="m-0 text-[10px] font-black uppercase tracking-wider text-text-muted">{label}</p>
                                <p className="m-0 truncate text-xs font-bold text-text-main">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Transcript (scrollable) */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-black tracking-widest text-text-muted">
                        <FileText size={12} strokeWidth={2.2} className="text-brand-gold" />
                        TRANSCRIPT
                    </div>
                    {call.transcript ? (
                        <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap text-text-sub font-medium">
                            {call.transcript}
                        </p>
                    ) : (
                        <p className="m-0 text-text-muted text-[13px] font-bold">No transcript available.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CallDetailModal;
