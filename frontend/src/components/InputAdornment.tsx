import React from 'react';

interface InputAdornmentProps {
    icon: React.ReactNode;
    side?: 'left' | 'right';
    className?: string;
}

/**
 * Absolutely-positioned decorative icon for inputs. Render it inside a
 * `.relative` wrapper next to the input (which must have matching
 * `pl-10` / `pr-10` padding). It's its own element rather than part of
 * the input, so theme colors apply cleanly in both light and dark mode.
 */
export const InputAdornment = ({ icon, side = 'left', className = '' }: InputAdornmentProps) => (
    <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-text-sub ${side === 'left' ? 'left-3.5' : 'right-3.5'} ${className}`}
    >
        {icon}
    </span>
);

export default InputAdornment;
