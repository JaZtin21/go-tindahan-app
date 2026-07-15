import { useState } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { SEARCH_SHOP_PRODUCTS_QUERY } from '~/api/graphql';
import { Product } from '~/types/item';
import { ImageIcon, Plus, Minus, ChevronDown } from 'lucide-react';

interface ManualSearchTabProps {
    shopId: string;
    addToCart: (product: Product, quantity: number) => void;
}

let searchTimeoutId: ReturnType<typeof setTimeout>;

export const ManualSearchTab = ({ shopId, addToCart }: ManualSearchTabProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // 🚀 Stores all alternative items sharing the exact same name
    const [groupedProducts, setGroupedProducts] = useState<Product[]>([]);
    const [showUnitDropdown, setShowUnitDropdown] = useState(false);

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
        }).then(result => {
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
        setGroupedProducts([]);
        setShowUnitDropdown(false);

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

    const handleAddToCart = () => {
        if (!selectedProduct) return;
        addToCart(selectedProduct, quantity);
        setSelectedProduct(null);
        setSearchQuery('');
        setQuantity(1);
        setSearchResults([]);
        setGroupedProducts([]); // Clear grouping arrays upon successful cart staging
    };

    const incrementQty = () => {
        if (!selectedProduct) return;
        setQuantity(prev => Math.min(selectedProduct.stockQuantity, prev + 1));
    };

    const decrementQty = () => {
        setQuantity(prev => Math.max(1, prev - 1));
    };

    return (
        <div className="flex flex-col gap-5 w-full  mx-6 my-4 text-text-main">
            <div className="flex flex-col gap-5 w-full h-full mb-4">

                {/* Item Name Search Component */}
                <div className="relative flex flex-col gap-4 w-full">
                    <label className="block text-xs font-semibold text-text-sub">Item Name</label>
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
                            className="w-full px-3 py-2 border border-border-main rounded-lg bg-bg-primary focus:outline-none focus:border-brand-gold"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-gold"></div>
                            </div>
                        )}
                    </div>

                    {/* Search Dropdown Results */}
                    {showDropdown && searchResults.length > 0 && (
                        <div className="absolute z-10 w-full top-full mt-1 bg-bg-secondary border border-border-main rounded-lg shadow-lg max-h-64 overflow-y-auto">
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
                                                Qty: 1 {product.unitOfMeasure ? `| ${product.unitOfMeasure}` : ''}
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

                {/* Selling Price */}
                <div className="flex flex-col gap-1">
                    <label className="block text-xs font-semibold text-text-sub">Selling Price</label>
                    <input
                        type="text"
                        value={selectedProduct ? `₱${selectedProduct.sellingPrice.toFixed(2)}` : '₱0.00'}
                        readOnly
                        className="w-full px-3 py-2 border border-border-main rounded-lg bg-bg-primary opacity-70"
                    />
                </div>

                {/* Available Stock */}
                <div className="flex flex-col gap-1">
                    <label className="block text-xs font-semibold text-text-sub">Available Stock</label>
                    <input
                        type="text"
                        value={selectedProduct ? selectedProduct.stockQuantity : 0}
                        readOnly
                        className="w-full px-3 py-2 border border-border-main rounded-lg bg-bg-primary opacity-70"
                    />
                </div>

                {/* 🚀 Clickable Unit of Measure Dropdown Selection Component */}
                <div className="relative flex flex-col gap-1 w-full">
                    <label className="block text-xs font-semibold text-text-sub">Unit of Measure</label>
                    <button
                        type="button"
                        disabled={!selectedProduct || groupedProducts.length <= 1}
                        onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                        onBlur={() => setTimeout(() => setShowUnitDropdown(false), 200)}
                        className="w-full px-3 py-2 flex items-center justify-between border border-border-main rounded-lg bg-bg-primary text-left focus:outline-none focus:border-brand-gold disabled:opacity-70"
                    >
                        <span className="truncate">
                            {selectedProduct ? (selectedProduct.unitOfMeasure || 'Not specified') : '—'}
                        </span>
                        {selectedProduct && groupedProducts.length > 1 && (
                            <ChevronDown size={16} className="text-text-sub flex-shrink-0 ml-2" />
                        )}
                    </button>

                    {/* Unit Options Panel overlay */}
                    {showUnitDropdown && groupedProducts.length > 0 && (
                        <div className="absolute z-20 w-full top-full mt-1 border border-border-main rounded-lg shadow-md max-h-40 overflow-y-auto">
                            {groupedProducts.map((variant) => (
                                <button
                                    key={variant.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleUnitSelect(variant);
                                    }}
                                    className={`w-full bg-bg-secondary text-left px-4 py-2 text-sm hover:bg-item-hover transition-colors ${selectedProduct?.id === variant.id ? 'bg-item-hover font-semibold text-brand-gold' : ''
                                        }`}
                                >
                                    {variant.unitOfMeasure || 'Not specified'}
                                    <span className="text-xs text-text-sub ml-2">(Stock: {variant.stockQuantity})</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quantity to Buy Stepper Counter */}
                <div className="flex flex-col gap-1">
                    <label className="block text-xs font-semibold text-text-sub">Quantity to Buy</label>
                    <div className="flex items-center gap-2">
                        <div className="w-full px-4 text-text-muted font-semibold py-2 border border-border-main rounded-lg bg-bg-primary">
                            {quantity}
                        </div>
                        <button
                            type="button"
                            onClick={decrementQty}
                            disabled={!selectedProduct || quantity <= 1}
                            className="p-2 h-full cursor-pointer border border-border-main rounded-lg hover:bg-item-hover disabled:opacity-50 transition-colors"
                        >
                            <Minus size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={incrementQty}
                            disabled={!selectedProduct || quantity >= selectedProduct.stockQuantity}
                            className="p-2 border cursor-pointer h-full border-border-main rounded-lg hover:bg-item-hover disabled:opacity-50 transition-colors"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    {selectedProduct && (
                        <div className="text-xs text-text-sub mt-1">
                            Max Available: {selectedProduct.stockQuantity}
                        </div>
                    )}
                </div>

                {/* Subtotal */}
                <div className="flex flex-col gap-1">
                    <label className="block text-xs font-semibold text-text-sub">Subtotal</label>
                    <input
                        type="text"
                        value={selectedProduct ? `₱${(selectedProduct.sellingPrice * quantity).toFixed(2)}` : '₱0.00'}
                        readOnly
                        className="w-full px-3 py-2 border bg-bg-secondary border-border-main rounded-lg text-brand-gold font-bold bg-bg-primary opacity-70"
                    />
                </div>

                {/* Add to Cart button */}
                <button
                    onClick={handleAddToCart}
                    disabled={!selectedProduct || quantity <= 0}
                    className="w-full cursor-pointer mt-auto py-3 bg-brand-gold hover:bg-brand-gold-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Add to Cart
                </button>
            </div>
        </div>
    );
};
