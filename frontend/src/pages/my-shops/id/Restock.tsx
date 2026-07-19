import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from "~/components";
import { useParams } from 'react-router-dom';
import { SEARCH_SHOP_PRODUCTS_QUERY, DECREMENT_STOCK_MUTATION } from '~/api/graphql';
import { Check, X, ChevronLeft, Search, ShoppingCart, Trash2, Image as ImageIcon } from 'lucide-react';
import { ManualRestockTab, RestockScannerTab } from '../components';


import type { Product, CartItem } from "~/types/item";


export default function Restock({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<'manual' | 'scanner'>('scanner');
    const { id: shopId } = useParams<{ id: string }>();

    const [cart, setCart] = useState<CartItem[]>([]);



    const getCartItems = (shopId: string) => {
        console.log(`Getting cart items for shopId: ${shopId}`);
        try {
            const rawData = localStorage.getItem(`cart_items_${shopId}`);
            const cartItems = rawData ? JSON.parse(rawData) : [];

            // 🔴 FIX: You must set the state here to trigger a UI re-render!
            setCart(cartItems);
            return cartItems;
        } catch (err) {
            console.error("Error reading cart from localStorage:", err);
            return [];
        }
    };

    useEffect(() => {
        const cartItems = getCartItems(shopId!);
        setCart(cartItems);
    }, [shopId]);


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
                        <div className="flex-1 flex min-w-0  text-center self-center justify-center">
                            <h2 className="text-lg font-bold text-text-main leading-tight truncate">
                                {activeTab === 'manual' ? 'Add Item' : 'Scan Product'}
                            </h2>
                        </div>
                    </div>
                }
            >
                <div className="flex flex-col w-full bg-bg-primary flex-1 h-full overflow-hidden min-h-0 relative">
                    {/* Tab Headers */}
                    <div className="w-full bg-bg-primary pb-2 flex-shrink-0 px-4">
                        <div className="flex bg-bg-primary my-2 rounded-full w-full max-w-xl border border-border-main mx-auto">
                            <button type="button" onClick={() => setActiveTab('manual')} className={`flex-1 flex flex-row gap-2 items-center justify-center py-2.5 px-4 text-sm font-semibold transition-all duration-200 rounded-full cursor-pointer ${activeTab === 'manual' ? 'bg-brand-gold text-text-white shadow-sm' : 'text-text-sub hover:text-text-main'}`} >
                                Manual Input
                            </button>
                            <button type="button" onClick={() => setActiveTab('scanner')} className={`flex-1 flex flex-row gap-2 items-center justify-center py-2.5 px-4 text-sm font-semibold transition-all duration-200 rounded-full cursor-pointer ${activeTab === 'scanner' ? 'bg-brand-gold text-text-white shadow-sm' : 'text-text-sub hover:text-text-main'}`} >
                                AI Scanner
                            </button>
                        </div>
                    </div>
                    {/* Tab Content */}
                    <div className="w-full bg-bg-primary flex-1 flex min-h-0 overflow-hidden relative">
                        {/* MANUAL SEARCH TAB */}
                        {activeTab === 'manual' && (
                            <ManualRestockTab shopId={shopId || ""} updateCart={() => getCartItems(shopId || "")} />
                        )}
                        {/* AI SCANNER TAB */}
                        {activeTab === 'scanner' && (
                            <RestockScannerTab shopId={shopId || ""} updateCart={() => getCartItems(shopId || "")} />
                        )}

                    </div>
                </div>

            </Modal>
        </>
    );
}