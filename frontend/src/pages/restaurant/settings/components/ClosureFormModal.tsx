import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarX2, FileText, Loader2 } from 'lucide-react';
import { DatePickerDropdown } from '~/components/DatePickerDropdown';
import { InputAdornment } from '~/components/InputAdornment';

interface ClosureFormModalProps {
    saving?: boolean;
    /** Mutation failure message — rendered inside the modal so it's never hidden behind the backdrop. */
    error?: string | null;
    onClose: () => void;
    onSave: (input: { closureDate: string; reason: string }) => void;
}

export const ClosureFormModal = ({ saving, error, onClose, onSave }: ClosureFormModalProps) => {
    const [date, setDate] = useState('');
    const [reason, setReason] = useState('');

    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const isPast = date ? new Date(`${date}T23:59:59`) < new Date() : false;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || isPast) return;
        onSave({ closureDate: date, reason: reason.trim() });
    };

    const inputCls =
        'block w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border-main/70 bg-bg-secondary text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200';
    const labelCls = 'text-xs font-bold text-text-sub uppercase tracking-wider';

    // Render via portal: ClosuresPanel's root is a .glass-panel whose
    // backdrop-filter makes it the containing block for position:fixed
    // descendants — without the portal the overlay gets trapped inside the
    // card instead of covering the viewport.
    return createPortal(
        <div
            onClick={onClose}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md sm:p-5"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="animate-[modal-pop_0.18s_ease-out] flex max-h-[90vh] w-full max-w-[400px] flex-col overflow-hidden rounded-3xl border border-border-main/70 bg-bg-primary shadow-xs shadow-black/10"
            >
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-main/60 bg-bg-secondary/60 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red ring-1 ring-brand-red/20">
                            <CalendarX2 size={20} strokeWidth={2.2} />
                        </span>
                        <div>
                            <h3 className="m-0 text-lg font-bold tracking-tight text-text-main">Add a closure</h3>
                            <p className="m-0 text-[11px] font-bold text-text-muted">
                                A one-off date when the kitchen is closed.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-item-hover hover:text-text-main"
                        aria-label="Close"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 sm:p-7">
                    <label className={labelCls}>
                        Date *
                        <div className="relative mt-1.5">
                            <DatePickerDropdown value={date} onChange={setDate} className="w-full" modal />
                        </div>
                        {isPast && (
                            <span className="mt-1.5 block text-[11px] font-bold text-brand-red">
                                Can't schedule a closure in the past — pick a future date.
                            </span>
                        )}
                    </label>

                    <label className={labelCls}>
                        Reason (optional)
                        <div className="relative mt-1.5">
                            <InputAdornment icon={<FileText size={15} strokeWidth={2.2} />} />
                            <input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g. Christmas Day, private event"
                                className={inputCls}
                            />
                        </div>
                    </label>

                    {error && (
                        <div className="flex items-start gap-2 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3.5 py-2.5">
                            <CalendarX2 size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-brand-red" />
                            <span className="break-words text-xs font-semibold text-brand-red">{error}</span>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto flex gap-2.5 border-t border-border-main/60 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 cursor-pointer rounded-xl border border-border-main bg-bg-secondary py-2.5 text-sm font-bold text-text-sub transition-colors duration-150 hover:bg-item-hover"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !date || isPast}
                            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-gold py-2.5 text-sm font-bold text-text-white shadow-xs shadow-brand-gold/20 transition-colors duration-150 hover:bg-brand-gold-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving && <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />}
                            {saving ? 'Adding…' : 'Add closure'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default ClosureFormModal;
