import React, { useEffect, useState } from 'react';
import { X, UtensilsCrossed, DollarSign, Tag, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { InputAdornment } from '~/components/InputAdornment';
import type { MenuItem } from '~/types/restaurant';

interface MenuItemModalProps {
    editing: MenuItem | null;
    saving?: boolean;
    /** Mutation failure message — rendered inside the modal so it's never hidden behind the backdrop. */
    error?: string | null;
    onClose: () => void;
    onSave: (input: {
        name: string;
        priceCents: number;
        category: string;
        description: string;
        allergens: string[];
        isAvailable: boolean;
    }) => void;
}

const dollars = (cents: number) => (cents / 100).toFixed(2);
const toCents = (d: string) => Math.max(0, Math.round((parseFloat(d) || 0) * 100));

export const MenuItemModal = ({ editing, saving, error, onClose, onSave }: MenuItemModalProps) => {
    const [name, setName] = useState(editing?.name ?? '');
    const [price, setPrice] = useState(editing ? dollars(editing.priceCents) : '0.00');
    const [category, setCategory] = useState(editing?.category ?? '');
    const [allergens, setAllergens] = useState((editing?.allergens ?? []).join(', '));
    const [description, setDescription] = useState(editing?.description ?? '');
    const [isAvailable, setIsAvailable] = useState(editing?.isAvailable ?? true);

    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
            name: name.trim(),
            priceCents: toCents(price),
            category: category.trim(),
            description: description.trim(),
            allergens: allergens.split(',').map((s) => s.trim()).filter(Boolean),
            isAvailable,
        });
    };

    const inputCls =
        'block w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border-main/70 bg-bg-secondary text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200';
    const labelCls = 'text-xs font-bold text-text-sub uppercase tracking-wider';

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md sm:p-5"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="animate-[modal-pop_0.18s_ease-out] flex max-h-[90vh] w-full max-w-[460px] flex-col overflow-hidden rounded-3xl border border-border-main/70 bg-bg-primary shadow-xs shadow-black/10"
            >
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-main/60 bg-bg-secondary/60 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/25 to-brand-green/25 text-brand-gold ring-1 ring-brand-gold/20">
                            <UtensilsCrossed size={20} strokeWidth={2.2} />
                        </span>
                        <div>
                            <h3 className="m-0 text-lg font-bold tracking-tight text-text-main">
                                {editing ? `Edit ${editing.name}` : 'Add a menu item'}
                            </h3>
                            <p className="m-0 text-[11px] font-bold text-text-muted">
                                {editing
                                    ? 'Update what the AI reads aloud to callers.'
                                    : 'Callers can ask about this dish, its price, and allergens.'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-item-hover hover:text-text-main"
                        aria-label="Close"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 sm:p-7">
                    <label className={labelCls}>
                        Name *
                        <div className="relative mt-1.5">
                            <InputAdornment icon={<UtensilsCrossed size={15} strokeWidth={2.2} />} />
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="e.g. Pork Sisig"
                                className={inputCls}
                            />
                        </div>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className={labelCls}>
                            Price ($)
                            <div className="relative mt-1.5">
                                <InputAdornment icon={<DollarSign size={15} strokeWidth={2.2} />} />
                                <input
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    inputMode="decimal"
                                    className={inputCls}
                                />
                            </div>
                        </label>
                        <label className={labelCls}>
                            Category
                            <div className="relative mt-1.5">
                                <InputAdornment icon={<Tag size={15} strokeWidth={2.2} />} />
                                <input
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    placeholder="e.g. Mains"
                                    className={inputCls}
                                />
                            </div>
                        </label>
                    </div>

                    <label className={labelCls}>
                        Allergens (comma separated)
                        <div className="relative mt-1.5">
                            <InputAdornment icon={<AlertTriangle size={15} strokeWidth={2.2} />} />
                            <input
                                value={allergens}
                                onChange={(e) => setAllergens(e.target.value)}
                                placeholder="e.g. peanuts, gluten"
                                className={inputCls}
                            />
                        </div>
                    </label>

                    <label className={labelCls}>
                        Description
                        <div className="relative mt-1.5">
                            <InputAdornment icon={<FileText size={15} strokeWidth={2.2} />} />
                            <input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g. Crispy pork belly, onion, chilli, calamansi"
                                className={inputCls}
                            />
                        </div>
                    </label>

                    {/* Availability toggle row */}
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border-main/60 bg-bg-secondary px-3.5 py-3 transition-colors duration-150 hover:border-brand-gold/40">
                        <span className="text-xs font-bold text-text-sub">
                            Available for callers
                            <span className="mt-0.5 block text-[10px] font-bold text-text-muted">
                                Sold-out items are hidden from the AI's answers.
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={isAvailable}
                            onChange={(e) => setIsAvailable(e.target.checked)}
                            className="h-4 w-4 shrink-0 accent-brand-gold"
                        />
                    </label>

                    {error && (
                        <div className="flex items-start gap-2 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3.5 py-2.5">
                            <AlertTriangle size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-brand-red" />
                            <span className="break-words text-xs font-semibold text-brand-red">{error}</span>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto flex gap-2.5 border-t border-border-main/60 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 cursor-pointer rounded-xl border border-border-main bg-bg-secondary py-2.5 text-sm font-bold text-text-sub transition-colors duration-150 hover:bg-item-hover"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-gold py-2.5 text-sm font-bold text-text-white shadow-xs shadow-brand-gold/20 transition-colors duration-150 hover:bg-brand-gold-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving && <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />}
                            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MenuItemModal;
