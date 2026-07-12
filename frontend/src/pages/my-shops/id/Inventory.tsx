import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useDispatch, useSelector } from 'react-redux';
import {
    setInventory,
    setInventoryLoading,
    setInventoryError,
    deleteInventoryItem as deleteInventoryItemAction
} from '~/store/inventorySlice';
import { DELETE_INVENTORY_ITEM_MUTATION, GET_SHOP_INVENTORY_QUERY } from '~/api/graphql';
import InventoryForm from '../components/InventoryForm';

export const InventoryPage = () => {
    const { shopId } = useParams<{ shopId: string }>();

    const navigate = useNavigate();
    const dispatch = useDispatch();

    // 1. PAGINATION SETUP: 10 items per page limit matrix footprint
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const offset = (currentPage - 1) * itemsPerPage;



    // 2. RUN APOLLO FETCH QUERY
    const { loading: isLoading, error, data }: any = useQuery(GET_SHOP_INVENTORY_QUERY, {
        variables: { shopId: shopId, limit: itemsPerPage, offset: offset },
        fetchPolicy: 'no-cache',
        skip: !shopId
    });

    // 3. READ DIRECTLY FROM REDUX STORAGE CACHE FOR VIEW RENDERS
    const inventoryItems = useSelector((state: any) => state.inventory.items);
    const totalItems = useSelector((state: any) => state.inventory.totalCount);

    // 4. LIFECYCLE DATA BOUNDARY BUFFER MANAGEMENT SYNC
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

    // 5. DELETE MUTATION IMPLEMENTATION
    const [deleteInventoryItem] = useMutation(DELETE_INVENTORY_ITEM_MUTATION, {
        refetchQueries: ['GetShopInventory'],
        onError: (err) => alert(err.message || 'Failed to delete item.')
    });

    const handleDeleteClick = async (itemId: string, name: string) => {
        const confirmDelete = window.confirm(`Are you sure you want to permanently delete "${name}" and remove its files?`);
        if (!confirmDelete) return;

        try {
            await deleteInventoryItem({ variables: { itemId } });
            dispatch(deleteInventoryItemAction(itemId)); // Instant client-side strip filter
        } catch (err) {
            console.error(err);
        }
    };

    useLayoutEffect(() => {
        const scrollableContainer = document.querySelector('.overflow-y-auto');
        if (scrollableContainer) {
            scrollableContainer.scrollTop = 0;
        }
    }, [currentPage]);


    // Pagination bounds calculation
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const hasNextPage = offset + itemsPerPage < totalItems;
    const hasPreviousPage = offset > 0;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2
        }).format(value);
    };
    const getPageNumbers = () => {
        // If there are 4 or fewer total pages, just show them all directly without dots
        if (totalPages <= 4) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const pages = [];

        // 1. Always anchor the absolute first page
        pages.push(1);

        // 2. Calculate the start of our 2-number sliding window
        let startPage = currentPage;

        // Adjust bounds if we are too close to the edges
        if (currentPage === 1) {
            startPage = 2;
        } else if (currentPage >= totalPages - 1) {
            startPage = totalPages - 2;
        }

        // 3. Add leading dots if the window is pushed away from page 1
        if (startPage > 2) {
            pages.push('...');
        }

        // 4. Push the 2 active sliding window numbers
        pages.push(startPage);
        pages.push(startPage + 1);

        // 5. Add trailing dots if there is a gap before the last page
        if (startPage + 1 < totalPages - 1) {
            pages.push('...');
        }

        // 6. Always anchor the absolute final page
        pages.push(totalPages);

        return pages;
    };


    const [selectedItem, setSelectedItem] = useState(null);
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


    return (
        <div className="w-full min-h-screen text-text-main flex flex-col">
            {/* GO BACK STRIP */}
            <div className="flex justify-between items-center px-2">
                <button
                    onClick={() => navigate(-1)}
                    className="flex text-text-muted hover:text-text-main transition-colors duration-200 items-center gap-1.5 h-8 rounded-xl text-xs font-bold cursor-pointer active:scale-98"
                >
                    <ArrowLeft size={16} strokeWidth={2.5} />
                    <span>Go Back to My Shops</span>
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

                {/* SCROLLABLE TABLE FRAMEWORK */}
                <div className="overflow-x-auto w-full mt-4">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b border-border-sub/40 text-text-muted text-xs font-bold uppercase tracking-wider h-12">
                                <th className="pb-3 pl-2">Item Name</th>
                                <th className="pb-3">Category</th>
                                <th className="pb-3">Price</th>
                                <th className="pb-3">Stock</th>
                                <th className="pb-3">Description</th>
                                <th className="pb-3 text-right pr-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-sub/20 text-sm font-medium">
                            {inventoryItems.map((item: any) => (
                                <tr key={item.id} className="hover:bg-item-hover/30 transition-colors h-14">
                                    <td className="pl-2 font-bold text-text-main truncate max-w-[150px]">{item.itemName}</td>
                                    <td className="text-text-muted">{item.category || '-'}</td>
                                    <td className="text-text-main font-semibold">{formatCurrency(item.sellingPrice)}</td>
                                    <td>
                                        <span className={`inline-flex items-center justify-center px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${item.stockQuantity <= item.reorderLevel
                                            ? 'bg-brand-red/10 border-brand-red/20 text-brand-red'
                                            : 'bg-brand-green/10 border-brand-green/20 text-brand-green'
                                            }`}>
                                            {item.stockQuantity} units
                                        </span>
                                    </td>
                                    <td className="text-text-muted truncate max-w-[180px]">{item.description || '-'}</td>
                                    <td className="text-right pr-4">
                                        <div className="inline-flex gap-2">
                                            <button onClick={() => handleEditClick(item)} className="h-7 px-3 text-xs font-bold rounded-md bg-brand-gold text-white hover:bg-brand-gold-hover transition-colors cursor-pointer shadow-xs">
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(item.id, item.itemName)}
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
                        {/* Previous Navigation Action */}
                        <button
                            disabled={!hasPreviousPage}
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border-main hover:bg-[var(--color-bg-secondary)] text-text-sub cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            Previous
                        </button>

                        {/* Dynamic Truncated Pages Window Loops */}
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

                        {/* Next Navigation Action */}
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
        </div>
    );
};
