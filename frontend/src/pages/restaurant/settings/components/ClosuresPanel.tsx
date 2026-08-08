import React, { useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { DatePickerDropdown } from '~/components/DatePickerDropdown';
import { useMutation } from '@apollo/client/react';
import { CREATE_CLOSURE_MUTATION, DELETE_CLOSURE_MUTATION } from '~/api/queries/graphql/restaurant';
import { useAppDispatch } from '~/store';
import { addClosure, removeClosure, setSettingsError } from '~/store';
import type { Closure } from '~/types/restaurant';

interface ClosuresPanelProps {
    restaurantId: string;
    closures: Closure[];
}

export const ClosuresPanel = ({ restaurantId, closures }: ClosuresPanelProps) => {
    const dispatch = useAppDispatch();
    const [createClosure, { loading }] = useMutation(CREATE_CLOSURE_MUTATION);
    const [deleteClosure] = useMutation(DELETE_CLOSURE_MUTATION);
    const [date, setDate] = useState('');
    const [reason, setReason] = useState('');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date) return;
        try {
            const { data }: any = await createClosure({
                variables: { input: { restaurantId, closureDate: date, reason: reason.trim() || null } },
            });
            if (data?.createClosure) {
                dispatch(addClosure(data.createClosure as Closure));
                setDate('');
                setReason('');
            }
        } catch (err: any) {
            dispatch(setSettingsError(err?.message ?? 'Failed to add closure'));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { data }: any = await deleteClosure({ variables: { id } });
            if (data?.deleteClosure) dispatch(removeClosure(id));
        } catch (err: any) {
            dispatch(setSettingsError(err?.message ?? 'Failed to delete closure'));
        }
    };

    const inputCls =
        'px-3.5 py-2.5 rounded-xl border border-border-main/70 bg-bg-primary/70 text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200';

    return (
        <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 bg-bg-secondary/70 border-b border-border-main/60">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green">
                    <CalendarDays size={16} strokeWidth={2.2} />
                </span>
                <div>
                    <div className="font-black text-text-main text-sm">Sudden closures</div>
                    <div className="text-xs font-bold text-text-muted mt-0.5">
                        One-off dates when the kitchen is closed (public holidays, events).
                    </div>
                </div>
            </div>

            <form onSubmit={handleAdd} className="px-4 py-3.5 flex flex-col gap-2.5">
                <div className="flex gap-2.5">
                    <DatePickerDropdown value={date} onChange={setDate} className="flex-1" />
                    <button
                        type="submit"
                        disabled={loading}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-black text-sm transition-all duration-200 active:scale-95 ${
                            loading
                                ? 'bg-brand-gold/40 text-text-white/60 cursor-not-allowed'
                                : 'bg-brand-gold text-text-white hover:bg-brand-gold-hover cursor-pointer'
                        }`}
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        Add
                    </button>
                </div>
                <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (optional) — e.g. Christmas Day"
                    className={inputCls}
                />
            </form>

            <div className="px-4 pb-3.5">
                {closures.length === 0 ? (
                    <p className="text-text-muted text-[13px] font-bold my-2">No closures scheduled.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {closures.map((c) => (
                            <div
                                key={c.id}
                                className="flex justify-between items-center px-3 py-2.5 border border-brand-gold/40 bg-brand-gold/10 rounded-xl backdrop-blur-sm"
                            >
                                <div>
                                    <div className="font-black text-[13px] text-text-main">
                                        {new Date(`${c.closureDate}T00:00:00`).toLocaleDateString('en-AU', {
                                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                        })}
                                    </div>
                                    {c.reason && <div className="text-xs font-bold text-brand-gold">{c.reason}</div>}
                                </div>
                                <button
                                    onClick={() => handleDelete(c.id)}
                                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 px-2.5 py-1.5 text-xs font-black text-brand-red transition-colors duration-150 hover:bg-brand-red/20"
                                >
                                    <Trash2 size={12} strokeWidth={2.2} />
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClosuresPanel;
