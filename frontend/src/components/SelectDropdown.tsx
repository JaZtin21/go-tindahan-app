import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
}

interface SelectDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    loading?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    /** Trigger styling — tint, size, etc. */
    className?: string;
    /** Width of the popover menu. */
    popoverClassName?: string;
}

/**
 * Themed dropdown — replaces native `<select>` (whose popup styling can't be
 * controlled and looks off-brand). Button trigger + a solid themed listbox
 * with a check on the selected option, click-away backdrop, and Escape close.
 */
export const SelectDropdown = ({
    value,
    onChange,
    options,
    loading,
    disabled,
    ariaLabel,
    className = '',
    popoverClassName = 'w-40',
}: SelectDropdownProps) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selected = options.find((o) => o.value === value);

    // Close on Escape or any click outside the dropdown. (A `fixed` backdrop
    // can't be used here — `.glass-panel` ancestors apply `backdrop-filter`,
    // which becomes the containing block for fixed descendants and shrinks
    // the backdrop to the panel instead of the viewport.)
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        const onDocMouseDown = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const isBusy = loading || disabled;

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                disabled={isBusy}
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            >
                {loading && <Loader2 size={12} strokeWidth={2.5} className="animate-spin" />}
                <span className="truncate">{selected?.label ?? 'Select…'}</span>
                {!loading && (
                    <ChevronDown size={12} strokeWidth={2.5} className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
                )}
            </button>

            {open && (
                <div
                    role="listbox"
                    aria-label={ariaLabel}
                    className={`absolute right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border-main/70 bg-bg-primary p-1 shadow-xs shadow-black/10 ${popoverClassName}`}
                >
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            role="option"
                            aria-selected={o.value === value}
                            onClick={() => {
                                onChange(o.value);
                                setOpen(false);
                            }}
                            className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-bold transition-colors duration-100 ${
                                o.value === value
                                    ? 'bg-brand-gold/15 text-brand-gold'
                                    : 'text-text-sub hover:bg-item-hover hover:text-text-main'
                            }`}
                        >
                            {o.label}
                            {o.value === value && <Check size={12} strokeWidth={2.5} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SelectDropdown;
