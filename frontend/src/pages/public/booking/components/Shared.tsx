import React from 'react';
import { Link } from 'react-router-dom';

interface PublicHeaderProps {
    stepLabel?: string;
    stepCount?: number;
}

// Minimal public header — no auth, no staff nav. Just the brand + a
// "Staff login" escape hatch so testers can jump to the dashboard.
export const PublicHeader = ({ stepLabel, stepCount }: PublicHeaderProps) => (
    <header className="sticky top-0 z-40 border-b border-border-main bg-bg-secondary/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 md:px-6 py-4">
            <Link to="/" className="text-lg font-black tracking-tight text-text-main no-underline hover:text-brand-gold transition-colors duration-200">
                🍽️ Hostly
            </Link>
            <div className="flex items-center gap-3">
                {stepLabel && (
                    <span className="hidden sm:block text-xs font-bold text-text-muted">
                        Step {stepCount} · {stepLabel}
                    </span>
                )}
                <Link
                    to="/login"
                    className="text-xs font-bold rounded-xl px-3 py-1.5 border border-border-main bg-bg-primary text-text-sub hover:text-text-main hover:border-brand-gold/50 transition-all duration-200 no-underline"
                >
                    Staff login
                </Link>
            </div>
        </div>
    </header>
);

// Shared step shell so every step has a consistent container + back button.
export const StepShell = ({
    title,
    subtitle,
    onBack,
    children,
}: {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    children: React.ReactNode;
}) => (
    <div className="rounded-2xl border border-border-main bg-bg-primary shadow-sm overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-5 md:px-7 pt-5 pb-3 border-b border-border-sub">
            <div>
                <h2 className="text-lg font-black tracking-tight text-text-main">{title}</h2>
                {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
            </div>
            {onBack && (
                <button
                    onClick={onBack}
                    className="shrink-0 text-xs font-bold rounded-xl px-3 py-1.5 border border-border-main bg-bg-secondary text-text-muted hover:text-text-main hover:border-border-muted transition-all duration-200 cursor-pointer"
                >
                    ← Back
                </button>
            )}
        </div>
        <div className="p-5 md:p-7">{children}</div>
    </div>
);
