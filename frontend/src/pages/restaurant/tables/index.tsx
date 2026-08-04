import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
    GET_TABLES_QUERY,
    CREATE_TABLE_MUTATION,
    UPDATE_TABLE_MUTATION,
    DELETE_TABLE_MUTATION,
} from '~/api/queries/graphql/restaurant';
import { useAppDispatch, useAppSelector } from '~/store';
import { setTables, upsertTable, removeTable, setTablesError } from '~/store';
import type { RestaurantTable } from '~/types/restaurant';
import { TableFormModal } from './components/TableFormModal';

export const TablesPage = () => {
    const dispatch = useAppDispatch();
    const activeRestaurantId = useAppSelector((s) => s.restaurant.activeRestaurantId);
    const tables = useAppSelector((s) => s.tables.tables);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<RestaurantTable | null>(null);

    const { data, loading } = useQuery(GET_TABLES_QUERY, {
        variables: { restaurantId: activeRestaurantId ?? '' },
        skip: !activeRestaurantId,
        fetchPolicy: 'network-only',
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
            setModalOpen(false);
            setEditing(null);
        } catch (err: any) {
            dispatch(setTablesError(err?.message ?? 'Failed to save table'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Deactivate this table? Past bookings keep their reference.')) return;
        try {
            const { data }: any = await deleteTable({ variables: { id } });
            if (data?.deleteTable) dispatch(removeTable(id));
        } catch (err: any) {
            dispatch(setTablesError(err?.message ?? 'Failed to delete table'));
        }
    };

    if (!activeRestaurantId) {
        return <p className="py-16 text-center text-text-muted text-sm font-bold">Select a restaurant to manage tables.</p>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-black text-text-main tracking-tight m-0">Table Layout</h2>
                    <p className="mt-1 text-xs font-bold text-text-muted m-0">
                        Build and monitor your physical seating floor constraints.
                    </p>
                </div>
                <button
                    onClick={() => { setEditing(null); setModalOpen(true); }}
                    className="px-4 py-2.5 rounded-xl bg-brand-gold text-bg-black font-black text-sm hover:bg-brand-gold-hover transition-all duration-200 cursor-pointer active:scale-95"
                >
                    + Add table
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <span className="h-4 w-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"></span>
                    <p className="text-text-muted text-sm font-bold m-0">Loading tables…</p>
                </div>
            ) : tables.length === 0 ? (
                <div className="border border-dashed border-border-main rounded-2xl py-16 text-center text-text-muted text-sm font-bold">
                    No tables yet. Add your first table to start accepting reservations.
                </div>
            ) : (
                <>
                    {sections.map((section) => (
                        <div key={section} className="mb-6">
                            <h3 className="text-xs font-black text-text-sub uppercase tracking-wider mb-2.5">{section}</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                                {tables.filter((t) => (t.section ?? null) === section).map((t) => (
                                    <div key={t.id} className="border border-border-main rounded-xl p-3 flex flex-col gap-1.5 bg-bg-primary hover:border-brand-gold/50 transition-colors duration-200">
                                        <div className="flex justify-between items-center">
                                            <strong className="text-sm text-text-main">🪑 {t.tableNumber}</strong>
                                            <span className="text-[11px] font-bold text-text-muted">
                                                {t.capacityMin}–{t.capacityMax}
                                            </span>
                                        </div>
                                        <div className="flex gap-1.5 mt-1">
                                            <button
                                                onClick={() => { setEditing(t); setModalOpen(true); }}
                                                className="flex-1 py-1.5 text-xs font-bold border border-border-main rounded-lg bg-bg-primary text-text-sub hover:bg-item-hover cursor-pointer transition-colors duration-150"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(t.id)}
                                                className="flex-1 py-1.5 text-xs font-bold border border-brand-red/30 rounded-lg bg-brand-red/10 text-brand-red hover:bg-brand-red/20 cursor-pointer transition-colors duration-150"
                                            >
                                                Delete
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
                                    <div key={t.id} className="border border-border-main rounded-xl p-3 flex flex-col gap-1.5 bg-bg-primary hover:border-brand-gold/50 transition-colors duration-200">
                                        <div className="flex justify-between items-center">
                                            <strong className="text-sm text-text-main">🪑 {t.tableNumber}</strong>
                                            <span className="text-[11px] font-bold text-text-muted">{t.capacityMin}–{t.capacityMax}</span>
                                        </div>
                                        <div className="flex gap-1.5 mt-1">
                                            <button
                                                onClick={() => { setEditing(t); setModalOpen(true); }}
                                                className="flex-1 py-1.5 text-xs font-bold border border-border-main rounded-lg bg-bg-primary text-text-sub hover:bg-item-hover cursor-pointer transition-colors duration-150"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(t.id)}
                                                className="flex-1 py-1.5 text-xs font-bold border border-brand-red/30 rounded-lg bg-brand-red/10 text-brand-red hover:bg-brand-red/20 cursor-pointer transition-colors duration-150"
                                            >
                                                Delete
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
                    existingSections={sections}
                    onClose={() => { setModalOpen(false); setEditing(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default TablesPage;
