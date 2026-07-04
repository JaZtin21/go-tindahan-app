import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Sun, Moon, Plus, Menu } from 'lucide-react'; // 1. ADDED: Menu icon
import { useTheme } from '../ThemeProvider';

interface HeaderProps {
    isAuthenticated: boolean;
    userInfo: { firstName: string; lastName: string; avatarUrl?: string } | null;
    logoutAndClear: () => void;
    onAddShopClick: () => void;
    isSidebarOpen: boolean;       // 2. ADDED: state parameter mapping
    setIsSidebarOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
    isAuthenticated,
    userInfo,
    logoutAndClear,
    onAddShopClick,
    isSidebarOpen,
    setIsSidebarOpen
}) => {
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const { theme, toggleTheme } = useTheme();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isMainMapPage = routerLocation.pathname === '/';
    const isMyShopsPage = routerLocation.pathname === '/my-shops' || routerLocation.pathname.startsWith('/my-shops/');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header
            className={`absolute top-0 right-0 left-0 z-30 flex h-14 w-full items-center justify-between pr-4 pl-2 md:pl-16 transition-all duration-200 ${isMainMapPage
                ? 'bg-transparent pointer-events-none'
                : 'bg-bg-primary  shadow-xs pointer-events-auto'
                }`}
        >

            {/* LEFT SIDE ACCUMULATOR PANEL */}
            <div className={`flex items-center md:pl-4 gap-2 ${isMainMapPage ? 'pointer-events-auto' : ''}`}>
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="flex md:hidden h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-text-sub hover:text-text-main  hover:bg-item-hover transition-colors outline-hidden shrink-0 mr-1"
                >
                    <Menu size={16} strokeWidth={2.5} />
                </button>
                {isMyShopsPage ? (
                    /* --- BLUEPRINT DESIGN B: MY SHOPS CONTENT MODE HOOK --- */
                    <div className="flex items-center gap-4 pl-4 animate-in fade-in duration-200">
                        <h1 className="text-lg font-bold text-text-main whitespace-nowrap">
                            My shops
                        </h1>
                        <button
                            onClick={onAddShopClick}
                            className="flex h-7 items-center text-text-white gap-1 rounded-full bg-brand-gold hover:bg-brand-gold-hover px-3 transition-color duration-200 text-[11px] font-semibold text-text-sub  cursor-pointer"
                        >
                            <Plus size={12} strokeWidth={4} />
                            Add Shop
                        </button>
                    </div>
                ) : (
                    /* --- BLUEPRINT DESIGN A: CORE MAP SEARCH ENVIRONMENT --- */
                    <>
                        <div className={`flex h-9 w-64 items-center gap-2.5 rounded-full px-4 transition-colors shadow-xs ${isMainMapPage ? 'bg-[#ededed] dark:bg-bg-primary' : 'bg-gray-100 dark:bg-bg-primary'
                            }`}>
                            <Search size={15} className="text-text-sub shrink-0" strokeWidth={2.5} />
                            <input
                                type="text"
                                placeholder="Search for stores..."
                                className="w-full bg-transparent text-xs font-normal text-text-sub outline-hidden placeholder:text-text-muted"
                            />
                        </div>

                        <button
                            onClick={() => console.log('Filtering...')}
                            className="flex h-9 items-center gap-1.5 rounded-full bg-brand-gold hover:bg-brand-gold-hover px-4 shadow-xs transition-all duration-200 active:scale-98 cursor-pointer text-text-dark font-semibold"
                        >
                            <span className="h-2.5 w-2.5 rounded-xs bg-white/40 shrink-0" />
                            <span className="text-[11px] text-bg-primary  whitespace-nowrap">
                                Shop near me
                            </span>
                        </button>
                    </>
                )}
            </div>

            {/* RIGHT SIDE: PROFILE SECTION */}
            <div className={`flex items-center gap-3 ${isMainMapPage ? 'pointer-events-auto' : ''}`} ref={dropdownRef}>
                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="h-9 w-9 rounded-full bg-[#d37e7e] shadow-xs cursor-pointer flex items-center justify-center font-bold text-white text-xs overflow-hidden border border-white/20 transition-transform active:scale-95"
                    >
                        {userInfo?.avatarUrl ? (
                            <img src={userInfo.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                            userInfo?.firstName?.charAt(0).toUpperCase() || '👤'
                        )}
                    </button>

                    {/* DROP DOWN MENU */}
                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg bg-bg-primary dark:bg-bg-secondary p-1 shadow-lg z-50 transition-colors">

                            {/* ACCOUNT IDENTIFIER BANNER */}
                            <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 mb-1">
                                {/* FIXED: Section title uses the gray muted design category token token */}
                                <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Account</p>
                                {/* FIXED: Core profile identification name uses the crisp bold main token text style */}
                                <p className="text-xs font-bold text-text-main truncate">
                                    {isAuthenticated && userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : 'Public Guest'}
                                </p>
                            </div>

                            {/* NAVIGATION CONTROLS */}
                            <button
                                onClick={() => { navigate('/profile'); setIsDropdownOpen(false); }}
                                /* FIXED: View Profile text uses text-text-sub for a modern soft charcoal color look */
                                className="w-full text-left rounded-md px-3 py-1.5 text-xs font-medium text-text-sub hover:bg-item-hover transition-colors cursor-pointer"
                            >
                                👤 View Profile
                            </button>

                            {/* THEME TOGGLE ROW */}
                            <button
                                onClick={toggleTheme}
                                /* FIXED: Toggle mode row link uses soft grey text-text-sub layout profiles */
                                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium text-text-sub hover:bg-item-hover transition-colors cursor-pointer"
                            >
                                <span className="flex items-center gap-2">
                                    {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                                </span>
                                <div className="text-text-muted">
                                    {theme === 'light' ? (
                                        <Moon size={13} strokeWidth={2.5} />
                                    ) : (
                                        <Sun size={13} strokeWidth={2.5} className="text-yellow-500" />
                                    )}
                                </div>
                            </button>

                            {/* LOGOUT SYSTEM ACTION */}
                            <button
                                onClick={() => { logoutAndClear(); setIsDropdownOpen(false); }}
                                className="w-full text-left rounded-md px-3 py-1.5 text-xs font-bold text-brand-red hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors cursor-pointer border-t border-gray-100 dark:border-gray-800 mt-1 pt-1.5"
                            >
                                👋 Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
