import React, { useEffect, useMemo, useState } from 'react';
import { Armchair, Plus, Pencil, Trash2, MapPin, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
    GET_TABLES_QUERY,
    CREATE_TABLE_MUTATION,
    UPDATE_TABLE_MUTATION,
    DELETE_TABLE_MUTATION,
} from '~/api/queries/graphql/restaurant';
import { useAppDispatch, useAppSelector } from '~/store';
import { setTables, upsertTable, removeTable, setTablesError } from '~/store';
import { ErrorState } from '~/components';
import { useRestaurantId } from '~/utils/useRestaurantId';
import type { RestaurantTable } from '~/types/restaurant';
import { TableFormModal } from './components/TableFormModal';

export const TablesPage = () => {
    const dispatch = useAppDispatch();
    const activeRestaurantId = useRestaurantId();
    const tables = useAppSelector((s) => s.tables.tables);
    const tablesStoreError = useAppSelector((s) => s.tables.error);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<RestaurantTable | null>(null);
    const [tableSaving, setTableSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data, loading, error: queryError, refetch } = useQuery(GET_TABLES_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
        fetchPolicy: 'no-cache',
    });

    // Sync fetched tables into Redux whenever they arrive.
    useEffect(() => {
        const fetched = (data as any)?.tables as RestaurantTable[] | undefined;
        if (fetched) {
            dispatch(setTables(fetched));
        }
    }, [data, dispatch]);

    const [createTable] = useMutation(CREATE_TABLE_MUTATION);
    const [updateTable] = useMutation(UPDATE_TABLE_MUTATION);
    const [deleteTable] = useMutation(DELETE_TABLE_MUTATION);

    const sections = useMemo(() => {
        const set = new Set<string>();
        tables.forEach((t) => t.section && set.add(t.section));
        return Array.from(set).sort();
    }, [tables]);

    const handleSave = async (input: { tableNumber: string; capacityMin: number; capacityMax: number; section?: string | null }) => {
        if (!activeRestaurantId) return;
        setTableSaving(true);
        try {
            if (editing) {
                const { data }: any = await updateTable({
                    variables: { id: editing.id, input: { ...input, isActive: editing.isActive } },
                });
                if (data?.updateTable) dispatch(upsertTable(data.updateTable as RestaurantTable));
            } else {
                const { data }: any = await createTable({
                    variables: { input: { restaurantId: activeRestaurantId, ...input } },
                });
                if (data?.createTable) dispatch(upsertTable(data.createTable as RestaurantTable));
            }
            setTableSaving(false);
            setModalOpen(false);
            setEditing(null);
        } catch (err: any) {
            setTableSaving(false);
            dispatch(setTablesError(err?.message ?? 'Failed to save table'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Deactivate this table? Past bookings keep their reference.')) return;
        setDeletingId(id);
        try {
            const { data }: any = await deleteTable({ variables: { id } });
            if (data?.deleteTable) dispatch(removeTable(id));
        } catch (err: any) {
            dispatch(setTablesError(err?.message ?? 'Failed to delete table'));
        } finally {
            setDeletingId(null);
        }
    };

    if (!activeRestaurantId) {
        return <p className="py-16 text-center text-text-muted text-sm font-bold">Select a restaurant to manage tables.</p>;
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green">
                            <Armchair size={18} strokeWidth={2.2} />
                        </span>
                        <div>
                            <h2 className="m-0 text-xl font-black tracking-tight text-text-main">Table Layout</h2>
                            <p className="m-0 mt-0.5 text-xs font-bold text-text-muted">
                                Build and monitor your physical seating floor constraints.
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <span className="flex items-center gap-1.5 rounded-full border border-border-main/60 bg-bg-primary/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-text-sub">
                            <Armchair size={11} strokeWidth={2.2} className="text-brand-gold" />
                            {tables.length} tables
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full border border-border-main/60 bg-bg-primary/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-text-sub">
                            <MapPin size={11} strokeWidth={2.2} className="text-brand-green" />
                            {sections.length} sections
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => { setEditing(null); setModalOpen(true); }}
                    className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-black text-text-white shadow-xs shadow-brand-gold/20 transition-all duration-200 hover:bg-brand-gold-hover active:scale-95"
                >
                    <Plus size={15} strokeWidth={2.5} />
                    Add table
                </button>
            </div>

            {tablesStoreError && (
                <div className="mb-4">
                    <ErrorState compact title="Action failed" message={tablesStoreError} onDismiss={() => dispatch(setTablesError(null))} />
                </div>
            )}

            {queryError ? (
                <ErrorState title="Couldn't load tables" message={queryError.message} onRetry={() => refetch()} />
            ) : loading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading tables…</p>
                </div>
            ) : tables.length === 0 ? (
                <div className="glass-panel rounded-3xl border-dashed px-6 py-16 text-center text-text-muted text-sm font-bold">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold/10 text-brand-gold">
                        <Armchair size={26} strokeWidth={2} />
                    </div>
                    No tables yet. Add your first table to start accepting reservations.
                </div>
            ) : (
                <>
                    {sections.map((section) => (
                        <div key={section} className="mb-6">
                            <h3 className="text-xs font-black text-text-sub uppercase tracking-wider mb-2.5">{section}</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                                {tables.filter((t) => (t.section ?? null) === section).map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => { setEditing(t); setModalOpen(true); }}
                                        className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border-main/60 bg-bg-primary/60 p-3 transition-colors duration-150 hover:bg-item-hover"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                                                    <Armchair size={16} strokeWidth={2.2} />
                                                </span>
                                                <strong className="truncate text-sm text-text-main">{t.tableNumber}</strong>
                                            </div>
                                            <span className="shrink-0 text-[11px] font-bold text-text-muted">
                                                {t.capacityMin}–{t.capacityMax}
                                            </span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditing(t); setModalOpen(true); }}
                                                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border-main/70 bg-bg-primary py-1.5 text-xs font-bold text-text-sub transition-colors duration-150 hover:bg-item-hover"
                                            >
                                                <Pencil size={12} strokeWidth={2.2} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                                                disabled={deletingId === t.id}
                                                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 py-1.5 text-xs font-bold text-brand-red transition-colors duration-150 hover:bg-brand-red/20 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {deletingId === t.id ? (
                                                    <Loader2 size={12} strokeWidth={2.2} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={12} strokeWidth={2.2} />
                                                )}
                                                {deletingId === t.id ? 'Deleting…' : 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {tables.some((t) => !t.section) && (
                        <div>
                            <h3 className="text-xs font-black text-text-sub uppercase tracking-wider mb-2.5">General</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                                {tables.filter((t) => !t.section).map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => { setEditing(t); setModalOpen(true); }}
                                        className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border-main/60 bg-bg-primary/60 p-3 transition-colors duration-150 hover:bg-item-hover"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                                                    <Armchair size={16} strokeWidth={2.2} />
                                                </span>
                                                <strong className="truncate text-sm text-text-main">{t.tableNumber}</strong>
                                            </div>
                                            <span className="shrink-0 text-[11px] font-bold text-text-muted">{t.capacityMin}–{t.capacityMax}</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditing(t); setModalOpen(true); }}
                                                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border-main/70 bg-bg-primary py-1.5 text-xs font-bold text-text-sub transition-colors duration-150 hover:bg-item-hover"
                                            >
                                                <Pencil size={12} strokeWidth={2.2} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                                                disabled={deletingId === t.id}
                                                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 py-1.5 text-xs font-bold text-brand-red transition-colors duration-150 hover:bg-brand-red/20 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {deletingId === t.id ? (
                                                    <Loader2 size={12} strokeWidth={2.2} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={12} strokeWidth={2.2} />
                                                )}
                                                {deletingId === t.id ? 'Deleting…' : 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {modalOpen && (
                <TableFormModal
                    editing={editing}
                    saving={tableSaving}
                    onClose={() => { setModalOpen(false); setEditing(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default TablesPage;
