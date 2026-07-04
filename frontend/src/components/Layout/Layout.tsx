import React, { useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../config/ApolloProviderWithAuth';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MapCanvas } from './MapCanvas';

const MAPTILER_BASE_URL = "https://maptiler.com";
const MAPTILER_STYLE_NAME = "voyager";
export const MAP_TILE_URL = `${MAPTILER_BASE_URL}/maps/${MAPTILER_STYLE_NAME}/style.json?key=${import.meta.env.VITE_MAPTILE_KEY || 'your_fallback_key'}`;

export const Layout: React.FC = () => {
    const { userInfo, logoutAndClear, isAuthenticated } = useAuth();
    const mapRef = useRef<any>(null);
    const location = useLocation();

    // 1. ADDED: Shared state to manage sidebar expansion across header and sidebar boundaries
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [addShopTicker, setAddShopTicker] = useState(0);

    const isMainMapPage = location.pathname === '/';

    return (
        <div className="flex h-screen flex-col font-sans antialiased overflow-hidden select-none">

            {/* TOP HEADER MENU - Added sidebar toggle controls */}
            <Header
                isAuthenticated={isAuthenticated}
                userInfo={userInfo}
                logoutAndClear={logoutAndClear}
                onAddShopClick={() => setAddShopTicker((prev) => prev + 1)}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
            />

            {/* LOWER CONTAINER WORKSPACE */}
            <div className="flex flex-1 relative overflow-hidden">
                {/* 2. Pass shared states down as explicit reactive parameters */}
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

                {/* 3. FIXED mobile offset padding constraints: pl-0 on mobile, pl-16 on tablet/desktop */}
                <main className="relative flex flex-1 flex-col pl-0 md:pl-16 h-full w-full bg-bg-primary dark:bg-bg-secondary transition-all duration-200">

                    {/* MAP ENGINE CANVAS LAYER */}
                    <MapCanvas
                        mapRef={mapRef}
                        isMainMapPage={isMainMapPage}
                        mapStyleUrl={MAP_TILE_URL}
                    />

                    {/* DYNAMIC CHILD INJECTION ROUTE PANEL */}
                    {!isMainMapPage && (
                        <div className="absolute inset-0 top-0 left-0 md:left-16 right-0 bottom-0 h-full bg-bg-primary dark:bg-bg-secondary z-10 overflow-y-auto">
                            <Outlet context={{ triggerAddShop: addShopTicker }} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
