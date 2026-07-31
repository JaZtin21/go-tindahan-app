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

// 3. Lucide Dashboard Icons
import {
    TrendingUp,
    BarChart3,
    ShoppingBag,
    Coins,
    Activity,
    Eye,
    EyeOff,
} from 'lucide-react';
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

    // --- NEW: Toggle visibility of the metrics/charts panel (persisted per-shop in localStorage) ---
    const chartsVisibilityStorageKey = `shopDashboard:${shopId}:chartsVisible`;

    const [isChartsVisible, setIsChartsVisible] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        try {
            const stored = window.localStorage.getItem(chartsVisibilityStorageKey);
            return stored === null ? true : stored === 'true';
        } catch {
            return true;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(chartsVisibilityStorageKey, String(isChartsVisible));
        } catch {
            // localStorage may be unavailable (e.g. private browsing); fail silently
        }
    }, [isChartsVisible, chartsVisibilityStorageKey]);

    const toggleChartsVisibility = () => setIsChartsVisible((prev) => !prev);


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

    console.log(`isInventoryModalOpen: ${isInventoryModalOpen}`);
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

    const handleDeleteModalClose = ({ navigateBack }: { navigateBack?: boolean }) => {
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
                <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green"></span>
                    </span>
                    Live Tracking Active
                </span>
            </div>
            {/* --- RECHARTS-DRIVEN 2.5x SCALE METRICS PANEL --- */}
            {/* --- RECHARTS-DRIVEN 2.5x SCALE METRICS PANEL --- */}
            {/* MAIN CONTAINER: Handles clear, scrollable layout blocks seamlessly */}
            {/* WRAPPER — new, outermost. Only job: clip + host the wave. No padding, no scroll, nothing else. */}
            {isChartsVisible ? (
                <div className="relative overflow-hidden rounded-2xl mb-8">

                    {/* --- FLOATING VISIBILITY TOGGLE — pinned to upper-right of the charts container --- */}
                    <button
                        type="button"
                        onClick={toggleChartsVisibility}
                        aria-pressed={isChartsVisible}
                        aria-label={isChartsVisible ? 'Hide charts' : 'Show charts'}
                        title={isChartsVisible ? 'Hide charts' : 'Show charts'}
                        className="absolute top-3 right-3 z-30 flex items-center justify-center w-8 h-8 rounded-xl border border-brand-gold/50 bg-bg-primary/80 backdrop-blur-sm text-text-muted hover:text-text-main hover:bg-brand-gold/10 transition-all duration-200 cursor-pointer active:scale-95"
                    >
                        <Eye size={16} strokeWidth={2.5} />
                    </button>

                    {/* YOUR CARD — 100% as it was before any of this wave stuff, just remove mb-8 (wrapper has it now) */}
                    <div className="border-2 border-brand-gold/70 bg-brand-gold/10 rounded-2xl md:p-10  p-4 shadow-sm w-full overflow-x-auto min-h-[180px] flex items-center">
                        <div className="flex items-center justify-start md:gap-12 gap-3 min-w-[1300px] w-full box-border">

                            {/* SECTION 1 */}
                            <div className="flex items-center gap-6 shrink-0 md:w-[420px] w-[unset]">
                                <div className="w-65 h-65 md:w-80 md:h-80 relative flex items-center justify-center shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[{ value: 100 }]}
                                                dataKey="value"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius="84%"
                                                outerRadius="100%"
                                                startAngle={90}
                                                endAngle={-270}
                                                stroke="none"
                                                fill={
                                                    todaysGrossSales === 0 || todaysSalesGrowthPct === -100
                                                        ? 'var(--color-text-muted)'
                                                        : todaysSalesGrowthPct === 0
                                                            ? 'var(--color-text-muted)'
                                                            : 'var(--color-text-muted)'
                                                }
                                                opacity={
                                                    todaysGrossSales === 0 || todaysSalesGrowthPct === -100 || todaysSalesGrowthPct === 0
                                                        ? 0.2
                                                        : 0.2
                                                }
                                                cornerRadius={10}
                                            />
                                            <Pie
                                                data={[{
                                                    value: todaysGrossSales === 0
                                                        ? 0
                                                        : todaysSalesGrowthPct === 0
                                                            ? Math.min((todaysGrossSales / 1000) * 100, 100)
                                                            : Math.min(Math.max(0, 100 + todaysSalesGrowthPct), 100)
                                                }]}
                                                dataKey="value"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius="84%"
                                                outerRadius="100%"
                                                startAngle={90}
                                                endAngle={90 - (360 * ((
                                                    todaysGrossSales === 0
                                                        ? 0
                                                        : todaysSalesGrowthPct === 0
                                                            ? Math.min((todaysGrossSales / 1000) * 100, 100)
                                                            : Math.min(Math.max(0, 100 + todaysSalesGrowthPct), 100)
                                                ) / 100))}
                                                stroke="none"
                                                fill={todaysGrossSales === 0 ? 'transparent' : 'var(--color-brand-green)'}
                                                cornerRadius={10}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    <div className="absolute text-center flex flex-col items-center justify-center select-none pointer-events-none">
                                        <span className="text-md line-clamp-2 font-bold text-text-muted tracking-tight max-w-[160px] mb-1">
                                            {shop?.shopName}
                                        </span>
                                        <span className="text-4xl font-black text-text-main tracking-tighter leading-none mt-2">
                                            {formatCurrency(todaysGrossSales)}
                                        </span>
                                        <p className={`text-sm font-bold border-b-2 border-border-white/30 pb-1 mt-2 ${(weeklySalesTrend.at(-1)?.grossSale || 0) === 0
                                            ? 'text-text-muted'
                                            : (weeklySalesTrend.at(-1)?.grossSale || 0) > 0
                                                ? 'text-brand-green'
                                                : 'text-brand-red'
                                            }`}>
                                            {/* Only show the "+" sign if sales are strictly greater than 0 */}
                                            {(weeklySalesTrend.at(-1)?.grossSale || 0) > 0 && '+ '}
                                            {formatCurrency(weeklySalesTrend.at(-1)?.grossSale || 0)} today
                                        </p>
                                        <p className={`text-xs font-extrabold mt-1 ${todaysSalesGrowthPct >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                                            {todaysSalesGrowthPct === 0 && todaysGrossSales > 0
                                                ? `+${formatCurrency(todaysGrossSales)} vs last week`
                                                : formatGrowthRate(todaysSalesGrowthPct)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col max-w-[120px]">
                                    <div className="w-7 h-7 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green mb-2">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                    <span className="text-2xl font-black text-text-main tracking-tight">Weekly Sales</span>
                                    <span className="text-sm font-bold text-text-muted mt-1.5">Primary revenue scale</span>
                                </div>
                            </div>

                            {/* SECTION 2 */}
                            <div className="flex flex-col gap-10 shrink-0 justify-center">
                                <div className="flex items-center gap-6">
                                    <div className="w-35 h-35 relative flex items-center justify-center shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={14} data={[{ value: Math.min(weeklyRevenueGrowthIndex, 100), fill: 'var(--color-brand-gold)' }]} startAngle={90} endAngle={-270}>
                                                <RadialBar background={{ fill: 'var(--color-brand-gold)', opacity: 0.15 }} dataKey="value" cornerRadius={6} />
                                            </RadialBarChart>
                                        </ResponsiveContainer>
                                        <span className="absolute text-base font-black text-text-main">{weeklyRevenueGrowthIndex.toFixed(0)}%</span>
                                    </div>
                                    <div className="flex flex-col max-w-[200px]">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 className="w-4 h-4 text-brand-gold" />
                                            <span className="text-lg font-black text-text-sub tracking-tight">7-Day Growth Index</span>
                                        </div>
                                        <span className="text-xs text-text-muted font-bold mt-2 pl-6">Growth of sales over the last 7 days</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="w-35 h-35 relative flex items-center justify-center shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={14} data={[{ value: 100, fill: 'var(--color-brand-green)' }]} startAngle={90} endAngle={-270}>
                                                <RadialBar background={{ fill: 'var(--color-brand-red)', opacity: 0.15 }} dataKey="value" cornerRadius={6} />
                                            </RadialBarChart>
                                        </ResponsiveContainer>
                                        <span className="absolute text-xs font-black text-text-main">{formatCurrency(averageTicketSize)}</span>
                                    </div>
                                    <div className="flex flex-col max-w-[200px]">
                                        <div className="flex gap-2">
                                            <ShoppingBag className="w-5 h-5 mt-1 text-brand-green" />
                                            <span className="text-lg font-black text-text-sub tracking-tight">Customer average spending</span>
                                        </div>
                                        <span className="text-xs text-text-muted font-bold mt-2 pl-6">{formatCurrency(averageTicketSize)} pesos</span>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3 */}
                            <div className="flex flex-col shrink-0 justify-center h-44 px-8 w-[320px] border-r-2 border-border-white/40">
                                <div className="w-full h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={weeklySalesTrend} margin={{ top: 15, right: 5, left: 5, bottom: 5 }} >
                                            <XAxis dataKey="dayName" axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)', strokeWidth: 1.5 }} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: '800' }} dy={8} />
                                            <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.04)', radius: 6 }} content={({ active, payload }) => { if (active && payload && payload.length) { const data = payload[0].payload; return (<div className="p-3 bg-white rounded-xl border border-slate-200 font-bold flex flex-col gap-1 shadow-md select-none text-xs"> <p className="text-text-muted font-black mb-0.5">{data.formattedDate}</p> <p className="text-slate-800">Sales: {formatCurrency(data.grossSale)}</p> <p className="text-brand-green">Profit: {formatCurrency(data.grossProfit)}</p> </div>); } return null; }} />
                                            <Bar dataKey="grossSale" fill="var(--color-brand-green)" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Line type="monotone" dataKey="grossSale" stroke='rgba(148, 163, 184, 0.2)' strokeWidth={2.5} dot={{ fill: 'rgba(148, 163, 184, 0.2)', r: 3 }} activeDot={{ r: 5 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-[10px] text-center font-bold text-text-muted mt-2 uppercase tracking-wider select-none flex items-center justify-center gap-1">
                                    <Activity className="w-3 h-3 text-text-muted/60" /> 7-Day Sales & Profit Trend
                                </p>
                            </div>

                            {/* SECTION 4 */}
                            <div className="flex items-center gap-10 shrink-0 w-[450px] justify-end pr-8">
                                <div className="flex flex-col text-right select-none items-end">
                                    <div className="w-7 h-7 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green mb-2">
                                        <Coins className="w-4 h-4" />
                                    </div>
                                    <span className="text-2xl font-black text-text-main tracking-tight"> Expected Profit Yield </span>
                                    <span className="text-xs font-bold text-text-muted mt-1.5 max-w-[200px] leading-tight"> {(100 - inventoryCapitalRatio).toFixed(0)}% goes to your pocket on total shelf value </span>
                                </div>
                                <div className="w-52 h-52 relative flex items-center justify-center shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={[{ value: Math.max(0, 100 - inventoryCapitalRatio), fill: 'var(--color-brand-green)' }, { value: inventoryCapitalRatio, fill: 'var(--color-brand-red)' }]} dataKey="value" cx="50%" cy="50%" innerRadius="75%" outerRadius="95%" startAngle={90} endAngle={-270} stroke="none" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <span className="absolute text-xl font-black text-text-main"> {(100 - inventoryCapitalRatio).toFixed(0)}% </span>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* WAVE — lives in the WRAPPER now, not inside the padded/scrolling card.
        w-full here = the wrapper's width = the card's true visible border-box width, always. */}
                    {/* MOBILE WAVE — fewer, bigger bumps. Visible below md breakpoint only. */}
                    <svg
                        className="block md:hidden absolute bottom-0 left-0 w-full h-28 pointer-events-none select-none z-20"
                        viewBox="0 0 1440 160"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <g className="animate-wave-back-mobile">
                            <path
                                d="M-720,65 C-480,25 -240,105 0,65 C240,25 480,105 720,65 C960,25 1200,105 1440,65 C1680,25 1920,105 2160,65 L2160,160 L-720,160 Z"
                                fill="var(--color-brand-gold)"
                                opacity="0.14"
                            />
                        </g>
                        <g className="animate-wave-front-mobile">
                            <path
                                d="M-720,105 C-480,145 -240,65 0,105 C240,145 480,65 720,105 C960,145 1200,65 1440,105 C1680,145 1920,65 2160,105 L2160,160 L-720,160 Z"
                                fill="var(--color-brand-gold)"
                                opacity="0.25"
                            />
                        </g>
                    </svg>

                    {/* DESKTOP WAVE — original density, just taller amplitude. Visible md and up only. */}
                    <svg
                        className="hidden md:block absolute bottom-0 left-0 w-full h-28 pointer-events-none select-none z-20"
                        viewBox="0 0 1440 160"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <g className="animate-wave-back">
                            <path
                                d="M-480,65 C-360,25 -240,105 -120,65 C0,25 120,105 240,65 C360,25 480,105 600,65 C720,25 840,105 960,65 C1080,25 1200,105 1320,65 C1440,25 1560,105 1680,65 C1800,25 1920,105 2040,65 L2040,160 L-480,160 Z"
                                fill="var(--color-brand-gold)"
                                opacity="0.14"
                            />
                        </g>
                        <g className="animate-wave-front">
                            <path
                                d="M-480,105 C-360,145 -240,65 -120,105 C0,145 120,65 240,105 C360,145 480,65 600,105 C720,145 840,65 960,105 C1080,145 1200,65 1320,105 C1440,145 1560,65 1680,105 C1800,145 1920,65 2040,105 L2040,160 L-480,160 Z"
                                fill="var(--color-brand-gold)"
                                opacity="0.25"
                            />
                        </g>
                    </svg>

                </div>
            ) : (
                /* --- HIDDEN STATE PLACEHOLDER: shown when charts are toggled off --- */
                <div className="relative overflow-hidden rounded-2xl mb-8">

                    {/* --- FLOATING VISIBILITY TOGGLE — pinned to upper-right, same spot as the visible state --- */}
                    <button
                        type="button"
                        onClick={toggleChartsVisibility}
                        aria-pressed={isChartsVisible}
                        aria-label={isChartsVisible ? 'Hide charts' : 'Show charts'}
                        title={isChartsVisible ? 'Hide charts' : 'Show charts'}
                        className="absolute top-3 right-3 z-30 flex items-center justify-center w-8 h-8 rounded-xl border border-brand-gold/50 bg-bg-primary/80 backdrop-blur-sm text-text-muted hover:text-text-main hover:bg-brand-gold/10 transition-all duration-200 cursor-pointer active:scale-95"
                    >
                        <EyeOff size={16} strokeWidth={2.5} />
                    </button>

                    <div className="border-2 border-brand-gold/70 bg-brand-gold/10 rounded-2xl p-10 shadow-sm w-full min-h-[180px] flex flex-col items-center justify-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-xl bg-brand-gold/10 flex items-center justify-center text-text-muted">
                            <EyeOff className="w-6 h-6" />
                        </div>
                        <span className="text-lg font-black text-text-main tracking-tight">
                            Charts are hidden
                        </span>
                        <span className="text-sm font-bold text-text-muted max-w-[360px]">
                            Your sales metrics are still tracking in the background. Tap the eye icon to show them again.
                        </span>
                    </div>

                    {/* WAVE — kept animating even while charts are hidden, identical to the visible state */}
                    <svg
                        className="block md:hidden absolute bottom-0 left-0 w-full h-28 pointer-events-none select-none z-20"
                        viewBox="0 0 1440 160"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <g className="animate-wave-back-mobile">
                            <path
                                d="M-720,65 C-480,25 -240,105 0,65 C240,25 480,105 720,65 C960,25 1200,105 1440,65 C1680,25 1920,105 2160,65 L2160,160 L-720,160 Z"
                                fill="var(--color-brand-gold)"
                                opacity="0.14"
                            />
                        </g>
                        <g className="animate-wave-front-mobile">
                            <path
                                d="M-720,105 C-480,145 -240,65 0,105 C240,145 480,65 720,105 C960,145 1200,65 1440,105 C1680,145 1920,65 2160,105 L2160,160 L-720,160 Z"
                                fill="var(--color-brand-gold)"
                                opacity="0.25"
                            />
                        </g>
                    </svg>

                    <svg
                        className="hidden md:block absolute bottom-0 left-0 w-full h-28 pointer-events-none select-none z-20"
                        viewBox="0 0 1440 160"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <g className="animate-wave-back">
                            <path
                                d="M-480,65 C-360,25 -240,105 -120,65 C0,25 120,105 240,65 C360,25 480,105 600,65 C720,25 840,105 960,65 C1080,25 1200,105 1320,65 C1440,25 1560,105 1680,65 C1800,25 1920,105 2040,65 L2040,160 L-480,160 Z"
                                fill="var(--color-brand-gold)"
                                opacity="0.14"
                            />
                        </g>
                        <g className="animate-wave-front">
                            <path
                                d="M-480,105 C-360,145 -240,65 -120,105 C0,145 120,65 240,105 C360,145 480,65 600,105 C720,145 840,65 960,105 C1080,145 1200,65 1320,105 C1440,145 1560,65 1680,105 C1800,145 1920,65 2040,105 L2040,160 L-480,160 Z"
                                fill="var(--color-brand-gold)"
                                opacity="0.25"
                            />
                        </g>
                    </svg>
                </div>
            )}



            {/* --- COMPLETE ACTIONS GRID SECTION (Matches 5 buttons layout structure) --- */}
            {/* --- ACTION GRID: 5 BUTTONS FROM IMAGE --- */}
            {/* --- ACTION GRID: 5 BUTTONS (Matches Shop Card Layout Styles) --- */}
            <div className="grid grid-cols-2  md:grid-cols-4 lg:grid-cols-5 gap-6">

                {/* 1. Someone is buying (Modal Trigger) */}
                <div
                    onClick={handleOpenCheckoutModal}
                    className="group flex flex-col border-1 border-brand-gold/50 hover:border-brand-gold/40  bg-bg-primary hover:bg-brand-gold/10  rounded-2xl p-5 shadow-sm transition-all duration-300   cursor-pointer "
                >
                    {/* Centered Asset Representation Box matching your shop card geometry layout */}
                    <div className="relative w-full aspect-video bg-brand-gold/10 group-hover:bg-bg-primary transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center overflow-hidden">
                        <svg
                            viewBox="0 0 593 560"

                            preserveAspectRatio="xMidYMid meet"

                        >
                            <g transform="translate(0,560) scale(0.1,-0.1)" fill="var(--color-brand-gold)" opacity="0.4" stroke="none">
                                <path d="M5660 4644 c-126 -17 -165 -33 -186 -77 -13 -28 -20 -32 -47 -30 -18 2 -272 10 -566 18 l-533 15 -82 -55 c-462 -317 -754 -527 -773 -555 -29 -41 -29 -85 -2 -129 l20 -34 -169 -171 c-184 -186 -194 -203 -173 -284 13 -45 64 -98 106 -108 17 -4 33 -8 37 -10 3 -3 -9 -30 -28 -61 -41 -69 -46 -134 -13 -192 18 -32 73 -81 92 -81 7 0 37 66 37 81 0 5 -7 9 -15 9 -19 0 -47 44 -47 75 0 22 204 378 254 444 41 53 13 39 -64 -35 -137 -129 -177 -157 -212 -150 -17 3 -39 16 -48 27 -40 47 -30 61 187 272 l206 200 -51 31 c-34 21 -50 37 -50 51 0 16 61 63 252 195 138 96 321 223 406 283 l155 107 536 -15 c295 -9 545 -16 556 -18 18 -2 23 -28 62 -337 23 -184 45 -366 49 -403 l7 -68 -54 -55 c-62 -63 -115 -97 -197 -125 -65 -23 -200 -49 -252 -49 -34 0 -45 -11 -260 -267 -321 -380 -370 -434 -407 -449 -76 -32 -173 38 -173 123 0 32 16 59 269 447 99 153 181 288 182 300 3 46 -4 70 -47 169 -48 111 -70 137 -116 137 -31 0 -186 -79 -209 -106 -7 -8 -45 -101 -84 -207 -77 -205 -77 -204 -16 -209 l32 -3 49 130 c91 248 78 225 150 267 36 21 68 38 71 38 3 0 24 -44 47 -97 l42 -97 -19 -30 c-10 -17 -109 -170 -219 -339 -111 -170 -206 -325 -212 -345 -27 -98 9 -186 98 -243 61 -38 155 -41 217 -6 27 15 130 129 323 357 l283 335 102 17 c173 29 289 78 380 159 46 41 57 46 67 34 27 -32 70 -36 223 -16 153 20 183 31 213 76 13 20 15 41 11 98 -5 80 -105 859 -114 894 -3 13 -21 36 -39 53 -40 35 -70 37 -244 14z" />
                                <path d="M3885 3265 c-323 -70 -539 -407 -470 -733 50 -240 237 -433 473 -488 100 -24 255 -15 350 18 197 70 349 237 396 433 18 76 30 195 19 194 -4 0 -29 -26 -54 -57 -32 -39 -49 -71 -54 -100 -4 -24 -25 -79 -46 -122 -106 -212 -347 -327 -581 -279 -128 27 -272 127 -342 238 -135 214 -105 484 73 662 130 130 304 183 480 145 40 -8 77 -13 81 -11 5 3 17 21 29 40 l20 34 -38 11 c-123 33 -233 38 -336 15z" />
                                <path d="M3962 3024 c3 -45 2 -46 -35 -59 -76 -26 -117 -84 -117 -165 0 -92 35 -141 119 -165 l36 -11 3 -72 c3 -70 2 -72 -21 -72 -13 0 -45 11 -71 24 l-47 24 -26 -45 c-22 -37 -24 -47 -12 -55 29 -20 105 -52 139 -58 34 -5 35 -7 32 -47 l-2 -41 60 -4 60 -3 0 47 c0 44 2 47 34 58 61 20 100 60 120 126 5 16 0 23 -19 32 -43 20 -116 94 -143 147 -34 66 -37 177 -7 245 13 30 19 61 17 93 l-3 47 -60 0 -61 0 4 -46z" />
                                <path
                                    d="M2775 2291 c-70 -18 -86 -32 -469 -395 -87 -83 -164 -154 -172 -159 -9 -5 -18 1 -28 20 -18 35 -62 76 -104 97 -34 18 -129 30 -647 86 -159 17 -390 42 -513 55 -351 39 -349 39 -492 -75 l-88 -70 -37 24 c-84 57 -154 48 -267 -37 -130 -97 -174 -145 -186 -203 -12 -56 -4 -110 24 -152 32 -49 686 -876 726 -918 55 -58 144 -80 213 -54 15 6 76 48 135 95 114 89 150 138 150 202 l0 31 88 16 c904 163 1203 218 1230 227 64 21 71 30 389 449 93 124 202 267 241 319 89 116 111 176 92 258 -28 127 -165 215 -285 184z"
                                    fill="none"
                                    stroke="var(--color-brand-gold)"
                                    strokeWidth="90"
                                />
                            </g>
                        </svg>

                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Someone is buying</h3>
                    </div>
                </div>

                {/* 2. Add Items in Inventory (Modal Trigger) */}
                <div
                    onClick={handleOpenInventoryModal}
                    className="group flex flex-col border-1 border-brand-gold/50 hover:border-brand-gold/20 bg-bg-primary hover:bg-brand-gold/10 rounded-2xl p-5 shadow-sm transition-all duration-300  hover:bg-bg-primary-hover cursor-pointer "
                >
                    <div className="relative w-full aspect-video bg-brand-gold/10 group-hover:bg-bg-primary transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center overflow-hidden">
                        <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="247.000000pt" height="247.000000pt" viewBox="-80 -150 647.000000 647.000000" preserveAspectRatio="xMidYMid meet">
                            <g transform="translate(0.000000,447.000000) scale(0.050000,-0.050000)" fill="var(--color-brand-gold)" opacity="0.4" stroke="none">
                                <path d="M4830 8697 c-77 -45 -320 -185 -540 -312 -865 -499 -1047 -604 -1240 -715 -110 -63 -207 -125 -215 -137 -20 -31 -18 -2497 2 -2528 8 -14 114 -82 234 -151 121 -70 404 -233 629 -364 979 -567 1270 -730 1305 -730 42 0 114 34 275 131 437 261 848 488 861 475 8 -9 25 -49 38 -90 172 -538 882 -788 1383 -485 719 436 555 1528 -262 1738 l-90 24 -10 988 -10 987 -80 54 c-44 29 -231 139 -415 245 -504 290 -962 554 -1185 683 -551 319 -485 301 -680 187z m900 -598 c330 -190 711 -411 848 -490 285 -167 290 -125 -44 -317 l-196 -112 -84 43 c-46 23 -115 62 -154 87 -84 53 -208 125 -810 471 -704 404 -771 444 -760 455 5 6 116 71 245 146 l235 134 60 -35 c33 -20 330 -192 660 -382z m-989 -291 c258 -150 496 -287 529 -305 189 -104 810 -470 805 -474 -3 -2 -75 -46 -160 -96 l-156 -92 -194 113 c-107 62 -276 159 -375 216 -500 287 -1143 659 -1195 690 l-59 36 47 30 c79 50 266 154 278 154 6 0 222 -122 480 -272z m-454 -406 c321 -185 720 -416 888 -511 168 -96 305 -182 305 -191 0 -9 -106 -77 -235 -151 l-234 -135 -71 39 c-38 22 -286 164 -550 317 -264 152 -619 357 -790 455 -170 98 -331 192 -357 208 l-47 30 107 65 c271 165 349 209 374 210 14 1 289 -150 610 -336z m-387 -642 c369 -213 740 -427 825 -476 l155 -88 0 -1049 c0 -577 -7 -1045 -15 -1041 -8 5 -136 79 -285 164 -148 86 -414 239 -590 340 -545 313 -843 485 -887 513 l-43 27 0 1047 0 1046 85 -48 c47 -26 387 -222 755 -435z m3060 -367 l0 -825 -146 -43 c-352 -104 -639 -421 -688 -762 l-16 -108 -380 -218 c-209 -120 -427 -246 -485 -278 l-105 -60 5 1053 5 1053 220 127 c121 70 226 127 234 128 7 0 16 -179 20 -398 9 -571 14 -574 470 -311 163 95 310 185 326 201 24 24 32 120 40 521 l10 492 230 135 c127 74 237 131 245 126 8 -5 15 -380 15 -833z m-760 59 l0 -348 -95 -55 c-52 -30 -124 -72 -160 -93 l-65 -39 1 356 0 357 145 84 c79 46 151 84 159 85 8 1 15 -156 15 -347z m1164 -1207 c344 -150 510 -589 353 -927 -320 -688 -1340 -473 -1344 282 -3 522 511 856 991 645z" /> <path d="M6994 5095 c-39 -29 -50 -82 -53 -240 l-1 -115 -129 0 c-156 0 -223 -23 -243 -84 -43 -126 19 -176 215 -176 l157 0 0 -151 c0 -217 86 -303 207 -208 49 39 53 53 53 200 l0 159 159 0 c147 0 161 4 200 53 90 115 12 194 -200 204 l-159 7 0 148 c0 199 -91 289 -206 203z" />
                                <path d="M3231 3958 c-260 -38 -353 -75 -1107 -436 -637 -306 -561 -289 -627 -144 -132 294 -293 312 -812 92 -618 -261 -629 -296 -315 -1051 963 -2323 881 -2148 1040 -2221 147 -68 195 -56 810 201 298 125 387 310 279 584 -51 129 -57 123 241 260 298 136 397 141 750 33 132 -40 371 -110 530 -157 160 -46 358 -104 440 -129 352 -107 682 -71 1200 129 83 32 233 90 335 130 102 39 264 101 360 139 96 37 274 105 395 151 121 46 274 105 340 131 66 27 323 126 570 220 248 95 508 196 579 226 607 252 734 1051 208 1305 -233 113 -579 98 -1077 -48 -165 -49 -444 -130 -620 -182 -176 -52 -423 -124 -550 -161 -126 -37 -245 -73 -263 -80 -23 -9 -41 1 -57 30 -92 172 -255 274 -576 358 -903 237 -928 246 -1094 349 -359 224 -684 314 -979 271z m485 -296 c70 -24 223 -101 340 -171 228 -136 214 -131 1034 -351 580 -155 738 -330 592 -651 -116 -257 -285 -285 -822 -137 -1095 301 -1222 331 -1269 300 -124 -80 -54 -210 139 -257 241 -59 1045 -276 1220 -329 543 -165 989 69 1015 532 l6 108 90 27 c81 25 253 76 1159 341 546 160 597 171 810 173 664 6 694 -682 42 -934 -100 -39 -393 -153 -652 -253 -258 -101 -537 -209 -620 -240 -401 -152 -715 -273 -970 -374 -781 -309 -942 -327 -1490 -165 -192 57 -427 125 -522 151 -94 25 -242 69 -330 97 -338 109 -517 93 -878 -79 -128 -61 -240 -106 -248 -101 -19 12 -26 28 -362 841 -154 374 -294 710 -310 746 -41 91 -40 96 45 130 41 17 272 126 513 243 895 434 1092 481 1468 353z m-2480 -308 c12 -14 72 -146 134 -295 61 -148 133 -318 159 -379 26 -60 112 -267 192 -460 79 -192 242 -583 362 -867 222 -531 243 -604 182 -658 -95 -85 -705 -305 -760 -274 -51 28 -233 439 -694 1569 -49 121 -136 328 -192 460 -261 616 -261 615 -84 695 473 211 655 266 701 209z" />
                            </g>
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Add Items in Inventory</h3>
                    </div>
                </div>

                {/* 3. Manage Inventory (Subroute Navigation Anchor) */}
                <a
                    onClick={handleOpenRestockModal}
                    className="group flex flex-col border-1 border-brand-gold/50 hover:border-brand-gold/20 bg-bg-primary hover:bg-brand-gold/10 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer no-underline "
                >
                    <div className="relative w-full aspect-video bg-brand-gold/10 group-hover:bg-bg-primary transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center overflow-hidden">
                        <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="256.000000pt" height="197.000000pt" viewBox="0 0 256.000000 197.000000" preserveAspectRatio="xMidYMid meet">
                            <g transform="translate(0.000000,197.000000) scale(0.066667,-0.066667)" fill="var(--color-brand-gold)" opacity="0.4" stroke="none">
                                <path d="M330 2826 c0 -64 -7 -98 -23 -111 -12 -11 -76 -77 -140 -148 l-118 -129 1175 0 1175 0 -149 150 -150 150 0 90 0 90 -885 0 -885 0 0 -92z" />
                                <path d="M30 2306 c1 -118 91 -251 189 -275 l36 -9 0 -644 0 -643 -112 0 -113 0 0 -75 0 -75 563 0 562 0 0 -118 c0 -166 4 -169 248 -164 l192 5 21 62 c88 264 523 269 581 8 15 -69 38 -80 160 -75 l111 5 3 641 4 641 -157 0 -158 0 0 209 0 210 52 24 c77 37 155 130 165 197 5 32 12 76 16 99 l6 41 -1184 0 -1185 0 0 -64z m668 -201 c139 -182 437 -101 495 135 10 41 12 39 37 -34 95 -283 448 -267 548 25 l18 52 17 -69 c19 -76 99 -168 160 -183 37 -9 37 -9 37 -201 0 -106 4 -203 9 -216 8 -22 -35 -24 -427 -24 l-437 0 0 -427 0 -428 -382 0 -383 0 0 642 0 642 51 19 c68 24 138 106 160 186 l18 64 19 -65 c10 -35 38 -88 60 -118z m1432 -1008 c0 -241 -5 -259 -69 -233 -121 50 -296 21 -459 -78 -113 -69 -109 -76 -114 198 l-5 231 215 1 c134 1 237 9 275 21 32 11 81 21 108 21 l49 2 0 -163z" />
                                <path d="M2550 796 l0 -494 249 2 249 1 33 76 c119 269 454 268 574 -2 25 -58 43 -79 65 -79 79 0 132 157 56 168 -31 4 -34 12 -36 125 -1 66 -3 132 -4 146 -4 79 -61 101 -269 101 l-194 0 -146 199 c-200 270 -170 251 -391 251 l-186 0 0 -494z m447 230 c60 -87 105 -164 100 -172 -5 -8 -106 -14 -225 -14 l-217 0 0 173 0 172 117 0 117 0 108 -159z" /> <path d="M1793 462 c-242 -140 -58 -514 200 -407 224 93 174 415 -68 435 -56 5 -86 -2 -132 -28z m169 -125 c66 -47 26 -157 -58 -157 -78 0 -113 89 -58 147 36 39 70 42 116 10z" />
                                <path d="M3251 462 c-139 -81 -152 -279 -23 -377 151 -115 365 -12 365 178 0 180 -187 289 -342 199z m173 -128 c58 -66 22 -154 -63 -154 -75 0 -109 78 -60 140 36 46 89 52 123 14z" />
                            </g>
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Restock Items</h3>
                    </div>
                </a>

                {/* 3. Manage Inventory (Subroute Navigation Anchor) */}
                <a
                    onClick={() => navigate(`/my-shops/${shopId}/inventory`)}
                    className="group flex flex-col border-1 border-brand-gold/50 hover:border-brand-gold/20 bg-bg-primary hover:bg-brand-gold/10 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer no-underline"
                >
                    <div className="relative w-full aspect-video bg-brand-gold/10 group-hover:bg-bg-primary transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center overflow-hidden">
                        <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="1128.000000pt" height="900.000000pt" viewBox="0 -30 1128.000000 900.000000" preserveAspectRatio="xMidYMid meet">
                            <g transform="translate(0.000000,900.000000) scale(0.100000,-0.100000)" fill="var(--color-brand-gold)" opacity="0.4" stroke="none">
                                <path d="M5174 7480 c-6 -6 -44 -22 -85 -36 -77 -26 -131 -48 -161 -64 -10 -6 -24 -10 -33 -10 -8 0 -29 -6 -47 -14 -75 -33 -191 -76 -206 -76 -8 0 -23 -6 -31 -13 -9 -7 -43 -21 -76 -32 -53 -16 -101 -35 -170 -65 -11 -5 -48 -18 -83 -29 -34 -12 -70 -25 -80 -31 -9 -5 -46 -19 -82 -30 -36 -12 -69 -25 -75 -29 -5 -5 -37 -16 -70 -26 -33 -10 -69 -23 -80 -29 -23 -12 -52 -23 -160 -61 -44 -15 -84 -31 -90 -34 -5 -4 -37 -16 -70 -26 -33 -11 -65 -22 -70 -26 -6 -4 -45 -19 -87 -33 -42 -13 -84 -29 -94 -34 -43 -22 -96 -42 -110 -42 -9 0 -28 -6 -42 -14 -15 -8 -45 -21 -67 -29 -22 -8 -94 -35 -160 -60 -66 -25 -129 -48 -140 -51 -12 -3 -28 -19 -38 -35 -16 -27 -17 -98 -17 -954 l0 -925 -44 -36 c-25 -20 -58 -56 -74 -80 -30 -45 -36 -63 -54 -181 -6 -38 -18 -94 -27 -124 -15 -52 -19 -57 -76 -86 -91 -47 -150 -67 -177 -60 -14 4 -42 22 -64 40 -21 19 -45 35 -52 35 -8 0 -32 15 -55 34 -65 53 -172 99 -213 92 -64 -13 -105 -37 -179 -107 -99 -95 -125 -140 -125 -219 0 -58 4 -69 53 -147 28 -47 60 -97 69 -112 10 -14 21 -33 25 -41 4 -8 15 -27 26 -42 22 -30 20 -96 -4 -124 -7 -9 -21 -39 -31 -67 -22 -62 -48 -84 -108 -92 -25 -4 -65 -11 -90 -16 -25 -6 -63 -14 -85 -19 -98 -21 -153 -53 -193 -112 -26 -41 -27 -45 -27 -187 0 -136 2 -149 23 -184 35 -55 80 -85 158 -103 38 -9 83 -20 99 -26 17 -6 57 -15 90 -20 87 -15 109 -29 129 -85 21 -57 23 -61 41 -93 26 -45 18 -80 -35 -158 -28 -41 -50 -75 -50 -76 0 -2 -20 -34 -45 -72 -43 -66 -45 -71 -45 -145 0 -69 3 -80 30 -117 51 -70 151 -163 199 -184 77 -34 159 -21 236 36 17 12 37 26 45 29 8 4 27 15 41 25 15 9 55 34 89 56 l62 38 41 -17 c23 -9 56 -23 72 -30 17 -8 39 -16 51 -19 11 -4 30 -16 41 -29 20 -22 53 -127 53 -169 0 -13 9 -58 19 -101 22 -86 51 -132 114 -178 40 -29 40 -29 181 -28 l141 0 45 33 c69 50 96 97 115 201 9 50 23 110 31 135 8 25 14 55 14 67 0 25 45 61 100 82 102 37 122 43 144 37 13 -3 68 -36 122 -72 55 -37 127 -79 161 -95 53 -24 69 -27 110 -20 76 12 117 37 201 126 85 90 92 104 92 210 0 52 -4 68 -28 101 -16 21 -31 46 -35 54 -14 27 -32 55 -59 91 -16 20 -28 41 -28 46 0 6 -6 16 -14 22 -26 22 -29 68 -7 113 11 24 29 68 39 98 l20 55 63 16 c35 10 84 22 109 29 25 6 68 15 95 20 75 12 121 36 169 85 23 25 48 45 55 45 6 0 59 -22 116 -50 57 -27 107 -50 109 -50 3 0 47 -20 98 -44 51 -24 122 -56 158 -72 36 -16 94 -44 129 -61 35 -18 72 -33 82 -33 10 0 44 13 76 29 62 30 141 68 263 124 41 19 107 49 145 67 39 18 95 43 125 57 57 25 77 34 169 77 30 15 58 26 62 26 5 0 10 -262 12 -582 2 -500 5 -589 19 -628 44 -126 132 -231 238 -282 36 -17 77 -37 92 -45 21 -11 257 -13 1285 -13 l1258 0 72 29 c144 59 237 151 289 287 18 47 19 111 19 1834 l0 1785 -38 75 c-43 85 -107 157 -185 207 -84 54 -134 64 -357 72 l-200 6 -6 65 c-8 92 -49 160 -127 207 l-47 28 -338 5 c-286 4 -339 7 -347 20 -6 8 -10 133 -10 286 0 311 5 294 -100 328 -30 10 -68 24 -85 31 -16 7 -49 20 -72 29 -109 41 -130 49 -155 62 -14 8 -33 14 -42 14 -8 0 -32 7 -53 16 -73 32 -98 42 -153 59 -30 10 -60 22 -65 26 -6 4 -49 21 -95 37 -47 17 -123 44 -170 62 -47 17 -94 34 -105 37 -11 3 -24 9 -30 14 -5 4 -39 17 -75 28 -36 12 -73 26 -84 32 -10 6 -51 21 -90 34 -40 13 -98 35 -130 49 -32 14 -66 26 -75 26 -9 0 -21 4 -26 8 -6 4 -35 17 -65 29 -156 59 -220 82 -265 98 -27 10 -63 23 -80 30 -87 38 -104 45 -118 45 -9 0 -28 6 -44 14 -44 22 -73 33 -153 61 -41 14 -79 30 -84 35 -13 13 -99 13 -112 0z m141 -176 c44 -15 87 -33 96 -40 8 -8 22 -14 30 -14 14 -1 90 -26 144 -49 17 -7 45 -19 63 -27 18 -8 39 -14 47 -14 7 0 26 -6 42 -14 53 -26 104 -46 118 -46 9 0 23 -4 33 -9 39 -22 111 -50 172 -69 53 -17 65 -24 65 -42 0 -17 -12 -25 -65 -44 -36 -12 -74 -28 -85 -34 -11 -6 -49 -21 -85 -32 -36 -12 -69 -25 -75 -30 -5 -4 -38 -17 -73 -29 -34 -12 -70 -25 -80 -30 -43 -22 -94 -41 -108 -41 -9 0 -28 -6 -42 -14 -15 -8 -46 -21 -69 -30 -24 -9 -62 -23 -85 -32 -24 -9 -54 -22 -68 -29 -14 -7 -53 -22 -88 -34 -34 -12 -70 -25 -80 -30 -43 -22 -94 -41 -108 -41 -9 0 -28 -6 -42 -13 -15 -8 -42 -21 -60 -30 -19 -9 -40 -17 -48 -17 -8 0 -42 -13 -76 -28 -75 -34 -124 -52 -158 -59 -14 -3 -31 -11 -39 -17 -15 -12 -70 -33 -116 -45 -17 -4 -39 -12 -50 -18 -33 -17 -85 -38 -175 -72 -234 -89 -212 -85 -300 -55 -41 14 -88 32 -105 39 -16 7 -59 23 -95 35 -36 12 -69 26 -74 31 -6 5 -20 9 -32 9 -13 0 -25 4 -28 9 -3 5 -39 19 -78 31 -40 12 -82 27 -93 34 -11 6 -47 20 -80 30 -33 10 -68 22 -79 28 -10 5 -53 21 -95 34 -84 28 -128 52 -115 64 5 4 37 17 72 29 34 12 70 26 80 31 34 19 95 40 117 40 12 0 28 6 34 14 6 8 22 16 34 19 12 3 60 19 107 37 47 18 103 38 125 46 22 8 48 19 57 24 10 6 26 10 36 10 9 0 26 6 37 13 11 8 45 22 75 32 30 9 66 23 80 30 14 7 54 22 90 34 69 23 98 34 143 57 16 8 35 14 42 14 8 0 29 7 47 14 18 8 71 29 118 46 47 18 101 38 120 45 19 8 78 30 130 50 52 20 104 40 115 45 11 5 48 18 83 29 34 12 70 25 80 31 9 5 44 18 77 29 53 17 86 30 160 60 31 13 79 29 90 30 5 1 46 -11 90 -25z m1141 -430 c22 -8 53 -21 69 -28 17 -8 55 -22 85 -31 30 -10 60 -21 65 -25 6 -5 26 -13 45 -18 19 -6 60 -20 90 -32 85 -34 213 -81 235 -87 11 -3 25 -9 30 -14 6 -4 39 -17 75 -28 36 -12 76 -27 90 -34 14 -8 53 -22 88 -33 34 -10 62 -23 62 -29 -1 -10 -56 -38 -100 -50 -14 -3 -34 -10 -45 -15 -76 -33 -180 -70 -196 -70 -10 0 -21 -4 -24 -10 -3 -5 -42 -21 -87 -35 -44 -14 -86 -29 -92 -33 -13 -8 -57 -24 -155 -57 -41 -14 -79 -29 -85 -34 -6 -4 -22 -11 -36 -14 -14 -3 -50 -15 -80 -27 -30 -12 -82 -31 -115 -42 -33 -11 -73 -26 -90 -34 -16 -8 -75 -30 -130 -50 -55 -20 -140 -51 -190 -69 -49 -18 -119 -43 -155 -55 -36 -13 -87 -33 -115 -46 -27 -12 -66 -27 -85 -32 -19 -6 -53 -18 -75 -26 -22 -8 -78 -29 -125 -47 -47 -17 -101 -37 -120 -45 -54 -20 -81 -17 -182 22 -51 20 -111 43 -133 52 -22 8 -53 20 -70 27 -16 7 -59 23 -95 35 -156 54 -216 76 -226 82 -6 4 -49 20 -95 36 -152 53 -209 77 -209 87 0 12 35 29 123 61 37 14 76 28 85 33 16 8 36 16 145 57 23 9 56 22 72 29 17 8 41 17 55 21 14 3 48 17 75 29 28 13 79 33 115 45 36 12 70 25 75 30 6 4 39 17 75 29 69 23 98 35 142 57 14 8 31 14 38 14 11 0 41 12 115 45 17 7 57 22 90 34 56 18 106 39 147 62 10 5 25 9 34 9 10 0 46 14 81 30 34 17 68 30 74 30 10 0 37 11 114 45 17 7 55 21 85 31 30 10 60 22 66 26 6 5 44 20 83 33 40 14 80 29 89 34 88 45 135 51 198 25z m-3478 -500 c20 -8 64 -24 97 -35 33 -11 68 -25 79 -30 10 -6 50 -21 90 -34 97 -33 137 -48 163 -63 12 -7 29 -12 37 -12 8 0 32 -7 53 -16 81 -36 100 -43 158 -60 33 -10 67 -24 76 -31 8 -7 22 -13 30 -13 14 -1 90 -26 144 -49 17 -7 45 -19 63 -27 18 -8 39 -14 47 -14 14 0 69 -21 110 -43 11 -6 33 -14 50 -18 16 -4 55 -17 85 -29 30 -11 84 -32 120 -45 36 -13 90 -33 120 -45 76 -29 181 -68 270 -99 41 -15 80 -30 87 -34 6 -4 45 -18 85 -32 40 -13 89 -31 108 -38 19 -8 50 -20 68 -26 l32 -13 0 -1409 c0 -1058 -3 -1409 -12 -1409 -11 0 -47 16 -198 87 -119 57 -192 90 -235 108 -22 9 -47 20 -55 25 -8 5 -34 18 -57 29 -36 17 -43 25 -48 58 -23 148 -75 216 -191 246 -38 10 -92 24 -120 32 -28 8 -66 15 -85 15 -19 0 -50 8 -69 19 -28 15 -39 29 -55 77 -11 32 -28 75 -37 95 -22 44 -16 68 37 144 23 34 44 67 48 75 4 8 18 33 32 55 46 76 55 103 55 173 0 61 -4 74 -31 113 -17 24 -61 72 -98 106 -54 52 -78 66 -133 83 l-67 21 -68 -32 c-37 -18 -93 -51 -123 -74 -72 -55 -161 -105 -187 -105 -12 0 -34 7 -50 15 -15 7 -50 24 -78 36 -71 31 -95 56 -95 96 0 19 -6 46 -14 61 -7 15 -17 52 -20 82 -13 97 -31 149 -70 195 -47 56 -81 75 -159 83 l-62 7 -3 845 c-1 465 0 851 3 858 6 16 28 15 73 -4z m4569 4 c11 -17 12 -369 2 -390 -8 -14 -38 -17 -251 -20 l-243 -3 -47 -28 c-84 -51 -127 -119 -137 -217 l-6 -55 -200 -6 c-230 -8 -268 -17 -370 -84 -38 -26 -125 -107 -125 -117 0 -5 -12 -27 -26 -49 -60 -95 -57 -45 -60 -1223 -2 -594 -5 -1085 -8 -1093 -3 -7 -12 -13 -21 -13 -8 0 -57 -20 -108 -45 -52 -25 -98 -45 -104 -45 -6 0 -16 -7 -23 -15 -7 -8 -19 -15 -26 -15 -8 0 -67 -25 -131 -56 -153 -72 -220 -103 -283 -128 -8 -3 -22 -11 -31 -18 -9 -6 -24 -8 -32 -5 -15 6 -16 127 -13 1404 2 769 4 1399 5 1400 8 10 77 43 91 43 10 0 21 4 24 9 3 5 43 21 88 35 45 15 87 31 93 35 5 5 42 18 80 30 39 12 89 31 113 41 23 11 76 31 116 44 41 14 82 29 92 35 11 5 46 17 79 27 33 9 69 22 80 29 11 6 45 20 75 30 30 9 66 22 80 28 79 33 205 77 223 77 7 0 18 5 24 11 10 10 47 24 233 89 62 21 83 29 160 62 19 8 62 24 95 36 145 49 205 71 227 83 10 5 48 18 85 30 38 11 86 29 108 40 47 22 61 23 72 7z m849 -603 c23 -29 24 -36 24 -189 0 -143 -2 -162 -21 -192 -14 -23 -30 -35 -52 -39 -18 -3 -310 -5 -649 -3 l-617 3 -23 23 c-22 22 -23 29 -23 201 0 176 0 180 24 205 l24 26 551 2 c303 2 593 1 644 -2 90 -5 95 -6 118 -35z m-1532 -281 c3 -9 6 -30 6 -47 0 -68 61 -177 117 -210 78 -45 110 -47 736 -47 649 1 678 3 746 58 20 16 51 51 69 78 25 39 32 59 32 99 0 87 -1 87 205 83 173 -3 182 -4 237 -31 71 -35 117 -77 159 -147 l34 -55 0 -1760 0 -1760 -24 -44 c-26 -47 -90 -116 -131 -142 -14 -9 -47 -23 -74 -32 -45 -16 -158 -17 -1255 -17 l-1206 0 -65 25 c-63 24 -160 102 -160 128 0 6 -6 18 -13 26 -8 9 -21 37 -30 62 -16 42 -17 176 -15 1765 l3 1719 33 67 c30 64 93 138 115 138 6 0 18 6 26 14 39 35 103 45 277 46 148 0 173 -2 178 -16z m-3866 -993 c12 -11 22 -25 22 -33 0 -8 7 -23 15 -34 8 -10 15 -29 15 -42 1 -62 34 -203 61 -259 29 -58 35 -65 97 -94 188 -89 256 -105 316 -74 15 8 34 15 41 15 6 0 30 13 53 30 23 16 56 37 74 47 18 10 49 30 68 44 61 45 81 49 125 28 46 -22 122 -100 130 -132 4 -12 1 -34 -5 -47 -12 -29 -32 -61 -154 -240 -27 -41 -30 -53 -30 -125 -1 -65 3 -87 21 -115 12 -19 29 -59 38 -88 33 -101 103 -158 220 -177 22 -4 57 -13 78 -21 20 -8 50 -14 65 -14 50 0 119 -29 126 -53 3 -12 6 -62 6 -110 0 -81 -2 -90 -24 -110 -14 -13 -50 -26 -88 -33 -217 -39 -265 -56 -320 -109 -34 -34 -51 -62 -68 -113 -12 -37 -30 -75 -39 -86 -22 -25 -23 -202 -1 -220 15 -11 80 -102 80 -111 0 -3 20 -34 45 -71 65 -94 63 -114 -24 -197 -47 -45 -77 -67 -93 -67 -14 0 -54 19 -89 42 -35 23 -89 58 -119 78 -94 61 -137 80 -188 80 -26 0 -56 -6 -67 -13 -11 -7 -42 -22 -70 -32 -193 -70 -229 -116 -260 -330 -11 -75 -39 -160 -60 -177 -16 -14 -40 -17 -111 -18 -128 0 -129 1 -178 252 -23 118 -28 128 -75 181 -25 28 -109 77 -131 77 -5 0 -39 13 -73 30 -103 48 -163 40 -282 -40 -103 -70 -182 -118 -202 -124 -32 -10 -74 15 -132 81 -35 39 -51 66 -51 84 0 18 30 73 85 155 47 70 90 146 96 168 13 49 5 147 -15 184 -15 27 -32 68 -57 131 -21 55 -73 98 -147 119 -68 20 -189 47 -252 57 -63 10 -74 26 -79 116 -5 121 2 144 49 163 22 9 55 16 73 16 17 1 43 7 57 15 14 8 36 14 49 15 13 0 54 7 91 16 91 22 131 60 177 167 20 45 41 88 47 96 6 8 11 53 11 106 0 74 -3 97 -17 112 -10 11 -18 22 -18 26 0 3 -19 34 -42 69 -52 76 -64 96 -77 125 -5 11 -15 24 -20 28 -6 3 -11 18 -11 33 0 21 16 43 63 89 34 33 71 65 81 71 24 12 67 -1 111 -33 17 -12 80 -51 141 -88 133 -79 160 -83 269 -38 39 16 96 40 128 52 49 19 65 33 98 79 21 30 39 65 39 77 0 12 4 33 10 48 5 14 14 49 19 78 20 109 41 172 62 190 32 25 185 24 217 -2z" />
                                <path d="M7138 4722 c-23 -26 -77 -112 -137 -215 -13 -23 -27 -44 -31 -47 -4 -3 -19 -30 -33 -60 -15 -31 -41 -70 -60 -88 l-33 -32 -37 48 c-20 26 -67 80 -105 121 -63 68 -71 74 -110 75 -80 2 -107 -69 -48 -127 13 -12 50 -53 82 -92 33 -38 71 -83 84 -99 14 -16 49 -53 78 -83 44 -44 58 -53 88 -53 24 0 37 5 41 18 3 9 18 33 32 52 30 41 47 67 61 95 6 11 18 32 28 46 15 23 113 181 145 234 7 11 29 46 50 79 43 69 46 104 14 134 -33 31 -78 29 -109 -6z" />
                                <path d="M7583 4470 c-27 -16 -33 -26 -33 -54 0 -18 8 -44 18 -56 l18 -23 655 2 c651 1 654 1 672 22 24 29 22 81 -4 105 -20 18 -48 19 -658 22 -620 2 -637 2 -668 -18z" />
                                <path d="M7142 3634 c-15 -16 -47 -60 -70 -99 -48 -79 -51 -83 -109 -177 -24 -37 -43 -71 -43 -75 0 -4 -16 -26 -35 -48 l-35 -40 -57 61 c-32 34 -82 89 -111 123 -48 55 -57 61 -92 61 -42 0 -67 -18 -76 -55 -7 -29 13 -67 72 -130 51 -55 154 -170 203 -227 37 -43 81 -57 114 -35 13 8 39 41 58 72 19 31 51 82 71 113 21 31 38 62 38 69 0 6 3 13 8 15 9 4 52 65 52 73 0 4 15 30 34 58 19 29 40 64 47 80 7 15 16 27 20 27 11 0 39 66 39 90 0 28 -32 59 -67 66 -27 5 -37 1 -61 -22z" />
                                <path d="M7587 3382 c-50 -31 -49 -95 2 -125 27 -16 78 -17 656 -17 618 0 627 0 656 21 23 16 29 28 29 59 0 31 -6 43 -29 59 -29 21 -38 21 -658 21 -577 -1 -630 -2 -656 -18z" />
                                <path d="M7122 2518 c-34 -46 -90 -135 -179 -286 -30 -50 -44 -70 -70 -101 l-23 -26 -52 55 c-29 31 -79 86 -112 123 -32 37 -69 70 -81 73 -47 12 -103 -44 -91 -91 6 -25 182 -233 277 -327 35 -36 55 -48 77 -48 39 0 63 29 167 202 44 73 95 154 113 181 18 26 37 58 43 70 5 12 25 47 44 77 37 59 42 79 24 113 -16 30 -28 37 -66 37 -27 0 -38 -8 -71 -52z" />
                                <path d="M7620 2302 c-68 -6 -93 -80 -43 -127 l28 -25 636 0 c629 0 637 0 663 21 31 25 35 76 9 108 -18 21 -21 21 -638 23 -341 2 -636 2 -655 0z" />
                            </g>

                            <g transform="translate(0.000000,900.000000) scale(0.100000,-0.100000)" stroke="none">
                                <path fill-rule="nonzero" fill="var(--color-brand-gold)" opacity="0.4"
                                    d="M2735 3625 c-187 -40 -381 -217 -442 -405 -35 -109 -35 -298 1 -403 39 -117 138 -254 211 -293 19 -10 35 -22 35 -26 0 -10 138 -74 195 -89 65 -18 247 -18 305 0 153 46 288 140 355 245 10 17 22 33 26 36 3 3 13 19 22 35 53 105 87 283 68 358 -6 25 -11 56 -11 69 0 13 -7 36 -15 52 -8 15 -15 35 -15 42 0 30 -76 150 -128 202 -69 70 -173 142 -204 142 -8 0 -20 6 -26 12 -34 34 -259 48 -377 23z" />
                            </g>
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Manage Inventory</h3>
                    </div>
                </a>

                {/* 4. View Inquiries (Subroute Navigation Anchor) */}
                <a
                    onClick={() => navigate(`/my-shops/${shopId}/inquiries`)}
                    className="group flex flex-col border-1 border-brand-gold/50 hover:border-brand-gold/20 bg-bg-primary hover:bg-brand-gold/10 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer no-underline "
                >
                    <div className="relative w-full aspect-video bg-brand-gold/10 group-hover:bg-bg-primary transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center overflow-hidden">
                        <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="1050.000000pt" height="1050.000000pt" viewBox="0 -150 1050.000000 1050.000000" preserveAspectRatio="xMidYMid meet">
                            <g transform="translate(0.000000,1050.000000) scale(0.100000,-0.100000)" fill="var(--color-brand-gold)" opacity="0.4" stroke="none">
                                <path d="M4935 9570 c-177 -27 -342 -66 -387 -91 -10 -5 -24 -9 -33 -9 -16 0 -51 -14 -165 -68 -41 -19 -88 -41 -105 -49 -39 -18 -109 -59 -163 -94 -24 -16 -45 -29 -48 -29 -3 0 -42 -28 -87 -62 -222 -167 -327 -290 -364 -428 -9 -30 -16 -98 -17 -150 l-2 -95 -67 -111 c-76 -127 -124 -235 -156 -349 -12 -44 -27 -98 -33 -120 -7 -22 -14 -124 -17 -226 -7 -209 1 -188 -103 -289 -66 -65 -146 -172 -164 -220 -3 -8 -10 -23 -15 -34 -49 -90 -78 -304 -59 -434 28 -199 109 -362 241 -488 204 -194 450 -247 662 -143 57 28 61 25 102 -76 60 -145 153 -281 284 -415 68 -70 228 -200 246 -200 3 0 21 -11 38 -24 35 -26 138 -78 202 -102 183 -68 278 -85 484 -87 l175 -1 30 37 c28 35 55 93 59 127 1 10 -6 14 -23 12 -14 -1 -81 -5 -150 -8 -177 -9 -291 7 -475 68 -264 86 -561 347 -675 591 -96 205 -102 257 -98 807 l3 435 195 6 c257 8 395 30 600 95 152 48 177 58 276 109 180 95 330 209 469 359 104 112 131 127 181 102 27 -12 41 -29 60 -74 88 -200 173 -312 324 -426 68 -50 80 -58 150 -92 30 -15 68 -36 83 -47 l28 -19 -3 -502 -4 -501 -36 -100 c-54 -151 -64 -170 -138 -270 -54 -73 -238 -263 -294 -304 -23 -16 -56 -43 -75 -60 -31 -27 -130 -71 -160 -71 -6 0 -14 -7 -17 -15 -4 -8 -12 -15 -19 -15 -20 0 -127 -122 -153 -173 -116 -232 48 -490 311 -490 72 0 154 22 188 50 8 7 19 13 22 13 13 0 122 78 162 117 78 73 107 138 103 228 -1 33 1 65 5 72 4 6 46 32 95 58 238 129 404 272 536 462 20 29 36 55 36 57 0 2 12 25 28 52 15 27 43 87 63 134 34 82 39 88 127 160 85 70 202 193 202 214 0 5 6 17 13 25 17 20 70 149 91 222 21 74 22 325 1 384 -8 22 -15 47 -15 55 0 22 -60 144 -105 215 -21 33 -72 93 -112 134 -86 88 -93 106 -93 257 0 258 -68 492 -211 729 -65 108 -72 132 -78 270 l-6 130 -47 71 c-57 85 -163 187 -318 303 -104 79 -212 151 -225 151 -3 0 -23 11 -44 24 -31 20 -137 67 -256 115 -279 112 -745 161 -1060 111z m540 -419 c137 -18 175 -26 315 -66 79 -23 171 -63 285 -125 88 -48 220 -138 303 -206 100 -83 255 -247 332 -352 167 -228 258 -462 275 -709 8 -121 7 -124 -81 -95 l-59 19 -8 49 c-44 280 -117 469 -253 661 -164 229 -409 430 -669 550 -135 62 -199 83 -357 119 -114 26 -464 31 -582 9 -296 -55 -478 -132 -736 -312 -59 -41 -166 -138 -222 -202 -211 -240 -330 -489 -379 -794 -13 -85 -9 -80 -92 -107 -54 -17 -67 -3 -67 73 0 112 38 283 89 402 22 51 81 156 141 250 97 153 246 325 379 438 147 125 288 212 451 277 30 12 69 28 86 35 55 24 276 73 379 84 55 6 114 13 130 15 83 9 205 4 340 -13z m1279 -1699 c2 -4 6 -287 7 -627 l2 -620 -24 -2 c-33 -4 -99 45 -126 92 l-23 40 2 506 3 506 27 35 c38 49 118 92 132 70z m-2959 -25 c25 -14 48 -37 60 -62 19 -38 20 -63 23 -534 2 -482 2 -495 -18 -536 -24 -51 -75 -92 -116 -97 l-29 -3 -3 615 c-1 338 0 621 3 628 7 18 35 14 80 -11z m-265 -32 c25 -30 3 -62 -67 -97 -103 -50 -174 -126 -228 -242 -32 -70 -49 -96 -63 -96 -67 0 -50 108 39 241 57 84 141 152 239 190 56 22 64 23 80 4z m3065 -1295 c18 -28 111 -62 186 -67 104 -8 107 -10 79 -69 -12 -27 -26 -58 -31 -69 -18 -41 -68 -109 -128 -177 -50 -56 -193 -161 -343 -252 l-128 -78 -42 21 c-50 25 -78 45 -78 56 0 5 41 47 91 94 81 75 209 227 209 247 0 4 6 15 14 23 22 26 71 121 101 196 15 39 29 73 32 78 6 10 31 9 38 -3z m-585 -790 c59 -30 55 -58 -17 -112 -109 -83 -272 -188 -291 -188 -35 0 -46 30 -43 113 2 65 191 205 279 206 18 1 51 -8 72 -19z" /> <path d="M5664 6950 c-35 -11 -99 -77 -114 -116 -23 -59 2 -154 49 -191 121 -96 301 -18 301 130 0 124 -119 213 -236 177z" /> <path d="M4650 6928 c-60 -41 -75 -71 -75 -152 0 -64 3 -77 28 -109 75 -98 237 -85 295 24 20 36 23 54 19 101 -9 102 -71 158 -174 158 -46 0 -68 -5 -93 -22z" /> <path d="M4827 6173 c-19 -18 10 -139 48 -199 51 -80 123 -141 207 -175 70 -29 220 -31 288 -4 147 59 242 177 264 328 6 39 5 47 -9 47 -8 0 -18 -8 -21 -17 -21 -68 -101 -161 -168 -196 -112 -59 -217 -71 -324 -37 -107 33 -205 117 -252 216 -23 47 -23 47 -33 37z" /> <path d="M4350 5019 c-19 -5 -64 -13 -100 -19 -36 -6 -85 -15 -110 -20 -25 -5 -79 -16 -120 -25 -151 -31 -204 -48 -345 -106 -289 -121 -504 -300 -680 -569 -32 -48 -125 -234 -125 -248 0 -5 -6 -22 -14 -38 -24 -49 -73 -273 -87 -394 -13 -122 -17 -430 -5 -449 5 -8 78 -11 240 -11 186 0 236 -3 245 -14 8 -10 11 -199 9 -711 -3 -676 -4 -697 -22 -711 -14 -10 -49 -14 -115 -14 -140 -1 -192 -24 -232 -102 -29 -58 -26 -181 6 -255 63 -142 201 -293 321 -352 38 -18 77 -38 87 -43 17 -8 70 -21 167 -38 25 -5 825 -9 1778 -9 1711 -1 1735 -1 1813 19 177 45 300 123 410 260 50 63 62 81 85 130 43 93 55 202 31 272 -31 87 -96 118 -251 118 -56 0 -107 4 -114 8 -10 7 -12 158 -10 723 l3 714 244 3 c148 1 249 6 257 13 8 6 11 30 8 67 -2 31 -8 145 -14 252 -12 223 -28 330 -77 485 -35 112 -105 265 -149 322 -13 17 -24 35 -24 38 0 14 -96 130 -164 198 -183 184 -372 300 -646 395 -256 89 -287 87 -359 -18 -33 -49 -39 -84 -18 -115 27 -40 139 -314 135 -331 -2 -12 -32 -28 -97 -51 -51 -18 -98 -30 -102 -27 -15 9 -10 46 8 66 22 24 22 121 1 168 -9 19 -24 57 -34 84 -11 26 -24 50 -31 53 -6 2 -40 -3 -75 -12 -35 -10 -79 -21 -98 -26 -131 -31 -264 -70 -315 -91 -169 -70 -263 -89 -455 -90 -227 -1 -371 36 -630 160 -134 64 -125 50 -126 199 0 71 -3 134 -8 141 -8 14 -44 14 -96 1z m-416 -408 c4 -5 -3 -29 -13 -54 -30 -70 -70 -153 -78 -160 -12 -13 -43 -111 -43 -139 0 -24 18 -77 41 -118 16 -29 48 -96 89 -185 62 -136 37 -125 297 -125 122 0 223 2 223 5 0 2 -18 43 -40 90 -22 47 -40 88 -40 90 0 3 -10 21 -22 40 -25 38 -47 48 -235 119 -102 38 -139 56 -151 75 -13 19 -12 22 12 32 33 15 100 0 301 -67 94 -32 125 -50 125 -74 0 -10 7 -23 15 -30 8 -7 15 -16 15 -21 0 -9 30 -78 91 -208 17 -35 28 -70 25 -77 -5 -12 -77 -14 -469 -14 -463 1 -566 -5 -607 -35 -23 -17 -72 -36 -78 -30 -3 3 0 5 6 5 7 0 12 6 12 14 0 17 41 46 100 68 36 15 76 18 206 18 88 0 163 2 166 5 3 3 -10 36 -28 73 -116 239 -144 308 -144 358 0 68 73 221 142 299 48 53 70 66 82 46z m525 -75 c6 -8 22 -16 34 -19 12 -3 45 -14 72 -25 99 -39 241 -89 290 -102 238 -61 609 -48 795 28 14 6 72 25 130 42 58 18 120 38 138 46 18 8 39 14 47 14 8 0 30 7 49 16 64 31 68 16 26 -88 -37 -92 -151 -335 -253 -537 -46 -92 -56 -106 -87 -117 -26 -9 -154 -13 -491 -13 -441 -1 -457 0 -482 19 -13 11 -28 32 -32 47 -3 15 -18 52 -32 83 -28 62 -82 176 -94 201 -4 10 -20 46 -34 80 -24 57 -72 166 -126 285 -11 22 -19 43 -19 47 0 13 57 7 69 -7z" />
                            </g> </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">View Inquiries</h3>
                    </div>
                </a>

                {/* 5. Sales History */}
                <a
                    onClick={() => navigate(`/my-shops/${shopId}/sales-history`)}
                    className="group flex flex-col border-1 border-brand-gold/50 hover:border-brand-gold/20 bg-bg-primary hover:bg-brand-gold/10 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer no-underline"
                >
                    <div className="relative w-full aspect-video bg-brand-gold/10 group-hover:bg-bg-primary transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center overflow-hidden">
                        <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="941.000000pt" height="543.000000pt" viewBox="-270 -20 941.000000 543.000000" preserveAspectRatio="xMidYMid meet">
                            <g transform="translate(0.000000,543.000000) scale(0.100000,-0.100000)" fill="var(--color-brand-gold)" opacity="0.4" stroke="none">
                                <path d="M468 4734 l-28 -15 0 -1462 0 -1462 329 -329 c181 -181 340 -335 353 -342 30 -17 2098 -20 2128 -4 51 28 44 91 -12 109 -23 7 -338 10 -1018 9 -542 -1 -991 1 -997 5 -10 6 -13 78 -13 300 0 261 -2 294 -18 314 -17 23 -20 23 -322 25 l-305 3 -3 1368 c-2 1090 0 1367 10 1367 7 0 591 0 1297 0 1014 0 1287 -3 1293 -13 4 -6 8 -292 8 -634 l0 -622 30 -16 c37 -19 35 -20 65 12 l25 28 0 650 c0 357 -3 660 -6 673 -15 53 47 51 -1425 51 -1193 0 -1367 -2 -1391 -15z m617 -3181 c0 -175 -2 -203 -15 -203 -18 0 -400 379 -400 398 0 10 44 12 208 10 l207 -3 0 -202z" /> <path d="M1826 4469 c-20 -16 -26 -29 -26 -59 0 -43 -11 -55 -59 -65 -22 -5 -52 -25 -83 -57 -48 -49 -48 -50 -48 -117 0 -59 4 -73 29 -107 49 -69 72 -78 199 -84 109 -5 115 -6 138 -33 31 -36 30 -52 -5 -88 l-29 -29 -154 0 c-168 0 -178 -3 -178 -56 0 -45 22 -58 109 -64 l76 -5 3 -40 c4 -48 26 -75 61 -75 40 0 52 13 59 66 7 47 8 49 56 66 139 49 186 199 95 303 -48 55 -82 67 -199 72 -118 6 -140 16 -140 68 0 58 19 65 179 65 181 0 226 19 201 85 -11 28 -63 46 -127 43 -53 -2 -63 6 -63 52 0 30 -6 43 -26 59 -15 12 -30 21 -34 21 -4 0 -19 -9 -34 -21z" /> <path d="M848 3429 c-12 -6 -18 -22 -18 -44 0 -69 -66 -65 1033 -65 l988 0 24 25 c29 28 31 42 9 73 l-15 22 -1002 0 c-662 -1 -1008 -4 -1019 -11z" /> <path d="M858 3174 c-22 -12 -28 -22 -28 -49 0 -66 -19 -64 709 -65 728 0 701 -3 701 66 0 66 18 65 -708 64 -547 -1 -651 -4 -674 -16z" />
                                <path d="M2785 3176 c-118 -17 -192 -40 -290 -89 -201 -100 -339 -250 -439 -477 -57 -132 -74 -378 -36 -536 57 -237 184 -417 385 -549 156 -103 308 -148 495 -149 276 0 521 116 702 334 85 102 144 223 179 368 18 75 20 107 16 237 -2 83 -10 166 -17 185 -68 193 -110 274 -185 358 -25 28 -45 55 -45 61 0 13 2 13 113 11 66 -1 94 2 112 14 27 18 33 53 15 87 -10 18 -23 19 -236 19 -222 0 -226 0 -245 -22 -17 -21 -18 -41 -18 -231 1 -207 2 -209 26 -233 28 -29 44 -30 72 -6 19 15 21 29 23 151 2 96 7 136 15 138 16 6 62 -43 116 -122 100 -145 137 -265 137 -445 0 -260 -108 -473 -322 -635 -97 -73 -200 -115 -351 -141 -106 -19 -188 -14 -322 21 -179 47 -352 181 -453 350 -84 141 -114 246 -113 404 0 186 40 309 147 456 141 194 341 309 561 322 72 5 97 10 113 25 38 36 17 90 -40 101 -14 3 -65 0 -115 -7z" /> <path d="M852 2914 c-24 -16 -29 -53 -12 -85 10 -18 27 -19 564 -19 l554 0 16 25 c15 22 15 28 2 54 -9 16 -26 31 -38 35 -13 3 -257 6 -543 6 -455 0 -523 -2 -543 -16z" /> <path d="M842 2648 c-7 -7 -12 -27 -12 -44 0 -65 -8 -64 510 -64 518 0 510 -1 510 64 0 17 -5 37 -12 44 -17 17 -979 17 -996 0z" /> <path d="M2857 2642 c-14 -16 -17 -43 -17 -174 l0 -156 -52 -44 c-29 -23 -59 -47 -66 -53 -7 -5 -18 -14 -25 -20 -7 -5 -45 -36 -85 -68 -88 -71 -108 -97 -92 -126 14 -28 46 -44 71 -36 18 6 129 91 302 231 l67 55 0 188 c0 169 -2 190 -18 204 -24 22 -65 21 -85 -1z" /> <path d="M851 2391 c-31 -20 -28 -74 4 -95 23 -15 73 -17 482 -16 512 2 513 2 513 64 0 66 8 65 -513 63 -375 -2 -470 -5 -486 -16z" /> <path d="M852 2134 c-25 -17 -31 -71 -10 -92 9 -9 119 -12 435 -12 l423 0 15 24 c15 22 15 27 1 54 -8 16 -23 32 -31 36 -9 3 -195 6 -414 6 -343 0 -400 -2 -419 -16z" />
                            </g> </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Sales History</h3>
                    </div>
                </a>

                {/* 6. Edit Shop Info (Modal Trigger) */}
                <div
                    onClick={() => triggerModalAction('Edit Shop Info')}
                    className="group  flex flex-col border-1 border-brand-gold/50 hover:border-brand-gold/20 bg-bg-primary hover:bg-brand-gold/10 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer "
                >
                    <div className="relative w-full aspect-video bg-brand-gold/10 group-hover:bg-bg-primary transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center overflow-hidden">
                        <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="942.000000pt" height="837.000000pt" viewBox="-680 -520 1942.000000 1837.000000" preserveAspectRatio="xMidYMid meet">
                            <g transform="translate(0.000000,837.000000) scale(0.100000,-0.100000)" fill="var(--color-brand-gold)" opacity="0.4" stroke="none">
                                <path d="M1220 8352 c0 -10 -6 -26 -14 -37 -28 -41 -39 -104 -45 -265 l-6 -165 -300 -6 c-297 -6 -452 -22 -478 -48 -6 -6 -19 -11 -28 -11 -9 0 -22 -7 -29 -15 -7 -8 -20 -15 -30 -15 -31 0 -113 -95 -158 -181 -48 -96 -49 -99 -57 -414 -3 -110 -9 -317 -13 -460 -9 -336 -9 -4891 0 -5180 18 -567 18 -566 47 -617 61 -110 212 -242 306 -269 42 -12 314 -14 1780 -14 2590 0 3313 4 3356 17 21 6 52 24 69 39 17 16 36 29 41 29 18 0 149 139 149 158 0 10 7 27 15 38 8 10 15 29 15 41 0 12 6 48 14 80 8 32 18 132 22 223 4 91 9 192 11 225 7 115 16 1784 9 1801 -5 13 -28 -4 -109 -84 -56 -56 -155 -153 -219 -217 l-118 -116 -1 -762 c0 -699 -6 -910 -27 -992 -6 -23 -15 -31 -43 -37 -93 -20 -478 -29 -1474 -32 -952 -2 -1104 -5 -1200 -19 -123 -19 -195 -33 -240 -49 -57 -19 -130 -32 -190 -31 -62 0 -143 17 -160 34 -5 5 -20 9 -35 9 -14 0 -43 6 -65 14 -34 11 -134 19 -405 32 -25 1 -243 5 -485 9 -242 4 -460 11 -485 15 -81 15 -123 28 -130 41 -4 6 -11 59 -16 118 -4 58 -9 126 -12 151 -9 114 -11 5443 -2 5560 6 69 14 172 18 230 5 58 14 115 20 127 7 12 12 32 12 45 1 43 51 100 100 114 25 8 52 11 60 7 8 -4 116 -10 240 -13 l225 -5 5 -115 c6 -132 28 -194 78 -222 44 -26 100 -23 145 7 55 38 70 81 77 215 l5 115 415 0 415 0 6 -120 c7 -138 23 -188 70 -227 95 -80 191 30 202 230 3 48 9 78 19 88 21 21 226 34 507 31 l216 -2 7 -95 c12 -163 38 -229 103 -262 20 -10 39 -13 58 -7 35 10 77 49 77 72 0 10 6 28 13 40 6 12 14 73 17 137 l5 115 400 0 400 0 5 -130 c4 -80 11 -141 20 -158 27 -54 128 -91 180 -64 29 14 93 105 84 118 -3 6 -1 16 5 22 6 7 12 58 13 113 l3 99 306 3 c264 2 308 0 319 -13 7 -8 20 -15 29 -15 25 0 55 -47 74 -116 15 -52 17 -120 17 -520 0 -254 3 -464 7 -467 3 -4 32 17 62 48 31 30 130 127 220 217 l163 162 -5 230 c-7 319 -33 532 -74 591 -7 11 -13 26 -13 34 0 20 -79 114 -125 147 -54 39 -105 64 -131 64 -12 0 -35 7 -50 15 -16 8 -47 15 -69 15 -22 0 -71 5 -110 11 -38 6 -194 14 -345 18 l-275 6 -5 160 c-3 101 -10 168 -17 182 -7 12 -13 33 -13 46 0 13 -9 36 -20 50 -11 14 -20 30 -20 36 0 7 -30 11 -85 11 -73 0 -85 -2 -85 -17 0 -9 -6 -24 -14 -32 -26 -31 -39 -108 -45 -271 l-6 -165 -400 0 -400 0 -6 170 c-3 94 -10 184 -16 200 -6 17 -16 49 -23 73 l-13 42 -79 0 c-60 0 -78 -3 -78 -14 0 -7 -7 -19 -15 -26 -8 -7 -15 -21 -15 -32 0 -10 -6 -31 -14 -46 -9 -17 -16 -81 -20 -177 -5 -110 -11 -154 -22 -165 -12 -12 -66 -14 -351 -12 -251 2 -341 6 -350 15 -8 8 -14 64 -18 157 -4 80 -12 161 -20 180 -7 19 -19 54 -26 78 l-12 42 -76 0 c-74 0 -76 -1 -93 -31 -10 -17 -18 -38 -18 -48 0 -9 -5 -22 -12 -29 -9 -9 -14 -71 -18 -195 l-5 -182 -415 0 -415 0 -6 155 c-7 164 -21 230 -60 292 l-24 37 -77 1 c-68 0 -78 -2 -78 -18z" /> <path d="M6445 6688 c-59 -21 -153 -86 -228 -157 -195 -187 -367 -364 -367 -378 0 -17 1176 -1183 1193 -1183 10 0 46 30 80 66 34 36 129 133 211 216 81 82 170 182 197 221 48 71 49 73 49 149 0 76 0 77 -53 155 -72 105 -110 147 -408 443 -272 271 -288 286 -389 371 -108 90 -209 125 -285 97z" /> <path d="M2360 6138 c-911 -7 -959 -11 -997 -67 -13 -19 -23 -42 -23 -52 0 -10 22 -40 48 -67 l48 -49 124 -6 c69 -3 231 -11 360 -17 214 -10 2209 -8 2310 3 73 8 136 19 148 26 30 18 62 76 62 113 0 55 -25 75 -102 82 -438 38 -786 44 -1978 34z" /> <path d="M5608 5897 c-7 -7 -57 -52 -110 -99 -96 -85 -397 -383 -1412 -1395 l-513 -512 -1009 -4 c-1106 -5 -1134 -6 -1193 -60 -27 -24 -31 -34 -31 -80 0 -79 17 -90 165 -111 103 -14 237 -16 944 -16 453 0 828 -3 833 -6 6 -4 -46 -62 -113 -129 -418 -416 -479 -484 -479 -533 0 -10 -4 -22 -9 -27 -6 -6 -14 -28 -20 -50 -31 -125 -33 -131 -71 -235 -7 -19 -15 -48 -18 -65 -2 -16 -11 -39 -18 -50 -8 -11 -14 -31 -14 -45 0 -14 -7 -34 -15 -44 -8 -11 -15 -31 -15 -45 0 -14 -7 -35 -15 -45 -8 -11 -15 -32 -15 -46 0 -14 -7 -35 -15 -46 -8 -10 -15 -31 -15 -45 0 -14 -7 -34 -15 -45 -8 -10 -15 -29 -15 -41 0 -12 -6 -37 -14 -55 -28 -68 -60 -175 -73 -243 -3 -16 -12 -39 -19 -50 -8 -11 -14 -31 -14 -45 -1 -14 -7 -36 -15 -50 -8 -14 -14 -40 -15 -58 0 -18 -6 -45 -14 -60 -8 -15 -17 -65 -21 -112 -6 -78 -5 -87 15 -113 24 -31 41 -33 102 -13 24 7 111 35 193 61 83 26 165 54 183 61 18 8 45 14 60 14 16 0 37 7 48 15 10 8 30 15 45 15 14 0 30 5 36 11 6 6 29 15 50 19 21 5 70 19 108 33 172 60 357 117 379 117 13 0 29 7 36 15 7 8 27 15 44 15 18 0 41 7 52 15 10 8 29 15 42 15 13 0 33 5 45 12 12 6 35 15 52 19 16 4 46 13 65 20 19 7 54 19 78 27 37 13 251 223 1430 1403 763 763 1419 1421 1459 1462 l72 74 -553 549 c-304 302 -570 564 -590 582 -40 35 -57 39 -78 19z m-37 -426 c58 -57 52 -87 -36 -201 -62 -80 -216 -237 -858 -878 -842 -841 -1038 -1035 -1101 -1087 -34 -27 -79 -67 -101 -87 -81 -76 -120 -108 -132 -108 -7 0 -16 -6 -20 -13 -15 -24 -64 -48 -91 -45 -17 2 -32 14 -45 36 -19 32 -19 32 6 75 14 23 46 65 71 92 25 28 46 53 46 58 0 4 24 32 53 61 73 76 275 290 333 356 180 201 1581 1597 1629 1622 11 6 39 30 62 54 45 46 120 104 136 104 5 0 27 -17 48 -39z m-2058 -3451 c20 -23 37 -46 37 -50 0 -11 -21 -26 -45 -33 -25 -7 -103 -35 -130 -46 -41 -17 -91 -33 -125 -41 -42 -10 -180 -56 -233 -78 l-38 -16 -160 160 c-162 162 -174 180 -144 220 8 10 15 30 15 44 0 14 7 36 15 50 8 14 14 37 15 52 0 15 6 42 14 60 22 55 38 101 46 141 4 21 13 44 19 50 6 6 11 23 11 37 0 14 7 35 15 46 8 10 15 28 15 40 0 11 3 24 7 28 7 6 579 -564 666 -664z" /> <path d="M1865 5058 c-170 -4 -326 -9 -345 -11 -126 -17 -135 -20 -157 -46 -15 -18 -22 -40 -23 -68 0 -39 3 -44 38 -62 26 -13 85 -24 190 -35 229 -24 2467 -24 2682 0 189 21 236 45 210 108 -28 66 -58 76 -265 86 -88 5 -248 13 -355 20 -225 13 -1517 18 -1975 8z" />
                            </g> </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Edit Shop Info</h3>
                    </div>
                </div>

                {/* 6. Edit Shop Info (Modal Trigger) */}
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeletePrompt(shopId)
                    }}
                    className="group  flex flex-col border-1 border-brand-gold/50 hover:border-brand-gold/20 bg-bg-primary hover:bg-brand-gold/10 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-bg-primary-hover cursor-pointer "
                >
                    <div className="relative w-full aspect-video bg-brand-gold/10 group-hover:bg-bg-primary transition-all duration-300 rounded-xl mb-4 shrink-0 flex items-center justify-center overflow-hidden">
                        <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="741.000000pt" height="730.000000pt" viewBox="-170 -230 942.000000 937.000000" preserveAspectRatio="xMidYMid meet">
                            <g transform="translate(0.000000,530.000000) scale(0.050000,-0.050000)" fill="var(--color-brand-gold)" opacity="0.4" stroke="none"> <path d="M4998 10102 c-27 -20 -59 -68 -71 -105 -13 -37 -78 -233 -144 -437 -308 -950 -660 -2034 -803 -2470 -87 -264 -271 -831 -411 -1260 -139 -429 -298 -920 -354 -1092 l-102 -312 -211 -12 c-1283 -72 -1924 -1506 -1119 -2504 l112 -139 -92 -104 c-226 -254 -416 -774 -355 -970 5 -15 14 -79 21 -142 l11 -115 -248 0 c-323 0 -397 -41 -362 -201 34 -153 -440 -139 4624 -139 l4508 0 49 49 c66 67 68 186 3 248 -44 41 -64 43 -430 43 -211 0 -384 8 -384 17 0 10 28 79 63 155 152 335 176 778 63 1142 -31 98 -31 106 6 157 115 163 152 231 188 346 189 602 -278 1261 -895 1263 -137 0 -210 -274 517 1955 76 234 201 618 278 855 355 1090 425 1304 539 1651 187 572 253 495 -685 799 -409 133 -766 250 -794 260 -53 18 -470 154 -1630 530 -599 194 -1234 401 -1666 542 -115 38 -169 35 -226 -10z m1212 -691 c231 -74 537 -174 680 -221 143 -47 404 -132 580 -189 324 -104 1245 -404 1892 -616 l353 -115 -119 -360 c-162 -495 -334 -1022 -586 -1800 -118 -363 -266 -817 -329 -1010 -63 -192 -189 -579 -280 -860 -91 -280 -191 -585 -221 -676 -44 -134 -140 -281 -140 -215 0 28 -256 -272 -279 -327 -22 -53 -36 -62 -98 -62 -287 -1 -615 -116 -918 -322 -80 -54 -145 -88 -145 -75 0 13 -6 18 -13 10 -7 -7 -25 4 -40 25 -49 70 -275 227 -437 304 -472 222 -1060 151 -1446 -176 -145 -124 -156 -110 -169 209 -5 140 -19 278 -30 305 -11 28 -31 86 -44 130 -113 366 -416 718 -770 891 -191 93 -186 84 -132 249 118 357 295 898 441 1350 91 281 227 699 302 930 75 231 210 645 299 920 90 275 202 617 249 760 47 143 151 463 230 710 79 248 152 473 163 502 l19 52 284 -93 c156 -52 473 -155 704 -230z m-3006 -5373 c605 -124 1034 -764 913 -1364 -26 -131 1 -194 109 -251 34 -18 103 -71 154 -117 177 -161 209 -158 420 44 449 432 1164 412 1510 -41 l49 -65 -88 -153 c-148 -260 -234 -588 -181 -691 105 -203 283 -115 361 180 214 804 1116 1251 1834 908 140 -66 261 14 251 166 -7 110 -46 146 -226 207 -66 22 -133 45 -148 50 -112 39 222 234 419 245 608 35 892 -629 458 -1072 -120 -123 -122 -149 -26 -404 120 -317 71 -781 -116 -1090 l-73 -120 -1702 -5 -1702 -5 0 146 c0 578 -464 1033 -1056 1034 -188 0 -230 -16 -275 -102 -82 -159 6 -241 277 -259 434 -28 694 -285 694 -685 l0 -144 -1608 5 -1608 5 -11 46 c-79 314 15 685 237 931 109 120 102 120 322 27 311 -131 463 -128 521 10 58 139 -2 212 -220 266 -443 111 -790 468 -883 910 -172 821 568 1558 1394 1388z" /> <path d="M5670 9001 c-74 -30 -110 -93 -191 -342 -301 -920 -299 -911 -210 -993 27 -25 59 -46 70 -46 21 0 350 -105 831 -265 422 -140 426 -137 571 312 58 177 135 413 172 523 121 361 102 412 -183 506 -562 185 -996 324 -1007 323 -7 -1 -31 -9 -53 -18z m550 -520 c182 -58 337 -111 345 -119 12 -11 -186 -650 -209 -673 -8 -8 -669 204 -707 228 -29 17 188 688 219 677 12 -5 171 -56 352 -113z" /> <path d="M7607 8351 c-73 -32 -67 -19 -277 -659 -148 -454 -172 -572 -124 -634 63 -83 180 -100 258 -39 56 44 64 66 225 566 76 240 123 355 142 355 38 0 654 -202 677 -222 19 -16 13 -35 -167 -598 l-100 -310 41 -85 c40 -82 45 -85 135 -84 147 1 170 29 266 335 34 107 110 342 170 523 159 480 181 448 -473 660 -247 80 -501 163 -564 184 -134 43 -128 43 -209 8z" /> <path d="M5040 7221 c-72 -56 -73 -231 -1 -279 42 -28 563 -207 858 -294 122 -36 121 -29 34 -268 -26 -71 -68 -197 -93 -280 -25 -82 -47 -153 -49 -156 -2 -3 -196 58 -431 136 -541 179 -576 185 -657 104 -65 -65 -76 -128 -38 -212 28 -62 74 -83 447 -203 165 -52 406 -130 535 -172 302 -99 381 -92 431 37 22 57 199 592 214 646 4 17 35 115 69 220 68 213 74 272 32 333 -16 23 -23 48 -15 56 8 8 5 12 -6 9 -27 -7 -97 14 -670 202 -521 170 -581 181 -660 121z" /> <path d="M7038 6607 c-75 -47 -77 -52 -244 -567 -205 -634 -201 -620 -176 -684 28 -73 79 -102 312 -176 110 -35 223 -73 250 -85 28 -12 59 -23 70 -24 11 -1 151 -45 310 -97 275 -91 294 -95 370 -70 l80 26 183 550 c261 779 278 723 -279 901 -211 67 -475 153 -586 191 -232 78 -222 77 -290 35z m689 -548 c120 -37 222 -79 227 -93 8 -19 -183 -637 -205 -663 -5 -6 -708 217 -727 231 -8 5 148 502 200 640 l16 44 136 -46 c75 -25 234 -76 353 -113z" /> <path d="M4486 5485 c-43 -34 -99 -172 -186 -460 -24 -79 -52 -150 -62 -156 -10 -7 -14 -19 -9 -27 5 -8 -26 -121 -70 -250 -138 -408 -150 -394 492 -601 264 -85 513 -167 554 -183 233 -87 263 -53 435 482 78 242 155 468 172 503 18 34 33 108 35 164 5 161 -14 172 -658 381 -595 193 -634 201 -703 147z m599 -497 c190 -62 348 -115 351 -118 9 -8 -197 -657 -213 -672 -7 -6 -176 43 -375 110 l-362 122 110 335 c60 184 117 335 127 335 9 0 172 -51 362 -112z" /> <path d="M6488 4874 c-71 -39 -102 -93 -168 -298 -37 -113 -115 -351 -174 -529 -167 -508 -176 -490 350 -657 195 -61 372 -120 394 -129 371 -161 587 -141 589 55 2 135 -24 150 -536 317 -260 85 -476 156 -480 159 -7 5 83 300 115 378 9 22 33 92 53 156 48 152 4 154 519 -16 516 -170 529 -172 611 -89 109 112 61 256 -104 313 -173 59 -900 295 -1009 326 -90 26 -131 30 -160 14z" /> <path d="M2185 5489 c-83 -58 -90 -96 -64 -329 27 -246 64 -329 154 -349 211 -46 269 159 163 573 -32 124 -154 174 -253 105z" /> <path d="M972 4758 c-70 -82 -68 -101 50 -383 133 -322 228 -391 368 -270 77 66 69 141 -40 399 -137 324 -254 403 -378 254z" /> <path d="M9436 4265 c-277 -297 -308 -545 -69 -545 89 0 248 161 350 354 94 178 -142 340 -281 191z" /> <path d="M689 2531 c-80 -80 -65 -149 84 -395 177 -290 254 -337 380 -228 93 79 78 165 -71 402 -180 287 -274 340 -393 221z" />
                                <path d="M9990 2145 c-52 -13 -382 -276 -398 -317 -46 -121 33 -248 154 -248 67 0 321 173 419 284 101 116 -24 318 -175 281z" />
                            </g>
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-text-main text-center">Delete Shop</h3>
                    </div>
                </div>

            </div>
            <button
                type="button"
                onClick={handleOpenCheckoutModal}
                aria-label="Someone is buying"
                title="Someone is buying"
                className="md:hidden fixed bottom-6 right-4 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-brand-gold text-white shadow-lg hover:brightness-95 transition-all duration-200 cursor-pointer active:scale-95"
            >
                <ShoppingCart size={24} strokeWidth={2.25} className="-ml-0.5" />
            </button>
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
                onClose={() => handleDeleteModalClose({ navigateBack: false })}
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
                                    onClick={() => handleDeleteModalClose({ navigateBack: false })}
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