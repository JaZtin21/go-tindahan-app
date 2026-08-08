import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, User, Mail, Lock, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';
import { InputAdornment } from '~/components/InputAdornment';

const PERKS = [
    { icon: ShieldCheck, title: 'Owner-level access', text: 'Create restaurants, tables, and operating hours.' },
    { icon: User, title: 'Multi-restaurant ready', text: 'One account can manage every location you own.' },
    { icon: ArrowRight, title: 'Live in minutes', text: 'Your AI phone agent can start taking bookings today.' },
];

export const RestaurantRegister = () => {
    const { register, isLoading, loginError } = useRestaurantAuth();
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });

    const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await register(form.firstName, form.lastName, form.email, form.password);
        } catch {
            // loginError from context already covers the message shown below
        }
    };

    const inputCls =
        'block w-full pl-10 pr-4 py-3 rounded-xl border border-border-main/70 bg-bg-primary/70 backdrop-blur-sm text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/50 transition-all duration-200';

    return (
        <div className="min-h-screen grid lg:grid-cols-[1fr_1.05fr] ambient-bg">
            {/* ---- Form side (left on desktop) ---- */}
            <div className="flex items-center justify-center px-4 py-12 sm:px-8 lg:order-2">
                <div className="w-full max-w-[470px]">
                    <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold to-brand-green text-bg-black shadow-xs shadow-brand-gold/25">
                            <UtensilsCrossed size={22} strokeWidth={2.2} />
                        </div>
                        <span className="text-xl font-black tracking-tight text-text-main">Hostly</span>
                    </div>

                    <div className="glass-strong rounded-3xl p-7 sm:p-9">
                        <h2 className="m-0 text-2xl font-black tracking-tight text-text-main">Create your account</h2>
                        <p className="mt-1.5 text-xs font-bold text-text-muted">
                            Start managing your restaurant, tables, and bookings.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-xs font-black uppercase tracking-wider text-text-sub">
                                    First name
                                    <div className="relative mt-1.5">
                                        <InputAdornment icon={<User size={16} strokeWidth={2.2} />} />
                                        <input className={inputCls} value={form.firstName} onChange={handleChange('firstName')} required placeholder="Jane" />
                                    </div>
                                </label>
                                <label className="text-xs font-black uppercase tracking-wider text-text-sub">
                                    Last name
                                    <div className="relative mt-1.5">
                                        <InputAdornment icon={<User size={16} strokeWidth={2.2} />} />
                                        <input className={inputCls} value={form.lastName} onChange={handleChange('lastName')} required placeholder="Smith" />
                                    </div>
                                </label>
                            </div>

                            <label className="text-xs font-black uppercase tracking-wider text-text-sub">
                                Email
                                <div className="relative mt-1.5">
                                    <InputAdornment icon={<Mail size={16} strokeWidth={2.2} />} />
                                    <input className={inputCls} type="email" value={form.email} onChange={handleChange('email')} required placeholder="you@restaurant.com" />
                                </div>
                            </label>

                            <label className="text-xs font-black uppercase tracking-wider text-text-sub">
                                Password
                                <div className="relative mt-1.5">
                                    <InputAdornment icon={<Lock size={16} strokeWidth={2.2} />} />
                                    <input className={inputCls} type="password" value={form.password} onChange={handleChange('password')} required minLength={8} placeholder="At least 8 characters" />
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
                                className={`mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-black transition-all duration-200 active:scale-[0.98] shadow-xs shadow-brand-gold/20 ${
                                    isLoading
                                        ? 'cursor-not-allowed bg-brand-gold/40 text-text-white/60'
                                        : 'cursor-pointer bg-brand-gold text-text-white hover:bg-brand-gold-hover hover:shadow-brand-gold/30'
                                }`}
                            >
                                {isLoading ? 'Creating account…' : 'Create account'}
                                {!isLoading && <ArrowRight size={16} strokeWidth={2.5} />}
                            </button>

                            <p className="m-0 text-center text-xs font-bold text-text-muted">
                                Already have an account?{' '}
                                <Link
                                    to="/login"
                                    className="text-brand-gold no-underline underline-offset-2 transition-colors duration-200 hover:text-brand-gold-hover hover:underline"
                                >
                                    Sign in
                                </Link>
                            </p>

                            <div className="flex items-center gap-3 border-t border-border-main/60 pt-4">
                                <Link
                                    to="/book"
                                    className="flex items-center gap-2 text-xs font-bold text-brand-green no-underline transition-colors duration-200 hover:text-brand-green-hover"
                                >
                                    <ArrowLeft size={14} strokeWidth={2.5} />
                                    Back to customer booking
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* ---- Brand showcase panel (desktop) ---- */}
            <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16 lg:order-1">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-gold/25 blur-3xl" />
                    <div className="absolute -top-16 -left-16 h-96 w-96 rounded-full bg-brand-green/20 blur-3xl" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-bg-primary/0 via-bg-primary/30 to-bg-primary/70" />
                </div>

                <div className="relative flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold to-brand-green text-bg-black shadow-xs shadow-brand-gold/25">
                        <UtensilsCrossed size={22} strokeWidth={2.2} />
                    </div>
                    <span className="text-xl font-black tracking-tight text-text-main">Hostly</span>
                </div>

                <div className="relative max-w-md">
                    <h1 className="text-4xl font-black leading-tight tracking-tight text-text-main">
                        Put your front desk <br />
                        <span className="bg-gradient-to-r from-brand-green to-brand-gold bg-clip-text text-transparent">
                            on autopilot.
                        </span>
                    </h1>
                    <p className="mt-4 text-sm font-bold leading-relaxed text-text-muted">
                        Set up your profile once and let the AI phone agent take reservations, answer menu questions, and handle calls.
                    </p>
                </div>

                <div className="relative flex flex-col gap-4">
                    {PERKS.map(({ icon: Icon, title, text }) => (
                        <div key={title} className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-green/30 bg-brand-green/10 text-brand-green">
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
        </div>
    );
};
