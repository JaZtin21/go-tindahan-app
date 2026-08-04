import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';
import { useAppSelector } from '~/store';
import { useRestaurantId } from '~/utils/useRestaurantId';

const FEATURE_LINKS = [
    { to: 'bookings', title: 'Live Bookings', description: 'Daily grid timeline of bookings across your tables.', icon: '📅' },
    { to: 'waitlist', title: 'Live Waitlist', description: 'Overflow queue with assign-table actions.', icon: '⏳' },
    { to: 'tables', title: 'Table Layout', description: 'Build and monitor your physical seating floor.', icon: '🪑' },
    { to: 'calls', title: 'AI Voice Logs', description: 'Review transcripts and call conversion telemetry.', icon: '📞' },
    { to: 'settings', title: 'Hours & Closures', description: 'Operating hours and closure adjustments for the AI engine.', icon: '⚙️' },
];

const cardCls =
    'group flex flex-col border border-brand-gold/50 hover:border-brand-gold/30 bg-bg-primary hover:bg-brand-gold/10 rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer no-underline';

export const RestaurantDashboard = () => {
    const { owner } = useRestaurantAuth();
    const navigate = useNavigate();
    const restaurantId = useRestaurantId();
    const roles = useAppSelector((s) => s.restaurant.roles);

    const restaurants = roles.length > 0 ? roles : owner?.restaurants ?? [];
    const restaurant = restaurants.find((r) => r.restaurant.id === restaurantId)?.restaurant;

    if (!restaurantId) {
        return <p className="py-16 text-center text-text-muted text-sm font-bold">Select a restaurant to view its dashboard.</p>;
    }

    if (!restaurant) {
        return (
            <div className="py-16 text-center">
                <p className="text-text-muted text-sm font-bold mb-4">We couldn't find that restaurant.</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-5 py-2.5 rounded-xl bg-brand-gold text-bg-black font-black text-sm hover:bg-brand-gold-hover transition-all duration-200 cursor-pointer active:scale-95"
                >
                    Back to my restaurants
                </button>
            </div>
        );
    }

    return (
        <div>
            <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-brand-gold no-underline transition-colors duration-200"
            >
                ← All restaurants
            </Link>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-text-main tracking-tight m-0">{restaurant.name}</h2>
                    <div className="text-xs font-bold text-text-muted mt-1">
                        {restaurant.suburb ? `${restaurant.suburb}, ` : ''}
                        {restaurant.state ?? ''}
                        {restaurant.cuisineType ? ` · ${restaurant.cuisineType}` : ''}
                    </div>
                </div>
                <div className="px-4 py-2.5 rounded-xl border border-border-main bg-bg-secondary text-xs font-bold text-text-muted">
                    Seating: {restaurant.seatingType.replace('_', ' ')} · Turn: {restaurant.defaultTurnDurationMin}min · Max party:{' '}
                    {restaurant.maxPartySize}
                </div>
            </div>

            <p className="text-sm font-bold text-text-sub mb-4">
                Manage <span className="text-brand-gold">{restaurant.name}</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {FEATURE_LINKS.map(({ to, title, description, icon }) => (
                    <Link key={to} to={`/${restaurantId}/${to}`} className={cardCls}>
                        <div className="text-3xl mb-3 transition-transform duration-300 group-hover:scale-110">{icon}</div>
                        <h3 className="text-sm font-black text-text-main tracking-tight m-0">{title}</h3>
                        <p className="text-xs font-bold text-text-muted mt-1.5 leading-relaxed">{description}</p>
                        <span className="mt-3 text-[11px] font-black text-brand-gold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            Open →
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default RestaurantDashboard;
