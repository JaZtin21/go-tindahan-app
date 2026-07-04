import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Home, Store } from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const menuItems = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/my-shops', label: 'My Shops', icon: Store },
    ];

    return (
        <>
            {/* --- MOBILE OVERLAY BACKGROUND BLUR --- */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 z-30 bg-black/20 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
                />
            )}

            <aside
                className={`fixed top-0 left-0 shadow-sm bottom-0 z-40 flex flex-col bg-bg-primary transition-all duration-200 ease-in-out border-none w-64 -translate-x-full md:translate-x-0 ${isOpen ? 'translate-x-0 md:w-56' : 'md:w-16'
                    }`}
            >
                {/* TOP HEADER MENU BRANDING HUB */}
                <div className="flex h-14 w-full items-center border-none">
                    {isOpen ? (
                        <div className="flex w-full items-center justify-between px-4 animate-in fade-in duration-150">
                            <div className="flex items-center gap-2">
                                <span className="text-base text-brand-gold">⛺</span>
                                <span className="text-sm font-bold tracking-tight text-brand-gold">
                                    Tindahan
                                </span>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-sub hover:text-text-main hover:bg-item-hover transition-colors outline-hidden"
                            >
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    ) : (
                        <div className="hidden md:flex w-full items-center justify-center animate-in fade-in duration-150">
                            <button
                                onClick={() => setIsOpen(true)}
                                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-text-sub hover:text-text-main hover:bg-item-hover transition-colors outline-hidden"
                            >
                                <Menu size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    )}
                </div>

                {/* NAVIGATION LINKS LIST CONTENT */}
                {/* NAVIGATION LINKS LIST CONTENT */}
                <nav className="flex flex-col gap-3 p-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.path}
                                onClick={() => {
                                    navigate(item.path);
                                    if (window.innerWidth < 768) setIsOpen(false);
                                }}
                                className={`w-full cursor-pointer rounded-lg transition-all duration-150 flex items-center outline-hidden flex-row  px-4 gap-3 justify-start ${isOpen
                                    ? 'md:flex-row py-4 md:px-4 md:gap-3 md:justify-start'
                                    : 'md:flex-col  md:py-2 md:justify-center md:gap-1'
                                    } ${isActive
                                        ? 'bg-item-hover text-text-main font-bold'
                                        : 'text-text-sub hover:bg-item-hover hover:text-text-main'
                                    }`}
                            >
                                <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0">
                                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                </div>

                                {/* THE CLEANED TEXT TRACKING NODE */}
                                <span className={`tracking-tight animate-in fade-in duration-150 block ${isOpen
                                    ? 'text-xs font-semibold'
                                    : 'md:text-[9px] md:font-medium  md:leading-none'
                                    }`}>
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
