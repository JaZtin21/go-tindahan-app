import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Menu,
    X,
    Store,
    LayoutDashboard,
    CalendarDays,
    Hourglass,
    Armchair,
    PhoneCall,
    Settings as SettingsIcon,
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
        { path: '/waitlist', label: 'Waitlist', icon: Hourglass },
        { path: '/tables', label: 'Tables', icon: Armchair },
        { path: '/calls', label: 'AI Calls', icon: PhoneCall },
        { path: '/settings', label: 'Settings', icon: SettingsIcon },
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
            {/* MOBILE OVERLAY BACKGROUND BLUR */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
                />
            )}

            <aside
                className={`fixed top-0 left-0 bottom-0 z-40 flex flex-col bg-bg-primary border-r border-border-main transition-all duration-200 ease-in-out w-64 -translate-x-full md:translate-x-0 ${
                    isOpen ? 'translate-x-0 md:w-56' : 'md:w-16'
                }`}
            >
                {/* TOP HEADER BRANDING */}
                <div className="flex h-14 w-full items-center border-b border-border-sub shrink-0">
                    {isOpen ? (
                        <div className="flex w-full items-center justify-between px-4">
                            <button
                                onClick={() => navigateTo('/')}
                                className="flex items-center gap-2 cursor-pointer bg-transparent outline-none"
                                title="All restaurants"
                            >
                                <span className="text-base">🍽️</span>
                                <span className="text-sm font-bold tracking-tight text-brand-gold">Hostly</span>
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-sub hover:text-text-main hover:bg-item-hover transition-colors outline-none"
                            >
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    ) : (
                        <div className="hidden md:flex w-full items-center justify-center">
                            <button
                                onClick={() => setIsOpen(true)}
                                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-text-sub hover:text-text-main hover:bg-item-hover transition-colors outline-none"
                            >
                                <Menu size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    )}
                </div>

                {/* NAVIGATION LINKS */}
                <nav className="flex flex-col gap-1 p-2 overflow-y-auto flex-1">
                    {restaurantName && isOpen && restaurantId && (
                        <div className="px-3 pb-1 pt-1 text-[10px] font-black uppercase tracking-wider text-text-muted truncate">
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
                                className={`w-full cursor-pointer rounded-lg transition-all duration-150 flex items-center outline-none px-4 gap-3 justify-start ${
                                    isOpen ? 'md:flex-row py-3 md:px-4 md:gap-3 md:justify-start' : 'md:flex-col md:py-2 md:justify-center md:gap-1'
                                } ${isActive ? 'bg-brand-gold/15 text-brand-gold font-bold' : 'text-text-sub hover:bg-item-hover hover:text-text-main'}`}
                            >
                                <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0">
                                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className={`tracking-tight block ${isOpen ? 'text-xs font-semibold' : 'md:text-[9px] md:font-medium md:leading-none'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
};

export default RestaurantSidebar;
