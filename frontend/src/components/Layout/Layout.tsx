import React, { useRef, useState, useEffect } from 'react'; // Added useEffect
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

    // ✅ 1. Create a reference specifically for the scrollable container panel
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const isMainMapPage = location.pathname === '/';

    // ✅ 2. Reset the local container scroll track every time the route path switches
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [location.pathname]);

    return (
        <div className="flex h-screen flex-col font-sans antialiased overflow-hidden select-none">
            <Header
                isAuthenticated={isAuthenticated}
                userInfo={userInfo}
                logoutAndClear={logoutAndClear}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
            />

            <div className="flex flex-1 relative overflow-hidden bg-bg-secondary ">
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

                <main className="relative flex flex-1 flex-col pl-0 md:pl-12 h-full w-full bg-bg-primary transition-all duration-200 overflow-hidden">
                    <MapCanvas mapRef={mapRef} isMainMapPage={isMainMapPage} mapStyleUrl={MAP_TILE_URL} />

                    {!isMainMapPage && (
                        /* ✅ 3. Attach the ref to this overflow container */
                        <div
                            ref={scrollContainerRef}
                            className="w-full h-full overflow-y-auto z-10 md:px-12 px-2 md:pt-18 pt-18 pb-8"
                        >
                            <Outlet />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
