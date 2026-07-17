import { useState } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import { SEARCH_SHOP_PRODUCTS_QUERY, INCREMENT_STOCK_MUTATION } from '~/api/graphql';
import { Product } from '~/types/item';
import { ImageIcon, Plus, Minus, ChevronDown } from 'lucide-react';
import { Modal } from '~/components';
import { X, Check, XIcon } from 'lucide-react';
import { on } from 'events';
interface ManualSearchTabProps {
    shopId: string;
    updateCart: () => void
}

let searchTimeoutId: ReturnType<typeof setTimeout>;

export const ManualRestockTab = ({ shopId, updateCart }: ManualSearchTabProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState<number | ''>(0);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // 🚀 Stores all alternative items sharing the exact same name
    //const [groupedProducts, setGroupedProducts] = useState<Product[]>([]);
    //const [showUnitDropdown, setShowUnitDropdown] = useState(false);

    const [searchProducts] = useLazyQuery(SEARCH_SHOP_PRODUCTS_QUERY, {
        fetchPolicy: 'network-only',
    });

    const runSearch = (text: string) => {
        if (!shopId || !text.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        setShowDropdown(true);

        searchProducts({
            variables: {
                shopId: String(shopId),
                query: text,
                limit: 7, // 🚀 Updated search capacity threshold up to 7 items
                offset: 0
            }
        }).then((result: any) => {
            setIsSearching(false);
            if (result.data?.searchShopProducts?.products) {
                setSearchResults(result.data.searchShopProducts.products);
            }
        }).catch(err => {
            setIsSearching(false);
            console.error("Search failed:", err);
        });
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);

        if (selectedProduct && value !== selectedProduct.itemName) {
            setSelectedProduct(null);
        }

        // 🚀 Typing resets both grouping states completely
        //setGroupedProducts([]);
        //setShowUnitDropdown(false);

        clearTimeout(searchTimeoutId);

        if (selectedProduct && value === selectedProduct.itemName) {
            setIsSearching(false);
            return;
        }

        searchTimeoutId = setTimeout(() => {
            runSearch(value);
        }, 500);
    };

    const handleSelectProduct = (product: Product) => {
        clearTimeout(searchTimeoutId);
        setSelectedProduct(product);
        setSearchQuery(product.itemName);
        setIsSearching(false);
        setShowDropdown(false);

        // 🚀 Filters search results to find matches with the exact same name string
        const matchingItems = searchResults.filter(
            (item) => item.itemName.toLowerCase() === product.itemName.toLowerCase()
        );
        //setGroupedProducts(matchingItems);

        if (product.stockQuantity === 0) {
            setQuantity(0);
        } else {
            setQuantity(1);
        }
    };



    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleModalClose = () => {
        setIsModalOpen(false);
    };


    const [incrementStock, { loading: isIncrementing }] = useMutation(INCREMENT_STOCK_MUTATION, {
        // Automatically refetch your dashboard charts so your "Capital Locked" ring updates live!
        onCompleted: () => {
            setIsModalOpen(true);
            setIsSuccess(true);
            setModalMessage('Stock updated successfully for' + ' ' + selectedProduct?.itemName);
        },
        awaitRefetchQueries: true,
        onError: (err) => {
            setIsModalOpen(true);
            setIsSuccess(false);
            setModalMessage('Failed to update stock. Please try again.');
            setErrorMessage(err.message);
        }
    });


    const handleAddToCart = async () => {
        if (!selectedProduct || !quantity) return;



        try {
            // 1. Fire the GraphQL mutation to update PostgreSQL stock rows
            await incrementStock({
                variables: {
                    input: {
                        itemId: selectedProduct.id,
                        quantityToAdd: parseInt(quantity.toString(), 10) // Force strict integer parsing
                    }
                }
            });

            // 2. Clear everything out only on a SUCCESSFUL network completion response
            setSelectedProduct(null);
            setSearchQuery('');
            setQuantity(1);
            setSearchResults([]);
            //setGroupedProducts([]);

            // Optional: Trigger your clean global toast success notification here!
            // toast.success(`Successfully added ${quantity} units to ${selectedProduct.itemName}`);

        } catch (err: any) {
            console.error("Failed to execute inventory increment:", err.message);
            // toast.error("Stock update failed. Please try again.");
        }
    };



    const incrementQty = () => {
        if (!selectedProduct) return;
        setQuantity(prev => Number(prev) + 1);
    };

    const decrementQty = () => {
        setQuantity(prev => Math.max(1, Number(prev) - 1));
    }

    const handleQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedProduct) return;

        const rawValue = e.target.value;

        // 🚀 ALLOW WIPE: If the user deletes everything, let it be an empty string so they can type freely
        if (rawValue === '') {
            setQuantity('');
            return;
        }

        const parsedValue = parseInt(rawValue, 10);

        // Fallback if parsing fails completely
        if (isNaN(parsedValue)) {
            setQuantity('');
            return;
        }

        // 🚀 MAX CEILING CHECK: Clamp the manual number strictly to the available database inventory limit
        setQuantity(parsedValue);
    };

    return (
        <div className="relative flex flex-col w-full h-full min-h-0 overflow-hidden text-text-main">
            <div className="flex-grow overflow-y-auto min-h-0 flex flex-col gap-4 px-5 pt-2 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

                {/* Item Name Search Component */}
                <div className="relative flex flex-col gap-1.5 w-full ">
                    <label className="block text-sm font-semibold text-text-sub">Item Name</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onFocus={() => {
                                if (searchResults.length > 0 && !selectedProduct) {
                                    setShowDropdown(true);
                                }
                            }}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                            placeholder="Search product..."
                            className="w-full px-3 py-2 border border-border-main rounded-lg bg-bg-secondary focus:outline-none focus:border-brand-gold"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-gold"></div>
                            </div>
                        )}
                    </div>

                    {/* Search Dropdown Results */}
                    {showDropdown && searchResults.length > 0 && (
                        <div className="absolute z-10 w-full top-full mt-1 bg-bg-primary border border-border-main rounded-lg shadow-md max-h-64 overflow-y-auto">
                            {searchResults.map((product) => (
                                <button
                                    key={product.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelectProduct(product);
                                    }}
                                    className="w-full cursor-pointer text-left px-4 py-3 hover:bg-item-hover transition-colors border-b border-border-main last:border-b-0 flex items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {product.photo ? (
                                            <img src={product.photo} alt={product.itemName} className="w-10 h-10 object-cover rounded" />
                                        ) : (
                                            <div className="w-10 h-10 bg-item-hover rounded flex items-center justify-center flex-shrink-0">
                                                <ImageIcon size={16} className="text-text-sub" />
                                            </div>
                                        )}
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate">{product.itemName}</span>
                                            {/* 🚀 Unit label appended directly after the Qty readout placeholder */}
                                            <span className="text-xs text-text-sub truncate">
                                                Stock: {product.stockQuantity} {product.unitOfMeasure ? `| ${product.unitOfMeasure}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-semibold text-right flex-shrink-0">
                                        ₱{product.sellingPrice.toFixed(2)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>


                {/* Quantity to Buy Stepper Counter */}
                <div className="flex flex-col gap-1.5">
                    <label className="block text-sm font-semibold text-text-sub">Quantity to Add</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={quantity}
                            onChange={handleQuantityInputChange}

                            min={selectedProduct?.stockQuantity === 0 ? 0 : 1}
                            className="w-full px-4 py-2  border border-border-main rounded-lg bg-bg-primary text-text-main focus:outline-none focus:border-brand-gold disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                            type="button"
                            onClick={decrementQty}
                            disabled={!selectedProduct || Number(quantity) <= 1}
                            className="p-2 h-full cursor-pointer border border-border-main rounded-lg hover:bg-item-hover disabled:opacity-50 transition-colors"
                        >
                            <Minus size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={incrementQty}
                            disabled={!selectedProduct}
                            className="p-2 border cursor-pointer h-full border-border-main rounded-lg hover:bg-item-hover disabled:opacity-50 transition-colors"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    {selectedProduct && (
                        <div className="text-sm text-text-sub mt-1">
                            Current Available: {selectedProduct.stockQuantity}
                        </div>
                    )}
                </div>


                {/* Add to Cart button */}
                <button
                    onClick={handleAddToCart}
                    disabled={!selectedProduct || Number(quantity) <= 0}
                    className="w-full cursor-pointer py-3 bg-brand-gold mt-auto hover:bg-brand-gold-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Add Item Stock
                </button>
            </div>

            {/* Success/Error Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                title={isSuccess ? "" : "Error"}
                subtitle=""
                isMobileVariant={false}
                maxWidth="max-w-[340px]"
                isFullScreenModal={false}
                isHeaderVisible={false}
                unsetHeight
            >
                <div className="flex flex-col items-center justify-center p-6 min-h-[200px]">
                    <div>
                        {isSuccess ? (
                            <Check className="w-8 h-8 text-brand-gold" />
                        ) : (
                            <X className="w-8 h-8 text-brand-red" />
                        )}
                    </div>
                    <p className="mt-2 text-lg font-bold text-text-main text-center">{modalMessage}</p>
                    {errorMessage && (
                        <p className="mt-2 text-sm text-text-sub text-center">{errorMessage}</p>
                    )}
                    <button
                        onClick={handleModalClose}
                        className='mt-6 p-2 px-4 bg-brand-gold hover:bg-brand-gold-hover cursor-pointer text-text-white rounded-lg transition-colors'
                    >
                        OK
                    </button>
                </div>
            </Modal>
        </div>
    );
};
