import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';

// Minimal stub — replace with your real dashboard chrome (sidebar, etc.)
// once you have one. Kept here just so the router below has something to
// nest routes inside, matching the <Layout /> pattern in your reference.
export const RestaurantLayout = () => {
    const { owner, logout } = useRestaurantAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <nav style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 24px', borderBottom: '1px solid #eee',
            }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <Link to="/" style={{ fontWeight: 'bold', textDecoration: 'none', color: '#222' }}>Dashboard</Link>
                    <Link to="/create-restaurant" style={{ textDecoration: 'none', color: '#4285F4' }}>+ New restaurant</Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#666' }}>
                    {owner && <span>{owner.firstName} {owner.lastName}</span>}
                    <button
                        onClick={handleLogout}
                        style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                    >
                        Sign out
                    </button>
                </div>
            </nav>
            <main style={{ padding: '24px' }}>
                <Outlet />
            </main>
        </div>
    );
};