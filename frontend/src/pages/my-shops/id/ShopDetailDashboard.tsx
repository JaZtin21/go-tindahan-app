import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
    RadialBarChart,
    RadialBar
} from 'recharts';
import { ShoppingCart, PlusCircle, Package, MessageSquare, Store, ArrowLeft } from 'lucide-react';

// ... Keep SHOP_METRICS mock data exactly the same ...
const SHOP_METRICS = {
    id: "1",
    name: "Downtown Coffee & Bakery",
    stats: {
        todaySales: "$1,240.00",
        growthRate: "+12.4%",
        activeOrders: 14,
    },
    // Raw numerical percentages to map dynamic progress tracking fills
    progressMetrics: {
        todayLiftPct: 53,
        weeklyTargetPct: 78,
        liveOrdersPct: 35,
        marketHealthPct: 65
    },
    // Functional layout clusters mapping historical timeline trends to the multi-column bar layout
    comparisonBars: [
        { name: 'Cluster A', actual: 60, target: 80, projected: 100 },
        { name: 'Cluster B', actual: 75, target: 60, projected: 90 }
    ],
    chartData: [
        { day: 'Mon', sales: 400 },
        { day: 'Tue', sales: 700 },
        { day: 'Wed', sales: 600 },
        { day: 'Thu', sales: 900 },
        { day: 'Fri', sales: 1240 },
        { day: 'Sat', sales: 1100 },
        { day: 'Sun', sales: 1300 },
    ]
};
export const ShopDetailDashboard = () => {
    const { id } = useParams<{ id: string }>();
    const shopId = id || "1";
    const navigate = useNavigate();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');

    const triggerModalAction = (title: string) => {
        setModalTitle(title);
        setIsModalOpen(true);
    };

    // Helper to render the exact SVG circle progress bars matching your image
    const ProgressCircle = ({ percentage, value, label, colorClass, trailColorClass }: {
        percentage: number;
        value: string | number;
        label: React.ReactNode;
        colorClass: string;
        trailColorClass: string;
    }) => {
        const radius = 50;
        const strokeWidth = 10;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        return (
            <div className="flex flex-col items-center text-center group cursor-pointer w-full max-w-[160px]">
                <div className="w-36 h-36 relative flex items-center justify-center group-hover:scale-105 transition-all duration-300">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                        {/* Background Gray/Muted Ring */}
                        <circle
                            cx="60" cy="60" r={radius}
                            strokeWidth={strokeWidth}
                            className={`${trailColorClass} stroke-current`}
                            fill="transparent"
                        />
                        {/* Filled Color Progress Ring */}
                        <circle
                            cx="60" cy="60" r={radius}
                            strokeWidth={strokeWidth}
                            className={`${colorClass} stroke-current transition-all duration-500 ease-out`}
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            fill="transparent"
                        />
                    </svg>
                    {/* Absolute Center Text Content */}
                    <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-base font-black text-text-main">{value}</span>
                        {label}
                    </div>
                </div>
                <span className="text-xs font-bold text-text-sub tracking-wide mt-2">Total Sales Today</span>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-bg-secondary p-6 transition-colors duration-300">



            {/* --- COMMAND IMPLEMENTED: GO BACK STRIP ON TOP OF CHART CONTAINER --- */}
            <div className="flex justify-between items-center mb-2 px-2  mt-12">
                <button
                    onClick={() => navigate(-1)}
                    className="flex text-text-muted hover:text-text-main transition-colors duration-200 items-center gap-1.5 h-8  rounded-xl text-text-sub text-xs font-bold transition-all duration-200 cursor-pointer active:scale-98 border border-transparent"
                >
                    <ArrowLeft size={16} strokeWidth={2.5} />
                    <span className="">Go Back to My Shops</span>
                </button>
                <span className="text-xs font-bold text-text-muted">Live Tracking Active</span>
            </div>
            {/* --- RECHARTS-DRIVEN 2.5x SCALE METRICS PANEL --- */}
            {/* --- RECHARTS-DRIVEN 2.5x SCALE METRICS PANEL --- */}
            <div className="bg-bg-primary rounded-3xl p-10 shadow-xs border border-transparent mb-8 w-full overflow-x-auto min-h-[380px] flex items-center">
                {/* Explicit min-width prevents container squishing, allowing clean native horizontal scrolling */}
                <div className="flex items-center justify-between gap-12 min-w-[1300px] w-full px-8 py-4">

                    {/* SECTION 1: MASTER RECHARTS RADIAL BAR (Today's Lift) */}
                    <div className="flex items-center gap-10 shrink-0 flex-1 max-w-md">
                        <div className="w-70 h-70 relative flex items-center justify-center shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadialBarChart cx="50%" cy="50%" innerRadius="80%" outerRadius="100%" barSize={20} data={[{ value: SHOP_METRICS.progressMetrics.todayLiftPct, fill: 'var(--color-brand-green)' }]} startAngle={90} endAngle={-270}>
                                    <RadialBar background={{ fill: 'var(--color-brand-green)', opacity: 0.1 }} dataKey="value" cornerRadius={10} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                            <div className="absolute text-center">
                                <span className="text-4xl font-black text-text-main tracking-tighter">{SHOP_METRICS.stats.todaySales}</span>
                                <p className="text-sm text-brand-green font-extrabold mt-1.5">{SHOP_METRICS.stats.growthRate}</p>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-text-main tracking-tight">Today's Lift</span>
                            <span className="text-sm font-semibold text-text-muted mt-1.5">Primary revenue scale</span>
                        </div>
                    </div>

                    {/* SECTION 2: VERTICALLY STACKED RECHARTS RADIAL BARS */}
                    <div className="flex flex-col gap-10 shrink-0 justify-center flex-1 ">
                        {/* Upper Stack Ring (Weekly Target) */}
                        <div className="flex items-center gap-6">
                            <div className="w-35 h-35 relative flex items-center justify-center shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={14} data={[{ value: SHOP_METRICS.progressMetrics.weeklyTargetPct, fill: 'var(--color-brand-gold)' }]} startAngle={90} endAngle={-270}>
                                        <RadialBar background={{ fill: 'var(--color-brand-gold)', opacity: 0.15 }} dataKey="value" cornerRadius={6} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <span className="absolute text-base font-black text-text-main">{SHOP_METRICS.progressMetrics.weeklyTargetPct}%</span>
                            </div>
                            <span className="text-lg font-black text-text-sub tracking-tight">Weekly Target</span>
                        </div>
                        {/* Lower Stack Ring (Live Orders) */}
                        <div className="flex items-center gap-6">
                            <div className="w-35 h-35 relative flex items-center justify-center shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={14} data={[{ value: SHOP_METRICS.progressMetrics.liveOrdersPct, fill: 'var(--color-brand-red)' }]} startAngle={90} endAngle={-270}>
                                        <RadialBar background={{ fill: 'var(--color-brand-red)', opacity: 0.15 }} dataKey="value" cornerRadius={6} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <span className="absolute text-base font-black text-text-main">{SHOP_METRICS.stats.activeOrders}</span>
                            </div>
                            <span className="text-lg font-black text-text-sub tracking-tight">Live Orders</span>
                        </div>
                    </div>

                    {/* SECTION 3: RECHARTS MULTI-COLUMN COMPARISON CLUSTERS */}
                    {/* FIXED: Added a stable h-40 container with explicit layout scaling properties */}
                    <div className="flex items-center gap-16 flex-1 justify-center  h-40">
                        {/* Sub-container A */}
                        <div className="w-full h-full flex-1 min-w-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={SHOP_METRICS.comparisonBars} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={12}>
                                    <Bar dataKey="actual" fill="var(--color-brand-green)" opacity={0.4} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="target" fill="var(--color-brand-green)" opacity={0.7} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="projected" fill="var(--color-brand-green)" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Sub-container B */}
                        <div className="w-full h-full flex-1 min-w-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={SHOP_METRICS.comparisonBars} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={12}>
                                    <Bar dataKey="actual" fill="var(--color-brand-gold)" opacity={0.4} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="target" fill="var(--color-brand-gold)" opacity={0.7} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="projected" fill="var(--color-brand-gold)" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* SECTION 4: SECONDARY BALANCE RECHARTS RADIAL BAR (Market Health) */}
                    <div className="flex items-center gap-10 shrink-0  border-l-2 border-bg-secondary/60 flex-1 max-w-md justify-end">
                        <div className="flex flex-col text-right">
                            <span className="text-2xl font-black text-text-main tracking-tight">Market Health</span>
                            <span className="text-sm font-semibold text-text-muted mt-1.5">Retention index</span>
                        </div>
                        <div className="w-52 h-52 relative flex items-center justify-center shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadialBarChart cx="50%" cy="50%" innerRadius="80%" outerRadius="100%" barSize={16} data={[{ value: SHOP_METRICS.progressMetrics.marketHealthPct, fill: 'var(--color-brand-gold)' }]} startAngle={90} endAngle={-270}>
                                    <RadialBar background={{ fill: 'var(--color-brand-gold)', opacity: 0.1 }} dataKey="value" cornerRadius={8} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                            <span className="absolute text-xl font-black text-text-main">{SHOP_METRICS.progressMetrics.marketHealthPct}%</span>
                        </div>
                    </div>

                </div>
            </div>





            {/* --- COMPLETE ACTIONS GRID SECTION (Matches 5 buttons layout structure) --- */}
            {/* --- ACTION GRID: 5 BUTTONS FROM IMAGE --- */}
            {/* --- ACTION GRID: 5 BUTTONS (Matches Shop Card Layout Styles) --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">

                {/* 1. Someone is buying (Modal Trigger) */}
                <div
                    onClick={() => triggerModalAction('Someone is buying')}
                    className="flex flex-col bg-bg-primary rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer border border-transparent"
                >
                    {/* Centered Asset Representation Box matching your shop card geometry layout */}
                    <div className="w-full aspect-video bg-bg-secondary rounded-xl mb-4 shrink-0 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-text-sub" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Someone is buying</h3>
                    </div>
                </div>

                {/* 2. Add Items in Inventory (Modal Trigger) */}
                <div
                    onClick={() => triggerModalAction('Add Items in Inventory')}
                    className="flex flex-col bg-bg-primary rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer border border-transparent"
                >
                    <div className="w-full aspect-video bg-bg-secondary rounded-xl mb-4 shrink-0 flex items-center justify-center">
                        <PlusCircle className="w-6 h-6 text-text-sub" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Add Items in Inventory</h3>
                    </div>
                </div>

                {/* 3. Manage Inventory (Subroute Navigation Anchor) */}
                <a
                    href={`/my-shops/${shopId}/inventory`}
                    className="flex flex-col bg-bg-primary rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer no-underline border border-transparent"
                >
                    <div className="w-full aspect-video bg-bg-secondary rounded-xl mb-4 shrink-0 flex items-center justify-center">
                        <Package className="w-6 h-6 text-text-sub" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Manage Inventory</h3>
                    </div>
                </a>

                {/* 4. View Inquiries (Subroute Navigation Anchor) */}
                <a
                    href={`/my-shops/${shopId}/inquiries`}
                    className="flex flex-col bg-bg-primary rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer no-underline border border-transparent"
                >
                    <div className="w-full aspect-video bg-bg-secondary rounded-xl mb-4 shrink-0 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-text-sub" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">View Inquiries</h3>
                    </div>
                </a>

                {/* 5. Edit Shop Info (Modal Trigger) */}
                <div
                    onClick={() => triggerModalAction('Edit Shop Info')}
                    className="flex flex-col bg-bg-primary rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer border border-transparent"
                >
                    <div className="w-full aspect-video bg-bg-secondary rounded-xl mb-4 shrink-0 flex items-center justify-center">
                        <Store className="w-6 h-6 text-text-sub" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Edit Shop Info</h3>
                    </div>
                </div>

            </div>


            {/* --- MODAL PLACED SAFELY OUTSIDE THE GRID ITEMS --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs transition-all animate-fade-in">
                    <div className="bg-bg-primary w-full max-w-sm rounded-2xl p-6 shadow-xl border border-bg-secondary transform scale-100 transition-all">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-text-main">{modalTitle}</h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-text-muted hover:text-text-main font-bold text-xs p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3 py-1">
                            <p className="text-xs text-text-sub">
                                Modify live storefront metrics configuration mapping parameters below.
                            </p>
                            <input
                                type="text"
                                placeholder="Update data field..."
                                className="w-full h-9 px-3 bg-bg-secondary rounded-lg text-xs font-medium text-text-main placeholder-text-muted focus:outline-none border border-transparent focus:ring-1 focus:ring-brand-gold"
                            />
                        </div>

                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="h-8 px-3 rounded-lg text-xs font-bold text-text-sub bg-bg-secondary hover:bg-bg-primary-hover cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="h-8 px-3 rounded-lg text-xs font-bold text-text-white bg-brand-green hover:bg-brand-green-hover cursor-pointer"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
