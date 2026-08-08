import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

interface ErrorStateProps {
    /** Short headline — defaults to "Something went wrong". */
    title?: string;
    /** Full error detail (Apollo message, etc.). */
    message?: string | null;
    /** When provided, shows a "Try again" button that calls it (usually a query refetch). */
    onRetry?: () => void;
    /** Compact inline banner variant — for mutation failures surfaced at the top of a page. */
    compact?: boolean;
    /** When provided, shows a dismiss ✕ that calls it. */
    onDismiss?: () => void;
}

/**
 * Consistent error display for the restaurant dashboard.
 *
 * - `compact={false}` (default): a full-width glass card with a centered alert
 *   icon — use it in place of page content when a query fails (e.g. backend down).
 * - `compact={true}`: a slim inline banner — use it for mutation failures at the
 *   top of a page, so the user sees the message without losing the UI around it.
 */
export const ErrorState = ({ title = 'Something went wrong', message, onRetry, compact = false, onDismiss }: ErrorStateProps) => {
    const body = (
        <span className="min-w-0">
            {title && <span className="block text-sm font-black text-brand-red">{title}</span>}
            {message && (
                <span className="mt-0.5 block break-words text-xs font-semibold text-text-muted">{message}</span>
            )}
        </span>
    );

    if (compact) {
        return (
            <div
                role="alert"
                className="flex items-start justify-between gap-3 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3.5 py-2.5 backdrop-blur-sm"
            >
                <div className="flex min-w-0 items-start gap-2.5">
                    <AlertTriangle size={15} strokeWidth={2.2} className="mt-0.5 shrink-0 text-brand-red" />
                    {body}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="flex cursor-pointer items-center gap-1 rounded-lg border border-brand-red/30 bg-brand-red/10 px-2.5 py-1 text-[11px] font-black text-brand-red transition-colors duration-150 hover:bg-brand-red/20"
                        >
                            <RotateCcw size={11} strokeWidth={2.4} />
                            Retry
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            type="button"
                            onClick={onDismiss}
                            aria-label="Dismiss error"
                            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-item-hover hover:text-text-main"
                        >
                            <X size={13} strokeWidth={2.4} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div role="alert" className="glass-panel flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red">
                <AlertTriangle size={22} strokeWidth={2.2} />
            </span>
            {body}
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1 flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-gold px-4 py-2.5 text-xs font-black text-text-white shadow-xs shadow-brand-gold/20 transition-all duration-200 hover:bg-brand-gold-hover active:scale-95"
                >
                    <RotateCcw size={13} strokeWidth={2.4} />
                    Try again
                </button>
            )}
        </div>
    );
};

export default ErrorState;
