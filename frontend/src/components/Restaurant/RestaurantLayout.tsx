import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useParams } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useRestaurantAuth } from '~/config/RestaurantAuthProvider';
import { useAppSelector } from '~/store';
import { RestaurantSidebar } from './RestaurantSidebar';

export const RestaurantLayout = () => {
    const { owner, logout } = useRestaurantAuth();
    const navigate = useNavigate();
    const { restaurantId } = useParams<{ restaurantId: string }>();
    const roles = useAppSelector((s) => s.restaurant.roles);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const restaurants = roles.length > 0 ? roles : owner?.restaurants ?? [];
    const restaurantName = restaurants.find((r) => r.restaurant.id === restaurantId)?.restaurant?.name;

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="min-h-screen bg-bg-primary text-text-main transition-colors duration-300">
            <RestaurantSidebar
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                restaurantId={restaurantId ?? null}
                restaurantName={restaurantName}
            />

            <div className={`min-h-screen transition-all duration-200 ease-in-out ${isSidebarOpen ? 'md:pl-56' : 'md:pl-16'}`}>
                <nav className="flex items-center justify-between gap-4 px-4 md:px-8 py-3.5 border-b border-border-main bg-bg-secondary/60 backdrop-blur-sm sticky top-0 z-20">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsSidebarOpen((v) => !v)}
                            className="md:hidden flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-text-sub hover:text-text-main hover:bg-item-hover transition-colors outline-none"
                            aria-label="Toggle menu"
                        >
                            <Menu size={18} strokeWidth={2.5} />
                        </button>
                        <Link
                            to="/"
                            className="text-base font-black text-text-main tracking-tight no-underline hover:text-brand-gold transition-colors duration-200"
                        >
                            🍽️ Hostly
                        </Link>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-text-muted">
                        {owner && (
                            <span className="hidden sm:block max-w-[160px] truncate">
                                {owner.firstName} {owner.lastName}
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 rounded-xl border border-border-main bg-bg-primary hover:bg-brand-red/10 hover:text-brand-red hover:border-brand-red/40 text-text-sub transition-all duration-200 cursor-pointer active:scale-95"
                        >
                            Sign out
                        </button>
                    </div>
                </nav>

                <main className="px-4 md:px-8 py-6 max-w-[1400px] mx-auto w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default RestaurantLayout;
