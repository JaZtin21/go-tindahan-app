import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    UtensilsCrossed,
    CalendarDays,
    PhoneCall,
    Sparkles,
    Mail,
    Lock,
    ArrowRight,
    ArrowLeft,
} from 'lucide-react';
import { useRestaurantAuth } from '../config/RestaurantAuthProvider'; // 👈 Adjust this path matching your file setup
import { InputAdornment } from '../components/InputAdornment';

const FEATURES = [
    { icon: CalendarDays, title: 'Live bookings', text: 'Every table, every slot, on one timeline.' },
    { icon: PhoneCall, title: 'AI voice agent', text: 'Riley answers calls and books tables 24/7.' },
    { icon: Sparkles, title: 'Auto-managed', text: 'Calls, bookings, and menu info handled for you.' },
];

export const RestaurantLogin = () => {
    const { login, isLoading, isAuthenticated, owner, loginError } = useRestaurantAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(email, password);
        } catch {
            // loginError from context already covers the message shown below
        }
    };

    const inputCls =
        'block w-full pl-10 pr-4 py-3 rounded-xl border border-border-main/70 bg-bg-primary/70 backdrop-blur-sm text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/50 transition-all duration-200';

    if (isAuthenticated && owner) {
        return (
            <div className="min-h-screen ambient-bg flex items-center justify-center px-4 py-12">
                <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold to-brand-green text-bg-black shadow-lg shadow-brand-gold/25">
                        <UtensilsCrossed size={28} strokeWidth={2.2} />
                    </div>
                    <p className="m-0 text-xs font-bold text-text-muted uppercase tracking-widest">Signed in as</p>
                    <strong className="mt-2 block text-xl text-text-main">{owner.firstName} {owner.lastName}</strong>
                    <span className="mt-1 block text-xs font-bold text-text-muted">{owner.email}</span>
                    <Link
                        to="/"
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-black text-text-white no-underline transition-all duration-200 hover:bg-brand-gold-hover active:scale-[0.98] shadow-lg shadow-brand-gold/20"
                    >
                        Open dashboard <ArrowRight size={16} strokeWidth={2.5} />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] ambient-bg">
            {/* ---- Brand showcase panel (desktop) ---- */}
            <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16">
                {/* Backdrop wash */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/25 blur-3xl" />
                    <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-brand-green/20 blur-3xl" />
                    <div className="absolute inset-0 bg-gradient-to-br from-bg-primary/0 via-bg-primary/30 to-bg-primary/70" />
                </div>

                <div className="relative flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold to-brand-green text-bg-black shadow-lg shadow-brand-gold/25">
                        <UtensilsCrossed size={22} strokeWidth={2.2} />
                    </div>
                    <span className="text-xl font-black tracking-tight text-text-main">Hostly</span>
                </div>

                <div className="relative max-w-md">
                    <h1 className="text-4xl font-black leading-tight tracking-tight text-text-main">
                        Your restaurant, <br />
                        <span className="bg-gradient-to-r from-brand-gold to-brand-green bg-clip-text text-transparent">
                            answered by AI.
                        </span>
                    </h1>
                    <p className="mt-4 text-sm font-bold leading-relaxed text-text-muted">
                        Hostly runs your front desk — bookings, hours, and phone calls — so your staff can focus on the floor.
                    </p>
                </div>

                <div className="relative flex flex-col gap-4">
                    {FEATURES.map(({ icon: Icon, title, text }) => (
                        <div key={title} className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
                                <Icon size={18} strokeWidth={2.2} />
                            </div>
                            <div>
                                <p className="m-0 text-sm font-black text-text-main">{title}</p>
                                <p className="m-0 text-xs font-bold text-text-muted">{text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ---- Form side ---- */}
            <div className="flex items-center justify-center px-4 py-12 sm:px-8">
                <div className="w-full max-w-[430px]">
                    {/* Compact brand for mobile */}
                    <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold to-brand-green text-bg-black shadow-lg shadow-brand-gold/25">
                            <UtensilsCrossed size={22} strokeWidth={2.2} />
                        </div>
                        <span className="text-xl font-black tracking-tight text-text-main">Hostly</span>
                    </div>

                    <div className="glass-strong rounded-3xl p-7 sm:p-9">
                        <h2 className="m-0 text-2xl font-black tracking-tight text-text-main">
                            Sign in
                        </h2>
                        <p className="mt-1.5 text-xs font-bold text-text-muted">
                            Welcome back — manage your restaurant, tables, and bookings.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
                            <label className="text-xs font-black uppercase tracking-wider text-text-sub">
                                Email
                                <div className="relative mt-1.5">
                                    <InputAdornment icon={<Mail size={16} strokeWidth={2.2} />} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className={inputCls}
                                    />
                                </div>
                            </label>

                            <label className="text-xs font-black uppercase tracking-wider text-text-sub">
                                Password
                                <div className="relative mt-1.5">
                                    <InputAdornment icon={<Lock size={16} strokeWidth={2.2} />} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className={inputCls}
                                    />
                                </div>
                            </label>

                            {loginError && (
                                <p className="m-0 flex items-center gap-2 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3.5 py-2.5 text-xs font-bold text-brand-red">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" />
                                    {loginError}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-black transition-all duration-200 active:scale-[0.98] shadow-lg shadow-brand-gold/20 ${
                                    isLoading
                                        ? 'cursor-not-allowed bg-brand-gold/40 text-text-white/60'
                                        : 'cursor-pointer bg-brand-gold text-text-white hover:bg-brand-gold-hover hover:shadow-brand-gold/30'
                                }`}
                            >
                                {isLoading ? 'Signing in…' : 'Sign in'}
                                {!isLoading && <ArrowRight size={16} strokeWidth={2.5} />}
                            </button>

                            <p className="m-0 text-center text-xs font-bold text-text-muted">
                                Don't have an account?{' '}
                                <Link
                                    to="/register"
                                    className="text-brand-gold no-underline underline-offset-2 transition-colors duration-200 hover:text-brand-gold-hover hover:underline"
                                >
                                    Create one
                                </Link>
                            </p>

                            <div className="flex items-center gap-3 border-t border-border-main/60 pt-4">
                                <Link
                                    to="/book"
                                    className="flex items-center gap-2 text-xs font-bold text-brand-green no-underline transition-colors duration-200 hover:text-brand-green-hover"
                                >
                                    <ArrowLeft size={14} strokeWidth={2.5} />
                                    Customer demo — book a table
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
