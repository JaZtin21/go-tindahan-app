import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../config/ApolloProviderWithAuth';
import { Login } from '../pages/Login';
import { Layout } from './Layout/Layout';
import { Home, MyShops, ProfilePage, ScanPage, ShopDetailDashboard } from '../pages';

const ProtectedRouteGuard = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

export const App = () => {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public login gate */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

        {/* Nest your view paths inside the persistent Layout engine configuration */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/my-shops" element={<MyShops />} />

          {/* ADDED: Dynamic unprotected route for individual shop dashboards */}
          <Route path="/my-shops/:id" element={<ShopDetailDashboard />} />

          {/* Protected routes */}
          <Route element={<ProtectedRouteGuard />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/scan" element={<ScanPage />} />
          </Route>

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
