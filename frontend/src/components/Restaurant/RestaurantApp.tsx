import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';
import {
    RestaurantLogin,
    RestaurantRegister,
    RestaurantList,
    RestaurantDashboard,
    CreateRestaurant,
    BookingsPage,
    TablesPage,
    CallsPage,
    SettingsPage,
    InfoPage,
    PublicBookingPage,
} from '~/pages';
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
                {/* Public routes — NO auth required (customers, Vapi testing) */}
                <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <RestaurantLogin />} />
                <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RestaurantRegister />} />
                <Route path="/book" element={<PublicBookingPage />} />

                {/* Everything below requires a session — unlike your shop app's
                    reference, restaurant dashboard data (bookings, tables, staff)
                    is sensitive enough that even the "list my restaurants" view
                    shouldn't be reachable unauthenticated, so the guard wraps the
                    Layout itself rather than individual routes inside it. */}
                <Route element={<ProtectedRouteGuard />}>
                    <Route element={<RestaurantLayout />}>
                        {/* Landing page: all of the owner's restaurants, each
                            opening its own dashboard below. */}
                        <Route path="/" element={<RestaurantList />} />
                        <Route path="/create-restaurant" element={<CreateRestaurant />} />
                    </Route>

                    {/* Restaurant-scoped routes — /{id} is the restaurant's
                        dashboard (feature navigation), /{id}/bookings etc are
                        the feature pages. The id lives in the URL so a refresh /
                        deep link keeps context and each page queries with it. */}
                    <Route path="/:restaurantId" element={<RestaurantLayout />}>
                        <Route index element={<RestaurantDashboard />} />
                        <Route path="bookings" element={<BookingsPage />} />
                        <Route path="tables" element={<TablesPage />} />
                        <Route path="calls" element={<CallsPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="info" element={<InfoPage />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
};