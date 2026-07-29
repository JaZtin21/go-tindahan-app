import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RootState } from '~/store/store'; // Adjust import path to match your file structure
import { Shop } from '~/types/shop';
import { ShopForm } from '~/pages/my-shops/components/ShopForm';
import { Modal } from '~/components';
import { useSelector, useDispatch } from 'react-redux';
import { deleteShop as deleteShopAction } from '~/store/myShopsSlice';
import { useMyShops, useDeleteShop } from "~/api/queries";
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
import { ShoppingCart, PlusCircle, Package, MessageSquare, Store, ArrowLeft, History, TriangleAlert, X, Check, Trash2 } from 'lucide-react';
import { setAddShopModalOpen } from '~/store/uiSlice';
import InventoryForm from '../components/InventoryForm';
import { GET_SHOP_BY_ID_QUERY, GET_SHOP_DASHBOARD_METRICS_QUERY } from '~/api/graphql';
import { updateShop } from '~/store/myShopsSlice';
import Checkout from './Checkout';
import Restock from './Restock';
import { useShopById, useShopDashboardMetrics } from "~/api/queries";


export const ShopDetailDashboard = () => {

    const { id } = useParams<{ id: string }>();
    const shopId = id || "1";
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isAddShopModalOpen = useSelector((state: RootState) => state.ui.isAddShopModalOpen);
    const isSubscribed = false

    const shop = useSelector((state: RootState) =>
        state.myShops.shops.find((s: Shop) => s.id === id)
    );

    console.log(shop, 'this is shop');

    // 2. RUN STANDALONE FALLBACK QUERY (Skips network roundtrips if shop is already cached in Redux)
    const { loading: isLoading, data, error } = useShopById(
        shopId,
        shop,
        isSubscribed
    )

    const { data: metrics, loading: metricsLoading, error: metricsError } = useShopDashboardMetrics(
        shopId,
        isSubscribed
    )


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


    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const handleCloseRestockModal = () => setIsRestockModalOpen(false);
    const handleOpenRestockModal = () => setIsRestockModalOpen(true);


    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    const [deleteShop, { loading: isDeleting }] = useDeleteShop({
        isSubscribed: isSubscribed,
        onCompleted: () => {
            // Reuse your existing modal helper to show success
            setIsConfirmingDelete(false);
            setIsModalOpen(true);
            setIsSuccess(true);
            setModalMessage('Shop and its entire inventory have been permanently deleted.');
            if (selectedShopId) {
                // Optimistic Redux removal — makes the card disappear
                // immediately instead of waiting on the network refetch below.
                dispatch(deleteShopAction(selectedShopId));
            }
            setSelectedShopId(null);
        },
        onError: (error) => {
            setIsConfirmingDelete(false);
            setIsModalOpen(true);
            setIsSuccess(false);
            setModalMessage(error.message || 'Failed to delete shop. Please try again.');
            setSelectedShopId(null);
        }
    });


    // 1. Triggered when user clicks "Delete" on the shop card
    const handleOpenDeletePrompt = (shopId: string) => {
        setSelectedShopId(shopId);
        setIsConfirmingDelete(true);
        setIsModalOpen(true);
    };

    // 2. Triggered when user clicks "Yes, Delete" inside the modal
    const handleExecuteDelete = async () => {
        if (!selectedShopId) return;

        try {
            await deleteShop({
                variables: { shopId: selectedShopId }
            });
        } catch (err) {
            // Error is already gracefully handled inside the useMutation onError block
        }
    };

    const handleDeleteModalClose = ({ navigateBack }: { navigateBack: boolean }) => {
        setIsModalOpen(false);
        setIsSuccess(false);
        setIsConfirmingDelete(false);
        setSelectedShopId(null);
        setModalMessage('');
        if (navigateBack) {
            navigate('/my-shops');
        }
    }



    return (
        <div className="min-h-screen  transition-colors duration-300 pb-12">


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
            <div className="border-2 border-brand-gold/70 bg-brand-gold/10  rounded-2xl p-5 shadow-sm mb-8 w-full overflow-x-auto min-h-[380px] flex items-center ">
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
                                <span className="text-xs text-text-muted font-bold mt-2">{formatCurrency(averageTicketSize)} pesos</span>
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
                    className="relative overflow-hidden bg-clip-padding group flex flex-col border-b-4 md:border-b-8 border-brand-gold/70 hover:bg-brand-gold/10 bg-[url('/images/1.png')] bg-cover bg-center bg-no-repeat rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer"
                >
                    {/* The Absolute Dark Overlay */}
                    <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />

                    {/* Card Content Wrapper */}
                    <div className="relative z-10 flex flex-col w-full h-full">
                        <div className="w-full aspect-video group-hover:bg-bg-black/40 transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6 md:w-8 md:h-8 text-text-white -mb-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm md:text-base font-semibold text-text-white text-center">Someone is buying</h3>
                        </div>
                    </div>
                </div>


                {/* 2. Add Items in Inventory (Modal Trigger) */}
                <div
                    onClick={handleOpenInventoryModal}
                    className="relative overflow-hidden bg-clip-padding group flex flex-col border-b-4 md:border-b-8 border-brand-gold/70 hover:bg-brand-gold/10 bg-[url('/images/2.png')] bg-cover bg-center bg-no-repeat rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer"
                >
                    {/* The Absolute Dark Overlay */}
                    <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />

                    {/* Card Content Wrapper */}
                    <div className="relative z-10 flex flex-col w-full h-full">
                        <div className="w-full aspect-video group-hover:bg-bg-black/40 transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center">
                            <PlusCircle className="w-6 h-6 md:w-8 md:h-8 text-text-white -mb-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm md:text-base font-semibold text-text-white text-center">Add Items in Inventory</h3>
                        </div>
                    </div>
                </div>


                {/* 3. Manage Inventory (Subroute Navigation Anchor) */}
                <div
                    onClick={handleOpenRestockModal}
                    className="relative overflow-hidden bg-clip-padding group flex flex-col border-b-4 md:border-b-8 border-brand-gold/70 hover:bg-brand-gold/10 bg-[url('/images/3.png')] bg-cover bg-center bg-no-repeat rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer"
                >
                    {/* The Absolute Dark Overlay */}
                    <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />

                    {/* Card Content Wrapper */}
                    <div className="relative z-10 flex flex-col w-full h-full">
                        <div className="w-full aspect-video group-hover:bg-bg-black/40 transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center">
                            <Package className="w-6 h-6 md:w-8 md:h-8 text-text-white -mb-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm md:text-base font-semibold text-text-white text-center">Restock Items</h3>
                        </div>
                    </div>
                </div>



                <div
                    onClick={() => navigate(`/my-shops/${shopId}/inventory`)}
                    className="relative overflow-hidden bg-clip-padding group flex flex-col border-b-4 md:border-b-8 border-brand-gold/70 hover:bg-brand-gold/10 bg-[url('/images/7.png')] bg-cover bg-center bg-no-repeat rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer"
                >
                    {/* The Absolute Dark Overlay */}
                    <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />

                    {/* Card Content Wrapper */}
                    <div className="relative z-10 flex flex-col w-full h-full">
                        <div className="w-full aspect-video group-hover:bg-bg-black/40 transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center">
                            <Package className="w-6 h-6 md:w-8 md:h-8 text-text-white -mb-4" />
                        </div>

                        <div className="flex-1">
                            <h3 className="text-sm md:text-base font-semibold text-text-white text-center">Manage Inventory</h3>
                        </div>
                    </div>
                </div>

                <div
                    onClick={() => { }}
                    className="relative overflow-hidden bg-clip-padding group flex flex-col border-b-4 md:border-b-8 border-brand-gold/70 hover:bg-brand-gold/10 bg-[url('/images/4.png')] bg-cover bg-center bg-no-repeat rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer"
                >
                    {/* The Absolute Dark Overlay */}
                    <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />

                    {/* Card Content Wrapper */}
                    <div className="relative z-10 flex flex-col w-full h-full">
                        <div className="w-full aspect-video group-hover:bg-bg-black/40 transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center">
                            <MessageSquare className="w-6 h-6 md:w-8 md:h-8 text-text-white -mb-4" />
                        </div>

                        <div className="flex-1">
                            <h3 className="text-sm md:text-base font-semibold text-text-white text-center">View Inquiries</h3>
                        </div>
                    </div>
                </div>

                <div
                    onClick={() => navigate(`/my-shops/${shopId}/sales-history`)}
                    className="relative overflow-hidden bg-clip-padding group flex flex-col border-b-4 md:border-b-8 border-brand-gold/70 hover:bg-brand-gold/10 bg-[url('/images/6.png')] bg-cover bg-center bg-no-repeat rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer"
                >
                    {/* The Absolute Dark Overlay */}
                    <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />

                    {/* Card Content Wrapper */}
                    <div className="relative z-10 flex flex-col w-full h-full">
                        <div className="w-full aspect-video group-hover:bg-bg-black/40 transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center">
                            <History className="w-6 h-6 md:w-8 md:h-8 text-text-white -mb-4" />
                        </div>

                        <div className="flex-1">
                            <h3 className="text-sm md:text-base font-semibold text-text-white text-center">Sales History</h3>
                        </div>
                    </div>
                </div>

                <div
                    onClick={() => triggerModalAction('Edit Shop Info')}
                    className="relative overflow-hidden bg-clip-padding group flex flex-col border-b-4 md:border-b-8 border-brand-gold/70 hover:bg-brand-gold/10 bg-[url('/images/5.png')] bg-cover bg-center bg-no-repeat rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer"
                >
                    {/* The Absolute Dark Overlay */}
                    <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />

                    {/* Card Content Wrapper */}
                    <div className="relative z-10 flex flex-col w-full h-full">
                        <div className="w-full aspect-video group-hover:bg-bg-black/40 transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center">
                            <Store className="w-6 h-6 md:w-8 md:h-8 text-text-white -mb-4" />
                        </div>

                        <div className="flex-1">
                            <h3 className="text-sm md:text-base font-semibold text-text-white text-center">Edit Shop Info</h3>
                        </div>
                    </div>
                </div>

                <div
                    onClick={(e) => { e.stopPropagation(); handleOpenDeletePrompt(shopId) }}
                    className="relative overflow-hidden bg-clip-padding group flex flex-col border-b-4 md:border-b-8 border-brand-gold/70 hover:bg-brand-gold/10 bg-[url('/images/8.png')] bg-cover bg-center bg-no-repeat rounded-2xl p-5 shadow-sm transition-all duration-300 cursor-pointer"
                >
                    {/* The Absolute Dark Overlay */}
                    <div className="absolute inset-0 bg-black/60 pointer-events-none z-0" />

                    {/* Card Content Wrapper */}
                    <div className="relative z-10 flex flex-col w-full h-full">
                        <div className="w-full aspect-video group-hover:bg-bg-black/40 transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center">
                            <Trash2 className="w-6 h-6 md:w-8 md:h-8 text-text-white -mb-4" />
                        </div>

                        <div className="flex-1">
                            <h3 className="text-sm md:text-base font-semibold text-text-white text-center">Delete Shop</h3>
                        </div>
                    </div>
                </div>



            </div>
            <InventoryForm isOpen={isInventoryModalOpen} onClose={handleCloseInventoryModal} />
            <Checkout isOpen={isCheckoutModalOpen} onClose={handleCloseCheckoutModal} />
            <Restock isOpen={isRestockModalOpen} onClose={handleCloseRestockModal} />

            <Modal
                isOpen={isAddShopModalOpen}
                onClose={handleModalClose}
                title="Edit your Shop"
                subtitle="Edit your commercial storefront blueprint"
            >
                <ShopForm data={shop} />
            </Modal>


            <Modal
                isOpen={isModalOpen}
                onClose={handleDeleteModalClose}
                title={isConfirmingDelete ? "Are you absolutely sure?" : (isSuccess ? "Success" : "Error")}
                subtitle=""
                isMobileVariant={false}
                maxWidth="max-w-[360px] md:max-w-[400px]"
                isHeaderVisible={false}
                unsetHeight
            >
                <div className="flex flex-col gap-4 items-center text-center p-2">

                    {isConfirmingDelete ? (
                        /* --- CONFIRMATION PROMPT VIEW --- */
                        <div className='p-6 flex gap-6 flex-col'>
                            <div className="text-3xl self-center"><TriangleAlert className="w-8 h-8 text-brand-red" /></div>
                            <p className="m-0 text-[15px] max-w-[400px] text-[var(--color-text-sub)] leading-relaxed">
                                This action cannot be undone. Deleting this shop will <strong className="text-[var(--color-text-main)]">permanently delete all associated inventory, items, and transactional data</strong>.
                            </p>

                            <div className="flex gap-3 w-full mt-4">
                                <button
                                    onClick={handleDeleteModalClose}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 bg-[var(--color-bg-primary-hover)] hover:bg-[var(--color-border-main)] text-[var(--color-text-sub)] border border-[var(--color-border-main)] rounded-md font-semibold cursor-pointer transition-colors duration-200 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExecuteDelete}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-[var(--color-text-white)] rounded-md font-semibold cursor-pointer transition-colors duration-200 disabled:opacity-50"
                                >
                                    {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* --- ORIGINAL SUCCESS / ERROR VIEW --- */
                        <div className='p-6 flex gap-6 flex-col'>
                            <div className="text-2xl self-center">
                                {isSuccess ? <Check className="w-8 h-8 text-brand-green" /> : <X className="w-8 h-8 text-brand-red" />}
                            </div>
                            <p className="m-0 text-base max-w-[400px] text-[var(--color-text-sub)]">
                                {modalMessage}
                            </p>
                            <button
                                onClick={() => handleDeleteModalClose({ navigateBack: isSuccess })}
                                className={`mt-2 px-6 self-center w-unset py-2 text-text-white rounded-md font-semibold cursor-pointer transition-colors duration-200
                                                ${isSuccess
                                        ? 'bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)]'
                                        : 'bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)]'
                                    }`}
                            >
                                OK
                            </button>
                        </div>
                    )}
                </div>
            </Modal>

        </div>
    );
}
