import { useState, useEffect } from 'react';
import { CartItem } from "~/types/item";
import { useMutation } from "@apollo/client/react";
import { DECREMENT_STOCK_MUTATION } from "~/api/graphql";
import { Modal } from "~/components";
import { Check, X, ShoppingCart, Trash2, Image as ImageIcon } from 'lucide-react';

interface ManualSearchTabProps {
    shopId: string;
    updateCart: () => void
}

export const CheckoutTab = ({ shopId, updateCart }: ManualSearchTabProps) => {
    const [decrementStock] = useMutation(DECREMENT_STOCK_MUTATION);
    const [cart, setCart] = useState<any[]>([]); // 🚀 Set to any[] to hold your nested localStorage data structure cleanly
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // 🚀 FIX: target item.product.id when matching and filtering rows
    const removeFromCart = (productId: string) => {
        const updatedCart = cart.filter(item => item.product.id !== productId);
        setCart(updatedCart);
        // Synchronize updates immediately back down to your localStorage cache layers
        localStorage.setItem(`cart_items_${shopId}`, JSON.stringify(updatedCart));
        updateCart()

    };

    // 🚀 FIX: access sellingPrice from inside item.product
    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (item.product.sellingPrice * item.quantity), 0);
    };

    const getCartItems = (shopId: string) => {
        console.log(`Getting cart items for shopId: ${shopId}`);
        try {
            const rawData = localStorage.getItem(`cart_items_${shopId}`);
            return rawData ? JSON.parse(rawData) : [];
        } catch (err) {
            console.error("Error reading cart from localStorage:", err);
            return [];
        }
    };

    useEffect(() => {
        setCart(getCartItems(shopId));
    }, [shopId]);

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

    const handleCheckout = async () => {
        if (cart.length === 0) {
            openModal({ isSuccess: false, message: 'Cart is empty', error: 'Please add items to cart first' });
            return;
        }
        try {
            // 🚀 FIX: access fields directly from inside item.product node elements
            for (const item of cart) {
                await decrementStock({
                    variables: {
                        input: {
                            itemId: item.product.id,
                            quantityToRemove: item.quantity
                        }
                    }
                });
            }
            openModal({ isSuccess: true, message: 'Checkout successful! Stock updated.' });
            setCart([]);
            localStorage.removeItem(`cart_items_${shopId}`); // Cleanly wipe storage on complete checkout parameters pass
            updateCart()
        } catch (err: any) {
            console.error("Checkout failed:", err);
            openModal({ isSuccess: false, message: 'Checkout failed', error: err.message });
        }
    };

    return (
        <div className="flex flex-col gap-4  w-full h-full">
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
                        {cart.map((item) => {
                            // 🚀 CLEAN DESTRUCTURING: pull the nested child product values directly into local variables loop context
                            const product = item.product;
                            if (!product) return null; // Safety boundary fallback defusal check

                            return (
                                <div key={product.id} className="border border-border-main rounded-lg p-4 bg-bg-secondary">
                                    <div className="flex gap-3">
                                        {product.photo ? (
                                            <img src={product.photo} alt={product.itemName} className="w-14 h-14 object-cover rounded-lg" />
                                        ) : (
                                            <div className="w-14 h-14 bg-item-hover rounded-lg flex items-center justify-center">
                                                <ImageIcon size={20} className="text-text-sub" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-semibold text-text-main">{product.itemName}</h4>
                                                <button onClick={() => removeFromCart(product.id)} className="p-1.5 hover:bg-item-hover rounded-lg text-text-sub hover:text-brand-red transition-colors cursor-pointer" >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            {product.unitOfMeasure && (
                                                <p className="text-xs text-text-sub mb-2">{product.unitOfMeasure}</p>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <div className="text-sm">
                                                    <span className="text-text-sub mr-2">Quantity:</span>
                                                    <span className="font-semibold text-text-main">{item.quantity}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-brand-gold font-bold">
                                                        ₱{(product.sellingPrice * item.quantity).toFixed(2)}
                                                    </div>
                                                    <div className="text-xs text-text-sub">
                                                        ₱{product.sellingPrice.toFixed(2)} each
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Total and Checkout Button */}
                    <div className="border-t border-border-main pt-4 mt-auto">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-lg font-bold text-text-main">Total:</span>
                            <span className="text-2xl font-bold text-brand-gold">
                                ₱{calculateTotal().toFixed(2)}
                            </span>
                        </div>
                        <button onClick={handleCheckout} className="w-full py-3 bg-brand-gold hover:bg-brand-gold-hover text-white font-semibold rounded-lg transition-colors cursor-pointer" >
                            Proceed to Payment
                        </button>
                    </div>
                </>
            )}

            {/* Success/Error Modal */}
            <Modal isOpen={isModalOpen} onClose={handleModalClose} title={isSuccess ? "" : "Error"} subtitle="" isMobileVariant={false} maxWidth="max-w-[340px]" isFullScreenModal={false} isHeaderVisible={false} unsetHeight >
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
                    <button onClick={handleModalClose} className='mt-6 p-2 px-4 bg-brand-gold hover:bg-brand-gold-hover cursor-pointer text-text-white rounded-lg transition-colors font-semibold' >
                        OK
                    </button>
                </div>
            </Modal>
        </div>
    );
};
