import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import {
    Building2,
    UtensilsCrossed,
    Phone,
    Mail,
    MapPin,
    ChefHat,
    CheckCircle2,
    ArrowRight,
    Hash,
} from 'lucide-react';
import { CREATE_RESTAURANT_MUTATION } from '~/api/graphql';
import { useRestaurantAuth } from '~/config';
import { useAppDispatch } from '~/store';
import { addRestaurantRole } from '~/store';
import { InputAdornment } from '~/components/InputAdornment';
import type { Restaurant } from '~/types/restaurant';

// Dedicated restaurant client so the mutation goes through the restaurant
// token interceptors (not the diner app's client).
import { restaurantClient } from '~/config/restaurantApolloClient';

const AUSTRALIAN_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export const CreateRestaurant = () => {
    const { isAuthenticated } = useRestaurantAuth();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const [createRestaurant, { loading, error }] = useMutation(CREATE_RESTAURANT_MUTATION, {
        client: restaurantClient,
    });

    const [createdName, setCreatedName] = useState<string | null>(null);
    // Guarded so an early manual navigation (Sign out, nav link) cancels the
    // pending redirect instead of yanking the user back after creation.
    const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (navTimer.current) clearTimeout(navTimer.current);
        };
    }, []);

    const [form, setForm] = useState({
        name: '',
        phone: '',
        email: '',
        addressLine1: '',
        suburb: '',
        state: 'NSW',
        postcode: '',
        cuisineType: '',
    });

    const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data }: any = await createRestaurant({ variables: { input: form } });
            const created = data?.createRestaurant as Restaurant | undefined;
            setCreatedName(created?.name ?? form.name);
            if (created) {
                // Keep the Redux restaurant slice in sync so the dashboard
                // shows the new restaurant without a refetch, then land the
                // user directly in the new restaurant's scoped dashboard route
                // (id lives in the URL so a refresh keeps context).
                dispatch(addRestaurantRole(created));
                navTimer.current = setTimeout(() => navigate(`/${created.id}`), 1200);
            }
        } catch {
            // error state below already surfaces the message
        }
    };

    const inputCls =
        'block w-full pl-10 pr-4 py-2.5 rounded-xl border border-border-main/70 bg-bg-primary/70 backdrop-blur-sm text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/50 transition-all duration-200';
    const labelCls = 'text-[11px] font-black uppercase tracking-wider text-text-sub';

    if (!isAuthenticated) {
        return (
            <div className="glass-panel mx-auto max-w-lg rounded-3xl border-dashed px-6 py-16 text-center">
                <p className="text-sm font-bold text-text-muted">You need to sign in before creating a restaurant.</p>
            </div>
        );
    }

    if (createdName) {
        return (
            <div className="glass-panel mx-auto max-w-lg rounded-3xl px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-green/15 text-brand-green">
                    <CheckCircle2 size={30} strokeWidth={2.2} />
                </div>
                <p className="m-0 text-lg font-black text-text-main">
                    <span className="text-brand-green">{createdName}</span> is live.
                </p>
                <p className="mt-1.5 text-xs font-bold text-text-muted">You're the owner. Taking you to your dashboard…</p>
                <div className="mx-auto mt-5 h-1 w-24 overflow-hidden rounded-full bg-border-main">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-gold" />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[580px]">
            <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/25 to-brand-green/25 text-brand-gold ring-1 ring-brand-gold/20">
                    <Building2 size={26} strokeWidth={2} />
                </div>
                <h2 className="m-0 text-2xl font-black tracking-tight text-text-main">Create your restaurant</h2>
                <p className="mt-1.5 text-xs font-bold text-text-muted">
                    Add another location anytime from your dashboard.
                </p>
            </div>

            <div className="glass-strong rounded-3xl p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    {/* Details */}
                    <div>
                        <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-brand-gold">
                            <UtensilsCrossed size={14} strokeWidth={2.2} />
                            Restaurant details
                        </p>
                        <div className="flex flex-col gap-4">
                            <label className={labelCls}>
                                Restaurant name
                                <div className="relative mt-1.5">
                                    <InputAdornment icon={<UtensilsCrossed size={16} strokeWidth={2.2} />} />
                                    <input className={inputCls} placeholder="e.g. Riley's Rooftop" value={form.name} onChange={handleChange('name')} required />
                                </div>
                            </label>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className={labelCls}>
                                    Phone
                                    <div className="relative mt-1.5">
                                        <InputAdornment icon={<Phone size={16} strokeWidth={2.2} />} />
                                        <input className={inputCls} value={form.phone} onChange={handleChange('phone')} required />
                                    </div>
                                </label>
                                <label className={labelCls}>
                                    Email (optional)
                                    <div className="relative mt-1.5">
                                        <InputAdornment icon={<Mail size={16} strokeWidth={2.2} />} />
                                        <input className={inputCls} type="email" value={form.email} onChange={handleChange('email')} />
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-brand-gold">
                            <MapPin size={14} strokeWidth={2.2} />
                            Location
                        </p>
                        <div className="flex flex-col gap-4">
                            <label className={labelCls}>
                                Address
                                <div className="relative mt-1.5">
                                    <InputAdornment icon={<MapPin size={16} strokeWidth={2.2} />} />
                                    <input className={inputCls} value={form.addressLine1} onChange={handleChange('addressLine1')} required />
                                </div>
                            </label>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                                <label className={`${labelCls} col-span-2 sm:col-span-1`}>
                                    Suburb
                                    <div className="relative mt-1.5">
                                        <InputAdornment icon={<Building2 size={16} strokeWidth={2.2} />} />
                                        <input className={inputCls} value={form.suburb} onChange={handleChange('suburb')} required />
                                    </div>
                                </label>
                                <label className={labelCls}>
                                    State
                                    <div className="relative mt-1.5">
                                        <InputAdornment icon={<MapPin size={16} strokeWidth={2.2} />} />
                                        <select className={inputCls + ' cursor-pointer'} value={form.state} onChange={handleChange('state')}>
                                            {AUSTRALIAN_STATES.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </label>
                                <label className={labelCls}>
                                    Postcode
                                    <div className="relative mt-1.5">
                                        <InputAdornment icon={<Hash size={16} strokeWidth={2.2} />} />
                                        <input className={inputCls} value={form.postcode} onChange={handleChange('postcode')} required />
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Cuisine */}
                    <div>
                        <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-brand-gold">
                            <ChefHat size={14} strokeWidth={2.2} />
                            Style
                        </p>
                        <label className={labelCls}>
                            Cuisine type (optional)
                            <div className="relative mt-1.5">
                                <InputAdornment icon={<ChefHat size={16} strokeWidth={2.2} />} />
                                <input className={inputCls} placeholder="e.g. Italian, Modern Australian" value={form.cuisineType} onChange={handleChange('cuisineType')} />
                            </div>
                        </label>
                    </div>

                    {error && (
                        <p className="m-0 flex items-center gap-2 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3.5 py-2.5 text-xs font-bold text-brand-red">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" />
                            {error.message}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-black transition-all duration-200 active:scale-[0.98] shadow-lg shadow-brand-gold/20 ${
                            loading
                                ? 'cursor-not-allowed bg-brand-gold/40 text-text-white/60'
                                : 'cursor-pointer bg-brand-gold text-text-white hover:bg-brand-gold-hover hover:shadow-brand-gold/30'
                        }`}
                    >
                        {loading ? 'Creating…' : 'Create restaurant'}
                        {!loading && <ArrowRight size={16} strokeWidth={2.5} />}
                    </button>
                </form>
            </div>
        </div>
    );
};
