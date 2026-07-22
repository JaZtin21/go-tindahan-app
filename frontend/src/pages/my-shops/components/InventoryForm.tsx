import React, { useState, useEffect, useRef, act } from 'react';
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
import { ProductScannerCamera } from './ProductScannerCamera';
import { useAddInventoryItem, useUpdateInventoryItem } from '~/api/queries';
import { resizeAndConvertToWebPFile } from '~/utils/imageUtils';

export default function InventoryForm({ isOpen, onClose, data }: { isOpen: boolean, onClose: () => void, data?: any }) {


    const isEdit: boolean = !!data && Object.keys(data).length > 0;
    const item: any | undefined = data;

    // --- 1. STATES ---
    const [activeTab, setActiveTab] = useState('manual');
    const { id: shopId } = useParams();
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>(typeof item?.photo === 'string' ? item.photo : '');
    const isSubscribed = true;




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


    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');


    // --- CAMERA & INTERNAL SCANNER STEP TRACKING STATES ---
    const [scannerStep, setScannerStep] = useState<'camera' | 'form'>('camera');
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);


    // Clean up all local string variables and close the view
    const handleCloseInventoryModal = (shoudClose?: boolean) => {
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
        setScannerStep('camera');

        if (shoudClose)
            onClose();
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Save the actual native File object for the GraphQL mutation
        try {
            const optimizedWebpFile = await resizeAndConvertToWebPFile(file, 400, 0.7);

            console.log("--- FRONTEND IMAGE VERIFICATION ---");
            console.log("File Name:", optimizedWebpFile.name);        // Should end in .webp
            console.log("Mime Type:", optimizedWebpFile.type);        // MUST be "image/webp"
            console.log("Size on Wire:", (optimizedWebpFile.size / 1024).toFixed(2), "KB");

            setPhoto(optimizedWebpFile);
            setPhotoPreview(URL.createObjectURL(optimizedWebpFile));
        } catch (err: any) {
            // 🚀 Catch the type validation error here!
            console.error("Image processing error:", err.message);
        }
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
        if (isEdit) {
            onClose();
        }
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

    const [addInventoryItem, { loading: isAddingItem }] = useAddInventoryItem({
        isSubscribed: isSubscribed,
        onCompleted: (data: any) => {
            if (data?.addInventoryItem) {
                dispatch(addInventoryItemAction(data.addInventoryItem));
            }
            handleCloseInventoryModal(false);
            openModal({ isSuccess: true, type: 'add' });
        },
        onError: (err) => {
            console.error("Mutation failed to run:", err);
            openModal({ isSuccess: false, type: 'add', error: err.message });
        }
    });

    const [updateInventoryItem, { loading: isUpdatingItem }] = useUpdateInventoryItem({
        isSubscribed: isSubscribed,
        onCompleted: (data: any) => {
            if (data?.updateInventoryItem) {
                dispatch(updateInventoryItemAction(data.updateInventoryItem));
            }
            handleCloseInventoryModal();
            openModal({ isSuccess: true, type: 'update' });
        },
        onError: (err) => {
            console.error("Mutation failed to run:", err);
            openModal({ isSuccess: false, type: 'update', error: err.message }); // 👈 Fixed 'add' typo to 'update'
        }
    });


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
            costPrice: formData.costPrice ? Number(formData.costPrice) : 0,
            sellingPrice: formData.sellingPrice ? Number(formData.sellingPrice) : 0,
            stockQuantity: formData.stockQuantity ? Number(formData.stockQuantity) : 0,
            reorderLevel: formData.reorderLevel ? Number(formData.reorderLevel) : 0,
        };

        try {
            if (isEdit) {
                // 2. EDIT BRANCH: shopId intentionally NOT included here — it's
                // resolved from the existing local row inside useUpdateInventoryItem
                // (and from item.id -> server lookup when online), so we never risk
                // clobbering it with an empty value.
                //
                // Photo handling, simplified:
                //   - user picked a new file this session -> send it as `newPhoto`
                //   - user didn't touch the photo, but one already exists -> pass
                //     `photo` through unchanged (works whether it's a real URL or an
                //     offline base64 data: URI — useUpdateInventoryItem/syncEngine
                //     both already know how to handle either case)
                //   - user explicitly removed the photo -> send '' to clear it
                const updateInput: any = { ...mutationPayload, itemId: item.id };

                if (photo) {
                    updateInput.newPhoto = photo;
                } else if (photoPreview) {
                    updateInput.photo = photoPreview;
                } else {
                    updateInput.photo = '';
                }

                await updateInventoryItem({
                    variables: {
                        itemId: item.id,
                        input: updateInput
                    }
                });
            } else {
                await addInventoryItem({
                    variables: { input: { ...mutationPayload, shopId: shopId, photo: photo || null } }
                });
            }
            // 👇 EXECUTE APOLLO MUTATION LAYER PIPELINE

        } catch (err) {
            // Handled cleanly via the useMutation onError lifecycle block callback hooks
            console.error("Inventory mutation execution block trace catch:", err);
        }
    };


    const startCamera = async () => {
        setCameraError(null);
        try {
            console.log('starting camera');
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err: any) {
            console.error("Camera access failed:", err);
            setCameraError(err.message || "Could not access device camera.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    // Watch the master activeTab to toggle hardware safely
    useEffect(() => {
        if (activeTab === 'scanner' && scannerStep === 'camera') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [activeTab, scannerStep]);

    const handleGoBackToCamera = () => {
        setPhoto(null);
        setPhotoPreview('');
        setScannerStep('camera');
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
                <div className="relative flex flex-col w-full h-full min-h-0 overflow-hidden text-text-main">
                    <div className="flex-grow overflow-y-auto min-h-0 flex flex-col ">

                        {/* --- TAB HEADERS --- */}
                        <div className={`flex border-b bg-bg-primary border-[var(--color-border-main)] w-full ${isEdit ? 'hidden' : ''}`}>
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
                                onClick={() => setActiveTab('scanner')}
                                className={`flex-1  py-4 flex flex-row gap-2 items-center justify-center text-sm font-semibold transition-colors duration-200 border-b-3 cursor-pointer
                                ${activeTab === 'scanner'
                                        ? 'border-[var(--color-brand-gold)] text-[var(--color-text-main)]'
                                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-sub)]'
                                    }`}
                            >
                                <Camera className="h-4 w-4" /> AI Image Scanner
                            </button>
                        </div>

                        {/* --- INVENTORY CONTAINER DATA MATRIX --- */}
                        <div className="w-full bg-bg-secondary h-full flex-1 flex">
                            {activeTab === 'manual' ? (
                                <form onSubmit={handleInventoryFormSubmit} className="flex flex-col gap-5 p-6 w-full">

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
                                    <div className="grid grid-cols-2 gap-4 items-end">
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
                                            <label className="text-xs font-semibold text-[var(--color-text-sub)]">Measurement (1g,1kg, 12pcs etc)</label>
                                            <input
                                                type="text"
                                                value={formData.unitOfMeasure}
                                                onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                                                className="w-full px-3 py-2 border border-[var(--color-border-main)] rounded-lg text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-border-muted"
                                                placeholder="1g, 1kg, 12pcs etc"
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
                                    <div className="flex justify-end gap-3 mt-auto">
                                        <button
                                            type="button"
                                            onClick={() => handleCloseInventoryModal(true)}
                                            className="px-5 py-2 bg-[var(--color-bg-primary-hover)] border border-[var(--color-border-main)] text-[var(--color-text-sub)] rounded-lg font-semibold text-sm cursor-pointer hover:bg-[var(--color-border-main)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="px-6 py-2 bg-brand-gold hover:bg-brand-gold-hover text-text-white cursor-pointer rounded-lg hover:bg- disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    <span>{isEdit ? 'Updating...' : 'Adding...'}</span>
                                                </>
                                            ) : (
                                                <span>{isEdit ? 'Update Item' : 'Add Item'}</span>
                                            )}
                                        </button>
                                    </div>

                                </form>
                            ) : activeTab === 'scanner' && (
                                <div className="flex flex-col flex-1 w-full bg-[var(--color-bg-secondary)] ">

                                    {scannerStep === 'camera' && (
                                        <div className="flex flex-col relative isolate flex-1 w-auto mx-2 rounded-[20px] my-2 overflow-hidden bg-[var(--color-bg-secondary)] ">
                                            <ProductScannerCamera
                                                onCaptureComplete={(file, previewUrl, matchedName, unitOfMeasure) => {
                                                    setPhoto(file);
                                                    setPhotoPreview(previewUrl);
                                                    setFormData({
                                                        ...formData,
                                                        unitOfMeasure: unitOfMeasure,
                                                        itemName: matchedName,
                                                    });

                                                    setScannerStep('form');
                                                }}
                                            />
                                        </div>
                                    )}

                                    {scannerStep === 'form' && (
                                        <form onSubmit={handleInventoryFormSubmit} className="flex flex-col flex-1 gap-5 p-6  w-full bg-[var(--color-bg-secondary)]">
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
                                            <div className="grid grid-cols-2 gap-4 items-end">
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
                                                    <label className="text-xs font-semibold text-[var(--color-text-sub)]">Measurement (1g,1kg, 12pcs etc)</label>
                                                    <input
                                                        type="text"
                                                        value={formData.unitOfMeasure}
                                                        onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                                                        className="w-full px-3 py-2 border border-[var(--color-border-main)] rounded-lg text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-border-muted"
                                                        placeholder="1g, 1kg, 12pcs etc"
                                                    />
                                                </div>
                                            </div>

                                            {/* Pre-Populated Snapshot Render Canvas Preview Container */}
                                            <div className="flex flex-col gap-1 text-left w-full">
                                                <label className="text-xs font-semibold text-[var(--color-text-sub)]">Captured Scanner Snapshot</label>
                                                <div className="relative w-full h-48 border border-[var(--color-border-main)] rounded-lg bg-[var(--color-bg-secondary)] overflow-hidden flex items-center justify-center">
                                                    <img src={photoPreview || ''} alt="Product preview grid reference" className="h-full object-contain" />
                                                </div>
                                            </div>

                                            {/* Bottom Window Choice Action Items */}
                                            <div className="flex justify-between items-center mt-auto">
                                                {/* Go Back Left Anchor: Re-triggers camera tab frame loops */}
                                                <button
                                                    type="button"
                                                    onClick={handleGoBackToCamera}
                                                    className="px-4 py-2 bg-[var(--color-bg-primary-hover)] border border-[var(--color-border-main)] text-[var(--color-text-sub)] rounded-lg font-semibold text-sm cursor-pointer hover:bg-[var(--color-border-main)] transition-colors"
                                                >
                                                    ← Go Back to Camera
                                                </button>

                                                <div className="flex gap-3">
                                                    <button
                                                        type="submit"
                                                        disabled={isLoading}
                                                        className="px-6 py-2 bg-brand-gold hover:bg-brand-gold-hover text-text-white cursor-pointer rounded-lg disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                                    >
                                                        {isLoading ? (
                                                            <>
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                                <span>Adding Item...</span>
                                                            </>
                                                        ) : (
                                                            <span>Add Item</span>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </Modal>
            <Modal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                title={isSuccess ? "" : "Error"}
                subtitle=""
                isMobileVariant={false}
                maxWidth="max-w-[340px]"
                isHeaderVisible={false}
                unsetHeight
            >
                <div className="flex flex-col items-center justify-center  min-h-[200px]">
                    {/* Visual Success/Error Indicator Anchor (Optional styling) */}
                    <div className=''>
                        {isSuccess ? (
                            <Check className="w-8 h-8 text-brand-gold" />
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
                        className='mt-6 p-2 px-4 bg-brand-gold hover:bg-brand-gold-hover cursor-pointer text-text-white rounded-lg  transition-colors'
                    >
                        OK
                    </button>
                </div>
            </Modal>

        </>

    );
}