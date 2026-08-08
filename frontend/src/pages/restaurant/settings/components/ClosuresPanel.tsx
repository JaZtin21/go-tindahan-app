import React, { useState } from 'react';
import { CalendarDays, Plus, Trash2, Loader2 } from 'lucide-react';
import { useMutation } from '@apollo/client/react';
import { CREATE_CLOSURE_MUTATION, DELETE_CLOSURE_MUTATION } from '~/api/queries/graphql/restaurant';
import { useAppDispatch } from '~/store';
import { addClosure, removeClosure, setSettingsError } from '~/store';
import type { Closure } from '~/types/restaurant';
import { ClosureFormModal } from './ClosureFormModal';

interface ClosuresPanelProps {
    restaurantId: string;
    closures: Closure[];
}

export const ClosuresPanel = ({ restaurantId, closures }: ClosuresPanelProps) => {
    const dispatch = useAppDispatch();
    const [createClosure] = useMutation(CREATE_CLOSURE_MUTATION);
    const [deleteClosure] = useMutation(DELETE_CLOSURE_MUTATION);
    const [modalOpen, setModalOpen] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const openModal = () => {
        setFormError(null);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setFormError(null);
    };

    const handleAdd = async (input: { closureDate: string; reason: string }) => {
        setSaving(true);
        setFormError(null);
        try {
            const { data }: any = await createClosure({
                variables: { input: { restaurantId, closureDate: input.closureDate, reason: input.reason.trim() || null } },
            });
            if (data?.createClosure) {
                dispatch(addClosure(data.createClosure as Closure));
                closeModal();
            }
        } catch (err: any) {
            setFormError(err?.message ?? 'Failed to add closure');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const { data }: any = await deleteClosure({ variables: { id } });
            if (data?.deleteClosure) dispatch(removeClosure(id));
        } catch (err: any) {
            dispatch(setSettingsError(err?.message ?? 'Failed to delete closure'));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-bg-secondary/70 border-b border-border-main/60">
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                        <CalendarDays size={16} strokeWidth={2.2} />
                    </span>
                    <div>
                        <div className="font-black text-text-main text-sm">Sudden closures</div>
                        <div className="text-xs font-bold text-text-muted mt-0.5">
                            One-off dates when the kitchen is closed (public holidays, events).
                        </div>
                    </div>
                </div>
                <button
                    onClick={openModal}
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-gold px-3.5 py-2 text-xs font-black text-text-white shadow-xs shadow-brand-gold/20 transition-all duration-200 hover:bg-brand-gold-hover active:scale-95"
                >
                    <Plus size={14} strokeWidth={2.5} />
                    Add closure
                </button>
            </div>

            <div className="px-4 py-3.5">
                {closures.length === 0 ? (
                    <p className="text-text-muted text-[13px] font-bold my-2">No closures scheduled.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {closures.map((c) => (
                            <div
                                key={c.id}
                                className="flex justify-between items-center px-3 py-2.5 border border-brand-red/20 bg-brand-red/[0.06] rounded-xl"
                            >
                                <div>
                                    <div className="font-black text-[13px] text-text-main">
                                        {new Date(`${c.closureDate}T00:00:00`).toLocaleDateString('en-AU', {
                                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                        })}
                                    </div>
                                    {c.reason && <div className="text-xs font-bold text-brand-red/80">{c.reason}</div>}
                                </div>
                                <button
                                    onClick={() => handleDelete(c.id)}
                                    disabled={deletingId === c.id}
                                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 px-2.5 py-1.5 text-xs font-black text-brand-red transition-colors duration-150 hover:bg-brand-red/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {deletingId === c.id ? (
                                        <Loader2 size={12} strokeWidth={2.2} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={12} strokeWidth={2.2} />
                                    )}
                                    {deletingId === c.id ? 'Removing…' : 'Remove'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalOpen && (
                <ClosureFormModal
                    saving={saving}
                    error={formError}
                    onClose={closeModal}
                    onSave={handleAdd}
                />
            )}
        </div>
    );
};

export default ClosuresPanel;
