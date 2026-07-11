import React, { useState } from 'react';
import { Modal } from "~/components";
import { useParams } from 'react-router-dom';

export default function AddInventory({ isOpen, onClose }: any) {
    // --- 1. STATES ---
    const [activeTab, setActiveTab] = useState('manual');
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    const { shopId } = useParams();

    // Form element data track pointers
    const [itemName, setItemName] = useState('');
    const [description, setDescription] = useState('');
    const [barcode, setBarcode] = useState('');
    const [category, setCategory] = useState('');
    const [unitOfMeasure, setUnitOfMeasure] = useState('');
    const [costPrice, setCostPrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [stockQuantity, setStockQuantity] = useState('');
    const [reorderLevel, setReorderLevel] = useState('');
    const [photo, setPhoto] = useState('');


    // Clean up all local string variables and close the view
    const handleCloseInventoryModal = () => {
        setItemName('');
        setDescription('');
        setBarcode('');
        setCategory('');
        setUnitOfMeasure('');
        setCostPrice('');
        setSellingPrice('');
        setStockQuantity('');
        setReorderLevel('');
        setPhoto('');
        setActiveTab('manual');
        setIsInventoryModalOpen(false);
        onClose();
    };

    // Process local submit variables for your backend mutation structure
    const handleInventoryFormSubmit = async (e: any) => {
        e.preventDefault();

        const mutationPayload = {
            shopId: shopId, // Reads directly from your file's existing tracking state
            itemName: itemName,
            description: description || undefined,
            barcode: barcode || undefined,
            category: category || undefined,
            unitOfMeasure: unitOfMeasure || undefined,
            costPrice: costPrice ? parseFloat(costPrice) : 0.0,
            sellingPrice: sellingPrice ? parseFloat(sellingPrice) : 0.0,
            stockQuantity: stockQuantity ? parseInt(stockQuantity, 10) : 0,
            reorderLevel: reorderLevel ? parseInt(reorderLevel, 10) : undefined,
            photo: photo || undefined
        };

        console.log("Submitting payload directly inside page scope:", mutationPayload);

        try {
            // Your useMutation variable call can go straight here
            // await addInventoryItem({ variables: { input: mutationPayload } });
            handleCloseInventoryModal();
        } catch (err) {
            console.error("Inventory mutation error:", err);
        }
    };


    // --- 3. RENDERING COMPONENT MARKUP ---
    return (
        <Modal
            isOpen={isOpen}
            onClose={handleCloseInventoryModal}
            title="Add Inventory Item"
            subtitle="add items to your shop"
        >
            <div className="flex flex-col w-full ">

                {/* --- TAB HEADERS --- */}
                <div className="flex border-b border-[var(--color-border-main)] w-full">
                    <button
                        type="button"
                        onClick={() => setActiveTab('manual')}
                        className={`flex-1 py-4 text-sm font-semibold transition-colors duration-200 border-b-3 cursor-pointer
                                ${activeTab === 'manual'
                                ? 'border-[var(--color-brand-gold)] text-[var(--color-text-main)]'
                                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-sub)]'
                            }`}
                    >
                        ✏️ Manual Input
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('scan')}
                        className={`flex-1 py-4 text-sm font-semibold transition-colors duration-200 border-b-3 cursor-pointer
                                ${activeTab === 'scan'
                                ? 'border-[var(--color-brand-gold)] text-[var(--color-text-main)]'
                                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-sub)]'
                            }`}
                    >
                        📷 Barcode Scanner
                    </button>
                </div>

                {/* --- INVENTORY CONTAINER DATA MATRIX --- */}
                <div className="w-full bg-bg-secondary ">
                    {activeTab === 'manual' ? (
                        <form onSubmit={handleInventoryFormSubmit} className="flex flex-col gap-5 p-6">

                            {/* Item Name Input */}
                            <div className="flex flex-col gap-2 text-left">
                                <label className="text-xs font-semibold text-[var(--color-text-sub)]">Item Name *</label>
                                <input
                                    type="text"
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value)}
                                    className="w-full p-2 border border-[var(--color-border-main)] rounded-md text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-[var(--color-text-muted)] text-sm"
                                    placeholder="e.g. Organic Milk"
                                    required
                                />
                            </div>

                            {/* Financial Estimates Metrics Layout Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1 text-left">
                                    <label className="text-xs font-semibold text-[var(--color-text-sub)]">Cost Price *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={costPrice}
                                        onChange={(e) => setCostPrice(e.target.value)}
                                        className="w-full p-2 border border-[var(--color-border-main)] rounded-md text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none  focus:border-[var(--color-text-muted)] text-sm"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-1 text-left">
                                    <label className="text-xs font-semibold text-[var(--color-text-sub)]">Selling Price *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={sellingPrice}
                                        onChange={(e) => setSellingPrice(e.target.value)}
                                        className="w-full p-2 border border-[var(--color-border-main)] rounded-md text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-[var(--color-text-muted)] text-sm"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Quantities Operational Inventory Controls Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1 text-left">
                                    <label className="text-xs font-semibold text-[var(--color-text-sub)]">Stock Quantity *</label>
                                    <input
                                        type="number"
                                        value={stockQuantity}
                                        onChange={(e) => setStockQuantity(e.target.value)}
                                        className="w-full p-2 border border-[var(--color-border-main)] rounded-md text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-[var(--color-text-muted)] text-sm"
                                        placeholder="0"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-1 text-left">
                                    <label className="text-xs font-semibold text-[var(--color-text-sub)]">Barcode (Optional)</label>
                                    <input
                                        type="text"
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value)}
                                        className="w-full p-2 border border-[var(--color-border-main)] rounded-md text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-[var(--color-text-muted)] text-sm"
                                        placeholder="Scan or type barcode"
                                    />
                                </div>
                            </div>

                            {/* Bottom Window Choice Action Items */}
                            <div className="flex justify-end gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseInventoryModal}
                                    className="px-5 py-2 bg-[var(--color-bg-primary-hover)] border border-[var(--color-border-main)] text-[var(--color-text-sub)] rounded-md font-semibold text-sm cursor-pointer hover:bg-[var(--color-border-main)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 text-[var(--color-text-white)] rounded-md font-semibold bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-sm transition-colors cursor-pointer"
                                >
                                    Add Item
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* --- DISPATCH SCANNER HARDWARE SLOT --- */
                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[var(--color-border-main)] bg-[var(--color-bg-secondary)] rounded-lg min-h-[250px]">
                            <span className="text-4xl mb-2">📹</span>
                            <p className="text-sm font-semibold text-[var(--color-text-sub)]">Camera Scanner View Placeholder</p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">Barcode scanning hardware hooks will go here.</p>
                        </div>
                    )}
                </div>

            </div>
        </Modal>
    );
}