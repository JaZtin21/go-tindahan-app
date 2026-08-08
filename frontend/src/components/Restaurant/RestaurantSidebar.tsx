import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Menu,
    X,
    Store,
    LayoutDashboard,
    CalendarDays,
    Armchair,
    PhoneCall,
    Settings as SettingsIcon,
    Info,
} from 'lucide-react';

interface RestaurantSidebarProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    restaurantId: string | null;
    restaurantName?: string;
}

export const RestaurantSidebar: React.FC<RestaurantSidebarProps> = ({ isOpen, setIsOpen, restaurantId, restaurantName }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const scopedItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/bookings', label: 'Bookings', icon: CalendarDays },
        { path: '/tables', label: 'Tables', icon: Armchair },
        { path: '/calls', label: 'AI Calls', icon: PhoneCall },
        { path: '/settings', label: 'Settings', icon: SettingsIcon },
        { path: '/info', label: 'Info & Menu', icon: Info },
    ];

    const menuItems = restaurantId
        ? [
              { path: '/', label: 'All restaurants', icon: Store },
              ...scopedItems.map((item) => ({
                  ...item,
                  path: `/${restaurantId}${item.path}`,
              })),
          ]
        : [{ path: '/', label: 'All restaurants', icon: Store }];

    const navigateTo = (path: string) => {
        navigate(path);
        if (window.innerWidth < 768) setIsOpen(false);
    };

    return (
        <>
            {/* MOBILE OVERLAY */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 z-30 bg-black/25 backdrop-blur-md md:hidden"
                />
            )}

            <aside
                className={`fixed bottom-0 left-0 top-0 z-40 flex flex-col border-r border-border-main/60 bg-bg-primary/70 shadow-lg shadow-black/[0.04] backdrop-blur-xl transition-all duration-200 ease-in-out w-64 -translate-x-full md:translate-x-0 ${
                    isOpen ? 'translate-x-0 md:w-56' : 'md:w-16'
                }`}
            >
                {/* TOP HEADER BRANDING */}
                <div className="flex h-16 w-full shrink-0 items-center border-b border-border-main/50">
                    {isOpen ? (
                        <div className="flex w-full items-center justify-between px-4">
                            <button
                                onClick={() => navigateTo('/')}
                                className="flex cursor-pointer items-center gap-2.5 bg-transparent outline-none"
                                title="All restaurants"
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-gold to-brand-green text-bg-black shadow-md shadow-brand-gold/25">
                                    <Store size={16} strokeWidth={2.2} />
                                </span>
                                <span className="text-sm font-black tracking-tight text-text-main">Hostly</span>
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-sub outline-none transition-colors hover:bg-item-hover hover:text-text-main"
                                aria-label="Close menu"
                            >
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    ) : (
                        <div className="hidden w-full items-center justify-center md:flex">
                            <button
                                onClick={() => setIsOpen(true)}
                                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-text-sub outline-none transition-colors hover:bg-item-hover hover:text-text-main"
                                aria-label="Expand menu"
                            >
                                <Menu size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    )}
                </div>

                {/* NAVIGATION */}
                <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2.5">
                    {restaurantName && isOpen && restaurantId && (
                        <div className="px-3 pb-1.5 pt-2 text-[10px] font-black uppercase tracking-widest text-text-muted">
                            {restaurantName}
                        </div>
                    )}
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.path}
                                onClick={() => navigateTo(item.path)}
                                className={`group relative w-full cursor-pointer rounded-xl outline-none transition-all duration-150 ${
                                    isOpen
                                        ? 'flex items-center gap-3 px-3.5 py-2.5'
                                        : 'flex items-center justify-center md:py-2.5'
                                } ${
                                    isActive
                                        ? 'text-brand-gold'
                                        : 'text-text-sub hover:bg-item-hover hover:text-text-main'
                                }`}
                            >
                                {isActive && (
                                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                                )}
                                <span
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                        isActive ? 'bg-brand-gold/15' : 'bg-bg-secondary/60 group-hover:bg-bg-secondary'
                                    }`}
                                >
                                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                </span>
                                {isOpen && (
                                    <span className="block text-xs font-semibold tracking-tight">{item.label}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* FOOTER HINT */}
                {isOpen && (
                    <div className="border-t border-border-main/50 px-4 py-3">
                        <p className="m-0 text-[10px] font-bold leading-relaxed text-text-muted">
                            AI voice agent handles calls — you handle the floor.
                        </p>
                    </div>
                )}
            </aside>
        </>
    );
};

export default RestaurantSidebar;
