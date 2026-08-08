import React from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, ArrowLeft } from 'lucide-react';

interface PublicHeaderProps {
    stepLabel?: string;
    stepCount?: number;
}

// Minimal public header — no auth, no staff nav. Just the brand + a
// "Staff login" escape hatch so testers can jump to the dashboard.
export const PublicHeader = ({ stepLabel, stepCount }: PublicHeaderProps) => (
    <header className="sticky top-0 z-40 border-b border-border-main/60 bg-bg-primary/70 backdrop-blur-xl shadow-sm shadow-black/[0.03]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 md:px-6 py-4">
            <Link to="/" className="flex items-center gap-2.5 text-lg font-black tracking-tight text-text-main no-underline transition-colors duration-200 hover:text-brand-gold">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-gold to-brand-green text-bg-black shadow-md shadow-brand-gold/25">
                    <UtensilsCrossed size={17} strokeWidth={2.2} />
                </span>
                Hostly
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
    <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-5 md:px-7 pt-5 pb-3 border-b border-border-sub/60 bg-bg-secondary/40">
            <div>
                <h2 className="text-lg font-black tracking-tight text-text-main">{title}</h2>
                {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
            </div>
            {onBack && (
                <button
                    onClick={onBack}
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border-main/70 bg-bg-secondary/70 px-3 py-1.5 text-xs font-bold text-text-muted transition-all duration-200 hover:border-border-muted hover:text-text-main"
                >
                    <ArrowLeft size={13} strokeWidth={2.5} />
                    Back
                </button>
            )}
        </div>
        <div className="p-5 md:p-7">{children}</div>
    </div>
);
