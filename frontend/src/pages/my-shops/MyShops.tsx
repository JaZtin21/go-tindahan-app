import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RootState } from "../../store/store";
import { useSelector, useDispatch } from 'react-redux';
import { Modal } from "~/components";
import { setAddShopModalOpen } from '../../store/uiSlice';
import { ShopForm } from './components/ShopForm';
import { setShops, setLoading, setError } from '~/store/myShopsSlice';
import { useQuery } from '@apollo/client/react';
import { GET_MY_SHOPS_QUERY } from '~/api/graphql/'; // Ensure GET_MY_SHOPS_QUERY uses TypedDocumentNode in its source file
import type { Shop } from '~/types/shop';
import { Plus, Store, ImageOff } from 'lucide-react';
import { useMutation } from '@apollo/client/react';
import { DELETE_SHOP_MUTATION } from '~/api/graphql';
import { Check, TriangleAlert, X, Trash2 } from 'lucide-react';
import { deleteShop as deleteShopAction } from '~/store/myShopsSlice';
import { useMyShops, useDeleteShop } from "~/api/queries";
import { SyncButton } from '~/components';

interface GetMyShopsResponse {
    getMyShops: {
        shops: Shop[];
        totalCount: number;
        hasNextPage: boolean;
    };
}


export const MyShops: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isAddShopModalOpen = useSelector((state: RootState) => state.ui.isAddShopModalOpen);
    const isSubscribed = true

    // PAGINATION SETUP: 10 items per page limit matrix footprint
    const PAGE_LIMIT = 10;
    const [offset, setOffset] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // 1. RUN APOLLO FETCH QUERY (Types inferred automatically via type inference)
    // NOTE: `refetch` is new — see useDeleteShop's onCompleted below. When
    // WRITE_TO_OFFLINE_DB_WHEN_SUBSCRIBED is false, deleting/creating/updating
    // a shop no longer touches TinyBase, so there's no reactive table
    // subscription left to auto-refresh this hook's data. refetch() closes
    // that gap by explicitly re-running the query. (When the flag is true
    // this just causes one harmless extra fetch alongside the TinyBase
    // update that was already keeping things in sync.)
    const { loading: dataLoading, error, data } = useMyShops({ limit: PAGE_LIMIT, offset, isSubscribed: isSubscribed });

    // 2. READ DIRECTLY FROM REDUX STORAGE CACHE FOR VIEW TRANSFORMS
    const loadedShops = useSelector((state: RootState) => state.myShops.shops);
    const totalCount = useSelector((state: RootState) => state.myShops.totalCount);

    console.log('Loaded Shops:', loadedShops);


    // Compute navigation parameters based on local state slices instead of flat payloads
    const hasNextPage = offset + PAGE_LIMIT < totalCount;
    const hasPreviousPage = offset > 0;

    // Control Handlers
    const handleNextPage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasNextPage) setOffset((prev) => prev + PAGE_LIMIT);
    };

    const handlePrevPage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasPreviousPage) setOffset((prev) => Math.max(0, prev - PAGE_LIMIT));
    };

    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    // Import the Apollo client mutation hook
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

    // 3. Extend your clean-up close handler to reset the deletion states
    const handleModalClose = () => {
        setIsModalOpen(false);
        setIsSuccess(false);
        setIsConfirmingDelete(false);
        setSelectedShopId(null);
        setModalMessage('');
    };


    return (
        <>
            <SyncButton isSubscribed={isSubscribed} />
            <div className="w-full min-h-screen pb-10">

                {/* 3. ERROR HANDLER BOUNDARY SAFEGUARD SUB-TRACK */}
                {error && (
                    <div className="p-4 mb-4 rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red text-xs font-semibold max-w-6xl mt-4 animate-fade-in">
                        Error fetching commercial storefront layouts: {error.message}. Please reload.
                    </div>
                )}

                {/* 3-COLUMN RESPONSIVE LAYOUT MATRIX GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4  gap-6 max-w-full mt-4">

                    {isLoading ? (
                        /* --- DESIGN A: ANIMATED SKELETON LAYOUT MAPPING (3 Items) --- */
                        Array.from({ length: 3 }).map((_, index) => (
                            <div
                                key={`skeleton-${index}`}
                                className="flex flex-col bg-bg-primary rounded-2xl p-5 shadow-xs transition-shadow hover:shadow-sm animate-pulse"
                            >
                                <div className="w-full aspect-square bg-bg-secondary rounded-xl mb-4" />
                                <div className="flex-1 mb-6 space-y-2">
                                    <div className="h-4 w-1/2 bg-bg-secondary rounded-md" />
                                    <div className="h-3 w-3/4 bg-bg-secondary rounded-md" />
                                </div>
                                <div className="flex items-center justify-center gap-2.5 w-full">
                                    <div className="h-8 w-16 bg-bg-secondary rounded-lg w-full" />

                                </div>
                            </div>
                        ))
                    ) : loadedShops.length === 0 ? (
                        /* --- FALLBACK: EMPTY STATE BOUNDARY DISPLAY CONTAINER --- */
                        <div className="flex flex-col h-[500px] align-center p-9 text-center justify-center bg-bg-primary rounded-2xl shadow-xs transition-shadow hover:shadow-sm "
                        >
                            <Store className="self-center text-brand-gold md:h-18 md:w-18 h-10 w-10 " />
                            <p className="text-lg font-bold text-text-main mb-2">No Shops Added Yet</p>
                            <p className="text-md font-medium text-text-muted mb-4">You have not created any commercial storefront entries yet.</p>
                            <button
                                onClick={() => dispatch(setAddShopModalOpen(true))}
                                className="py-4 px-4 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-text-white text-xs font-bold cursor-pointer"
                            >
                                Click to Add Your First Shop
                            </button>
                        </div>
                    ) : (
                        /* --- DESIGN B: DYNAMIC COMPONENT STATISTIC CARD DISPLAY GRID --- */
                        loadedShops.map((shop) => (
                            <div
                                key={shop.id}
                                onClick={() => navigate(`/my-shops/${shop.id}`)}
                                className="group flex flex-col bg-bg-primary rounded-2xl shadow-xs transition-all duration-300 hover:shadow-md cursor-pointer overflow-hidden relative aspect-square w-full"
                            >
                                {/* 1. Core Background Image Asset */}
                                <div className="absolute inset-0 w-full h-full shrink-0 z-0">
                                    {shop.photo ? (
                                        <img
                                            src={typeof shop?.photo === 'string' ? shop.photo : ''}
                                            alt={shop.shopName}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-text-muted group-hover:scale-105 transition-transform duration-500 flex items-center justify-center flex-col gap-2 text-text-white text-xs font-semibold bg-bg-secondary-hover">

                                            <ImageOff className="h-6 w-6" />
                                            No Cover Photo
                                        </div>
                                    )}
                                </div>

                                {/* 2. Top Right Destructive Action (Delete Button)       */}

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenDeletePrompt(shop.id!)
                                    }}
                                    className="absolute top-3 right-3 z-20 h-7 px-0.5 rounded-lg bg-brand-red/70 border-2 border-brand-red hover:bg-brand-red-hover active:scale-95 transition-all text-[11px] font-bold text-text-white cursor-pointer"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                                {/* 3. Dark Bottom Gradient Shadow Vignette */}
                                <div className="absolute -inset-1 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none" />

                                {/* 4. Bottom Content Card Layout Wrap */}
                                <div className="absolute bottom-0 inset-x-0 p-8 z-20 flex flex-col gap-3">
                                    {/* Text Information Metadata Labels */}
                                    <div className="w-full mb-2">
                                        <h3 className="text-md font-bold text-text-white mb-0.5 truncate">
                                            {shop.shopName}
                                        </h3>
                                        <p className="text-sm font-medium text-text-sub-white line-clamp-2">
                                            {shop.address}
                                        </p>
                                    </div>

                                    {/* Primary Single Stretched Action Control Target */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/my-shops/${shop.id}`);
                                        }}
                                        className="w-full h-9 backdrop-blur-sm rounded-full bg-bg-primary dark:bg-bg-secondary dark:border dark:border-text-white/40 hover:bg-bg-primary-hover active:scale-98 transition-all text-xs font-bold text-text-main cursor-pointer flex items-center justify-center "
                                    >
                                        Manage
                                    </button>
                                </div>
                            </div>

                        ))
                    )}
                    <div className={`flex ${loadedShops.length === 0 ? "hidden" : ""} flex-col align-center p-9 text-center justify-center bg-bg-primary rounded-2xl shadow-xs transition-shadow hover:shadow-sm`}>
                        <Plus className="self-center text-brand-gold md:h-18 md:w-18 h-10 w-10 " />
                        <p className="text-lg font-bold text-text-main mb-2">Add Another Shop</p>
                        <p className="text-md font-medium text-text-muted mb-4">create your next shop</p>
                        <button
                            onClick={() => dispatch(setAddShopModalOpen(true))}
                            className="py-4 px-4 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-text-white text-xs font-bold cursor-pointer"
                        >
                            Add Shop
                        </button>
                    </div>
                </div>

                {/* 4. INTEGRATED FOOTER CONTROL STRIP STRATEGY */}
                {!isLoading && totalCount > PAGE_LIMIT && (
                    <div className="flex items-center justify-between max-w-6xl mt-8 px-2">
                        <span className="text-xs font-semibold text-text-muted">
                            Showing <strong className="text-text-main">{offset + 1}-{Math.min(offset + PAGE_LIMIT, totalCount)}</strong> of <strong className="text-text-main">{totalCount}</strong> blueprints
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                disabled={!hasPreviousPage}
                                onClick={handlePrevPage}
                                className="h-8 px-3 rounded-lg border border-bg-secondary bg-bg-primary text-xs font-bold text-text-main disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all hover:bg-bg-secondary-hover"
                            >
                                Previous
                            </button>
                            <button
                                disabled={!hasNextPage}
                                onClick={handleNextPage}
                                className="h-8 px-3 rounded-lg border border-bg-secondary bg-bg-primary text-xs font-bold text-text-main disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all hover:bg-bg-secondary-hover"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}

            </div >
            <Modal
                isOpen={isModalOpen}
                onClose={handleModalClose}
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
                                    onClick={handleModalClose}
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
                                onClick={handleModalClose}
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

            <Modal
                isOpen={isAddShopModalOpen}
                onClose={() => dispatch(setAddShopModalOpen(false))}
                title="Create New Shop"
                subtitle="Setup your commercial storefront blueprint"
            >
                <ShopForm />
            </Modal>
        </>
    );
};