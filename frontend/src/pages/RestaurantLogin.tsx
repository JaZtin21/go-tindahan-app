import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRestaurantAuth } from '../config/RestaurantAuthProvider'; // 👈 Adjust this path matching your file setup

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
        'block w-full px-4 py-2.5 rounded-xl border border-border-main bg-bg-primary text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200 mt-1';

    if (isAuthenticated && owner) {
        return (
            <div className="py-16 text-center">
                <div className="inline-block mt-5 px-6 py-4 rounded-2xl border border-brand-green/40 bg-brand-green/10">
                    <p className="m-0 text-xs font-bold text-text-muted">Logged in as:</p>
                    <strong className="text-text-main block mt-1">{owner.firstName} {owner.lastName}</strong>
                    <span className="block text-xs font-bold text-text-muted mt-0.5">{owner.email}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="py-16 text-center max-w-[420px] mx-auto">
            <div className="text-4xl mb-3">🍽️</div>
            <h2 className="text-2xl font-black text-text-main tracking-tight m-0">Restaurant Dashboard</h2>
            <p className="text-xs font-bold text-text-muted mt-1.5">Sign in to manage your restaurant, tables, and bookings.</p>

            <form
                onSubmit={handleSubmit}
                className="mt-6 flex flex-col gap-4 text-left"
            >
                <label className="text-xs font-black text-text-sub uppercase tracking-wider">
                    Email
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={inputCls}
                    />
                </label>

                <label className="text-xs font-black text-text-sub uppercase tracking-wider">
                    Password
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={inputCls}
                    />
                </label>

                {loginError && (
                    <p className="text-brand-red text-xs font-bold m-0">{loginError}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className={`mt-2 px-6 py-3 rounded-xl font-black text-sm transition-all duration-200 active:scale-95 ${
                        isLoading
                            ? 'bg-brand-gold/40 text-bg-black/50 cursor-not-allowed'
                            : 'bg-brand-gold text-bg-black hover:bg-brand-gold-hover cursor-pointer'
                    }`}
                >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                </button>

                <Link to="/register" className="text-xs font-bold text-brand-gold hover:text-brand-gold-hover text-center no-underline transition-colors duration-200">
                    Don't have an account? Create one
                </Link>
            </form>
        </div>
    );
};