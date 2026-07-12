import React, { useState, useEffect } from 'react';
import { Modal } from "~/components";
import { useParams } from 'react-router-dom';
import { Camera, Pencil } from 'lucide-react';
import { useMutation } from '@apollo/client/react';
import { ADD_INVENTORY_ITEM_MUTATION, UPDATE_INVENTORY_ITEM_MUTATION } from '~/api/graphql';
import { useDispatch } from 'react-redux';
import { addShop, updateShop } from '~/store/myShopsSlice';
import {
    addInventoryItem as addInventoryItemAction,
    updateInventoryItem as updateInventoryItemAction
} from "~/store/inventorySlice";
import { Check, X, XIcon } from 'lucide-react';

export default function InventoryForm({ isOpen, onClose, data }: { isOpen: boolean, onClose: () => void, data?: any }) {


    const isEdit: boolean = !!data && Object.keys(data).length > 0;
    const item: any | undefined = data;

    console.log(data, item)
    // --- 1. STATES ---
    const [activeTab, setActiveTab] = useState('manual');
    const { id: shopId } = useParams();
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>(typeof item?.photo === 'string' ? item.photo : '');



    const [formData, setFormData] = useState(
        {
            itemName: item?.itemName || '',
            description: item?.description || '',
            barcode: item?.barcode || '',
            category: item?.category || '',
            unitOfMeasure: item?.unitOfMeasure || '',
            costPrice: item?.costPrice,
            sellingPrice: item?.sellingPrice,
            stockQuantity: item?.stockQuantity,
            reorderLevel: item?.reorderLevel,
        }
    );

    useEffect(() => {
        if (item) {
            setFormData({
                itemName: item.itemName || '',
                description: item.description || '',
                barcode: item.barcode || '',
                category: item.category || '',
                unitOfMeasure: item.unitOfMeasure || '',
                costPrice: item.costPrice ?? '',
                sellingPrice: item.sellingPrice ?? '',
                stockQuantity: item.stockQuantity ?? '',
                reorderLevel: item.reorderLevel ?? '',
            });

            if (typeof item.photo === 'string') {
                setPhotoPreview(item.photo);
            }
        }
    }, [item]);

    console.log(formData.itemName, ';tjhis formadata')

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');


    // Clean up all local string variables and close the view
    const handleCloseInventoryModal = () => {
        setFormData({
            itemName: '',
            description: '',
            barcode: '',
            category: '',
            unitOfMeasure: '',
            costPrice: 0.0,
            sellingPrice: 0.0,
            stockQuantity: 0,
            reorderLevel: undefined,
        });
        setPhoto(null);
        setPhotoPreview('');
        setActiveTab('manual');
        onClose();
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Save the actual native File object for the GraphQL mutation
        setPhoto(file);

        // 2. Optional: Generate a quick, lightweight preview URL for your <img> tag
        setPhotoPreview(URL.createObjectURL(file));
    };

    const handleRemovePhoto = () => {
        setPhoto(null);
        setPhotoPreview('');
    }
    const dispatch = useDispatch();

    const handleModalClose = () => {
        setIsModalOpen(false);
        setIsSuccess(false);
        setModalMessage('');
    };

    const openModal = ({ isSuccess, type, error }: { isSuccess: boolean, type: string, error?: string }) => {

        if (isSuccess) {
            if (type === 'add') {
                setIsModalOpen(true);
                setIsSuccess(true);
                setModalMessage('Item created successfully!');
            } else {
                setIsModalOpen(true);
                setIsSuccess(true);
                setModalMessage('Item updated successfully!');
            }

        } else {
            if (type === 'add') {
                setIsModalOpen(true);
                setIsSuccess(false);
                setModalMessage('Failed to create item. Please try again.');
                setErrorMessage(error || '');
            } else {
                setIsModalOpen(true);
                setIsSuccess(false);
                setModalMessage('Failed to update item. Please try again.');
                setErrorMessage(error || '');
            }

        }

    }

    const [addInventoryItem, { loading: isAddingItem }] = useMutation(ADD_INVENTORY_ITEM_MUTATION, {
        refetchQueries: ['GetShopInventory'],
        onCompleted: (data: any) => {
            // 👇 DISPATCH THE RESPONSE DATA OBJECT DIRECTLY TO REDUX INSTANTLY
            if (data?.addInventoryItem) {
                dispatch(addInventoryItemAction(data.addInventoryItem));
            }

            handleCloseInventoryModal();
            openModal({ isSuccess: true, type: 'add' });
        },
        onError: (err) => {
            console.error("Mutation failed to run:", err);
            openModal({ isSuccess: false, type: 'add', error: err.message });
        }
    });

    const [updateInventoryItem, { loading: isUpdatingItem }] = useMutation(UPDATE_INVENTORY_ITEM_MUTATION, {
        refetchQueries: ['GetShopInventory'],
        onCompleted: (data: any) => {
            // 👇 DISPATCH THE RESPONSE DATA OBJECT DIRECTLY TO REDUX INSTANTLY
            if (data?.updateInventoryItem) {
                dispatch(updateInventoryItemAction(data.updateInventoryItem));
            }

            handleCloseInventoryModal();
            openModal({ isSuccess: true, type: 'update' });
        },
        onError: (err) => {
            console.error("Mutation failed to run:", err);
            openModal({ isSuccess: false, type: 'add', error: err.message });
        }
    })

    const isLoading = isAddingItem || isUpdatingItem;
    // Process local submit variables for your backend mutation structure
    const handleInventoryFormSubmit = async (e: any) => {
        e.preventDefault();

        console.log('handled')

        const mutationPayload = {
            itemName: formData.itemName,
            description: formData.description,
            barcode: formData.barcode,
            category: formData.category,
            unitOfMeasure: formData.unitOfMeasure,
            costPrice: formData.costPrice,
            sellingPrice: formData.sellingPrice,
            stockQuantity: formData.stockQuantity,
            reorderLevel: formData.reorderLevel,
            photo: photo || null // 👈 FIXED: Passes down your native browser binary File object stream
        };

        try {
            if (isEdit) {
                // 2. 🟢 EDIT BRANCH REFACTOR: Uses your specialized separate text/file fields
                const updateInput: any = {
                    ...mutationPayload,
                    itemId: item.id, // Reads directly from your dynamic useParams parameter context
                    photo: photoPreview?.startsWith('http') || photoPreview?.startsWith('res.cloudinary')
                        ? photoPreview
                        : "",

                    // 💡 Pass your native browser binary File object stream here as the upload scalar
                    newPhoto: photo || null
                    // Pass existing strings back normally (Pass null if cleared out to trigger cleanup!)
                };
                updateInventoryItem({
                    variables: {
                        input: updateInput
                    }
                });
            } else {
                await addInventoryItem({
                    variables: { input: { ...mutationPayload, shopId: shopId } }
                });
            }
            // 👇 EXECUTE APOLLO MUTATION LAYER PIPELINE

        } catch (err) {
            // Handled cleanly via the useMutation onError lifecycle block callback hooks
            console.error("Inventory mutation execution block trace catch:", err);
        }
    };


    // --- 3. RENDERING COMPONENT MARKUP ---
    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={handleCloseInventoryModal}
                title={isEdit ? 'Update Item' : 'Add Item'}
                subtitle={isEdit ? 'Update Items in your inventory' : 'Add Item to your inventory'}
            >
                <div className="flex flex-col w-full bg-bg-secondary flex-1">

                    {/* --- TAB HEADERS --- */}
                    <div className="flex border-b bg-bg-primary border-[var(--color-border-main)] w-full">
                        <button
                            type="button"
                            onClick={() => setActiveTab('manual')}
                            className={`flex-1 flex flex-row gap-2 items-center justify-center py-4 text-sm font-semibold transition-colors duration-200 border-b-3 cursor-pointer
                                ${activeTab === 'manual'
                                    ? 'border-[var(--color-brand-gold)] text-[var(--color-text-main)]'
                                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-sub)]'
                                }`}
                        >
                            <Pencil className="h-4 w-4" /> Manual Input
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('scan')}
                            className={`flex-1 py-4 flex flex-row gap-2 items-center justify-center text-sm font-semibold transition-colors duration-200 border-b-3 cursor-pointer
                                ${activeTab === 'scan'
                                    ? 'border-[var(--color-brand-gold)] text-[var(--color-text-main)]'
                                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-sub)]'
                                }`}
                        >
                            <Camera className="h-4 w-4" /> Image Scanner
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
                                        value={formData.itemName}
                                        onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                                        className="w-full px-3 py-2 border border-[var(--color-border-main)] rounded-lg text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-border-muted"
                                        placeholder="e.g. Organic Milk"
                                        required
                                    />
                                </div>

                                {/* Financial Estimates Metrics Layout Row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1 text-left">
                                        <label className="text-xs font-semibold text-[var(--color-text-sub)]">Cost Price</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.costPrice}
                                            onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                                            className="w-full px-3 py-2 border border-[var(--color-border-main)] rounded-lg text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none  focus:border-border-muted"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 text-left">
                                        <label className="text-xs font-semibold text-[var(--color-text-sub)]">Selling Price</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.sellingPrice}
                                            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                                            className="w-full px-3 py-2 border border-[var(--color-border-main)] rounded-lg text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-border-muted"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Quantities Operational Inventory Controls Row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1 text-left">
                                        <label className="text-xs font-semibold text-[var(--color-text-sub)]">Stock Quantity</label>
                                        <input
                                            type="number"
                                            value={formData.stockQuantity}
                                            onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                                            className="w-full px-3 py-2 border border-[var(--color-border-main)] rounded-lg text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-border-muted"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 text-left">
                                        <label className="text-xs font-semibold text-[var(--color-text-sub)]">Barcode (Optional)</label>
                                        <input
                                            type="text"
                                            value={formData.barcode}
                                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                            className="w-full px-3 py-2 border border-[var(--color-border-main)] rounded-lg text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-border-muted"
                                            placeholder="Scan or type barcode"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 text-left w-full">
                                    <label className="text-xs font-semibold text-[var(--color-text-sub)]">Product Image (Optional)</label>

                                    {!photoPreview ? (
                                        /* Dropzone Upload UI Target State Area */
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[var(--color-border-main)] rounded-lg bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-primary-hover)] transition-colors cursor-pointer">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <span className="text-2xl mb-1"><Camera className="text-[var(--color-text-sub)]" /></span>
                                                <p className="text-xs font-semibold text-[var(--color-text-sub)]">Click to browse image asset</p>
                                                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">PNG or JPG variants accepted</p>
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handlePhotoChange}
                                                className="hidden"
                                            />
                                        </label>
                                    ) : (
                                        /* Active Local Preview Matrix Overlay Canvas */
                                        <div className="relative w-full h-48 border border-[var(--color-border-main)] rounded-lg bg-[var(--color-bg-secondary)] overflow-hidden flex items-center justify-center">
                                            <img
                                                src={photoPreview || ''}
                                                alt="Product preview grid reference"
                                                className="h-full object-contain"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemovePhoto}
                                                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                                            >
                                                <XIcon className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Window Choice Action Items */}
                                <div className="flex justify-end gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseInventoryModal}
                                        className="px-5 py-2 bg-[var(--color-bg-primary-hover)] border border-[var(--color-border-main)] text-[var(--color-text-sub)] rounded-lg font-semibold text-sm cursor-pointer hover:bg-[var(--color-border-main)] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="px-6 py-2 bg-brand-green hover:bg-brand-green-hover text-text-white cursor-pointer rounded-lg hover:bg- disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                <span>{isEdit ? 'Updating...' : 'Adding...'}</span>
                                            </>
                                        ) : (
                                            <span>{isEdit ? 'Update Shop' : 'Add Shop'}</span>
                                        )}
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
            <Modal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                title={isSuccess ? "Yay!" : "Error"}
                subtitle=""
            >
                <div className="flex flex-col items-center justify-center p-6 min-h-[200px]">
                    {/* Visual Success/Error Indicator Anchor (Optional styling) */}
                    <div className=''>
                        {isSuccess ? (
                            <Check className="w-8 h-8 text-brand-green" />
                        ) : (
                            <X className="w-8 h-8 text-brand-red" />
                        )}
                    </div>

                    {/* Dynamic Text Content */}
                    <p className="mt-2 text-lg font-bold text-text-main dark:text-zinc-400">
                        {modalMessage}
                    </p>

                    <p className={`mt-2 ${isSuccess ? 'hidden' : ''} text-sm text-text-main dark:text-zinc-400`}>
                        {errorMessage}
                    </p>

                    {/* Confirmation Button to trigger close function */}
                    <button
                        onClick={handleModalClose}
                        className='mt-6 p-2 px-4 bg-brand-green hover:bg-brand-green-hover cursor-pointer text-text-white rounded-lg  transition-colors'
                    >
                        OK
                    </button>
                </div>
            </Modal>

        </>

    );
}