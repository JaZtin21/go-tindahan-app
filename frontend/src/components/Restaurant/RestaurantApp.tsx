import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';
import { RestaurantLogin, RestaurantRegister, RestaurantDashboard, CreateRestaurant } from '~/pages';
import { RestaurantLayout } from './RestaurantLayout';


const ProtectedRouteGuard = () => {
    const { isAuthenticated, isLoading } = useRestaurantAuth();
    if (isLoading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <Outlet />;
};

// NOTE: named RestaurantOwnerApp rather than RestaurantApp to avoid clashing
// with your existing RestaurantApp (which is actually the shop-owner app,
// per the routes in your reference — MyShops/Inventory/SalesHistory). Two
// components named the same thing in different domains would be confusing
// to navigate later. Rename either side if you'd rather standardize.
export const RestaurantApp = () => {
    const { isAuthenticated } = useRestaurantAuth();

    return (
        <BrowserRouter>
            <Routes>
                {/* Public auth gates */}
                <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <RestaurantLogin />} />
                <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RestaurantRegister />} />

                {/* Everything below requires a session — unlike your shop app's
                    reference, restaurant dashboard data (bookings, tables, staff)
                    is sensitive enough that even the "list my restaurants" view
                    shouldn't be reachable unauthenticated, so the guard wraps the
                    Layout itself rather than individual routes inside it. */}
                <Route element={<ProtectedRouteGuard />}>
                    <Route element={<RestaurantLayout />}>
                        <Route path="/" element={<RestaurantDashboard />} />
                        <Route path="/create-restaurant" element={<CreateRestaurant />} />
                        {/* Add /restaurants/:id, /restaurants/:id/tables,
                            /restaurants/:id/bookings, etc. here as those pages
                            get built. */}
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
};