import React, { useState } from 'react';
import type { RestaurantTable } from '~/types/restaurant';

interface TableFormModalProps {
    editing: RestaurantTable | null;
    existingSections: string[];
    onClose: () => void;
    onSave: (input: { tableNumber: string; capacityMin: number; capacityMax: number; section?: string | null }) => void;
}

export const TableFormModal = ({ editing, existingSections, onClose, onSave }: TableFormModalProps) => {
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
        'block w-full px-3.5 py-2.5 rounded-xl border border-border-main bg-bg-primary text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200 mt-1';

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 bg-black/45 z-[100] flex items-center justify-center p-5"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-bg-primary rounded-2xl p-6 w-full max-w-[420px] shadow-2xl"
            >
                <h3 className="text-lg font-black text-text-main tracking-tight m-0 mb-4">
                    {editing ? `Edit ${editing.tableNumber}` : 'Add a table'}
                </h3>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                    <label className="text-xs font-black text-text-sub uppercase tracking-wider">
                        Table number / name
                        <input
                            value={tableNumber}
                            onChange={(e) => setTableNumber(e.target.value)}
                            required
                            className={inputCls}
                        />
                    </label>

                    <div className="flex gap-3">
                        <label className="text-xs font-black text-text-sub uppercase tracking-wider flex-1">
                            Capacity min
                            <input
                                type="number" min={1} value={capacityMin}
                                onChange={(e) => setCapacityMin(Number(e.target.value))}
                                className={inputCls}
                            />
                        </label>
                        <label className="text-xs font-black text-text-sub uppercase tracking-wider flex-1">
                            Capacity max
                            <input
                                type="number" min={1} value={capacityMax}
                                onChange={(e) => setCapacityMax(Number(e.target.value))}
                                className={inputCls}
                            />
                        </label>
                    </div>

                    <label className="text-xs font-black text-text-sub uppercase tracking-wider">
                        Section
                        <div className="flex gap-2 mt-1">
                            <input
                                value={section}
                                onChange={(e) => setSection(e.target.value)}
                                placeholder="e.g. Main Dining Room"
                                className={inputCls + ' mt-0 flex-1'}
                            />
                            {existingSections.length > 0 && (
                                <select
                                    value=""
                                    onChange={(e) => e.target.value && setSection(e.target.value)}
                                    className="px-3 py-2.5 rounded-xl border border-border-main bg-bg-primary text-text-sub text-sm focus:outline-none cursor-pointer"
                                >
                                    <option value="">Pick…</option>
                                    {existingSections.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            )}
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
                            className="flex-1 py-2.5 rounded-xl bg-brand-gold text-bg-black font-black text-sm hover:bg-brand-gold-hover cursor-pointer transition-colors duration-150 active:scale-95"
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
