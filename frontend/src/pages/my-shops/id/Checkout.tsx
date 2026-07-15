import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from "~/components";
import { useParams } from 'react-router-dom';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import { SEARCH_SHOP_PRODUCTS_QUERY, DECREMENT_STOCK_MUTATION } from '~/api/graphql';
import { Check, X, ChevronLeft, Search, ShoppingCart, Trash2, Image as ImageIcon } from 'lucide-react';
import { ProductScannerCamera } from '../components';
import { useDebounce } from '~/utils';
import { ManualSearchTab, ScannerTab } from '../components';


import type { Product, CartItem } from "~/types/item";


export default function Checkout({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<'manual' | 'scanner' | 'checkout'>('manual');
    const { id: shopId } = useParams<{ id: string }>();

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [decrementStock] = useMutation(DECREMENT_STOCK_MUTATION);

    const addToCart = (product: Product, quantity: number) => {
        if (quantity <= 0 || quantity > product.stockQuantity) {
            openModal({
                isSuccess: false,
                message: 'Invalid quantity',
                error: `Quantity must be between 1 and ${product.stockQuantity}`
            });
            return;
        }

        const existingItem = cart.find(item => item.id === product.id);

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stockQuantity) {
                openModal({
                    isSuccess: false,
                    message: 'Not enough stock',
                    error: `Only ${product.stockQuantity} items available`
                });
                return;
            }

            setCart(cart.map(item =>
                item.id === product.id
                    ? { ...item, quantity: newQuantity }
                    : item
            ));
        } else {
            setCart([...cart, {
                id: product.id,
                itemName: product.itemName,
                sellingPrice: product.sellingPrice,
                stockQuantity: product.stockQuantity,
                quantity,
                unitOfMeasure: product.unitOfMeasure,
                photo: product.photo
            }]);
        }

        openModal({ isSuccess: true, message: 'Item added to cart' });
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.id !== productId));
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (item.sellingPrice * item.quantity), 0);
    };

    const handleCheckout = async () => {
        if (cart.length === 0) {
            openModal({ isSuccess: false, message: 'Cart is empty', error: 'Please add items to cart first' });
            return;
        }

        try {
            for (const item of cart) {
                await decrementStock({
                    variables: {
                        input: {
                            itemId: item.id,
                            quantityToRemove: item.quantity
                        }
                    }
                });
            }

            openModal({ isSuccess: true, message: 'Checkout successful! Stock updated.' });
            setCart([]);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err: any) {
            console.error("Checkout failed:", err);
            openModal({ isSuccess: false, message: 'Checkout failed', error: err.message });
        }
    };

    const openModal = ({ isSuccess, message, error }: { isSuccess: boolean, message: string, error?: string }) => {
        setIsModalOpen(true);
        setIsSuccess(isSuccess);
        setModalMessage(message);
        setErrorMessage(error || '');
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setIsSuccess(false);
        setModalMessage('');
        setErrorMessage('');
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                isFullScreenModal
                title='Checkout'
                subtitle=''
                customHeader={
                    <div className="flex items-center px-2 py-6">
                        <button
                            onClick={onClose}
                            className="p-1.5 text-text-sub hover:text-text-main hover:bg-item-hover z-1 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                            <ChevronLeft size={18} strokeWidth={2.5} />
                        </button>
                        <div className="flex-1 flex min-w-0 pr-4  text-center self-center justify-center">
                            <h2 className="text-lg font-bold text-text-main leading-tight truncate">
                                {activeTab === 'manual' ? 'Add Item' : activeTab === 'scanner' ? 'Scan Product' : 'Checkout'}
                            </h2>
                        </div>
                        <div className="relative p-1.5">
                            <ShoppingCart size={20} className="text-text-sub" />
                            {cart.length > 0 && (
                                <span className="absolute -top-1 right-2 bg-brand-gold text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                                    {cart.length}
                                </span>
                            )}
                        </div>
                    </div>
                }
            >
                <div className="flex flex-col w-full bg-bg-primary flex-1 h-full">
                    {/* Tab Headers */}
                    <div className='mx-4'>
                        <div className="flex bg-bg-primary my-2 rounded-full w-full max-w-xl border border-border-main">
                            <button
                                type="button"
                                onClick={() => setActiveTab('manual')}
                                className={`flex-1 flex flex-row gap-2 items-center justify-center py-2.5 px-4 text-sm font-semibold transition-all duration-200 rounded-full cursor-pointer ${activeTab === 'manual'
                                    ? 'bg-brand-gold text-text-white shadow-sm'
                                    : 'text-text-sub hover:text-text-main'
                                    }`}
                            >
                                Manual Input
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('scanner')}
                                className={`flex-1 flex flex-row gap-2 items-center justify-center py-2.5 px-4 text-sm font-semibold transition-all duration-200 rounded-full cursor-pointer ${activeTab === 'scanner'
                                    ? 'bg-brand-gold text-text-white shadow-sm'
                                    : 'text-text-sub hover:text-text-main'
                                    }`}
                            >
                                AI Scanner
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('checkout')}
                                className={`flex-1 flex flex-row gap-2 items-center justify-center py-2.5 px-4 text-sm font-semibold transition-all duration-200 rounded-full cursor-pointer ${activeTab === 'checkout'
                                    ? 'bg-brand-gold text-text-white shadow-sm'
                                    : 'text-text-sub hover:text-text-main'
                                    }`}
                            >
                                Checkout ({cart.length})
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="w-full bg-bg-primary h-full flex-1 flex overflow-auto">
                        {/* MANUAL SEARCH TAB */}
                        {activeTab === 'manual' && (
                            <ManualSearchTab shopId={shopId || ""} addToCart={addToCart} />
                        )}

                        {/* AI SCANNER TAB */}
                        {activeTab === 'scanner' && (
                            <ScannerTab shopId={shopId || ""} addToCart={addToCart} />
                        )}

                        {/* CHECKOUT TAB */}
                        {activeTab === 'checkout' && (
                            <div className="flex flex-col gap-4 p-5 w-full h-full">
                                {cart.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-text-sub">
                                        <div className="text-center">
                                            <ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
                                            <p>Your cart is empty</p>
                                            <p className="text-sm mt-2">Add items using Manual Input or AI Scanner</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 flex flex-col gap-3 overflow-auto">
                                            <h3 className="text-sm font-semibold text-text-sub">Cart Items</h3>
                                            {cart.map((item) => (
                                                <div key={item.id} className="border border-border-main rounded-lg p-4 bg-bg-secondary">
                                                    <div className="flex gap-3">
                                                        {item.photo ? (
                                                            <img
                                                                src={item.photo}
                                                                alt={item.itemName}
                                                                className="w-14 h-14 object-cover rounded-lg"
                                                            />
                                                        ) : (
                                                            <div className="w-14 h-14 bg-item-hover rounded-lg flex items-center justify-center">
                                                                <ImageIcon size={20} className="text-text-sub" />
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <h4 className="font-semibold text-text-main">{item.itemName}</h4>
                                                                <button
                                                                    onClick={() => removeFromCart(item.id)}
                                                                    className="p-1.5 hover:bg-item-hover rounded-lg text-text-sub hover:text-brand-red transition-colors"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                            {item.unitOfMeasure && (
                                                                <p className="text-xs text-text-sub mb-2">{item.unitOfMeasure}</p>
                                                            )}
                                                            <div className="flex justify-between items-center">
                                                                <div className="text-sm">
                                                                    <span className="text-text-sub mr-2">Quantity:</span>
                                                                    <span className="font-semibold">{item.quantity}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-brand-gold font-bold">
                                                                        ₱{(item.sellingPrice * item.quantity).toFixed(2)}
                                                                    </div>
                                                                    <div className="text-xs text-text-sub">
                                                                        ₱{item.sellingPrice.toFixed(2)} each
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Total and Checkout Button */}
                                        <div className="border-t border-border-main pt-4 mt-auto">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-lg font-bold text-text-main">Total:</span>
                                                <span className="text-2xl font-bold text-brand-gold">
                                                    ₱{calculateTotal().toFixed(2)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={handleCheckout}
                                                className="w-full py-3 bg-brand-gold hover:bg-brand-gold-hover text-white font-semibold rounded-lg transition-colors"
                                            >
                                                Proceed to Payment
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

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
                    <p className="mt-2 text-lg font-bold text-text-main">{modalMessage}</p>
                    {errorMessage && (
                        <p className="mt-2 text-sm text-text-sub">{errorMessage}</p>
                    )}
                    <button
                        onClick={handleModalClose}
                        className='mt-6 p-2 px-4 bg-brand-gold hover:bg-brand-gold-hover cursor-pointer text-text-white rounded-lg transition-colors'
                    >
                        OK
                    </button>
                </div>
            </Modal>
        </>
    );
}