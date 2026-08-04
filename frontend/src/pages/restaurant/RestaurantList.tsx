import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';
import { useAppDispatch, useAppSelector } from '~/store';
import { setOwner, setActiveRestaurant } from '~/store';

export const RestaurantList = () => {
    const { owner } = useRestaurantAuth();
    const navigate = useNavigate();
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

    const openRestaurant = (id: string) => {
        dispatch(setActiveRestaurant(id));
        navigate(`/${id}`);
    };

    if (restaurants.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="text-4xl mb-3">🍽️</div>
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
        <div className="max-w-[760px] mx-auto">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-2xl font-black text-text-main tracking-tight m-0">Your Restaurants</h2>
                <Link
                    to="/create-restaurant"
                    className="px-4 py-2 rounded-xl bg-brand-gold text-bg-black font-black text-xs hover:bg-brand-gold-hover transition-all duration-200 no-underline active:scale-95"
                >
                    + New restaurant
                </Link>
            </div>
            <p className="text-xs font-bold text-text-muted mb-5">
                Pick a restaurant to open its dashboard — bookings, tables, hours and more.
            </p>

            <div className="flex flex-col gap-3">
                {restaurants.map(({ restaurant, role }) => {
                    const active = restaurant.id === activeRestaurantId;
                    return (
                        <button
                            key={restaurant.id}
                            onClick={() => openRestaurant(restaurant.id)}
                            className={`group flex items-center justify-between gap-4 w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.99] ${
                                active
                                    ? 'border-brand-gold/60 bg-brand-gold/5'
                                    : 'border-border-main bg-bg-primary hover:border-brand-gold/40 hover:bg-item-hover'
                            }`}
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="h-11 w-11 rounded-xl bg-brand-gold/15 text-brand-gold flex items-center justify-center text-xl shrink-0">
                                    🍽️
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black text-text-main text-sm truncate">{restaurant.name}</div>
                                    <div className="text-xs font-bold text-text-muted truncate">
                                        {restaurant.suburb ? `${restaurant.suburb}, ` : ''}
                                        {restaurant.state ?? ''}
                                        {restaurant.cuisineType ? ` · ${restaurant.cuisineType}` : ''}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="px-2.5 py-1 rounded-full bg-bg-secondary border border-border-main text-[10px] font-black uppercase tracking-wider text-text-muted">
                                    {role.toLowerCase()}
                                </span>
                                <span className="text-brand-gold font-black text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    Open →
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default RestaurantList;
