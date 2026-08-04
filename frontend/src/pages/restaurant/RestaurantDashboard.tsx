import React from 'react';
import { Link } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';

export const RestaurantDashboard = () => {
    const { owner } = useRestaurantAuth();
    const restaurants = owner?.restaurants ?? [];

    if (restaurants.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <p>You don't have any restaurants yet.</p>
                <Link
                    to="/create-restaurant"
                    style={{
                        display: 'inline-block', marginTop: '12px', padding: '10px 20px',
                        background: '#4285F4', color: 'white', borderRadius: '4px', textDecoration: 'none',
                    }}
                >
                    Create your first restaurant
                </Link>
            </div>
        );
    }

    return (
        <div>
            <h2>Your Restaurants</h2>
            <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
                {restaurants.map(({ restaurant, role }) => (
                    <div
                        key={restaurant.id}
                        style={{ padding: '16px', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}
                    >
                        <div>
                            <strong>{restaurant.name}</strong>
                            <div style={{ fontSize: '13px', color: '#666' }}>{restaurant.suburb}, {restaurant.state}</div>
                        </div>
                        <span style={{ fontSize: '12px', color: '#888', textTransform: 'capitalize' }}>{role.toLowerCase()}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};