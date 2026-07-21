import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
    setInventory,
    setInventoryLoading,
    setInventoryError,
    deleteInventoryItem as deleteInventoryItemAction
} from '~/store/inventorySlice';
import InventoryForm from '../components/InventoryForm';
import type { Item } from '~/types';
import { Modal } from '~/components';
import { X, Check, TriangleAlert } from 'lucide-react';
import { useShopInventory, useDeleteInventoryItem } from '~/api/queries';

// Generic debounce hook: returns a debounced copy of `value` that only
// updates after `delay` ms have passed without `value` changing again.
function useDebouncedValue<T>(value: T, delay = 400): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);

    return debounced;
}

export const InventoryPage = () => {
    const { shopId } = useParams<{ shopId: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isSubscribed = false

    // 1. PAGINATION SETUP: 10 items per page limit matrix footprint
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const offset = (currentPage - 1) * itemsPerPage;

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('item_name');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

    // Debounced versions — only these feed the query, so rapid clicks/typing
    // don't spam the network, but the UI itself never feels laggy
    const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);
    const debouncedSortBy = useDebouncedValue(sortBy, 300);
    const debouncedSortOrder = useDebouncedValue(sortOrder, 300);

    const { loading: isLoading, error, data } = useShopInventory({
        shopId: shopId || '',
        offset: offset,
        itemsPerPage: 10, // 👈 Required field missing in your original code
        isSubscribed: isSubscribed, // 👈 Required field missing in your original code
        search: debouncedSearchQuery || undefined,
        sortBy: debouncedSortBy || undefined,
        sortOrder: debouncedSortOrder || undefined,
    })

    const [tableLoading, setTableLoading] = useState(isLoading);
    const loadingOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


    useEffect(() => {
        if (loadingOffTimer.current) {
            clearTimeout(loadingOffTimer.current);
            loadingOffTimer.current = null;
        }

        if (isLoading) {
            // Loading started — reflect immediately
            setTableLoading(true);
        } else {
            // Loading finished — hold the loading UI a bit longer so the
            // transition feels deliberate instead of an instant content-swap
            loadingOffTimer.current = setTimeout(() => {
                setTableLoading(false);
            }, 250); // tweak to taste — 200-350ms usually feels right
        }

        return () => {
            if (loadingOffTimer.current) {
                clearTimeout(loadingOffTimer.current);
            }
        };
    }, [isLoading]);

    // 4. READ DIRECTLY FROM REDUX STORAGE CACHE FOR VIEW RENDERS
    const inventoryItems = useSelector((state: any) => state.inventory.items);
    const totalItems = useSelector((state: any) => state.inventory.totalCount);



    // 5. LIFECYCLE DATA BOUNDARY BUFFER MANAGEMENT SYNC
    useEffect(() => {
        dispatch(setInventoryLoading(isLoading));
        if (error) {
            dispatch(setInventoryError(error.message));
            return;
        }
        if (data?.getShopInventory) {
            dispatch(
                setInventory({
                    items: data.getShopInventory.items,
                    totalCount: data.getShopInventory.totalCount,
                })
            );
        }
    }, [data, isLoading, error, dispatch]);

    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);




    // 6. DELETE MUTATION IMPLEMENTATION
    const [deleteInventoryItem, { loading: isDeleting }] = useDeleteInventoryItem({
        isSubscribed: isSubscribed,
        onCompleted: () => {
            // Reuse your existing modal helper to show success
            setIsConfirmingDelete(false);
            setIsModalOpen(true);
            setIsSuccess(true);
            setModalMessage('item have been permanently deleted.');
            setSelectedItemId(null);
        },
        onError: (error) => {
            setIsConfirmingDelete(false);
            setIsModalOpen(true);
            setIsSuccess(false);
            setModalMessage(error.message || 'Failed to delete item. Please try again.');
        }
    });


    // 1. Triggered when user clicks "Delete" on the shop card
    const handleOpenDeletePrompt = (itemId: string) => {
        setSelectedItemId(itemId);
        setIsConfirmingDelete(true);
        setIsModalOpen(true);
    };

    // 2. Triggered when user clicks "Yes, Delete" inside the modal
    const handleExecuteDelete = async () => {
        if (!selectedItemId) return;

        try {
            await deleteInventoryItem({ variables: { itemId: selectedItemId } });
        } catch (err) {
            console.error(err);
        }
    };

    // 3. Extend your clean-up close handler to reset the deletion states
    const handleModalClose = () => {
        setIsModalOpen(false);
        setIsSuccess(false);
        setIsConfirmingDelete(false);
        setSelectedItemId(null);
        setModalMessage('');
    };

    useLayoutEffect(() => {
        const scrollableContainer = document.querySelector('.overflow-y-auto');
        if (scrollableContainer) {
            scrollableContainer.scrollTop = 0;
        }
    }, [currentPage]);

    // Reset to page 1 when the *debounced* search or sort actually changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, debouncedSortBy, debouncedSortOrder]);

    // Pagination bounds calculation
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const hasNextPage = offset + itemsPerPage < totalItems;
    const hasPreviousPage = offset > 0;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(value);
    };

    const getPageNumbers = () => {
        if (totalPages <= 4) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages = [];
        pages.push(1);
        let startPage = currentPage;
        if (currentPage === 1) {
            startPage = 2;
        } else if (currentPage >= totalPages - 1) {
            startPage = totalPages - 2;
        }
        if (startPage > 2) {
            pages.push('...');
        }
        pages.push(startPage);
        pages.push(startPage + 1);
        if (startPage + 1 < totalPages - 1) {
            pages.push('...');
        }
        pages.push(totalPages);
        return pages;
    };

    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

    const handleCloseInventoryModal = () => {
        setSelectedItem(null);
        setIsInventoryModalOpen(false);
    }

    const handleOpenInventoryModal = () => setIsInventoryModalOpen(true);

    const handleEditClick = (item: any) => {
        handleOpenInventoryModal();
        setSelectedItem(item);
    }


    const handleSortClick = (column: string) => {
        if (sortBy === column) {
            setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
        } else {
            setSortBy(column);
            setSortOrder('ASC');
        }
    };


    // Get sort icon for a column
    const getSortIcon = (column: string) => {
        if (sortBy !== column) return null;
        return sortOrder === 'ASC' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />;
    };

    const sortableColumns = [
        { key: 'item_name', label: 'Item Name' },
        { key: 'unit_of_measure', label: 'Unit' },
        //{ key: 'category', label: 'Category' },
        { key: 'cost_price', label: 'Cost Price' },
        { key: 'selling_price', label: 'Selling Price' },
        { key: 'stock_quantity', label: 'Stocks' },
    ];


    return (
        <div className="w-full min-h-screen text-text-main flex flex-col gap-2">
            {/* GO BACK STRIP */}
            <div className="flex justify-between items-center px-2">
                <button
                    onClick={() => navigate(-1)}
                    className="flex text-text-muted hover:text-text-main transition-colors duration-200 items-center gap-1.5 h-8 rounded-xl text-xs font-bold cursor-pointer active:scale-98"
                >
                    <ArrowLeft size={16} strokeWidth={2.5} />
                    <span>Go Back to My Shop</span>
                </button>
            </div>

            {/* CONTAINER PANEL */}
            <div className="w-full bg-bg-primary border border-border-main rounded-xl md:p-6 p-4 flex flex-col">
                {/* HEADER SECTION */}
                <div className="flex items-center justify-between pb-6 border-b border-border-sub">
                    <h1 className="text-xl font-bold tracking-tight text-text-main">Shop Inventory</h1>
                    <span className="text-xs text-text-muted font-medium bg-bg-secondary px-3 py-1.5 rounded-lg border border-border-sub">
                        {totalItems} total items
                    </span>
                </div>

                {/* SEARCH BAR */}
                <div className="mt-4 mb-4 flex gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Search by name, category, description, or barcode..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border-main bg-bg-secondary text-text-main placeholder-text-muted focus:outline-none focus:border-brand-gold transition-colors"
                        />
                    </div>
                </div>

                {/* SCROLLABLE TABLE FRAMEWORK */}
                <div className="overflow-x-auto w-full mt-2">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b border-border-sub/40 text-text-muted text-xs font-bold uppercase tracking-wider h-12">
                                {sortableColumns.map(col => (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSortClick(col.key)}
                                        className="pb-3 cursor-pointer hover:text-text-main transition-colors"
                                    >
                                        <span className="flex items-center">
                                            {col.label}
                                            {getSortIcon(col.key)}
                                        </span>
                                    </th>
                                ))}
                                <th className="pb-3 text-right pr-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className=" text-sm font-medium">
                            {tableLoading && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-gold"></div>
                                            <span className="text-text-muted">Loading inventory...</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!tableLoading && inventoryItems.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-text-muted">
                                        No items found. Try adjusting your search or filters.
                                    </td>
                                </tr>
                            )}
                            {!tableLoading && inventoryItems.map((item: Item) => (
                                <tr key={item.id} className="hover:bg-item-hover/50 transition-colors h-14">
                                    <td className="pl-2 font-bold text-text-main truncate max-w-[150px]">{item.itemName}</td>
                                    <td className="text-text-main font-semibold">{item.unitOfMeasure ? item.unitOfMeasure : '--'}</td>

                                    <td className="text-text-main font-semibold">{formatCurrency(item.costPrice)}</td>
                                    <td className="text-text-main font-semibold">{formatCurrency(item.sellingPrice)}</td>
                                    <td>
                                        <span className={`inline-flex items-center justify-center px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${item.stockQuantity <= item.reorderLevel
                                            ? 'bg-brand-red/10 border-brand-red/20 text-brand-red'
                                            : 'bg-brand-green/10 border-brand-green/20 text-brand-green'
                                            }`}>
                                            {item.stockQuantity} units
                                        </span>
                                    </td>
                                    <td className="text-right pr-4">
                                        <div className="inline-flex gap-2">
                                            <button onClick={() => handleEditClick(item)} className="h-7 px-3 text-xs font-bold rounded-md bg-brand-gold text-white hover:bg-brand-gold-hover transition-colors cursor-pointer shadow-xs">
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleOpenDeletePrompt(item.id)}
                                                className="h-7 px-3 text-xs font-bold rounded-md bg-brand-red text-white hover:bg-brand-red-hover transition-colors cursor-pointer shadow-xs"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>


                {/* 🧭 FOOTER PAGINATION BAR */}
                <div className="flex items-center justify-between pt-6 mt-4 border-t border-border-sub/60 flex-wrap gap-4">
                    <span className="text-xs text-text-muted">
                        Showing <span className="text-text-main font-semibold">{totalItems === 0 ? 0 : offset + 1}</span> to{' '}
                        <span className="text-text-main font-semibold">
                            {Math.min(offset + itemsPerPage, totalItems)}
                        </span>{' '}
                        of <span className="text-text-main font-semibold">{totalItems}</span> entries
                    </span>

                    <div className="inline-flex items-center gap-1.5">
                        <button
                            disabled={!hasPreviousPage}
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border-main hover:bg-[var(--color-bg-secondary)] text-text-sub cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            Previous
                        </button>

                        {getPageNumbers().map((page, index) => {
                            if (page === '...') {
                                return (
                                    <span
                                        key={`ellipsis-${index}`}
                                        className="md:h-8 md:w-8 h-6 w-6 flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)] select-none"
                                    >
                                        ...
                                    </span>
                                );
                            }

                            return (
                                <button
                                    key={`page-${page}`}
                                    onClick={() => setCurrentPage(page as number)}
                                    className={`md:h-8 md:w-8 h-6 w-6 text-xs font-bold rounded-md border transition-all duration-200 cursor-pointer
                                        ${currentPage === page
                                            ? 'bg-bg-primary-hover text-text-main border-border-muted shadow-xs hover:bg-bg-primary-hover'
                                            : 'bg-[var(--color-bg-primary)] border border-border-main text-text-sub hover:bg-bg-primary-hover '
                                        }`}
                                >
                                    {page}
                                </button>
                            );
                        })}

                        <button
                            disabled={!hasNextPage}
                            onClick={() => setCurrentPage((prev) => prev + 1)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border-main hover:bg-[var(--color-bg-secondary)] text-text-sub cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            Next
                        </button>
                    </div>
                </div>


            </div>

            <InventoryForm isOpen={isInventoryModalOpen} onClose={handleCloseInventoryModal} data={selectedItem} />

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
                                This action cannot be undone. Deleting this item <strong>{inventoryItems.filter((item: Item) => item.id === selectedItemId)[0].itemName}</strong> will <strong>permanently remove it</strong>.
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
                                    {isDeleting ? 'Deleting...' : 'Yes, Delete it'}
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
        </div>
    );
};