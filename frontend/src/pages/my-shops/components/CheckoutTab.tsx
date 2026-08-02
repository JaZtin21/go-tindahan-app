import { useState, useEffect } from 'react';
import { useMutation } from "@apollo/client/react";
import { CHECKOUT_CART_MUTATION, GET_SHOP_DASHBOARD_METRICS_QUERY } from "~/api/graphql";
import { Modal } from "~/components";
import { Check, X, ShoppingCart, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useCheckoutCart } from '~/api/queries';
import { Plus, Minus } from 'lucide-react'
import { RootState } from '~/store/store';
import { useSelector } from 'react-redux';



interface ManualSearchTabProps {
    shopId: string;
    updateCart: () => void
}

export const CheckoutTab = ({ shopId, updateCart }: ManualSearchTabProps) => {





    const [cart, setCart] = useState<any[]>([]); // 🚀 Set to any[] to hold your nested localStorage data structure cleanly
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const isSubscribed = useSelector((state: RootState) => state.appSubscription.isSubscribed);



    const [checkoutCart, { loading: checkoutLoading }] = useCheckoutCart({
        isSubscribed: isSubscribed,
        shopId: shopId,
    });

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

        console.log('opening modal', `isSuccess: ${isSuccess}, message: ${message}, error: ${error}`);
        setIsModalOpen(true);
        setIsSuccess(isSuccess);
        setModalMessage(message);
        setErrorMessage(error || '');
    };

    console.log(isModalOpen, 'open modal state');

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
            const items = cart.map((item) => ({
                itemId: item.product.id,
                quantity: item.quantity,
            }));

            // 🚀 Look! Your exact original layout passes with type safety!
            const result = await checkoutCart({
                variables: {
                    input: {
                        shopId,
                        items,
                    }
                }
            });

            // Grabs from result.data structure cleanly on both online & offline channels
            const grossSale = result?.data?.checkoutCart?.grossSale;

            openModal({
                isSuccess: true,
                message: 'Checkout successful! Batch sale recorded and stock updated.',
                error: grossSale != null ? `Gross Sale: ₱${Number(grossSale).toFixed(2)}` : undefined,
            });

            setCart([]);
            localStorage.removeItem(`cart_items_${shopId}`); // Cleanly wipe storage on complete checkout parameters pass
            updateCart()
        } catch (err: any) {
            console.error("Checkout failed:", err);
            openModal({ isSuccess: false, message: 'Checkout failed', error: err.message });
        }
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        // Find the item to check its maximum available stock limit boundary
        const targetItem = cart.find(item => item.product.id === productId);
        if (!targetItem) return;

        // Enforce boundary safety thresholds (minimum 1, maximum available stock)
        const maxStock = targetItem.product.stockQuantity ?? Infinity;
        const sanitizedQuantity = Math.max(1, Math.min(newQuantity, maxStock));

        const updatedCart = cart.map(item =>
            item.product.id === productId
                ? { ...item, quantity: sanitizedQuantity }
                : item
        );

        setCart(updatedCart);
        localStorage.setItem(`cart_items_${shopId}`, JSON.stringify(updatedCart));
        updateCart(); // Sync metrics instantly with parent layout structures
    };

    return (
        // 🚀 Absolute-boundary tracking container parent enforces strict layout clipping bounds
        <div className="absolute inset-0 flex flex-col w-full h-full p-0 m-0 overflow-hidden min-h-0 ">

            {cart.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-text-sub -mt-[20%]">
                    <div className="text-center">
                        <ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="font-bold text-md">Your cart is empty</p>
                        <p className="text-sm mt-2">Add items using Manual Input or AI Scanner</p>
                    </div>
                </div>
            ) : (

                <div className="flex-1 w-full h-full  relative flex flex-col min-h-0 overflow-hidden">
                    {cart.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-text-sub">
                            <div className="text-center">
                                <ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Your cart is empty</p>
                                <p className="text-sm mt-2">Add items using Manual Input or AI Scanner</p>
                            </div>
                        </div>
                    ) : (
                        // Structural height container
                        <div className="flex-1 flex flex-col min-h-0 w-full relative px-5  pt-3">

                            {/* 🚀 INDEPENDENT SCROLL REGION: Absorbs scroll actions perfectly and preserves bottom margin guards */}
                            <div className="flex-1 overflow-y-auto bg-bg-primary min-h-0 flex flex-col gap-3 pb-38 pr-1 ">
                                {/* 🚀 FIXED: Dropped all sticky classes so it rests naturally inside the list scroll stream block flow */}
                                <h3 className="text-sm font-semibold text-text-sub ">Cart Items</h3>
                                {cart.map((item) => {
                                    const product = item.product;
                                    if (!product) return null;

                                    return (
                                        <div key={product.id} className="border border-border-sub rounded-lg p-4 bg-bg-primary flex-shrink-0">
                                            <div className="flex gap-3">
                                                {product.photo ? (
                                                    <img src={product.photo} alt={product.itemName} className="w-14 h-full object-cover rounded-lg" />
                                                ) : (
                                                    <div className="w-14 h-14 bg-item-hover rounded-lg flex items-center justify-center">
                                                        <ImageIcon size={20} className="text-text-sub" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-semibold text-text-main">{product.itemName}</h4>
                                                        <button onClick={() => removeFromCart(product.id)} className="p-1.5 hover:bg-item-hover rounded-lg text-text-sub hover:text-brand-red transition-colors cursor-pointer" >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                    {product.unitOfMeasure && (
                                                        <p className="text-xs text-text-sub">{product.unitOfMeasure}</p>
                                                    )}
                                                    <div className="flex justify-between items-center mt-2">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm text-text-sub">Quantity:</span>
                                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                {/* Decrement Button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateQuantity(product.id, item.quantity - 1)}
                                                                    disabled={item.quantity <= 1}
                                                                    className="w-7 h-7 flex items-center justify-center cursor-pointer border border-border-main rounded-md hover:bg-item-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-text-main"
                                                                >
                                                                    <Minus size={14} />
                                                                </button>

                                                                {/* Dynamic Quantity Indicator */}
                                                                <span className="w-6 text-center text-sm font-semibold text-text-main">
                                                                    {item.quantity}
                                                                </span>

                                                                {/* Increment Button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateQuantity(product.id, item.quantity + 1)}
                                                                    disabled={item.quantity >= (product.stockQuantity || Infinity)}
                                                                    className="w-7 h-7 flex items-center justify-center cursor-pointer border border-border-main rounded-md hover:bg-item-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-text-main"
                                                                >
                                                                    <Plus size={14} />
                                                                </button>
                                                            </div>
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

                            {/* FIXED FOOTER OVERLAY PANEL: Locked down layout base configuration layer shadow grid accents */}
                            <div className="absolute bottom-0 left-0  pt-4 px-5 pb-6 w-full bg-bg-primary z-20 ">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-lg font-bold text-text-main">Total:</span>
                                    <span className="text-2xl font-bold text-brand-gold">
                                        ₱{calculateTotal().toFixed(2)}
                                    </span>
                                </div>
                                <button onClick={handleCheckout} className="w-full py-3 bg-brand-gold hover:bg-brand-gold-hover text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-md" >
                                    Proceed to Payment
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Success/Error Modal view portal component overlay */}
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
                        <p className="mt-2 text-sm font-semibold text-text-sub text-center">{errorMessage}</p>
                    )}
                    <button onClick={handleModalClose} className='mt-6 p-2 px-4 bg-brand-gold hover:bg-brand-gold-hover cursor-pointer text-text-white rounded-lg transition-colors font-semibold' >
                        OK
                    </button>
                </div>
            </Modal>
        </div>
    );

}
