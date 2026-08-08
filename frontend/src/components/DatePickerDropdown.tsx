import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { InputAdornment } from './InputAdornment';

interface DatePickerDropdownProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    className?: string; // extra classes for the trigger button
    /** Render the calendar as a centered modal instead of an anchored popover
     * (use when the trigger sits near a screen/card edge and the popover
     * would get clipped). Small screens always use the modal automatically. */
    modal?: boolean;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

// Tailwind's `md` breakpoint is 768px — below that the anchored popover
// overflows the viewport, so the calendar always renders as a modal.
const MOBILE_MQ = '(max-width: 767px)';

// Shared surface styling for the calendar dialog (both popover & modal modes).
const CALENDAR_SURFACE =
    'rounded-2xl border border-border-main/70 bg-bg-primary p-3 shadow-xs shadow-black/10';

/**
 * Button + themed calendar. Replaces native `<input type="date">` (which
 * doesn't open in every webview) with a fully styled calendar whose colors
 * follow the app's design tokens. Renders either an anchored popover or a
 * centered modal (see `modal` prop).
 */
export const DatePickerDropdown = ({ value, onChange, className = '', modal = false }: DatePickerDropdownProps) => {
    const [open, setOpen] = useState(false);

    const [viewYear, setViewYear] = useState(() => (value ? new Date(`${value}T00:00:00`) : new Date()).getFullYear());
    const [viewMonth, setViewMonth] = useState(() => (value ? new Date(`${value}T00:00:00`) : new Date()).getMonth());

    // On small screens (< md) the anchored popover overflows the viewport
    // (it clips against card edges), so force the centered modal there.
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches
    );
    useEffect(() => {
        const mq = window.matchMedia(MOBILE_MQ);
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const effectiveModal = modal || isMobile;

    const openPicker = () => {
        const d = value ? new Date(`${value}T00:00:00`) : new Date();
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
        setOpen(true);
    };

    // Close on Escape — the innermost dialog wins: capture phase runs this
    // handler BEFORE an outer modal's bubble-phase Escape handler (e.g. the
    // closure form behind this calendar), and stopImmediatePropagation then
    // prevents the outer handler from also firing and closing both at once.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopImmediatePropagation();
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [open]);

    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewYear((y) => y - 1);
            setViewMonth(11);
        } else {
            setViewMonth((m) => m - 1);
        }
    };

    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewYear((y) => y + 1);
            setViewMonth(0);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    // Monday-first grid: leading nulls pad the first week.
    const days = useMemo(() => {
        const first = new Date(viewYear, viewMonth, 1);
        const offset = (first.getDay() + 6) % 7;
        const total = new Date(viewYear, viewMonth + 1, 0).getDate();
        const cells: (number | null)[] = Array.from({ length: offset }, () => null);
        for (let d = 1; d <= total; d++) cells.push(d);
        return cells;
    }, [viewYear, viewMonth]);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const pick = (day: number) => {
        onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`);
        setOpen(false);
    };

    const renderCalendar = (cls: string, showHeader = false) => (
        <div role="dialog" aria-label="Select a date" className={cls}>
            {showHeader && (
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-text-main">Select a date</span>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Close"
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-item-hover hover:text-text-main"
                    >
                        <X size={14} strokeWidth={2.5} />
                    </button>
                </div>
            )}

            {/* Month header */}
            <div className="flex items-center justify-between pb-2">
                <button
                    type="button"
                    onClick={prevMonth}
                    aria-label="Previous month"
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-text-sub transition-colors duration-150 hover:bg-item-hover hover:text-text-main"
                >
                    <ChevronLeft size={15} strokeWidth={2.2} />
                </button>
                <span className="text-xs font-black uppercase tracking-wider text-text-main">
                    {MONTHS[viewMonth]} {viewYear}
                </span>
                <button
                    type="button"
                    onClick={nextMonth}
                    aria-label="Next month"
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-text-sub transition-colors duration-150 hover:bg-item-hover hover:text-text-main"
                >
                    <ChevronRight size={15} strokeWidth={2.2} />
                </button>
            </div>

            {/* Weekday row */}
            <div className="grid grid-cols-7 gap-1 pb-1">
                {WEEKDAYS.map((w) => (
                    <span key={w} className="text-center text-[10px] font-black uppercase tracking-wider text-text-muted">
                        {w}
                    </span>
                ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => {
                    if (day === null) return <span key={`empty-${i}`} />;
                    const key = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                    const isSelected = key === value;
                    const isToday = key === todayKey;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => pick(day)}
                            className={`flex h-8 w-full cursor-pointer items-center justify-center rounded-lg text-xs font-bold transition-colors duration-100 ${
                                isSelected
                                    ? 'bg-brand-gold text-text-white shadow-xs shadow-brand-gold/25'
                                    : isToday
                                      ? 'text-brand-gold ring-1 ring-brand-gold/50 hover:bg-brand-gold/10'
                                      : 'text-text-sub hover:bg-item-hover hover:text-text-main'
                            }`}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="relative">
            <button
                type="button"
                onClick={openPicker}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={`glass-panel flex cursor-pointer items-center gap-2 rounded-xl py-2.5 pl-10 pr-3.5 text-sm font-bold text-text-main transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 hover:border-brand-gold/40 ${className}`}
            >
                {value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-AU') : 'Select a date'}
            </button>
            <InputAdornment icon={<CalendarDays size={15} strokeWidth={2.2} />} className="!text-brand-gold" />

            {open && !effectiveModal && (
                <>
                    {/* Transparent click-away backdrop */}
                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
                    {renderCalendar(`absolute right-0 top-[calc(100%+8px)] z-50 w-[276px] ${CALENDAR_SURFACE}`)}
                </>
            )}

            {/* Modal mode is portaled to <body>: a `.glass-panel` ancestor's
                backdrop-filter becomes the containing block for `fixed`
                descendants, which would size/clip an in-place overlay. */}
            {open &&
                effectiveModal &&
                createPortal(
                    <div
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
                    >
                        <div onClick={(e) => e.stopPropagation()} className="animate-[modal-pop_0.18s_ease-out]">
                            {renderCalendar(`w-[288px] ${CALENDAR_SURFACE}`, true)}
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default DatePickerDropdown;
