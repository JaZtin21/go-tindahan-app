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
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    Legend,
    Tooltip,
    CartesianGrid,
    BarChart,
    PieChart, Pie,
    Bar,
    RadialBarChart,
    RadialBar
} from 'recharts';
import { ShoppingCart, PlusCircle, Package, MessageSquare, Store, ArrowLeft, History } from 'lucide-react';
import { setAddShopModalOpen } from '~/store/uiSlice';
import InventoryForm from '../components/InventoryForm';
import { GET_SHOP_BY_ID_QUERY, GET_SHOP_DASHBOARD_METRICS_QUERY } from '~/api/graphql';
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
        variables: { shopId: shopId },
        skip: !id || !!shop, // 💡 True security guard optimization bypass
        fetchPolicy: 'no-cache' // Pure utility strategy to directly mirror database states
    }) as { loading: boolean; error: any; data: { getShopById: Shop } | undefined };

    const { data: metrics, loading: metricsLoading, error: metricsError } = useQuery(
        GET_SHOP_DASHBOARD_METRICS_QUERY,
        { variables: { shopId: shopId } }
    ) as { data: { getShopDashboardMetrics: any }; loading: boolean; error: any; };

    console.log(metrics, 'this is metrics');

    // Format helper utility for financial readouts
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    // Format helper to convert numeric trends to readable strings
    const formatGrowthRate = (pct: number) => {
        const prefix = pct >= 0 ? '+' : '';
        return `${prefix}${pct.toFixed(1)}% vs last week`;
    };

    // SAFE ACCESS WRAPPER: Read directly from the base object with fallbacks
    const baseMetrics = metrics?.getShopDashboardMetrics;
    const todaysGrossSales = baseMetrics?.todaysGrossSales ?? 0;
    const todaysSalesGrowthPct = baseMetrics?.todaysSalesGrowthPct ?? 0;
    const weeklyRevenueGrowthIndex = baseMetrics?.weeklyRevenueGrowthIndex ?? 100;
    const averageTicketSize = baseMetrics?.averageTicketSize ?? 0;
    const inventoryCapitalRatio = baseMetrics?.inventoryCapitalRatio ?? 0;
    const weeklySalesTrend = baseMetrics?.weeklySalesTrend ?? [];


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
            <div className="flex justify-between items-center px-2 mb-2">
                <button
                    onClick={() => navigate(-1)}
                    className="flex text-text-muted hover:text-text-main transition-colors duration-200 items-center gap-1.5 h-8  rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-98 border border-transparent"
                >
                    <ArrowLeft size={16} strokeWidth={2.5} />
                    <span className="">Go Back to My Shops</span>
                </button>
                <span className="text-xs font-bold text-text-muted">Live Tracking Active</span>
            </div>
            {/* --- RECHARTS-DRIVEN 2.5x SCALE METRICS PANEL --- */}
            {/* --- RECHARTS-DRIVEN 2.5x SCALE METRICS PANEL --- */}
            <div className="bg-bg-primary rounded-3xl p-5 shadow-xs mb-8 w-full overflow-x-auto min-h-[380px] flex items-center ">
                {/* Explicit min-width prevents container squishing, allowing clean native horizontal scrolling */}
                <div className="flex items-center  justify-between gap-12 min-w-[1300px] w-full px-8 py-4 ">

                    {/* SECTION 1: MASTER RECHARTS RADIAL BAR (Today's Gross Sales) */}
                    <div className="flex items-center gap-6 shrink-0 flex-1 max-w-md">
                        <div className="w-80 h-80 relative flex items-center justify-center shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadialBarChart
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="80%"
                                    outerRadius="100%"
                                    barSize={20}
                                    data={[{ value: Math.min(weeklyRevenueGrowthIndex, 100), fill: 'var(--color-brand-green)' }]}
                                    startAngle={90}
                                    endAngle={-270}
                                >
                                    <RadialBar background={{ fill: 'var(--color-brand-green)', opacity: 0.1 }} dataKey="value" cornerRadius={10} />
                                    <Legend layout="vertical" verticalAlign="middle" align="center" content={() => (
                                        <div className="text-center flex flex-col items-center justify-center select-none">
                                            {/* 1. STORE NAME STACKED ON TOP */}
                                            <span className="text-md line-clamp-2 font-bold text-text-muted tracking-tight max-w-[160px] mb-1 mt-[-2rem]">
                                                {shop?.shopName}
                                            </span>
                                            {/* 2. LIVE TODAY REVENUE TRACKER */}
                                            <span className="text-4xl font-black text-text-main tracking-tighter leading-none mt-2">
                                                {formatCurrency(todaysGrossSales)}
                                            </span>
                                            {/* 3. TREND COMPARISON FOOTER */}
                                            <p className={`text-xs font-extrabold mt-2 ${todaysSalesGrowthPct >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                                                {formatGrowthRate(todaysSalesGrowthPct)}
                                            </p>
                                        </div>
                                    )} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-text-main tracking-tight">Today's Sales</span>
                            <span className="text-sm font-bold text-text-muted mt-1.5">Primary revenue scale</span>
                        </div>
                    </div>

                    {/* SECTION 2: VERTICALLY STACKED RECHARTS RADIAL BARS */}
                    <div className="flex flex-col gap-10 shrink-0 justify-center flex-1">
                        {/* Upper Stack Ring (7-Day Growth Index) */}
                        <div className="flex items-center gap-6">
                            <div className="w-35 h-35 relative flex items-center justify-center shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={14} data={[{ value: Math.min(weeklyRevenueGrowthIndex, 100), fill: 'var(--color-brand-gold)' }]} startAngle={90} endAngle={-270}>
                                        <RadialBar background={{ fill: 'var(--color-brand-gold)', opacity: 0.15 }} dataKey="value" cornerRadius={6} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <span className="absolute text-base font-black text-text-main">{weeklyRevenueGrowthIndex.toFixed(0)}%</span>
                            </div>
                            <span className="text-lg font-black text-text-sub tracking-tight">7-Day Growth Index</span>
                        </div>

                        {/* Lower Stack Ring (Average Ticket Size / Basket Value) */}
                        <div className="flex items-center gap-6">
                            <div className="w-35 h-35 relative flex items-center justify-center shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={14} data={[{ value: 100, fill: 'var(--color-brand-green)' }]} startAngle={90} endAngle={-270}>
                                        <RadialBar background={{ fill: 'var(--color-brand-red)', opacity: 0.15 }} dataKey="value" cornerRadius={6} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <span className="absolute text-xs font-black text-text-main">{formatCurrency(averageTicketSize)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-black text-text-sub tracking-tight">Customer spent avg. of</span>
                                <span className="text-xs text-text-muted font-bold mt-1">{formatCurrency(averageTicketSize)} pesos</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: RECHARTS UNIFIED 7-DAY VOLUME REVENUE TREND GRAPH (REPLACED OLD HOURLY BARS) */}
                    {/* SECTION 3: RECHARTS UNIFIED 7-DAY HYBRID REVENUE MATRIX (BARS + ZIGZAG TRENDLINE) */}
                    <div className="flex flex-col flex-1 justify-center h-44 px-8 min-w-[280px] max-w-sm border-r-2 border-border-main/30">
                        <div className="w-full h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                {/* 1. Swap BarChart out for ComposedChart to unlock multi-type drawing lanes */}
                                <ComposedChart
                                    data={weeklySalesTrend}
                                    margin={{ top: 15, right: 5, left: 5, bottom: 5 }}
                                >
                                    <XAxis
                                        dataKey="dayName"
                                        axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)', strokeWidth: 1.5 }}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: '800' }}
                                        dy={8}
                                    />

                                    <Tooltip
                                        cursor={{ fill: 'rgba(148, 163, 184, 0.04)', radius: 6 }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="p-3 bg-white rounded-xl border border-slate-200 font-bold flex flex-col gap-1 shadow-md select-none text-xs">
                                                        <p className="text-text-muted font-black mb-0.5">{data.formattedDate}</p>
                                                        <p className="text-slate-800">Sales: {formatCurrency(data.grossSale)}</p>
                                                        <p className="text-brand-green">Profit: {formatCurrency(data.grossProfit)}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />

                                    {/* 2. The Background Columns (Tracking Total Revenue Volume) */}
                                    <Bar
                                        dataKey="grossSale"
                                        fill="var(--color-brand-green)"
                                        radius={[4, 4, 0, 0]}
                                        barSize={20}
                                    />

                                    {/* 3. The Zigzag Overlay Line (Tracking Net Earning Trajectories) */}
                                    <Line
                                        type="monotone"
                                        dataKey="grossSale"  // Change this from grossProfit to grossSale
                                        stroke='rgba(148, 163, 184, 0.2)'
                                        strokeWidth={2.5}
                                        dot={{ fill: 'rgba(148, 163, 184, 0.2)', r: 3 }}
                                        activeDot={{ r: 5 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-center font-bold text-text-muted mt-2 uppercase tracking-wider select-none">
                            7-Day Sales & Profit Trend
                        </p>
                    </div>


                    {/* SECTION 4: INTEGRATED DOUBLE-SLICE OPERATIONAL PROFIT & COST WHEEL */}
                    <div className="flex items-center gap-10 shrink-0  flex-1 max-w-md justify-end">
                        <div className="flex flex-col text-right select-none">
                            <span className="text-2xl font-black text-text-main tracking-tight">
                                Expected Profit Yield
                            </span>
                            {/* Clean text explanation detailing your pocket value gains */}
                            <span className="text-xs font-bold text-text-muted mt-1.5 max-w-[200px] leading-tight">
                                {(100 - inventoryCapitalRatio).toFixed(0)}% goes to your pocket on total shelf value
                            </span>
                        </div>

                        <div className="w-52 h-52 relative flex items-center justify-center shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                {/* Switching over to a PieChart system lets us slice multiple data variables into one ring */}
                                <PieChart>
                                    <Pie
                                        data={[
                                            // SLICE 1: Your expected take-home markup (Gold / Green)
                                            { value: Math.max(0, 100 - inventoryCapitalRatio), fill: 'var(--color-brand-green)' },
                                            // SLICE 2: Your locked wholesale supplier buying costs (Red)
                                            { value: inventoryCapitalRatio, fill: 'var(--color-brand-red)' }
                                        ]}
                                        dataKey="value"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="75%"
                                        outerRadius="95%"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="none"
                                    />
                                </PieChart>
                            </ResponsiveContainer>

                            {/* Center Typography Absolute Readout */}
                            <span className="absolute text-xl font-black text-text-main">
                                {(100 - inventoryCapitalRatio).toFixed(0)}%
                            </span>
                        </div>
                    </div>


                </div>
            </div>






            {/* --- COMPLETE ACTIONS GRID SECTION (Matches 5 buttons layout structure) --- */}
            {/* --- ACTION GRID: 5 BUTTONS FROM IMAGE --- */}
            {/* --- ACTION GRID: 5 BUTTONS (Matches Shop Card Layout Styles) --- */}
            <div className="grid grid-cols-2  md:grid-cols-4 lg:grid-cols-5 gap-6">

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
