import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';

export const RestaurantRegister = () => {
    const { register, isLoading, loginError } = useRestaurantAuth();
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });

    const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await register(form.firstName, form.lastName, form.email, form.password);
        } catch {
            // loginError from context already covers the message shown below
        }
    };

    const inputStyle: React.CSSProperties = {
        display: 'block', width: '100%', padding: '10px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc',
    };
    const labelStyle: React.CSSProperties = { fontSize: '14px', color: '#333' };

    return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <h2>Create Your Account</h2>
            <p>Register to manage your restaurant, tables, and bookings.</p>

            <form
                onSubmit={handleSubmit}
                style={{ marginTop: '20px', display: 'inline-flex', flexDirection: 'column', gap: '12px', width: '280px', textAlign: 'left' }}
            >
                <label style={labelStyle}>
                    First name
                    <input style={inputStyle} value={form.firstName} onChange={handleChange('firstName')} required />
                </label>
                <label style={labelStyle}>
                    Last name
                    <input style={inputStyle} value={form.lastName} onChange={handleChange('lastName')} required />
                </label>
                <label style={labelStyle}>
                    Email
                    <input style={inputStyle} type="email" value={form.email} onChange={handleChange('email')} required />
                </label>
                <label style={labelStyle}>
                    Password
                    <input style={inputStyle} type="password" value={form.password} onChange={handleChange('password')} required minLength={8} />
                </label>

                {loginError && <p style={{ color: '#c0392b', fontSize: '13px', margin: 0 }}>{loginError}</p>}

                <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                        marginTop: '8px', padding: '12px 24px', fontSize: '16px', fontWeight: 'bold',
                        background: isLoading ? '#a0c3ff' : '#4285F4', color: 'white', border: 'none',
                        borderRadius: '4px', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background 0.2s ease',
                    }}
                >
                    {isLoading ? 'Creating account...' : 'Create account'}
                </button>

                <Link to="/login" style={{ fontSize: '13px', textAlign: 'center', color: '#4285F4' }}>
                    Already have an account? Sign in
                </Link>
            </form>
        </div>
    );
};