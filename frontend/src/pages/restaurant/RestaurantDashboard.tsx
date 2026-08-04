import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';
import { useAppDispatch, useAppSelector } from '~/store';
import { setOwner, setActiveRestaurant } from '~/store';

const FEATURE_LINKS = [
    { to: '/bookings', title: 'Live Bookings', description: 'Daily grid timeline of bookings across your tables.', icon: '📅' },
    { to: '/waitlist', title: 'Live Waitlist', description: 'Overflow queue with assign-table actions.', icon: '⏳' },
    { to: '/tables', title: 'Table Layout', description: 'Build and monitor your physical seating floor.', icon: '🪑' },
    { to: '/calls', title: 'AI Voice Logs', description: 'Review transcripts and call conversion telemetry.', icon: '📞' },
    { to: '/settings', title: 'Hours & Closures', description: 'Operating hours and closure adjustments for the AI engine.', icon: '⚙️' },
];

const cardCls = 'group flex flex-col border border-brand-gold/50 hover:border-brand-gold/30 bg-bg-primary hover:bg-brand-gold/10 rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer';

export const RestaurantDashboard = () => {
    const { owner } = useRestaurantAuth();
    const dispatch = useAppDispatch();
    const roles = useAppSelector((s) => s.restaurant.roles);
    const activeRestaurantId = useAppSelector((s) => s.restaurant.activeRestaurantId);

    // Keep the Redux restaurant slice in sync with the auth context owner.
    useEffect(() => {
        if (owner) {
            dispatch(setOwner(owner));
        }
    }, [owner, dispatch]);

    const restaurants = roles.length > 0 ? roles : owner?.restaurants ?? [];
    const activeRestaurant = restaurants.find((r) => r.restaurant.id === activeRestaurantId)?.restaurant;

    if (restaurants.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-text-muted text-sm font-bold">You don't have any restaurants yet.</p>
                <Link
                    to="/create-restaurant"
                    className="inline-block mt-4 px-6 py-3 rounded-xl bg-brand-gold text-bg-black font-black text-sm hover:bg-brand-gold-hover transition-all duration-200 no-underline active:scale-95"
                >
                    Create your first restaurant
                </Link>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-black text-text-main tracking-tight m-0">Your Restaurants</h2>
                <Link to="/create-restaurant" className="text-xs font-bold text-brand-gold hover:text-brand-gold-hover no-underline transition-colors duration-200">
                    + New restaurant
                </Link>
            </div>

            {restaurants.length > 1 && (
                <div className="flex gap-2 flex-wrap mb-4">
                    {restaurants.map(({ restaurant, role }) => (
                        <button
                            key={restaurant.id}
                            onClick={() => dispatch(setActiveRestaurant(restaurant.id))}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                                restaurant.id === activeRestaurantId
                                    ? 'bg-brand-gold text-bg-black'
                                    : 'border border-border-main bg-bg-primary text-text-sub hover:bg-item-hover'
                            }`}
                        >
                            {restaurant.name}
                            <span className={`opacity-70 ml-1.5 text-[10px] capitalize ${restaurant.id === activeRestaurantId ? '' : 'text-text-muted'}`}>
                                {role.toLowerCase()}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {activeRestaurant && (
                <div className="px-5 py-4 border border-border-main rounded-2xl mb-5 flex justify-between items-center bg-bg-secondary">
                    <div>
                        <strong className="text-text-main">{activeRestaurant.name}</strong>
                        <div className="text-xs font-bold text-text-muted">
                            {activeRestaurant.suburb}, {activeRestaurant.state}
                        </div>
                    </div>
                    <div className="text-xs font-bold text-text-muted">
                        Seating: {activeRestaurant.seatingType.replace('_', ' ')} · Turn: {activeRestaurant.defaultTurnDurationMin}min
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {FEATURE_LINKS.map(({ to, title, description, icon }) => (
                    <Link
                        key={to}
                        to={to}
                        className={cardCls + ' no-underline'}
                    >
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