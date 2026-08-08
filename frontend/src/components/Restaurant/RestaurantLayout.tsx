import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useParams } from 'react-router-dom';
import { Menu, UtensilsCrossed, LogOut, ChevronRight } from 'lucide-react';
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

    const initials = owner
        ? `${owner.firstName?.[0] ?? ''}${owner.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
        : 'U';

    return (
        <div className="relative min-h-screen ambient-bg text-text-main transition-colors duration-300">
            <RestaurantSidebar
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                restaurantId={restaurantId ?? null}
                restaurantName={restaurantName}
            />

            <div className={`min-h-screen transition-all duration-200 ease-in-out ${isSidebarOpen ? 'md:pl-56' : 'md:pl-16'}`}>
                <nav className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border-main/60 bg-bg-primary/70 px-4 py-3 shadow-sm shadow-black/[0.03] backdrop-blur-xl md:px-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen((v) => !v)}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-text-sub outline-none transition-colors hover:bg-item-hover hover:text-text-main md:hidden"
                            aria-label="Toggle menu"
                        >
                            <Menu size={18} strokeWidth={2.5} />
                        </button>

                        <Link
                            to="/"
                            className="flex items-center gap-2.5 no-underline transition-colors duration-200"
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-gold to-brand-green text-bg-black shadow-md shadow-brand-gold/25">
                                <UtensilsCrossed size={16} strokeWidth={2.2} />
                            </span>
                            <span className="text-base font-black tracking-tight text-text-main">Hostly</span>
                        </Link>

                        {restaurantId && restaurantName && (
                            <span className="hidden items-center gap-1.5 text-xs font-bold text-text-muted sm:flex">
                                <ChevronRight size={14} className="text-text-muted" />
                                <span className="max-w-[180px] truncate text-text-sub">{restaurantName}</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {owner && (
                            <span className="hidden items-center gap-2.5 sm:flex">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-[11px] font-black text-brand-gold ring-1 ring-brand-gold/30">
                                    {initials}
                                </span>
                                <span className="max-w-[140px] truncate text-xs font-bold text-text-muted">
                                    {owner.firstName} {owner.lastName}
                                </span>
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border-main/70 bg-bg-primary/70 px-3 py-2 text-xs font-bold text-text-sub transition-all duration-200 hover:border-brand-red/40 hover:bg-brand-red/10 hover:text-brand-red active:scale-95"
                        >
                            <LogOut size={14} strokeWidth={2.2} />
                            <span className="hidden sm:inline">Sign out</span>
                        </button>
                    </div>
                </nav>

                <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default RestaurantLayout;
