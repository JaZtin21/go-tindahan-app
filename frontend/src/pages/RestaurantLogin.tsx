import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRestaurantAuth } from '../config/RestaurantAuthProvider'; // 👈 Adjust this path matching your file setup

export const RestaurantLogin = () => {
    const { login, isLoading, isAuthenticated, owner, loginError } = useRestaurantAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(email, password);
        } catch {
            // loginError from context already covers the message shown below
        }
    };

    if (isAuthenticated && owner) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <div style={{ marginTop: '20px', padding: '15px', background: '#eef6ff', borderRadius: '8px', display: 'inline-block' }}>
                    <p style={{ margin: 0 }}>Logged in as:</p>
                    <strong>{owner.firstName} {owner.lastName}</strong>
                    <span style={{ display: 'block', fontSize: '12px', color: '#666' }}>{owner.email}</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <h2>Restaurant Dashboard</h2>
            <p>Sign in to manage your restaurant, tables, and bookings.</p>

            <form
                onSubmit={handleSubmit}
                style={{ marginTop: '20px', display: 'inline-flex', flexDirection: 'column', gap: '12px', width: '280px', textAlign: 'left' }}
            >
                <label style={{ fontSize: '14px', color: '#333' }}>
                    Email
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ display: 'block', width: '100%', padding: '10px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </label>

                <label style={{ fontSize: '14px', color: '#333' }}>
                    Password
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ display: 'block', width: '100%', padding: '10px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </label>

                {loginError && (
                    <p style={{ color: '#c0392b', fontSize: '13px', margin: 0 }}>{loginError}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                        marginTop: '8px',
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        background: isLoading ? '#a0c3ff' : '#4285F4',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s ease',
                    }}
                >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                </button>

                <Link to="/register" style={{ fontSize: '13px', textAlign: 'center', color: '#4285F4' }}>
                    Don't have an account? Create one
                </Link>
            </form>
        </div>
    );
};