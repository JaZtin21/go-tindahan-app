import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
    GET_RESTAURANT_INFO_QUERY,
    UPDATE_RESTAURANT_INFO_MUTATION,
    GET_MENU_ITEMS_QUERY,
    CREATE_MENU_ITEM_MUTATION,
    UPDATE_MENU_ITEM_MUTATION,
    DELETE_MENU_ITEM_MUTATION,
} from '~/api/queries/graphql/restaurant';
import { useRestaurantId } from '~/utils/useRestaurantId';
import type { MenuItem } from '~/types/restaurant';

const inputCls =
    'w-full px-3 py-2 rounded-xl border border-border-main bg-bg-primary text-sm font-semibold text-text-main placeholder:text-text-muted outline-none focus:border-brand-gold/60 transition-colors duration-150';
const labelCls = 'block text-[11px] font-black uppercase tracking-wider text-text-muted mb-1.5';
const btnPrimary =
    'px-4 py-2.5 rounded-xl bg-brand-gold text-bg-black font-black text-sm hover:bg-brand-gold-hover transition-all duration-200 cursor-pointer active:scale-95';
const btnGhost =
    'px-4 py-2.5 rounded-xl border border-border-main bg-bg-primary text-text-sub font-bold text-sm hover:bg-item-hover transition-all duration-200 cursor-pointer active:scale-95';

const dollars = (cents: number) => (cents / 100).toFixed(2);
const toCents = (dollars: string) => Math.max(0, Math.round((parseFloat(dollars) || 0) * 100));

interface InfoForm {
    name: string;
    phone: string;
    email: string;
    addressLine1: string;
    suburb: string;
    state: string;
    postcode: string;
    cuisineType: string;
    description: string;
    parkingInfo: string;
}

export const InfoPage = () => {
    const activeRestaurantId = useRestaurantId();

    // --- Restaurant profile -------------------------------------------------
    const { data: infoData, loading: infoLoading } = useQuery(GET_RESTAURANT_INFO_QUERY, {
        variables: { id: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
        fetchPolicy: 'network-only',
    });

    const [form, setForm] = useState<InfoForm>({
        name: '', phone: '', email: '', addressLine1: '', suburb: '', state: '', postcode: '',
        cuisineType: '', description: '', parkingInfo: '',
    });
    const [infoSaved, setInfoSaved] = useState(false);

    useEffect(() => {
        const r = (infoData as any)?.restaurant;
        if (r) {
            setForm({
                name: r.name ?? '',
                phone: r.phone ?? '',
                email: r.email ?? '',
                addressLine1: r.addressLine1 ?? '',
                suburb: r.suburb ?? '',
                state: r.state ?? '',
                postcode: r.postcode ?? '',
                cuisineType: r.cuisineType ?? '',
                description: r.description ?? '',
                parkingInfo: r.parkingInfo ?? '',
            });
        }
    }, [infoData]);

    const [updateRestaurant, { loading: savingInfo }] = useMutation(UPDATE_RESTAURANT_INFO_MUTATION);

    const handleSaveInfo = async () => {
        if (!activeRestaurantId) return;
        setInfoSaved(false);
        try {
            await updateRestaurant({ variables: { id: activeRestaurantId, input: form } });
            setInfoSaved(true);
            setTimeout(() => setInfoSaved(false), 2500);
        } catch (err: any) {
            window.alert(err?.message ?? 'Failed to save restaurant info');
        }
    };

    // --- Menu items ----------------------------------------------------------
    const { data: menuData, loading: menuLoading, refetch: refetchMenu } = useQuery(GET_MENU_ITEMS_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
        fetchPolicy: 'network-only',
    });
    const items = useMemo(() => ((menuData as any)?.menuItems as MenuItem[]) ?? [], [menuData]);

    const [createItem] = useMutation(CREATE_MENU_ITEM_MUTATION);
    const [updateItem] = useMutation(UPDATE_MENU_ITEM_MUTATION);
    const [deleteItem] = useMutation(DELETE_MENU_ITEM_MUTATION);

    const [editing, setEditing] = useState<MenuItem | null>(null);
    const [itemForm, setItemForm] = useState({
        name: '', price: '0.00', category: '', description: '', allergens: '', isAvailable: true,
    });

    const resetItemForm = () => {
        setItemForm({ name: '', price: '0.00', category: '', description: '', allergens: '', isAvailable: true });
        setEditing(null);
    };

    const openEdit = (m: MenuItem) => {
        setEditing(m);
        setItemForm({
            name: m.name,
            price: dollars(m.priceCents),
            category: m.category ?? '',
            description: m.description ?? '',
            allergens: (m.allergens ?? []).join(', '),
            isAvailable: m.isAvailable,
        });
    };

    const handleSaveItem = async () => {
        if (!activeRestaurantId) return;
        if (!itemForm.name.trim()) {
            window.alert('Item name is required.');
            return;
        }
        const allergens = itemForm.allergens.split(',').map((s) => s.trim()).filter(Boolean);
        try {
            if (editing) {
                await updateItem({
                    variables: {
                        id: editing.id,
                        input: {
                            name: itemForm.name.trim(),
                            priceCents: toCents(itemForm.price),
                            category: itemForm.category.trim() || null,
                            description: itemForm.description.trim() || null,
                            allergens,
                            isAvailable: itemForm.isAvailable,
                        },
                    },
                });
            } else {
                await createItem({
                    variables: {
                        input: {
                            restaurantId: activeRestaurantId,
                            name: itemForm.name.trim(),
                            priceCents: toCents(itemForm.price),
                            category: itemForm.category.trim() || null,
                            description: itemForm.description.trim() || null,
                            allergens,
                        },
                    },
                });
            }
            resetItemForm();
            refetchMenu();
        } catch (err: any) {
            window.alert(err?.message ?? 'Failed to save menu item');
        }
    };

    const handleDeleteItem = async (m: MenuItem) => {
        if (!window.confirm(`Delete "${m.name}" from the menu?`)) return;
        try {
            await deleteItem({ variables: { id: m.id } });
            if (editing?.id === m.id) resetItemForm();
            refetchMenu();
        } catch (err: any) {
            window.alert(err?.message ?? 'Failed to delete menu item');
        }
    };

    const handleToggleAvailable = async (m: MenuItem) => {
        try {
            await updateItem({ variables: { id: m.id, input: { isAvailable: !m.isAvailable } } });
            refetchMenu();
        } catch (err: any) {
            window.alert(err?.message ?? 'Failed to update item');
        }
    };

    if (!activeRestaurantId) {
        return <p className="py-16 text-center text-text-muted text-sm font-bold">Select a restaurant to edit its info and menu.</p>;
    }

    const loading = infoLoading || menuLoading;

    return (
        <div>
            <h2 className="text-xl font-black text-text-main tracking-tight m-0">Restaurant Info & Menu</h2>
            <p className="mt-1 mb-5 text-xs font-bold text-text-muted">
                This is what the AI phone agent reads from — hours come from Settings, everything here is answered directly to callers.
            </p>

            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading…</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                    {/* --- Restaurant profile card --- */}
                    <section className="border border-border-main rounded-2xl bg-bg-primary p-5">
                        <h3 className="text-sm font-black text-text-main tracking-tight m-0 mb-1">Profile</h3>
                        <p className="text-[11px] font-bold text-text-muted mb-4">
                            Address, cuisine, and parking — callers hear these when they ask about the restaurant.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Name</label>
                                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>Phone</label>
                                <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>Email</label>
                                <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>Cuisine</label>
                                <input className={inputCls} value={form.cuisineType} onChange={(e) => setForm({ ...form, cuisineType: e.target.value })} placeholder="e.g. Italian" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelCls}>Address line</label>
                                <input className={inputCls} value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>Suburb</label>
                                <input className={inputCls} value={form.suburb} onChange={(e) => setForm({ ...form, suburb: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>State</label>
                                    <input className={inputCls} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                                </div>
                                <div>
                                    <label className={labelCls}>Postcode</label>
                                    <input className={inputCls} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelCls}>Description (short blurb callers hear)</label>
                                <textarea
                                    className={`${inputCls} min-h-[70px] resize-y`}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="e.g. Family-run modern Filipino kitchen in the heart of the district."
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelCls}>Parking</label>
                                <input
                                    className={inputCls}
                                    value={form.parkingInfo}
                                    onChange={(e) => setForm({ ...form, parkingInfo: e.target.value })}
                                    placeholder="e.g. Free street parking after 6 PM, paid lot across the road"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mt-4">
                            <button onClick={handleSaveInfo} disabled={savingInfo} className={btnPrimary}>
                                {savingInfo ? 'Saving…' : 'Save info'}
                            </button>
                            {infoSaved && <span className="text-xs font-bold text-brand-gold">Saved ✓</span>}
                        </div>
                    </section>

                    {/* --- Menu card --- */}
                    <section className="border border-border-main rounded-2xl bg-bg-primary p-5">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-black text-text-main tracking-tight m-0">Menu</h3>
                            <span className="text-[11px] font-bold text-text-muted">{items.length} item{items.length === 1 ? '' : 's'}</span>
                        </div>
                        <p className="text-[11px] font-bold text-text-muted mb-4">
                            Callers can ask about dishes, prices, and allergens. Sold-out items can be toggled off instead of deleted.
                        </p>

                        {/* Add / edit form */}
                        <div className="border border-brand-gold/30 rounded-xl bg-bg-secondary/50 p-3.5 mb-4">
                            <p className="text-xs font-black text-brand-gold mb-2.5">{editing ? 'Edit item' : 'Add item'}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                    <label className={labelCls}>Name *</label>
                                    <input className={inputCls} value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Pork Sisig" />
                                </div>
                                <div>
                                    <label className={labelCls}>Price ($)</label>
                                    <input className={inputCls} value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} inputMode="decimal" />
                                </div>
                                <div>
                                    <label className={labelCls}>Category</label>
                                    <input className={inputCls} value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} placeholder="e.g. Mains" />
                                </div>
                                <div>
                                    <label className={labelCls}>Allergens (comma separated)</label>
                                    <input className={inputCls} value={itemForm.allergens} onChange={(e) => setItemForm({ ...itemForm, allergens: e.target.value })} placeholder="e.g. peanuts, gluten" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={labelCls}>Description</label>
                                    <input className={inputCls} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="e.g. Crispy pork belly, onion, chilli, calamansi" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <label className="flex items-center gap-2 text-xs font-bold text-text-sub cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={itemForm.isAvailable}
                                        onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                                        className="h-4 w-4 accent-brand-gold"
                                    />
                                    Available
                                </label>
                                <div className="flex gap-2">
                                    {editing && (
                                        <button onClick={resetItemForm} className={btnGhost}>
                                            Cancel
                                        </button>
                                    )}
                                    <button onClick={handleSaveItem} className={btnPrimary}>
                                        {editing ? 'Save changes' : '+ Add item'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {items.length === 0 ? (
                            <div className="border border-dashed border-border-main rounded-xl py-10 text-center text-text-muted text-sm font-bold">
                                No menu items yet — add your first dish above.
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                                {items.map((m) => (
                                    <li key={m.id} className="border border-border-main rounded-xl p-3 flex items-start justify-between gap-3 bg-bg-primary hover:border-brand-gold/40 transition-colors duration-150">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <strong className={`text-sm ${m.isAvailable ? 'text-text-main' : 'text-text-muted line-through'}`}>{m.name}</strong>
                                                {m.category && <span className="text-[10px] font-black uppercase tracking-wider text-text-muted border border-border-main rounded-full px-2 py-0.5">{m.category}</span>}
                                                <span className="text-sm font-black text-brand-gold">${dollars(m.priceCents)}</span>
                                            </div>
                                            {m.description && <p className="text-xs font-semibold text-text-muted mt-1 truncate">{m.description}</p>}
                                            {m.allergens.length > 0 && (
                                                <p className="text-[11px] font-bold text-brand-red/80 mt-1">⚠ {m.allergens.join(', ')}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <button
                                                onClick={() => handleToggleAvailable(m)}
                                                title={m.isAvailable ? 'Mark sold out' : 'Mark available'}
                                                className={`px-2.5 py-1.5 text-[11px] font-black rounded-lg border transition-colors duration-150 cursor-pointer ${m.isAvailable ? 'border-border-main text-text-sub hover:bg-item-hover' : 'border-brand-gold/50 text-brand-gold hover:bg-brand-gold/10'}`}
                                            >
                                                {m.isAvailable ? 'In stock' : 'Sold out'}
                                            </button>
                                            <button onClick={() => openEdit(m)} className="px-2.5 py-1.5 text-[11px] font-black rounded-lg border border-border-main text-text-sub hover:bg-item-hover transition-colors duration-150 cursor-pointer">
                                                Edit
                                            </button>
                                            <button onClick={() => handleDeleteItem(m)} className="px-2.5 py-1.5 text-[11px] font-black rounded-lg border border-brand-red/30 bg-brand-red/10 text-brand-red hover:bg-brand-red/20 transition-colors duration-150 cursor-pointer">
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
};

export default InfoPage;
