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
import { ProductScannerCamera } from '../components';
import { ChevronLeft } from 'lucide-react';

export default function Checkout({ isOpen, onClose, data }: { isOpen: boolean, onClose: () => void, data?: any }) {


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

            handleCloseInventoryModal(false);
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

    const handleCameraCapture = () => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 640;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (!blob) return;

            const capturedFile = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });

            // Lock the image binary file and preview string instantly
            setPhoto(capturedFile);
            setPhotoPreview(URL.createObjectURL(capturedFile));

            // Shut off the lens and advance smoothly to Step 2
            stopCamera();
            setScannerStep('form');
            setFormData({ ...formData, itemName: 'name here ' });
        }, 'image/jpeg', 0.85);
    };

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
                isFullScreenModal
                title={isEdit ? 'Update Item' : 'Add Item to Cart'}
                subtitle=''
                customHeader={<div className={` flex items-center  px-2 py-6 `}>
                    {/* 💡 Note: layout="position" is safe to leave here, or remove if unneeded */}
                    <button
                        onClick={() => { handleCloseInventoryModal(); onClose(); }}
                        className="p-1.5 text-text-sub hover:text-text-main hover:bg-item-hover z-1 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                        <ChevronLeft size={18} strokeWidth={2.5} />
                    </button>
                    <div className="flex-1 flex  min-w-0 pr-4 -ml-4 text-center self-center justify-center">
                        <h2 className="text-lg font-bold text-text-main  leading-tight truncate">{activeTab === 'manual' ? 'Add Item' : activeTab === 'scanner' ? 'Scan Item' : 'Checkout'}</h2>
                    </div>

                </div>}
            >
                {/* HEADER BLOCK for fullscreen modals */}

                <div className="flex flex-col w-full bg-bg-primary flex-1 h-full ">

                    {/* --- TAB HEADERS --- */}
                    <div className='mx-4'>
                        <div className="flex bg-bg-primary my-2 rounded-full w-full max-w-xl  border border-border-main ">
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
                                Checkout
                            </button>
                        </div>
                    </div>

                    {/* --- INVENTORY CONTAINER DATA MATRIX --- */}
                    <div className="w-full bg-bg-primary h-full flex-1 flex">
                        {activeTab === 'manual' ? (
                            <form onSubmit={handleInventoryFormSubmit} className="flex flex-col gap-5 md:p-6 p-5 w-full">

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
                                <div className="grid grid-cols-1 gap-4">
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
                                <div className="grid grid-cols-1 gap-4 items-end">
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
                                        <label className="text-xs font-semibold text-[var(--color-text-sub)]">Unit of Measure (1g,1kg, 12pcs etc)</label>
                                        <input
                                            type="text"
                                            value={formData.unitOfMeasure}
                                            onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                                            className="w-full px-3 py-2 border border-[var(--color-border-main)] rounded-lg text-[var(--color-text-main)] bg-[var(--color-bg-primary)] focus:outline-none focus:border-border-muted"
                                            placeholder="1g, 1kg, 12pcs etc"
                                        />
                                    </div>
                                </div>

                                {/* Bottom Window Choice Action Items */}
                                <div className="flex justify-center w-full  gap-3 mt-auto">

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="px-6 py-3 justify-center font-semibold w-full text-center bg-brand-gold hover:bg-brand-gold-hover text-text-white cursor-pointer rounded-xl hover:bg- disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                <span>{isEdit ? 'Updating...' : 'Adding...'}</span>
                                            </>
                                        ) : (
                                            <span>{isEdit ? 'Update Item' : 'Add Item to Cart'}</span>
                                        )}
                                    </button>
                                </div>

                            </form>
                        ) : activeTab === 'scanner' && (
                            /* --- DISPATCH SCANNER HARDWARE SLOT --- */
                            <div className="flex flex-col flex-1 h-full w-full bg-[var(--color-bg-secondary)] min-h-0 md:min-h-[521px]">

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
                                    <form onSubmit={handleInventoryFormSubmit} className="flex flex-col h-full gap-5 md:p-6 p-5 w-full bg-[var(--color-bg-primary)]">
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
                                        <div className="grid grid-cols-1 gap-4">

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
                                        <div className="grid grid-cols-1 gap-4">
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
                                                <label className="text-xs font-semibold text-[var(--color-text-sub)]">Unit of Measure (1g,1kg, 12pcs etc)</label>
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


                                            <div className="flex gap-3 w-full">
                                                <button
                                                    type="button"
                                                    onClick={handleGoBackToCamera}
                                                    className="px-2 md:px-4  py-2 md:w-[200px] w-[150px] bg-[var(--color-bg-primary-hover)] border border-[var(--color-border-main)] text-[var(--color-text-sub)] rounded-xl font-bold text-xs md:text-sm cursor-pointer hover:bg-[var(--color-border-main)] transition-colors"
                                                >
                                                    ← Go Back to Camera
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={isLoading}
                                                    className="px-6 py-3 text-sm md:text-sm align-center justify-center font-semibold flex-1 w-full flex bg-brand-gold hover:bg-brand-gold-hover text-text-white cursor-pointer rounded-xl disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                                >
                                                    {isLoading ? (
                                                        <>
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                            <span>Adding Item...</span>
                                                        </>
                                                    ) : (
                                                        <span>Add Item to cart</span>
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
            </Modal>
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