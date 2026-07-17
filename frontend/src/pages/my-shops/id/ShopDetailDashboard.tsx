import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RootState } from '~/store/store'; // Adjust import path to match your file structure
import { Shop } from '~/types/shop';
import { ShopForm } from '~/pages/my-shops/components/ShopForm';
import { Modal } from '~/components';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@apollo/client/react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Legend,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
    RadialBarChart,
    RadialBar
} from 'recharts';
import { ShoppingCart, PlusCircle, Package, MessageSquare, Store, ArrowLeft, History } from 'lucide-react';
import { setAddShopModalOpen } from '~/store/uiSlice';
import InventoryForm from '../components/InventoryForm';
import { GET_SHOP_BY_ID_QUERY } from '~/api/graphql';
import { updateShop } from '~/store/myShopsSlice';
import Checkout from './Checkout';


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
    const dispatch = useDispatch();
    const isAddShopModalOpen = useSelector((state: RootState) => state.ui.isAddShopModalOpen);

    const shop = useSelector((state: RootState) =>
        state.myShops.shops.find((s: Shop) => s.id === id)
    );

    console.log(shop, 'this is shop');

    // 2. RUN STANDALONE FALLBACK QUERY (Skips network roundtrips if shop is already cached in Redux)
    const { loading: isLoading, data, error } = useQuery(GET_SHOP_BY_ID_QUERY, {
        variables: { shopId: id },
        skip: !id || !!shop, // 💡 True security guard optimization bypass
        fetchPolicy: 'no-cache' // Pure utility strategy to directly mirror database states
    }) as { loading: boolean; error: any; data: { getShopById: Shop } | undefined };

    // 3. LIFECYCLE DATA BOUNDARY SYNC: Merge back directly into your core array on reload
    useEffect(() => {
        if (data?.getShopById) {
            dispatch(updateShop(data.getShopById)); // Reuses your existing upsert/overwrite logic handler
        }
    }, [data, dispatch]);

    const handleModalClose = () => {
        dispatch(setAddShopModalOpen(false))
    };

    const triggerModalAction = (title: string) => {
        dispatch(setAddShopModalOpen(true));
    };


    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    const handleCloseInventoryModal = () => setIsInventoryModalOpen(false);
    const handleOpenInventoryModal = () => setIsInventoryModalOpen(true);

    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const handleCloseCheckoutModal = () => setIsCheckoutModalOpen(false);
    const handleOpenCheckoutModal = () => setIsCheckoutModalOpen(true);


    return (
        <div className="min-h-screen bg-bg-secondary transition-colors duration-300 pb-12">


            {/* --- COMMAND IMPLEMENTED: GO BACK STRIP ON TOP OF CHART CONTAINER --- */}
            <div className="flex justify-between items-center px-2 ">
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
                        <div className="w-80 h-80 relative flex items-center justify-center shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadialBarChart
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="80%"
                                    outerRadius="100%"
                                    barSize={20}
                                    data={[{ value: SHOP_METRICS.progressMetrics.todayLiftPct, fill: 'var(--color-brand-green)' }]}
                                    startAngle={90}
                                    endAngle={-270}
                                >
                                    {/* The radial data track */}
                                    <RadialBar
                                        background={{ fill: 'var(--color-brand-green)', opacity: 0.1 }}
                                        dataKey="value"
                                        cornerRadius={10}
                                    />

                                    {/* NATIVE CENTERING COMPONENT BLOCK */}
                                    <Legend
                                        layout="vertical"
                                        verticalAlign="middle"
                                        align="center"
                                        content={() => (
                                            <div className="text-center flex flex-col items-center justify-center select-none ">
                                                {/* 1. STORE NAME STACKED ON TOP */}
                                                <span className="text-md line-clamp-2 font-bold text-text-muted tracking-tight max-w-[160px] mb-1 mt-[-2rem]">
                                                    {shop?.shopName}
                                                </span>

                                                {/* 2. EARNINGS DISPLAY ROW */}
                                                <span className="text-4xl font-black text-text-main tracking-tighter leading-none mt-2">
                                                    {SHOP_METRICS.stats.todaySales}
                                                </span>

                                                {/* 3. METRICS RATIO BASEMENT */}
                                                <p className="text-xs text-brand-green font-extrabold mt-2">
                                                    {SHOP_METRICS.stats.growthRate}
                                                </p>
                                            </div>
                                        )}
                                    />
                                </RadialBarChart>

                            </ResponsiveContainer>
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
            <div className="grid grid-cols-2  md:grid-cols-4 lg:grid-cols-6 gap-6">

                {/* 1. Someone is buying (Modal Trigger) */}
                <div
                    onClick={handleOpenCheckoutModal}
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
                    onClick={handleOpenInventoryModal}
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
                    onClick={() => navigate(`/my-shops/${shopId}/inventory`)}
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
                    onClick={() => navigate(`/my-shops/${shopId}/inquiries`)}
                    className="flex flex-col bg-bg-primary rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer no-underline border border-transparent"
                >
                    <div className="w-full aspect-video bg-bg-secondary rounded-xl mb-4 shrink-0 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-text-sub" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">View Inquiries</h3>
                    </div>
                </a>

                {/* 5. Sales History */}
                <a
                    onClick={() => navigate(`/my-shops/${shopId}/sales-history`)}
                    className="flex flex-col bg-bg-primary rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer no-underline border border-transparent"
                >
                    <div className="w-full aspect-video bg-bg-secondary rounded-xl mb-4 shrink-0 flex items-center justify-center">
                        <History className="w-6 h-6 text-text-sub" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Sales History</h3>
                    </div>
                </a>

                {/* 6. Edit Shop Info (Modal Trigger) */}
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
            <InventoryForm isOpen={isInventoryModalOpen} onClose={handleCloseInventoryModal} />
            <Checkout isOpen={isCheckoutModalOpen} onClose={handleCloseCheckoutModal} />

            <Modal
                isOpen={isAddShopModalOpen}
                onClose={handleModalClose}
                title="Edit your Shop"
                subtitle="Edit your commercial storefront blueprint"
            >
                <ShopForm data={shop} />
            </Modal>

        </div>
    );
}
