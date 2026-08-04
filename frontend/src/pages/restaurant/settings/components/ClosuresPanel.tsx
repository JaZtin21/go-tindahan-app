import React, { useState } from 'react';
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
        'px-3.5 py-2.5 rounded-xl border border-border-main bg-bg-primary text-text-main text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all duration-200';

    return (
        <div className="border border-border-main rounded-2xl overflow-hidden bg-bg-primary">
            <div className="px-4 py-3.5 bg-bg-secondary border-b border-border-main">
                <div className="font-black text-text-main text-sm">📅 Sudden closures</div>
                <div className="text-xs font-bold text-text-muted mt-0.5">
                    One-off dates when the kitchen is closed (public holidays, events).
                </div>
            </div>

            <form onSubmit={handleAdd} className="px-4 py-3.5 flex flex-col gap-2.5">
                <div className="flex gap-2.5">
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className={inputCls + ' flex-1'}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className={`px-4 py-2.5 rounded-xl font-black text-sm transition-all duration-200 active:scale-95 ${
                            loading
                                ? 'bg-brand-gold/40 text-bg-black/50 cursor-not-allowed'
                                : 'bg-brand-gold text-bg-black hover:bg-brand-gold-hover cursor-pointer'
                        }`}
                    >
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
                                className="flex justify-between items-center px-3 py-2.5 border border-brand-gold/40 bg-brand-gold/10 rounded-xl"
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
                                    className="px-2.5 py-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 text-brand-red text-xs font-black hover:bg-brand-red/20 cursor-pointer transition-colors duration-150"
                                >
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
