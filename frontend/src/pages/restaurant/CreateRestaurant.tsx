import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { CREATE_RESTAURANT_MUTATION } from '~/api/graphql';
import { useRestaurantAuth } from '~/config';
import { useAppDispatch } from '~/store';
import { addRestaurantRole } from '~/store';
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
        'block w-full px-4 py-2.5 rounded-xl border border-border-main bg-bg-primary text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200 mt-1';
    const labelCls = 'text-xs font-black text-text-sub uppercase tracking-wider';

    if (!isAuthenticated) {
        return (
            <div className="py-16 text-center">
                <p className="text-text-muted text-sm font-bold">You need to sign in before creating a restaurant.</p>
            </div>
        );
    }

    if (createdName) {
        return (
            <div className="py-16 text-center">
                <div className="inline-block px-6 py-4 rounded-2xl border border-brand-green/40 bg-brand-green/10 text-brand-green font-black">
                    🎉 <strong>{createdName}</strong> was created. You're the owner.
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[520px] mx-auto">
            <h2 className="text-2xl font-black text-text-main tracking-tight m-0">Create Your Restaurant</h2>
            <p className="text-xs font-bold text-text-muted mt-1">You can create more than one restaurant later from your dashboard.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
                <label className={labelCls}>
                    Restaurant name
                    <input className={inputCls} value={form.name} onChange={handleChange('name')} required />
                </label>

                <label className={labelCls}>
                    Phone
                    <input className={inputCls} value={form.phone} onChange={handleChange('phone')} required />
                </label>

                <label className={labelCls}>
                    Email (optional)
                    <input className={inputCls} type="email" value={form.email} onChange={handleChange('email')} />
                </label>

                <label className={labelCls}>
                    Address
                    <input className={inputCls} value={form.addressLine1} onChange={handleChange('addressLine1')} required />
                </label>

                <div className="flex gap-3">
                    <label className={`${labelCls} flex-[2]`}>
                        Suburb
                        <input className={inputCls} value={form.suburb} onChange={handleChange('suburb')} required />
                    </label>

                    <label className={`${labelCls} flex-1`}>
                        State
                        <select className={inputCls} value={form.state} onChange={handleChange('state')}>
                            {AUSTRALIAN_STATES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </label>

                    <label className={`${labelCls} flex-1`}>
                        Postcode
                        <input className={inputCls} value={form.postcode} onChange={handleChange('postcode')} required />
                    </label>
                </div>

                <label className={labelCls}>
                    Cuisine type (optional)
                    <input className={inputCls} placeholder="e.g. Italian, Modern Australian" value={form.cuisineType} onChange={handleChange('cuisineType')} />
                </label>

                {error && (
                    <p className="text-brand-red text-xs font-bold m-0">{error.message}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className={`mt-2 px-6 py-3 rounded-xl font-black text-sm transition-all duration-200 active:scale-95 ${
                        loading
                            ? 'bg-brand-gold/40 text-bg-black/50 cursor-not-allowed'
                            : 'bg-brand-gold text-bg-black hover:bg-brand-gold-hover cursor-pointer'
                    }`}
                >
                    {loading ? 'Creating...' : 'Create restaurant'}
                </button>
            </form>
        </div>
    );
};