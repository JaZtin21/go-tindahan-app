import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react'; // Standard clean import path
import { CREATE_RESTAURANT_MUTATION } from '~/api/graphql';
import { useRestaurantAuth } from '~/config';

// 1. IMPORT YOUR DEDICATED RESTAURANT CLIENT HERE
import { restaurantClient } from '~/config/restaurantApolloClient'; // Adjust path to matching file setup

const AUSTRALIAN_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export const CreateRestaurant = () => {
    const { isAuthenticated } = useRestaurantAuth();

    // 2. PASS THE CLIENT EXPLICITLY AS AN OPTION OVERWRITE
    const [createRestaurant, { loading, error }] = useMutation(CREATE_RESTAURANT_MUTATION, {
        client: restaurantClient, // 👈 FORCES the hook to execute through the restaurant interceptors
    });

    const [createdName, setCreatedName] = useState<string | null>(null);

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
            const { data } = await createRestaurant({ variables: { input: form } });
            setCreatedName(data?.createRestaurant?.name ?? form.name);
        } catch {
            // error state below already surfaces the message
        }
    };

    if (!isAuthenticated) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <p>You need to sign in before creating a restaurant.</p>
            </div>
        );
    }

    if (createdName) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <div style={{ padding: '15px', background: '#eef6ff', borderRadius: '8px', display: 'inline-block' }}>
                    <strong>{createdName}</strong> was created. You're the owner.
                </div>
            </div>
        );
    }

    const inputStyle: React.CSSProperties = {
        display: 'block',
        width: '100%',
        padding: '10px',
        marginTop: '4px',
        borderRadius: '4px',
        border: '1px solid #ccc',
    };
    const labelStyle: React.CSSProperties = { fontSize: '14px', color: '#333' };

    return (
        <div style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <h2>Create Your Restaurant</h2>
            <p>You can create more than one restaurant later from your dashboard.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                <label style={labelStyle}>
                    Restaurant name
                    <input style={inputStyle} value={form.name} onChange={handleChange('name')} required />
                </label>

                <label style={labelStyle}>
                    Phone
                    <input style={inputStyle} value={form.phone} onChange={handleChange('phone')} required />
                </label>

                <label style={labelStyle}>
                    Email (optional)
                    <input style={inputStyle} type="email" value={form.email} onChange={handleChange('email')} />
                </label>

                <label style={labelStyle}>
                    Address
                    <input style={inputStyle} value={form.addressLine1} onChange={handleChange('addressLine1')} required />
                </label>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ ...labelStyle, flex: 2 }}>
                        Suburb
                        <input style={inputStyle} value={form.suburb} onChange={handleChange('suburb')} required />
                    </label>

                    <label style={{ ...labelStyle, flex: 1 }}>
                        State
                        <select style={inputStyle} value={form.state} onChange={handleChange('state')}>
                            {AUSTRALIAN_STATES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </label>

                    <label style={{ ...labelStyle, flex: 1 }}>
                        Postcode
                        <input style={inputStyle} value={form.postcode} onChange={handleChange('postcode')} required />
                    </label>
                </div>

                <label style={labelStyle}>
                    Cuisine type (optional)
                    <input style={inputStyle} placeholder="e.g. Italian, Modern Australian" value={form.cuisineType} onChange={handleChange('cuisineType')} />
                </label>

                {error && (
                    <p style={{ color: '#c0392b', fontSize: '13px', margin: 0 }}>{error.message}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        marginTop: '8px',
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        background: loading ? '#a0c3ff' : '#4285F4',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s ease',
                    }}
                >
                    {loading ? 'Creating...' : 'Create restaurant'}
                </button>
            </form>
        </div>
    );
};