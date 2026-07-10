
import { useState, useRef, type ChangeEvent } from 'react';
//import { LocationPicker } from './LocationPicker';
import { useMutation } from '@apollo/client/react';
import { CREATE_SHOP_MUTATION, UPDATE_SHOP_MUTATION } from '~/api/graphql';
import type { Shop } from "~/types/shop";
import { useDispatch } from 'react-redux';
import { addShop, updateShop } from '~/store/myShopsSlice';
import { setAddShopModalOpen } from '~/store/uiSlice';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400';

// Inline SVG icons
const XIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const ImageIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);


export const ShopForm = ({ data }: { data?: Shop }) => {

    console.log('is this loggn');
    const isEdit: boolean = !!data && Object.keys(data).length > 0;
    const shop: Shop | undefined = data

    console.log(isEdit, shop);

    const dispatch = useDispatch();


    const [createShop, { loading: createLoading }] = useMutation(CREATE_SHOP_MUTATION, {
        onCompleted: (res: any) => {
            console.log('res this shop', res);
            dispatch(addShop(res.createShop));
            dispatch(setAddShopModalOpen(false));
        },
        onError: (err) => {
            console.error("Create Shop Mutation Error:", err);
        }
    });
    // 1. Initialize your Apollo Client Mutation hook with an explicit completion listener
    const [updateShopMutation, { loading: isMutationLoading }] = useMutation(UPDATE_SHOP_MUTATION, {
        onCompleted: (res: any) => {
            if (res?.updateShop) {
                //  DISPATCH ACTION: Updates the shop item where ID matches instantly inside the Redux array
                dispatch(updateShop(res.updateShop));
                dispatch(setAddShopModalOpen(false));
            }
        },
        onError: (err) => {
            console.error("GraphQL Save Failure:", err);
            alert("Failed to sync structural edits to database.");
        }
    });

    const onCancel = () => { }
    const isLoading = createLoading || isMutationLoading

    const [formData, setFormData] = useState({
        name: shop?.shopName || '',
        description: shop?.description || '',
        phone: shop?.contactDetails?.phone || '',
        email: shop?.contactDetails?.email || '',
        address: shop?.contactDetails?.address || '',
        coverPhotoUrl: shop?.photo || DEFAULT_IMAGE,
        coordinates: shop?.coordinates || { lat: 14.5995, lng: 120.9842 },
        openTime: shop?.businessHours?.openTime || '08:00',
        closeTime: shop?.businessHours?.closeTime || '20:00',
        businessDays: shop?.businessHours?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    });

    // Cover photo upload state - track existing and new separately like EditPostModal
    const [existingCoverPhoto, setExistingCoverPhoto] = useState<string>(typeof shop?.photo === 'string' ? shop.photo : '');
    const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
    const [newCoverPreview, setNewCoverPreview] = useState<string>('');


    const fileInputRef = useRef<HTMLInputElement>(null);

    // Combined preview for display
    const coverPhotoPreview = newCoverPreview || existingCoverPhoto;

    const handleLocationSelect = (coordinates: { lat: number; lng: number }, address: string) => {
        console.log('Location selected in ShopForm:', coordinates, address);
        setFormData(prev => ({
            ...prev,
            coordinates,
            address: address
        }));
    };

    const handleCoverPhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];

        // Revoke previous preview URL if it was a blob URL
        if (newCoverPreview && newCoverPreview.startsWith('blob:')) {
            URL.revokeObjectURL(newCoverPreview);
        }

        setNewCoverFile(file);
        const preview = URL.createObjectURL(file);
        setNewCoverPreview(preview);
    };

    const removeCoverPhoto = () => {
        if (newCoverPreview && newCoverPreview.startsWith('blob:')) {
            URL.revokeObjectURL(newCoverPreview);
        }
        // If there's a new file, remove it
        if (newCoverFile) {
            setNewCoverFile(null);
            setNewCoverPreview('');
        } else {
            // Otherwise remove the existing
            setExistingCoverPhoto('');
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    console.log(existingCoverPhoto, 'this is cover hpoto')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name) {
            alert('Please fill in shop name');
            return;
        }

        {
            /*
    if (!formData.address) {
            alert('Please select a location');
            return;
        }
            */
        }


        // Build complete Shop object with all required fields for API
        // Build complete Shop object with all required fields for API
        const shopData: Shop = {
            // 🟢 FIXED: Send the raw File object if it exists, otherwise pass null
            photo: newCoverFile ? newCoverFile : existingCoverPhoto ? existingCoverPhoto : null,
            photos: [], // Add your carousel file arrays here if you have any
            shopName: formData.name,
            description: formData.description,
            address: '123',
            coordinates: {
                lat: 123,
                lng: 123
            },
            contactDetails: {
                phone: formData.phone,
                email: formData.email,
                address: formData.address
            },
            paymentMethods: {
                cash: false,
                gcash: false,
                paymaya: false,
                card: false
            },
            delivery: {
                available: false,
                radius: 0,
                fee: 0
            },
            socialMedia: {
                facebook: '',
                instagram: ''
            },
            businessHours: {
                openTime: formData.openTime,
                closeTime: formData.closeTime,
                days: formData.businessDays
            },
        };


        console.log(existingCoverPhoto, shopData);

        if (isEdit) {
            updateShopMutation({
                variables: {
                    input: {
                        ...shopData,
                        shopId: shop?.id // 🟢 FIXED: Maps the identifier to the correct backend expected key name
                    }
                }
            });
        } else {
            createShop({
                variables: {
                    input: shopData
                }
            });
        }

        // Pass both existing URL and new File - upload happens via GraphQL mutation
        // Like EditPostModal: passes existing photos + new files
    };

    return (
        <div className="w-full max-h-[80vh] md:max-h-[80vh] ">
            <div className="bg-bg-secondary rounded-lg p-6 shadow-lg">
                {
                    /*
        <h2 className="text-2xl font-semibold mb-6">
                    {shop ? 'Edit Shop' : 'Add New Shop'}
                </h2>
                    */
                }

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm text-text-main font-medium mb-2">Shop Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border text-text-main focus:outline-none border-zinc-300 dark:border-zinc-600 rounded-lg bg-bg-primary  focus:ring-2 focus:ring-primary"
                                placeholder="Enter shop name"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-text-main font-medium mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 focus:outline-none text-text-main border border-zinc-300 dark:border-zinc-600 rounded-lg bg-bg-primary  focus:ring-2 focus:ring-primary"
                            placeholder="Describe your shop, what you sell, special offers, etc."
                            rows={4}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-text-main font-medium mb-2">Phone</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 focus:outline-none text-text-main border border-zinc-300 dark:border-zinc-600 rounded-lg bg-bg-primary  focus:ring-2 focus:ring-primary"
                                placeholder="+63 XXX XXX XXXX"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-text-main font-medium mb-2">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2  focus:outline-none text-text-main   border border-zinc-300 dark:border-zinc-600 rounded-lg bg-bg-primary  focus:ring-2 focus:ring-primary"
                                placeholder="shop@email.com"
                            />
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                            <span className="text-amber-600 dark:text-amber-400 text-sm">⚠️</span>
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                <strong>Privacy Notice:</strong> Don't put your personal phone number or email to prevent receiving spam messages or calls. Use a business contact instead.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-text-main font-medium mb-2">Full Address *</label>
                        <div className="relative">
                            {
                                /*
                            <LocationPicker
                                onLocationSelect={handleLocationSelect}
                                initialLocation={formData.coordinates}
                                initialAddress={formData.address}
                            />

                                */

                            }

                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                Click button to select location on map
                            </p>
                        </div>
                    </div>

                    {/* Business Hours */}
                    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                        <label className="block text-sm text-text-main font-medium mb-4">Business Hours</label>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-text-main mb-1">Open Time</label>
                                <input
                                    type="time"
                                    value={formData.openTime}
                                    onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                                    className="w-full focus:outline-none px-3 py-2 border text-text-main border-zinc-300 dark:border-zinc-600 rounded-lg bg-bg-primary  focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-main mb-1">Close Time</label>
                                <input
                                    type="time"
                                    value={formData.closeTime}
                                    onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                                    className="w-full px-3 focus:outline-none py-2 border text-text-main border-zinc-300 dark:border-zinc-600 rounded-lg bg-bg-primary  focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-text-main   mb-2">Operating Days</label>
                            <div className="flex flex-wrap gap-2">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => {
                                            const currentDays = formData.businessDays;
                                            const newDays = currentDays.includes(day)
                                                ? currentDays.filter(d => d !== day)
                                                : [...currentDays, day];
                                            setFormData({ ...formData, businessDays: newDays });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-sm  text-text-main font-medium transition-colors ${formData.businessDays.includes(day)
                                            ? 'bg-brand-gold text-white '
                                            : 'bg-zinc-100 dark:bg-zinc-700 text-text-main hover:bg-zinc-200 dark:hover:bg-zinc-600'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Cover Photo Upload */}
                    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                        <label className="block text-sm text-text-main font-medium mb-4">Cover Photo</label>

                        {/* Photo preview */}
                        {coverPhotoPreview ? (
                            <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 mb-4">
                                <img
                                    src={coverPhotoPreview}
                                    alt="Cover preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.src = DEFAULT_IMAGE;
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={removeCoverPhoto}
                                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                                >
                                    <XIcon className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        ) : (
                            <div className="aspect-video rounded-lg bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center mb-4">
                                <div className="text-center">
                                    <ImageIcon className="w-12 h-12 text-zinc-400 mx-auto mb-2" />
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No cover photo selected</p>
                                </div>
                            </div>
                        )}

                        {/* Upload button */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-primary text-text-main rounded-lg hover:bg-primary-700 dark:hover:bg-primary-700 transition-colors"
                            >
                                <ImageIcon className="w-5 h-5" />
                                <span>{coverPhotoPreview ? 'Change Photo' : 'Upload Photo'}</span>
                            </button>
                            {coverPhotoPreview && (
                                <span className="text-sm text-text-main dark:text-zinc-400">
                                    {newCoverFile ? 'New photo selected' : (existingCoverPhoto ? 'Using existing photo' : '')}
                                </span>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleCoverPhotoSelect}
                            className="hidden"
                        />

                        <p className="text-xs text-text-main mt-2">
                            Max 5MB. Recommended aspect ratio: 16:9
                        </p>
                    </div>

                    <div className="flex gap-4 justify-end">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isLoading}
                            className="px-6 py-2 cursor-pointer bg-zinc-200 dark:bg-zinc-700 text-text-main rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            </div>
        </div>
    );
}