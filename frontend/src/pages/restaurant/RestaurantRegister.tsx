import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';

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
        'block w-full px-4 py-2.5 rounded-xl border border-border-main bg-bg-primary text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200 mt-1';

    return (
        <div className="py-16 text-center max-w-[420px] mx-auto">
            <div className="text-4xl mb-3">🍽️</div>
            <h2 className="text-2xl font-black text-text-main tracking-tight m-0">Create Your Account</h2>
            <p className="text-xs font-bold text-text-muted mt-1.5">Register to manage your restaurant, tables, and bookings.</p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 text-left">
                <label className="text-xs font-black text-text-sub uppercase tracking-wider">
                    First name
                    <input className={inputCls} value={form.firstName} onChange={handleChange('firstName')} required />
                </label>
                <label className="text-xs font-black text-text-sub uppercase tracking-wider">
                    Last name
                    <input className={inputCls} value={form.lastName} onChange={handleChange('lastName')} required />
                </label>
                <label className="text-xs font-black text-text-sub uppercase tracking-wider">
                    Email
                    <input className={inputCls} type="email" value={form.email} onChange={handleChange('email')} required />
                </label>
                <label className="text-xs font-black text-text-sub uppercase tracking-wider">
                    Password
                    <input className={inputCls} type="password" value={form.password} onChange={handleChange('password')} required minLength={8} />
                </label>

                {loginError && <p className="text-brand-red text-xs font-bold m-0">{loginError}</p>}

                <button
                    type="submit"
                    disabled={isLoading}
                    className={`mt-2 px-6 py-3 rounded-xl font-black text-sm transition-all duration-200 active:scale-95 ${
                        isLoading
                            ? 'bg-brand-gold/40 text-bg-black/50 cursor-not-allowed'
                            : 'bg-brand-gold text-bg-black hover:bg-brand-gold-hover cursor-pointer'
                    }`}
                >
                    {isLoading ? 'Creating account...' : 'Create account'}
                </button>

                <Link to="/login" className="text-xs font-bold text-brand-gold hover:text-brand-gold-hover text-center no-underline transition-colors duration-200">
                    Already have an account? Sign in
                </Link>
            </form>
        </div>
    );
};