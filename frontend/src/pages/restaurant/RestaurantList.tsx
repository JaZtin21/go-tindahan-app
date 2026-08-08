import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, MapPin, ChefHat, Plus, ChevronRight } from 'lucide-react';
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
            <div className="glass-panel mx-auto max-w-lg rounded-3xl border-dashed px-6 py-16 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/25 to-brand-green/25 text-bg-black ring-1 ring-brand-gold/20">
                    <Store size={28} strokeWidth={2} />
                </div>
                <h3 className="m-0 text-lg font-black text-text-main">No restaurants yet</h3>
                <p className="mx-auto mt-1.5 max-w-xs text-xs font-bold leading-relaxed text-text-muted">
                    Create your first restaurant to start taking AI-powered bookings.
                </p>
                <Link
                    to="/create-restaurant"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-black text-text-white no-underline transition-all duration-200 hover:bg-brand-gold-hover active:scale-95 shadow-xs shadow-brand-gold/20"
                >
                    <Plus size={16} strokeWidth={2.5} />
                    Create your first restaurant
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[780px]">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="m-0 text-2xl font-black tracking-tight text-text-main">Your restaurants</h2>
                    <p className="mt-1 text-xs font-bold text-text-muted">
                        {restaurants.length} {restaurants.length === 1 ? 'location' : 'locations'} · pick one to open its dashboard
                    </p>
                </div>
                <Link
                    to="/create-restaurant"
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-xs font-black text-text-white no-underline transition-all duration-200 hover:bg-brand-gold-hover active:scale-95 shadow-xs shadow-brand-gold/20"
                >
                    <Plus size={15} strokeWidth={2.5} />
                    New restaurant
                </Link>
            </div>

            <div className="flex flex-col gap-3">
                {restaurants.map(({ restaurant, role }) => {
                    const active = restaurant.id === activeRestaurantId;
                    return (
                        <button
                            key={restaurant.id}
                            onClick={() => openRestaurant(restaurant.id)}
                            className={`card-lift group flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 text-left sm:p-5 ${
                                active
                                    ? 'border-brand-gold/60 bg-brand-gold/10'
                                    : 'border-border-main/60 bg-bg-primary/60 backdrop-blur-sm hover:border-brand-gold/40 hover:bg-bg-primary/90'
                            }`}
                        >
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/25 to-brand-green/25 text-brand-gold ring-1 ring-brand-gold/20 transition-transform duration-300 group-hover:scale-105">
                                    <Store size={22} strokeWidth={2} />
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate font-black text-sm text-text-main">{restaurant.name}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-bold text-text-muted">
                                        <span className="flex items-center gap-1">
                                            <MapPin size={12} strokeWidth={2.2} className="text-brand-gold" />
                                            {restaurant.suburb ? `${restaurant.suburb}, ` : ''}
                                            {restaurant.state ?? ''}
                                        </span>
                                        {restaurant.cuisineType && (
                                            <span className="flex items-center gap-1">
                                                <ChefHat size={12} strokeWidth={2.2} className="text-brand-green" />
                                                {restaurant.cuisineType}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                                <span className="rounded-full border border-brand-gold/30 bg-brand-gold/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-gold">
                                    {role.toLowerCase()}
                                </span>
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-main/60 bg-bg-primary/60 text-text-muted transition-all duration-200 group-hover:border-brand-gold/40 group-hover:bg-brand-gold/10 group-hover:text-brand-gold">
                                    <ChevronRight size={16} strokeWidth={2.2} />
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
