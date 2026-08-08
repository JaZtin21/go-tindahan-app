import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { InputAdornment } from './InputAdornment';

interface DatePickerDropdownProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    className?: string; // extra classes for the trigger button
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Button + themed calendar popover. Replaces native `<input type="date">`
 * (which doesn't open in every webview) with a fully styled dropdown whose
 * colors follow the app's design tokens.
 */
export const DatePickerDropdown = ({ value, onChange, className = '' }: DatePickerDropdownProps) => {
    const [open, setOpen] = useState(false);

    const [viewYear, setViewYear] = useState(() => (value ? new Date(`${value}T00:00:00`) : new Date()).getFullYear());
    const [viewMonth, setViewMonth] = useState(() => (value ? new Date(`${value}T00:00:00`) : new Date()).getMonth());

    const openPicker = () => {
        const d = value ? new Date(`${value}T00:00:00`) : new Date();
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
        setOpen(true);
    };

    // Close on Escape.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
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

            {open && (
                <>
                    {/* Transparent click-away backdrop */}
                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />

                    <div role="dialog" aria-label="Select a date" className="glass-strong absolute right-0 top-[calc(100%+8px)] z-50 w-[276px] rounded-2xl p-3 shadow-xl shadow-black/10">
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
                                                ? 'bg-brand-gold text-text-white shadow-md shadow-brand-gold/25'
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
                </>
            )}
        </div>
    );
};

export default DatePickerDropdown;
