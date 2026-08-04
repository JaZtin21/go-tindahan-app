import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';

const NAV_LINKS = [
    { to: '/', label: 'Dashboard' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/waitlist', label: 'Waitlist' },
    { to: '/tables', label: 'Tables' },
    { to: '/calls', label: 'AI Calls' },
    { to: '/settings', label: 'Settings' },
];

export const RestaurantLayout = () => {
    const { owner, logout } = useRestaurantAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="min-h-screen bg-bg-primary text-text-main transition-colors duration-300">
            <nav className="flex items-center justify-between gap-4 px-4 md:px-8 py-4 border-b border-border-main bg-bg-secondary/60 backdrop-blur-sm sticky top-0 z-40 flex-wrap">
                <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                    <Link
                        to="/"
                        className="text-base font-black text-text-main tracking-tight mr-2 no-underline hover:text-brand-gold transition-colors duration-200"
                    >
                        🍽️ Hostly
                    </Link>
                    {NAV_LINKS.map(({ to, label }) => {
                        const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`text-xs md:text-sm font-bold rounded-xl px-2.5 md:px-3 py-2 no-underline transition-all duration-200 ${
                                    active
                                        ? 'bg-brand-gold/15 text-brand-gold'
                                        : 'text-text-muted hover:text-text-main hover:bg-item-hover'
                                }`}
                            >
                                {label}
                            </Link>
                        );
                    })}
                    <Link
                        to="/create-restaurant"
                        className="text-xs md:text-sm font-bold rounded-xl px-2.5 md:px-3 py-2 no-underline text-text-muted hover:text-brand-green hover:bg-brand-green/10 transition-all duration-200"
                    >
                        + New
                    </Link>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-text-muted">
                    {owner && (
                        <span className="hidden sm:block max-w-[160px] truncate">
                            {owner.firstName} {owner.lastName}
                        </span>
                    )}
                    <button
                        onClick={handleLogout}
                        className="px-3 py-1.5 rounded-xl border border-border-main bg-bg-primary hover:bg-brand-red/10 hover:text-brand-red hover:border-brand-red/40 text-text-sub transition-all duration-200 cursor-pointer active:scale-95"
                    >
                        Sign out
                    </button>
                </div>
            </nav>
            <main className="px-4 md:px-8 py-6 max-w-[1400px] mx-auto w-full">
                <Outlet />
            </main>
        </div>
    );
};