import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowUpRight,
    CalendarDays,
    Armchair,
    PhoneCall,
    Settings as SettingsIcon,
    UtensilsCrossed,
    MapPin,
    ChefHat,
    Users,
    Clock,
} from 'lucide-react';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';
import { useAppSelector } from '~/store';
import { useRestaurantId } from '~/utils/useRestaurantId';

const FEATURE_LINKS = [
    { to: 'bookings', title: 'Live Bookings', description: 'Daily grid timeline of bookings across your tables.', icon: CalendarDays, tint: 'from-brand-gold/30 to-brand-gold/5' },
    { to: 'tables', title: 'Table Layout', description: 'Build and monitor your physical seating floor.', icon: Armchair, tint: 'from-brand-green/30 to-brand-green/5' },
    { to: 'calls', title: 'AI Voice Logs', description: 'Review transcripts and call conversion telemetry.', icon: PhoneCall, tint: 'from-brand-gold/30 to-brand-gold/5' },
    { to: 'settings', title: 'Hours & Closures', description: 'Operating hours and closure adjustments for the AI engine.', icon: SettingsIcon, tint: 'from-brand-green/30 to-brand-green/5' },
    { to: 'info', title: 'Info & Menu', description: 'Restaurant profile, parking, and menu items the AI reads aloud.', icon: UtensilsCrossed, tint: 'from-brand-gold/30 to-brand-green/10' },
];

export const RestaurantDashboard = () => {
    const { owner } = useRestaurantAuth();
    const navigate = useNavigate();
    const restaurantId = useRestaurantId();
    const roles = useAppSelector((s) => s.restaurant.roles);

    const restaurants = roles.length > 0 ? roles : owner?.restaurants ?? [];
    const restaurant = restaurants.find((r) => r.restaurant.id === restaurantId)?.restaurant;

    if (!restaurantId) {
        return <p className="py-16 text-center text-sm font-bold text-text-muted">Select a restaurant to view its dashboard.</p>;
    }

    if (!restaurant) {
        return (
            <div className="py-16 text-center">
                <p className="mb-4 text-sm font-bold text-text-muted">We couldn't find that restaurant.</p>
                <button
                    onClick={() => navigate('/')}
                    className="cursor-pointer rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-black text-text-white transition-all duration-200 hover:bg-brand-gold-hover active:scale-95"
                >
                    Back to my restaurants
                </button>
            </div>
        );
    }

    const stats = [
        { icon: Armchair, label: 'Seating', value: restaurant.seatingType.replace('_', ' ') },
        { icon: Clock, label: 'Turnover', value: `${restaurant.defaultTurnDurationMin} min` },
        { icon: Users, label: 'Max party', value: `${restaurant.maxPartySize} guests` },
    ];

    return (
        <div>
            <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted no-underline transition-colors duration-200 hover:text-brand-gold"
            >
                <ArrowLeft size={14} strokeWidth={2.2} />
                All restaurants
            </Link>

            {/* Hero banner */}
            <div className="relative mt-4 overflow-hidden rounded-3xl border border-brand-gold/25 bg-gradient-to-br from-brand-gold/15 via-bg-primary/60 to-brand-green/10 p-6 backdrop-blur-sm sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-gold/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-brand-green/15 blur-3xl" />

                <div className="relative">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold to-brand-green text-bg-black shadow-xs shadow-brand-gold/25">
                                <UtensilsCrossed size={26} strokeWidth={2.2} />
                            </div>
                            <div>
                                <h2 className="m-0 text-2xl font-black tracking-tight text-text-main sm:text-3xl">
                                    {restaurant.name}
                                </h2>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-text-muted">
                                    <span className="flex items-center gap-1.5">
                                        <MapPin size={13} strokeWidth={2.2} className="text-brand-gold" />
                                        {restaurant.suburb ? `${restaurant.suburb}, ` : ''}
                                        {restaurant.state ?? ''}
                                    </span>
                                    {restaurant.cuisineType && (
                                        <span className="flex items-center gap-1.5">
                                            <ChefHat size={13} strokeWidth={2.2} className="text-brand-green" />
                                            {restaurant.cuisineType}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2.5">
                        {stats.map(({ icon: Icon, label, value }) => (
                            <div
                                key={label}
                                className="flex items-center gap-2.5 rounded-xl border border-border-main/60 bg-bg-primary/60 px-3.5 py-2 backdrop-blur-sm"
                            >
                                <Icon size={15} strokeWidth={2.2} className="text-brand-gold" />
                                <div>
                                    <p className="m-0 text-[10px] font-black uppercase tracking-wider text-text-muted">{label}</p>
                                    <p className="m-0 text-xs font-black text-text-main">{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <p className="mt-6 mb-3 text-sm font-bold text-text-sub">
                Manage <span className="text-brand-gold">{restaurant.name}</span>
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURE_LINKS.map(({ to, title, description, icon: Icon, tint }) => (
                    <Link
                        key={to}
                        to={`/${restaurantId}/${to}`}
                        className="card-lift group relative flex flex-col rounded-2xl border border-border-main/60 bg-bg-primary/60 p-5 no-underline backdrop-blur-sm hover:border-brand-gold/40 hover:bg-bg-primary/90"
                    >
                        <div
                            className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tint} text-brand-gold ring-1 ring-brand-gold/15 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110`}
                        >
                            <Icon size={22} strokeWidth={2} />
                        </div>
                        <h3 className="m-0 text-sm font-black tracking-tight text-text-main">{title}</h3>
                        <p className="mt-1.5 flex-1 text-xs font-bold leading-relaxed text-text-muted">{description}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-brand-gold transition-all duration-200 group-hover:gap-2">
                            Open
                            <ArrowUpRight size={13} strokeWidth={2.5} />
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default RestaurantDashboard;
