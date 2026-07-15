// Scanner Tab Component
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLazyQuery } from '@apollo/client/react';
import { SEARCH_SHOP_PRODUCTS_QUERY } from '~/api/graphql';
import { Product } from '~/types/item';
import { useDebounce } from '~/utils';
import { ImageIcon, Minus, Plus, ChevronDown } from 'lucide-react';
import { ProductScannerCamera } from './ProductScannerCamera';
import { Modal } from '~/components';
import { X, Check, XIcon } from 'lucide-react';

interface ScannerTabProps {
    shopId: string
    updateCart: () => void
}
let searchTimeoutId: ReturnType<typeof setTimeout>;
export function ScannerTab({ shopId, updateCart }: ScannerTabProps) {
    // 🚀 Component States
    // 🚀 Component States
    const [scannerStep, setScannerStep] = useState<'camera' | 'search'>('camera');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState<number | ''>(0);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // 🚀 Added state to save the camera snapshot preview URL link string
    const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);

    // Grouped alternative variants states
    const [groupedProducts, setGroupedProducts] = useState<Product[]>([]);
    const [showUnitDropdown, setShowUnitDropdown] = useState(false);

    const [searchProducts] = useLazyQuery(SEARCH_SHOP_PRODUCTS_QUERY, {
        fetchPolicy: 'network-only',
    });

    const runSearch = (text: string, isScannerCapture = false) => {
        if (!shopId || !text.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);

        if (!isScannerCapture) {
            setShowDropdown(true);
        }

        searchProducts({
            variables: {
                shopId: String(shopId),
                query: text,
                limit: 7,
                offset: 0
            }
        }).then((result: any) => {
            setIsSearching(false);
            const products = result.data?.searchShopProducts?.products || [];
            setSearchResults(products);

            if (isScannerCapture && products.length > 0) {
                const firstProduct = products[0];
                setSelectedProduct(firstProduct);

                const matchingItems = products.filter(
                    (item: Product) => item.itemName.toLowerCase() === firstProduct.itemName.toLowerCase()
                );
                setGroupedProducts(matchingItems);
                setQuantity(firstProduct.stockQuantity === 0 ? 0 : 1);
                setShowDropdown(false);
            }
        }).catch(err => {
            setIsSearching(false);
            console.error("Search failed:", err);
        });
    };

    const handleScannerCapture = (file: File, previewUrl: string, matchedName: string, unitOfMeasure: string) => {
        setCapturedImagePreview(previewUrl); // 🚀 Saves the captured thumbnail link right into local component state
        setSearchQuery(matchedName);
        setScannerStep('search');
        setGroupedProducts([]);
        setShowUnitDropdown(false);
        clearTimeout(searchTimeoutId);
        runSearch(matchedName, true);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);

        if (selectedProduct && value !== selectedProduct.itemName) {
            setSelectedProduct(null);
        }

        setGroupedProducts([]);
        setShowUnitDropdown(false);
        clearTimeout(searchTimeoutId);

        if (selectedProduct && value === selectedProduct.itemName) {
            setIsSearching(false);
            return;
        }

        searchTimeoutId = setTimeout(() => {
            runSearch(value, false);
        }, 500);
    };

    const handleSelectProduct = (product: Product) => {
        clearTimeout(searchTimeoutId);
        setSelectedProduct(product);
        setSearchQuery(product.itemName);
        setIsSearching(false);
        setShowDropdown(false);

        const matchingItems = searchResults.filter(
            (item) => item.itemName.toLowerCase() === product.itemName.toLowerCase()
        );
        setGroupedProducts(matchingItems);

        if (product.stockQuantity === 0) {
            setQuantity(0);
        } else {
            setQuantity(1);
        }
    };

    const handleUnitSelect = (productVariant: Product) => {
        setSelectedProduct(productVariant);
        setShowUnitDropdown(false);
        if (productVariant.stockQuantity === 0) {
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


    const handleAddToCart = () => {
        if (!selectedProduct || !quantity) return;

        const storageKey = `cart_items_${shopId}`;
        const existingCartRaw = localStorage.getItem(storageKey);
        let currentCart: Array<{ product: Product; quantity: number }> = [];

        try {
            if (existingCartRaw) {
                currentCart = JSON.parse(existingCartRaw);
            }
        } catch (err) {
            console.error("Failed to parse cart storage array:", err);
        }

        // Identify if the product asset is already added in local storage cache registers
        const existingItem = currentCart.find((item) => item.product.id === selectedProduct.id);
        const alreadyInCartQty = existingItem ? existingItem.quantity : 0;

        // Calculate how many more items can safely be added before exceeding limits
        const allowedRemainingQty = selectedProduct.stockQuantity - alreadyInCartQty;

        // 🚀 STAGE LIMIT VALIDATION THROW: If the new amount exceeds what is left, trigger your exact modal parameters
        if (Number(quantity) > allowedRemainingQty) {
            setIsSuccess(false); // Triggers red X asset and drops title to "Error"
            setModalMessage("Stock Limit Exceeded");
            setErrorMessage(
                `You cannot add ${quantity} units. You already have some in your cart, meaning there are only ${Math.max(0, allowedRemainingQty)} units remaining available to add.`
            );
            setIsModalOpen(true);
            return; // ⚡ Bails immediately! Leaves form inputs, counters, and dropdown states completely un-wiped
        }

        // Proceed normally if validation criteria passes smoothly
        const existingItemIndex = currentCart.findIndex((item) => item.product.id === selectedProduct.id);
        if (existingItemIndex > -1) {
            currentCart[existingItemIndex].quantity += Number(quantity);
        } else {
            currentCart.push({
                product: selectedProduct,
                quantity: Number(quantity)
            });
        }

        localStorage.setItem(storageKey, JSON.stringify(currentCart));
        updateCart()
        // Clear everything out only on a successful cart addition
        setSelectedProduct(null);
        setSearchQuery('');
        setQuantity(1);
        setSearchResults([]);
        setGroupedProducts([]);
    };

    const handleGoBackToCamera = () => {
        clearTimeout(searchTimeoutId);
        setScannerStep('camera');
        setSearchQuery('');
        setSearchResults([]);
        setSelectedProduct(null);
        setGroupedProducts([]);
        setCapturedImagePreview(null); // Resets photo canvas wrapper references
        setShowDropdown(false);
        setShowUnitDropdown(false);
    };


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
        const validatedValue = Math.max(1, Math.min(selectedProduct.stockQuantity, parsedValue));
        setQuantity(validatedValue);
    };

    const incrementQty = () => {
        if (!selectedProduct) return;
        setQuantity(prev => Math.min(selectedProduct.stockQuantity, Number(prev) + 1));
    };

    const decrementQty = () => {
        setQuantity(prev => Math.max(1, Number(prev) - 1));
    };

    return (
        <div className="flex flex-col flex-1 h-full w-full bg-bg-primary min-h-0">
            {scannerStep === 'camera' && (
                <div className="flex flex-col relative isolate flex-1 w-auto mx-2 rounded-[20px] my-2 overflow-hidden bg-bg-primary">
                    <ProductScannerCamera onCaptureComplete={handleScannerCapture} />
                </div>
            )}

            {scannerStep === 'search' && (
                <div className="flex flex-col gap-4 p-5 w-full bg-bg-primary h-full overflow-auto">

                    {/* Navigation Context Row Header containing the new preview photo asset block */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* 🚀 Renders the scanner's snapshot image reference to the left side of text */}
                            {capturedImagePreview && (
                                <img
                                    src={capturedImagePreview}
                                    alt="Captured scan item reference preview"
                                    className="w-12 h-12 object-cover rounded-lg border border-border-main flex-shrink-0 shadow-sm"
                                />
                            )}
                            <h3 className="text-sm font-semibold text-text-sub truncate">
                                {searchQuery ? `Search: "${searchQuery}"` : 'Search Products'}
                            </h3>
                        </div>
                        <button onClick={handleGoBackToCamera} className="px-3 py-1.5 text-xs bg-bg-secondary border border-border-main text-text-sub rounded-lg hover:bg-item-hover transition-colors cursor-pointer flex-shrink-0" >
                            ← Scan Again
                        </button>
                    </div>

                    {/* Search Input Box Frame Row */}
                    <div className="relative">
                        <input type="text" value={searchQuery} onChange={handleSearchChange} onFocus={() => { if (searchResults.length > 0 && !selectedProduct) { setShowDropdown(true); } }} onBlur={() => setTimeout(() => setShowDropdown(false), 200)} placeholder="Type or search products..." className="w-full px-4 py-3 border border-border-main rounded-lg text-text-main bg-bg-primary focus:outline-none focus:border-brand-gold" />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-gold"></div>
                            </div>
                        )}

                        {/* Dropdown Results Overlay Menu */}
                        {showDropdown && searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-bg-primary border border-border-main rounded-lg shadow-md max-h-64 overflow-y-auto">
                                {searchResults.map((product) => (
                                    <button key={product.id} onMouseDown={(e) => { e.preventDefault(); handleSelectProduct(product); }} className="w-full text-left px-4 py-3 hover:bg-item-hover transition-colors border-b border-border-main last:border-b-0 flex items-center justify-between gap-4 cursor-pointer" >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {product.photo ? (
                                                <img src={product.photo} alt={product.itemName} className="w-10 h-10 object-cover rounded" />
                                            ) : (
                                                <div className="w-10 h-10 bg-item-hover rounded flex items-center justify-center flex-shrink-0">
                                                    <ImageIcon size={16} className="text-text-sub" />
                                                </div>
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <div className="font-medium text-text-main truncate">{product.itemName}</div>
                                                <span className="text-xs text-text-sub truncate">
                                                    Qty: 1 {product.unitOfMeasure ? `| ${product.unitOfMeasure}` : ''}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-semibold text-brand-gold text-right flex-shrink-0">
                                            ₱{product.sellingPrice.toFixed(2)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected Product Form */}
                    {selectedProduct && (
                        <div className="border border-border-main rounded-lg p-4 bg-bg-secondary flex flex-col gap-4">
                            {/* Selling Price */}
                            <div className="flex flex-col gap-1">
                                <label className="block text-xs font-semibold text-text-sub">Selling Price</label>
                                <input type="text" value={`₱${selectedProduct.sellingPrice.toFixed(2)}`} readOnly className="w-full px-3 py-2 border border-border-main rounded-lg text-text-main bg-bg-primary opacity-70" />
                            </div>

                            {/* Available Stock */}
                            <div className="flex flex-col gap-1">
                                <label className="block text-xs font-semibold text-text-sub">Available Stock</label>
                                <input type="text" value={selectedProduct.stockQuantity} readOnly className="w-full px-3 py-2 border border-border-main rounded-lg text-text-main bg-bg-primary opacity-70" />
                            </div>

                            {/* Clickable Unit of Measure Selector Menu */}
                            <div className="relative flex flex-col gap-1 w-full">
                                <label className="block text-xs font-semibold text-text-sub">Unit of Measure</label>
                                <button type="button" disabled={groupedProducts.length <= 1} onClick={() => setShowUnitDropdown(!showUnitDropdown)} onBlur={() => setTimeout(() => setShowUnitDropdown(false), 200)} className="w-full px-3 py-2 flex items-center justify-between border border-border-main rounded-lg bg-bg-primary text-left text-text-main focus:outline-none focus:border-brand-gold disabled:opacity-70" >
                                    <span className="truncate">
                                        {selectedProduct.unitOfMeasure || 'Not specified'}
                                    </span>
                                    {groupedProducts.length > 1 && (
                                        <ChevronDown size={16} className="text-text-sub flex-shrink-0 ml-2" />
                                    )}
                                </button>

                                {/* Alternative Variant units dropdown tray panel */}
                                {showUnitDropdown && groupedProducts.length > 0 && (
                                    <div className="absolute z-20 w-full top-full mt-1 border border-border-main rounded-lg bg-bg-primary shadow-md max-h-40 overflow-y-auto">
                                        {groupedProducts.map((variant) => (
                                            <button key={variant.id} type="button" onMouseDown={(e) => { e.preventDefault(); handleUnitSelect(variant); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-item-hover transition-colors text-text-main cursor-pointer ${selectedProduct.id === variant.id ? 'bg-bg-secondary font-semibold text-brand-gold' : ''}`} >
                                                {variant.unitOfMeasure || 'Not specified'}
                                                <span className="text-xs text-text-sub ml-2">(Stock: {variant.stockQuantity})</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quantity to Buy Counter Block UI */}
                            <div className="flex flex-col gap-1">
                                <label className="block text-xs font-semibold text-text-sub">Quantity to Buy</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={handleQuantityInputChange}
                                        disabled={!selectedProduct || selectedProduct.stockQuantity === 0}
                                        min={selectedProduct?.stockQuantity === 0 ? 0 : 1}
                                        max={selectedProduct?.stockQuantity || 0}
                                        className="w-full px-4 py-2 font-semibold border border-border-main rounded-lg bg-bg-primary text-text-main focus:outline-none focus:border-brand-gold disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button type="button" onClick={decrementQty} disabled={Number(quantity) <= 1} className="p-2 h-full cursor-pointer border border-border-main rounded-lg hover:bg-item-hover disabled:opacity-50 transition-colors text-text-main" >
                                        <Minus size={16} />
                                    </button>
                                    <button type="button" onClick={incrementQty} disabled={Number(quantity) >= selectedProduct.stockQuantity} className="p-2 border cursor-pointer h-full border-border-main rounded-lg hover:bg-item-hover disabled:opacity-50 transition-colors text-text-main" >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <div className="text-xs text-text-sub mt-1">
                                    Max Available: {selectedProduct.stockQuantity}
                                </div>
                            </div>


                        </div>

                    )}
                    {
                        selectedProduct && (
                            <>
                                <div className="flex flex-col gap-1">
                                    <label className="block text-xs font-semibold text-text-sub">Subtotal</label>
                                    <input type="text" value={`₱${(selectedProduct.sellingPrice * Number(quantity)).toFixed(2)}`} readOnly className="w-full px-3 py-2 border border-border-main rounded-lg text-brand-gold font-bold bg-bg-primary opacity-70" />
                                </div>

                                <button onClick={handleAddToCart} disabled={Number(quantity) <= 0} className="w-full cursor-pointer mt-2 py-3 bg-brand-gold hover:bg-brand-gold-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" >
                                    Add to Cart
                                </button>
                            </>
                        )
                    }
                    {/* Subtotal Calculation Field */}

                    {/* Empty States / Loading Panels */}
                    {isSearching && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
                            <span className="ml-3 text-text-sub">Searching for "{searchQuery}"...</span>
                        </div>
                    )}
                    {!selectedProduct && !isSearching && searchQuery && searchResults.length === 0 && (
                        <div className="text-center py-8 text-text-sub">
                            <p>No products found matching "{searchQuery}"</p>
                            <p className="text-sm mt-2">Try scanning again or type a different name</p>
                        </div>
                    )}
                </div>
            )}

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
                    <p className="mt-2 text-lg font-bold text-text-main">{modalMessage}</p>
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
}

