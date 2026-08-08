import React, { useState } from 'react';
import { X, Armchair, Users, Tag } from 'lucide-react';
import { InputAdornment } from '~/components/InputAdornment';
import type { RestaurantTable } from '~/types/restaurant';

interface TableFormModalProps {
    editing: RestaurantTable | null;
    onClose: () => void;
    onSave: (input: { tableNumber: string; capacityMin: number; capacityMax: number; section?: string | null }) => void;
}

export const TableFormModal = ({ editing, onClose, onSave }: TableFormModalProps) => {
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
        'block w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border-main/70 bg-bg-primary/70 text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200';

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-5"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="glass-strong animate-[modal-pop_0.18s_ease-out] w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7"
            >
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/25 to-brand-green/25 text-brand-gold ring-1 ring-brand-gold/20">
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
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-item-hover hover:text-text-main"
                        aria-label="Close"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                    <label className="text-xs font-bold text-text-sub uppercase tracking-wider">
                        Table number / name
                        <div className="relative mt-1.5">
                            <InputAdornment icon={<Tag size={15} strokeWidth={2.2} />} />
                            <input
                                value={tableNumber}
                                onChange={(e) => setTableNumber(e.target.value)}
                                required
                                className={inputCls}
                            />
                        </div>
                    </label>

                    <div className="flex gap-3">
                        <label className="text-xs font-bold text-text-sub uppercase tracking-wider flex-1">
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
                        <label className="text-xs font-bold text-text-sub uppercase tracking-wider flex-1">
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

                    <label className="text-xs font-bold text-text-sub uppercase tracking-wider">
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

                    <div className="flex gap-2.5 mt-2">
                        <button
                            type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-border-main bg-bg-primary text-text-sub font-bold text-sm hover:bg-item-hover cursor-pointer transition-colors duration-150"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 cursor-pointer rounded-xl bg-brand-gold py-2.5 text-sm font-bold text-text-white transition-colors duration-150 hover:bg-brand-gold-hover active:scale-95"
                        >
                            {editing ? 'Save changes' : 'Add table'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TableFormModal;
