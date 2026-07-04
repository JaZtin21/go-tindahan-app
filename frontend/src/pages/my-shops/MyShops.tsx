import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

interface MyShopsContext {
    triggerAddShop: number;
}

export const MyShops: React.FC = () => {
    const context = useOutletContext<MyShopsContext>();
    const [isLoading, setIsLoading] = useState(true);

    // Trigger simulated fetching delay process to demonstrate loading states
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 2000); // Resolves loading state cleanly after 2 seconds
        return () => clearTimeout(timer);
    }, []);

    const navigate = useNavigate();

    // Listen to header context triggers
    useEffect(() => {
        if (context?.triggerAddShop > 0) {
            alert("Opening Add Shop Form / Action Modal!");
        }
    }, [context?.triggerAddShop]);

    const dummyShops = [
        { id: 1, name: 'Shop name', address: 'shop address will be here.' },
        { id: 2, name: 'Shop name', address: 'shop address will be here.' },
        { id: 3, name: 'Shop name', address: 'shop address will be here.' },
    ];

    return (
        /* FIXED: Added xl:mr-56 to balance the grid layout footprint when sidebar unfolds on big desktop layouts */
        <div className="w-full bg-bg-secondary min-h-screen px-6 pt-16 pb-10 transition-colors">

            {/* 3-COLUMN RESPONSIVE LAYOUT MATRIX GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mt-4">

                {isLoading ? (
                    /* --- DESIGN A: ANIMATED SKELETON LAYOUT MAPPING (3 Items) --- */
                    Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={`skeleton-${index}`}
                            className="flex flex-col  bg-bg-primary  rounded-2xl p-5 shadow-xs transition-shadow hover:shadow-sm animate-pulse"
                        >
                            {/* Pulsating image boundary block */}
                            <div className="w-full aspect-square bg-bg-secondary  rounded-xl mb-4" />

                            {/* Pulsating text fields hierarchy lines */}
                            <div className="flex-1 mb-6 space-y-2">
                                <div className="h-4 w-1/2 bg-bg-secondary  rounded-md" />
                                <div className="h-3 w-3/4 bg-bg-secondary rounded-md" />
                            </div>

                            {/* Pulsating actions control buttons footprint layer */}
                            <div className="flex items-center justify-end gap-2.5 w-full">
                                <div className="h-8 w-16 bg-bg-secondary rounded-lg" />
                                <div className="h-8 w-16 bg-bg-secondary  rounded-lg" />
                            </div>
                        </div>
                    ))
                ) : (
                    /* --- DESIGN B: DYNAMIC COMPONENT STATISTIC CARD DISPLAY GRID --- */
                    dummyShops.map((shop) => (
                        <div
                            key={shop.id}
                            onClick={() => navigate(`/my-shops/${shop.id}`)}
                            /* FIXED: Removed raw border utility lines entirely, attached clean shadow-xs footprint */
                            className="flex flex-col  bg-bg-primary  rounded-2xl p-5 shadow-xs transition-all duration-300  hover:shadow-md hover:bg-bg-primary-hover cursor-pointer"
                        >
                            {/* Square Core Image Asset Representation Box */}
                            <div className="w-full aspect-square bg-bg-secondary  rounded-xl mb-4 shrink-0" />

                            {/* Text Layout Metadata Labels */}
                            <div className="flex-1 mb-6">
                                <h3 className="text-sm font-bold text-text-main mb-1">
                                    {shop.name}
                                </h3>
                                <p className="text-xs font-medium text-text-muted">
                                    {shop.address}
                                </p>
                            </div>

                            {/* ACTIONS ACTION BUTTON STRIP FOOTPRINT GROUP */}
                            <div className="flex items-center justify-end gap-2.5 w-full">

                                {/* Delete Trigger Button - Mapped directly to your custom brand-red error theme token */}
                                <button
                                    onClick={() => console.log('Delete target ID:', shop.id)}
                                    className="h-8 rounded-lg bg-brand-red hover:bg-brand-red-hover active:scale-98 transition-all px-4 text-xs font-bold text-text-white cursor-pointer border border-transparent"
                                >
                                    Delete
                                </button>

                                {/* Manage Trigger Button - Mapped directly to your custom brand-green success theme token */}
                                <button
                                    onClick={() => console.log('Manage target ID:', shop.id)}
                                    className="h-8 rounded-lg bg-brand-gold hover:bg-brand-gold-hover active:scale-98 transition-all px-4 text-xs font-bold text-text-white cursor-pointer border border-transparent"
                                >
                                    Manage
                                </button>

                            </div>
                        </div>
                    ))
                )}
            </div>

        </div>
    );
};
