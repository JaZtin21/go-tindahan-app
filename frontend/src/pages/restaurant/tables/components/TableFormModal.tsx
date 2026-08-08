import React, { useState } from 'react';
import { X, Armchair, Users, Tag, Loader2 } from 'lucide-react';
import { InputAdornment } from '~/components/InputAdornment';
import type { RestaurantTable } from '~/types/restaurant';

interface TableFormModalProps {
    editing: RestaurantTable | null;
    saving?: boolean;
    onClose: () => void;
    onSave: (input: { tableNumber: string; capacityMin: number; capacityMax: number; section?: string | null }) => void;
}

export const TableFormModal = ({ editing, saving, onClose, onSave }: TableFormModalProps) => {
    const [tableNumber, setTableNumber] = useState(editing?.tableNumber ?? '');
    const [capacityMin, setCapacityMin] = useState(editing?.capacityMin ?? 1);
    const [capacityMax, setCapacityMax] = useState(editing?.capacityMax ?? 4);
    const [section, setSection] = useState(editing?.section ?? '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tableNumber.trim()) return;
        onSave({
            tableNumber: tableNumber.trim(),
            capacityMin: Math.max(1, Number(capacityMin)),
            capacityMax: Math.max(Number(capacityMin), Number(capacityMax)),
            section: section.trim() || null,
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
                className="animate-[modal-pop_0.18s_ease-out] flex max-h-[90vh] w-full max-w-[440px] flex-col overflow-hidden rounded-3xl border border-border-main/70 bg-bg-primary shadow-xs shadow-black/10"
            >
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-main/60 bg-bg-secondary/60 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/25 to-brand-green/25 text-brand-gold ring-1 ring-brand-gold/20">
                            <Armchair size={20} strokeWidth={2.2} />
                        </span>
                        <div>
                            <h3 className="m-0 text-lg font-bold tracking-tight text-text-main">
                                {editing ? `Edit ${editing.tableNumber}` : 'Add a table'}
                            </h3>
                            <p className="m-0 text-[11px] font-bold text-text-muted">
                                {editing ? 'Update this table on the floor.' : 'Add a new table to your floor.'}
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
                        Table number / name
                        <div className="relative mt-1.5">
                            <InputAdornment icon={<Tag size={15} strokeWidth={2.2} />} />
                            <input
                                value={tableNumber}
                                onChange={(e) => setTableNumber(e.target.value)}
                                required
                                placeholder="e.g. Table 1"
                                className={inputCls}
                            />
                        </div>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className={labelCls}>
                            Capacity min
                            <div className="relative mt-1.5">
                                <InputAdornment icon={<Users size={15} strokeWidth={2.2} />} />
                                <input
                                    type="number" min={1} value={capacityMin}
                                    onChange={(e) => setCapacityMin(Number(e.target.value))}
                                    className={inputCls}
                                />
                            </div>
                        </label>
                        <label className={labelCls}>
                            Capacity max
                            <div className="relative mt-1.5">
                                <InputAdornment icon={<Users size={15} strokeWidth={2.2} />} />
                                <input
                                    type="number" min={1} value={capacityMax}
                                    onChange={(e) => setCapacityMax(Number(e.target.value))}
                                    className={inputCls}
                                />
                            </div>
                        </label>
                    </div>

                    <label className={labelCls}>
                        Section
                        <div className="relative mt-1.5">
                            <InputAdornment icon={<Tag size={15} strokeWidth={2.2} />} />
                            <input
                                value={section}
                                onChange={(e) => setSection(e.target.value)}
                                placeholder="e.g. Main Dining Room"
                                className={inputCls}
                            />
                        </div>
                    </label>

                    {/* Footer */}
                    <div className="mt-auto flex gap-2.5 border-t border-border-main/60 pt-4">
                        <button
                            type="button" onClick={onClose}
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
                            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add table'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TableFormModal;
