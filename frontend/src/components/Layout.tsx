import React, { useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { default as BaseMap } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../config/ApolloProviderWithAuth';

const MAPTILER_BASE_URL = "https://api.maptiler.com"; // 🌟 FIXED: Added 'api.' prefix for target assets
const MAPTILER_STYLE_NAME = "voyager";
export const MAP_TILE_URL = `${MAPTILER_BASE_URL}/maps/${MAPTILER_STYLE_NAME}/style.json?key=${import.meta.env.VITE_MAPTILE_KEY || 'your_fallback_key'}`;

export const Layout = () => {
    const { userInfo, logoutAndClear, isAuthenticated } = useAuth();
    const mapRef = useRef<any>(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Check if the user is currently viewing the main map page
    const isMainMapPage = location.pathname === '/';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>

            {/* 1. PERMANENT TOP HEADER */}
            <header style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb', zIndex: 20
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>📍 Map Interface Dashboard</h2>
                    {isAuthenticated && userInfo ? (
                        <span style={{ fontSize: '12px', color: '#666' }}>
                            Active Session: <strong>{userInfo.firstName} {userInfo.lastName}</strong>
                        </span>
                    ) : (
                        <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 'bold' }}>
                            Browsing as Public Guest
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isAuthenticated ? (
                        <>
                            <button onClick={() => navigate('/profile')} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                👤 Profile Settings
                            </button>
                            <button onClick={logoutAndClear} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Logout
                            </button>
                        </>
                    ) : (
                        <button onClick={() => navigate('/login')} style={{ padding: '8px 16px', background: '#4285F4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Sign In
                        </button>
                    )}
                </div>
            </header>

            {/* 2. THE DYNAMIC CONTENT AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

                {/* THE MAP CANVAS - Wrapped inside a standard display toggle */}
                {/* Using display: none keeps the map component fully alive in memory, preventing reloads! */}
                {
                    /*
   <div style={{ display: isMainMapPage ? 'block' : 'none', width: '100%', height: '100%' }}>
                    <BaseMap
                        ref={mapRef}
                        mapLib={maplibregl}
                        initialViewState={{
                            latitude: 14.599710314289638,
                            longitude: 120.9736820397427,
                            zoom: 12.8
                        }}
                        mapStyle={MAP_TILE_URL}
                        attributionControl={false}
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
                    */
                }
             

                {/* THE PAGE INJECTION POINT */}
                {/* Standard sub-pages render natively here in normal layout flow when you navigate away from '/' */}
                {!isMainMapPage && (
                    <div style={{ flex: 1, width: '100%', height: '100%', background: '#f3f4f6' }}>
                        <Outlet context={{ mapRef }} />
                    </div>
                )}

            </div>
        </div>
    );
};
