// Scanner Tab Component
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLazyQuery } from '@apollo/client/react';
import { SEARCH_SHOP_PRODUCTS_QUERY } from '~/api/graphql';
import { Product } from '~/types/item';
import { useDebounce } from '~/utils';
import { ImageIcon } from 'lucide-react';
import { ProductScannerCamera } from './ProductScannerCamera';


interface ScannerTabProps {
    shopId: string
    addToCart: (product: Product, quantity: number) => void
}

export function ScannerTab({ shopId, addToCart }: ScannerTabProps) {
    const [scannerStep, setScannerStep] = useState<'camera' | 'search'>('camera');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [searchProducts] = useLazyQuery(SEARCH_SHOP_PRODUCTS_QUERY);

    // Search effect
    useEffect(() => {
        if (debouncedSearchQuery.trim() && shopId) {
            setIsSearching(true);
            searchProducts({
                variables: {
                    shopId,
                    query: debouncedSearchQuery,
                    limit: 5,
                    offset: 0
                }
            }).then(result => {
                setIsSearching(false);
                if (result.data?.searchShopProducts?.products) {
                    setSearchResults(result.data.searchShopProducts.products);
                    setShowDropdown(true);
                }
            }).catch(err => {
                setIsSearching(false);
                console.error("Search failed:", err);
            });
        } else {
            setSearchResults([]);
            setShowDropdown(false);
        }
    }, [debouncedSearchQuery, shopId, searchProducts]);

    const handleScannerCapture = (file: File, previewUrl: string, matchedName: string, unitOfMeasure: string) => {
        setSearchQuery(matchedName);
        setScannerStep('search');
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        if (selectedProduct && value !== selectedProduct.itemName) {
            setSelectedProduct(null);
        }
    };

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSearchQuery(product.itemName);
        setShowDropdown(false);
        setQuantity(1);
    };

    const handleAddToCart = () => {
        if (!selectedProduct) return;
        addToCart(selectedProduct, quantity);
        setSelectedProduct(null);
        setSearchQuery('');
        setQuantity(1);
        setSearchResults([]);
        setScannerStep('camera');
    };

    const handleGoBackToCamera = () => {
        setScannerStep('camera');
        setSearchQuery('');
        setSearchResults([]);
        setSelectedProduct(null);
        setShowDropdown(false);
    };

    return (
        <div className="flex flex-col flex-1 h-full w-full bg-bg-secondary min-h-0">
            {scannerStep === 'camera' && (
                <div className="flex flex-col relative isolate flex-1 w-auto mx-2 rounded-[20px] my-2 overflow-hidden bg-bg-secondary">
                    <ProductScannerCamera onCaptureComplete={handleScannerCapture} />
                </div>
            )}

            {scannerStep === 'search' && (
                <div className="flex flex-col gap-4 p-5 w-full bg-bg-primary h-full overflow-auto">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-text-sub">
                            {searchQuery ? `Search: "${searchQuery}"` : 'Search Products'}
                        </h3>
                        <button
                            onClick={handleGoBackToCamera}
                            className="px-3 py-1.5 text-xs bg-bg-secondary border border-border-main text-text-sub rounded-lg hover:bg-item-hover transition-colors"
                        >
                            ← Scan Again
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onFocus={() => {
                                if (searchResults.length > 0) {
                                    setShowDropdown(true);
                                }
                            }}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                            placeholder="Type or search products..."
                            className="w-full px-4 py-3 border border-border-main rounded-lg text-text-main bg-bg-primary focus:outline-none focus:border-brand-gold"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-gold"></div>
                            </div>
                        )}

                        {/* Dropdown Results */}
                        {showDropdown && searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-bg-secondary border border-border-main rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                {searchResults.map((product) => (
                                    <button
                                        key={product.id}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectProduct(product);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-item-hover transition-colors border-b border-border-main last:border-b-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            {product.photo ? (
                                                <img
                                                    src={product.photo}
                                                    alt={product.itemName}
                                                    className="w-8 h-8 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 bg-item-hover rounded flex items-center justify-center">
                                                    <ImageIcon size={14} className="text-text-sub" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-text-main truncate">{product.itemName}</div>
                                                {product.category && (
                                                    <div className="text-xs text-text-sub mt-1 truncate">{product.category}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-sm font-semibold text-brand-gold">
                                                ₱{product.sellingPrice.toFixed(2)}
                                            </span>
                                            <span className="text-xs text-text-sub">
                                                Stock: {product.stockQuantity}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected Product Form */}
                    {selectedProduct && (
                        <div className="border border-border-main rounded-lg p-4 bg-bg-secondary">
                            <h3 className="font-bold text-text-main mb-3">Selected Product</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-text-sub mb-1">Item Name</label>
                                    <input
                                        type="text"
                                        value={selectedProduct.itemName}
                                        readOnly
                                        className="w-full px-3 py-2 border border-border-main rounded-lg text-text-main bg-bg-primary opacity-70"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-text-sub mb-1">Selling Price</label>
                                    <input
                                        type="text"
                                        value={`₱${selectedProduct.sellingPrice.toFixed(2)}`}
                                        readOnly
                                        className="w-full px-3 py-2 border border-border-main rounded-lg text-text-main bg-bg-primary opacity-70"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-text-sub mb-1">Available Stock</label>
                                    <input
                                        type="text"
                                        value={selectedProduct.stockQuantity}
                                        readOnly
                                        className="w-full px-3 py-2 border border-border-main rounded-lg text-text-main bg-bg-primary opacity-70"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-text-sub mb-1">Unit of Measure</label>
                                    <input
                                        type="text"
                                        value={selectedProduct.unitOfMeasure || 'Not specified'}
                                        readOnly
                                        className="w-full px-3 py-2 border border-border-main rounded-lg text-text-main bg-bg-primary opacity-70"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-text-sub mb-1">Quantity to Buy</label>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => {
                                            const value = parseInt(e.target.value) || 0;
                                            setQuantity(Math.max(1, Math.min(selectedProduct.stockQuantity, value)));
                                        }}
                                        min="1"
                                        max={selectedProduct.stockQuantity}
                                        className="w-full px-3 py-2 border border-border-main rounded-lg text-text-main bg-bg-primary focus:outline-none focus:border-brand-gold"
                                    />
                                    <div className="text-xs text-text-sub mt-1">
                                        Max: {selectedProduct.stockQuantity}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-text-sub mb-1">Subtotal</label>
                                    <input
                                        type="text"
                                        value={`₱${(selectedProduct.sellingPrice * quantity).toFixed(2)}`}
                                        readOnly
                                        className="w-full px-3 py-2 border border-border-main rounded-lg text-brand-gold font-bold bg-bg-primary opacity-70"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleAddToCart}
                                className="w-full mt-4 py-3 bg-brand-gold hover:bg-brand-gold-hover text-white font-semibold rounded-lg transition-colors"
                            >
                                Add to Cart
                            </button>
                        </div>
                    )}

                    {/* Empty States */}
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
        </div>
    );
}
