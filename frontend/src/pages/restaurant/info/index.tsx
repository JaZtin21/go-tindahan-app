import React, { useEffect, useMemo, useState } from 'react';
import { Building2, UtensilsCrossed, AlertTriangle, Pencil, Trash2, Check, Plus, Info } from 'lucide-react';
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
import { MenuItemModal } from './components/MenuItemModal';

const inputCls =
    'w-full px-3 py-2 rounded-xl border border-border-main/70 bg-bg-primary/70 text-sm font-semibold text-text-main placeholder:text-text-muted outline-none focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20 transition-all duration-150';
const labelCls = 'block text-[11px] font-black uppercase tracking-wider text-text-muted mb-1.5';
const btnPrimary =
    'px-4 py-2.5 rounded-xl bg-brand-gold text-text-white font-black text-sm hover:bg-brand-gold-hover transition-all duration-200 cursor-pointer active:scale-95';

const dollars = (cents: number) => (cents / 100).toFixed(2);

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

interface MenuItemInput {
    name: string;
    priceCents: number;
    category: string;
    description: string;
    allergens: string[];
    isAvailable: boolean;
}

type InfoTab = 'info' | 'menu';

export const InfoPage = () => {
    const activeRestaurantId = useRestaurantId();
    const [tab, setTab] = useState<InfoTab>('info');

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

    const [createItem, { loading: savingItem }] = useMutation(CREATE_MENU_ITEM_MUTATION);
    const [updateItem] = useMutation(UPDATE_MENU_ITEM_MUTATION);
    const [deleteItem] = useMutation(DELETE_MENU_ITEM_MUTATION);

    const [editing, setEditing] = useState<MenuItem | null>(null);
    const [menuModalOpen, setMenuModalOpen] = useState(false);

    const openAdd = () => {
        setEditing(null);
        setMenuModalOpen(true);
    };

    const openEdit = (m: MenuItem) => {
        setEditing(m);
        setMenuModalOpen(true);
    };

    const closeModal = () => {
        setMenuModalOpen(false);
        setEditing(null);
    };

    const handleSaveItem = async (input: MenuItemInput) => {
        if (!activeRestaurantId) return;
        try {
            if (editing) {
                await updateItem({
                    variables: {
                        id: editing.id,
                        input: {
                            name: input.name,
                            priceCents: input.priceCents,
                            category: input.category || null,
                            description: input.description || null,
                            allergens: input.allergens,
                            isAvailable: input.isAvailable,
                        },
                    },
                });
            } else {
                await createItem({
                    variables: {
                        input: {
                            restaurantId: activeRestaurantId,
                            name: input.name,
                            priceCents: input.priceCents,
                            category: input.category || null,
                            description: input.description || null,
                            allergens: input.allergens,
                        },
                    },
                });
            }
            closeModal();
            refetchMenu();
        } catch (err: any) {
            window.alert(err?.message ?? 'Failed to save menu item');
        }
    };

    const handleDeleteItem = async (m: MenuItem) => {
        if (!window.confirm(`Delete "${m.name}" from the menu?`)) return;
        try {
            await deleteItem({ variables: { id: m.id } });
            if (editing?.id === m.id) closeModal();
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

    const tabBtn = (active: boolean) =>
        `flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs transition-all duration-200 active:scale-95 ${
            active
                ? 'bg-brand-gold font-black text-text-white shadow-md shadow-brand-gold/20'
                : 'font-bold text-text-sub hover:bg-item-hover hover:text-text-main'
        }`;

    return (
        <div>
            <h2 className="m-0 text-xl font-black tracking-tight text-text-main">Restaurant Info & Menu</h2>
            <p className="mt-1 mb-5 text-xs font-bold text-text-muted">
                This is what the AI phone agent reads from — hours come from Settings, everything here is answered directly to callers.
            </p>

            {/* Tab selector */}
            <div className="mb-5 flex w-fit gap-1.5 rounded-2xl border border-border-main/60 bg-bg-primary/60 p-1.5 backdrop-blur-sm">
                <button onClick={() => setTab('info')} className={tabBtn(tab === 'info')}>
                    <Info size={15} strokeWidth={2.2} />
                    Restaurant Info
                </button>
                <button onClick={() => setTab('menu')} className={tabBtn(tab === 'menu')}>
                    <UtensilsCrossed size={15} strokeWidth={2.2} />
                    Menu
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-3 py-16">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-gold border-t-transparent"></span>
                    <p className="m-0 text-sm font-bold text-text-muted">Loading…</p>
                </div>
            ) : tab === 'info' ? (
                /* ------------------------- RESTAURANT INFO TAB ------------------------- */
                <section className="glass-panel rounded-2xl p-5 sm:p-6">
                    <div className="mb-1 flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
                            <Building2 size={15} strokeWidth={2.2} />
                        </span>
                        <h3 className="m-0 text-sm font-black tracking-tight text-text-main">Profile</h3>
                    </div>
                    <p className="mb-4 text-[11px] font-bold text-text-muted">
                        Address, cuisine, and parking — callers hear these when they ask about the restaurant.
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

                    <div className="mt-4 flex items-center gap-3">
                        <button onClick={handleSaveInfo} disabled={savingInfo} className={btnPrimary}>
                            {savingInfo ? 'Saving…' : 'Save info'}
                        </button>
                        {infoSaved && (
                            <span className="flex items-center gap-1 text-xs font-bold text-brand-gold">
                                <Check size={13} strokeWidth={2.5} />
                                Saved
                            </span>
                        )}
                    </div>
                </section>
            ) : (
                /* ----------------------------- MENU TAB ----------------------------- */
                <section className="glass-panel rounded-2xl p-5 sm:p-6">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green">
                                <UtensilsCrossed size={15} strokeWidth={2.2} />
                            </span>
                            <h3 className="m-0 text-sm font-black tracking-tight text-text-main">Menu</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full border border-border-main/60 bg-bg-primary/60 px-2.5 py-0.5 text-[11px] font-bold text-text-muted">
                                {items.length} item{items.length === 1 ? '' : 's'}
                            </span>
                            <button
                                onClick={openAdd}
                                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-gold px-3.5 py-2 text-xs font-black text-text-white shadow-md shadow-brand-gold/20 transition-all duration-200 hover:bg-brand-gold-hover active:scale-95"
                            >
                                <Plus size={14} strokeWidth={2.5} />
                                Add item
                            </button>
                        </div>
                    </div>
                    <p className="mb-4 text-[11px] font-bold text-text-muted">
                        Callers can ask about dishes, prices, and allergens. Sold-out items can be toggled off instead of deleted.
                    </p>

                    {items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border-main/70 py-10 text-center text-sm font-bold text-text-muted">
                            No menu items yet — add your first dish to get started.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {items.map((m) => (
                                <li
                                    key={m.id}
                                    className="card-lift flex items-start justify-between gap-3 rounded-xl border border-border-main/60 bg-bg-primary/60 p-3 backdrop-blur-sm hover:border-brand-gold/40"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <strong className={`text-sm ${m.isAvailable ? 'text-text-main' : 'text-text-muted line-through'}`}>{m.name}</strong>
                                            {m.category && <span className="rounded-full border border-border-main px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-text-muted">{m.category}</span>}
                                            <span className="text-sm font-black text-brand-gold">${dollars(m.priceCents)}</span>
                                        </div>
                                        {m.description && <p className="mt-1 truncate text-xs font-semibold text-text-muted">{m.description}</p>}
                                        {m.allergens.length > 0 && (
                                            <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-brand-red/80">
                                                <AlertTriangle size={12} strokeWidth={2.2} />
                                                {m.allergens.join(', ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 gap-1.5">
                                        <button
                                            onClick={() => handleToggleAvailable(m)}
                                            title={m.isAvailable ? 'Mark sold out' : 'Mark available'}
                                            className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition-colors duration-150 ${
                                                m.isAvailable ? 'border-border-main text-text-sub hover:bg-item-hover' : 'border-brand-gold/50 text-brand-gold hover:bg-brand-gold/10'
                                            }`}
                                        >
                                            {m.isAvailable ? 'In stock' : 'Sold out'}
                                        </button>
                                        <button onClick={() => openEdit(m)} className="flex cursor-pointer items-center gap-1 rounded-lg border border-border-main px-2.5 py-1.5 text-[11px] font-black text-text-sub transition-colors duration-150 hover:bg-item-hover">
                                            <Pencil size={11} strokeWidth={2.2} />
                                            Edit
                                        </button>
                                        <button onClick={() => handleDeleteItem(m)} className="flex cursor-pointer items-center gap-1 rounded-lg border border-brand-red/30 bg-brand-red/10 px-2.5 py-1.5 text-[11px] font-black text-brand-red transition-colors duration-150 hover:bg-brand-red/20">
                                            <Trash2 size={11} strokeWidth={2.2} />
                                            Delete
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {menuModalOpen && (
                <MenuItemModal
                    editing={editing}
                    saving={savingItem}
                    onClose={closeModal}
                    onSave={handleSaveItem}
                />
            )}
        </div>
    );
};

export default InfoPage;
