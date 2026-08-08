import React, { useEffect, useState } from 'react';
import { Clock, Check, Loader2 } from 'lucide-react';
import { useMutation } from '@apollo/client/react';
import { SET_OPERATING_HOURS_MUTATION } from '~/api/queries/graphql/restaurant';
import { useAppDispatch } from '~/store';
import { setOperatingHours, setSettingsError } from '~/store';
import type { OperatingHours } from '~/types/restaurant';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface OperatingHoursEditorProps {
    restaurantId: string;
    hours: OperatingHours[];
}

interface DayDraft {
    openTime: string;
    closeTime: string;
    isClosed: boolean;
}

// Backend returns TIME columns as "HH:MM:SS.ffffff" (pgx scans with microsecond
// precision) — <input type="time"> only accepts "HH:MM", so normalize or the
// browser silently falls back to 00:00.
const normalizeTime = (t?: string | null, fallback = '11:00'): string => {
    if (!t) return fallback;
    const m = t.match(/^(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : fallback;
};

export const OperatingHoursEditor = ({ restaurantId, hours }: OperatingHoursEditorProps) => {
    const dispatch = useAppDispatch();
    const [setHours, { loading }] = useMutation(SET_OPERATING_HOURS_MUTATION);
    const [saved, setSaved] = useState(false);

    const byDay = (day: number): DayDraft => {
        const existing = hours.find((h) => h.dayOfWeek === day);
        return {
            openTime: normalizeTime(existing?.openTime),
            closeTime: normalizeTime(existing?.closeTime, '21:00'),
            isClosed: existing?.isClosed ?? false,
        };
    };

    const draft = (day: number) => ({
        openTime: byDay(day).openTime,
        closeTime: byDay(day).closeTime,
        isClosed: byDay(day).isClosed,
    });

    const [drafts, setDrafts] = useState<Record<number, DayDraft>>(() =>
        Object.fromEntries(DAY_NAMES.map((_, i) => [i, byDay(i)]))
    );

    // Sync the form when the server returns (or refetches) hours.
    useEffect(() => {
        setDrafts(Object.fromEntries(DAY_NAMES.map((_, i) => [i, byDay(i)])));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(hours)]);

    const setDay = (day: number, patch: Partial<DayDraft>) => {
        setSaved(false);
        setDrafts((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
    };

    const handleSave = async () => {
        try {
            const payload = DAY_NAMES.map((_, day) => ({
                dayOfWeek: day,
                openTime: drafts[day].isClosed ? null : drafts[day].openTime,
                closeTime: drafts[day].isClosed ? null : drafts[day].closeTime,
                isClosed: drafts[day].isClosed,
            }));
            const { data }: any = await setHours({
                variables: { restaurantId, hours: payload },
            });
            if (data?.setOperatingHours) {
                dispatch(setOperatingHours(data.setOperatingHours as OperatingHours[]));
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
            }
        } catch (err: any) {
            dispatch(setSettingsError(err?.message ?? 'Failed to save operating hours'));
        }
    };

    const inputCls =
        'px-2.5 py-1.5 rounded-lg border border-border-main/70 bg-bg-primary text-text-sub text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40 disabled:opacity-50 transition-all duration-200';

    return (
        <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 bg-bg-secondary/70 border-b border-border-main/60">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
                    <Clock size={16} strokeWidth={2.2} />
                </span>
                <div>
                    <div className="font-black text-text-main text-sm">Weekly operating hours</div>
                    <div className="text-xs font-bold text-text-muted mt-0.5">0 = Sunday … 6 = Saturday</div>
                </div>
            </div>
            <div className="px-4 py-3.5">
                {DAY_NAMES.map((name, day) => (
                    <div
                        key={day}
                        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5 border-b border-border-sub"
                    >
                        {/* Day label + Closed toggle — stays together as one group */}
                        <div className="flex items-center gap-3">
                            <label className="w-[110px] text-[13px] font-black text-text-main">{name}</label>
                            <label className="text-xs font-bold text-text-sub flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={drafts[day].isClosed}
                                    onChange={(e) => setDay(day, { isClosed: e.target.checked })}
                                    className="accent-brand-gold"
                                />
                                Closed
                            </label>
                        </div>
                        {/* Time selectors — own container so both move down together on wrap */}
                        {!drafts[day].isClosed && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="time"
                                    value={drafts[day].openTime}
                                    disabled={drafts[day].isClosed}
                                    onChange={(e) => setDay(day, { openTime: e.target.value })}
                                    className={inputCls}
                                />
                                <span className="text-text-muted text-xs font-bold">to</span>
                                <input
                                    type="time"
                                    value={drafts[day].closeTime}
                                    disabled={drafts[day].isClosed}
                                    onChange={(e) => setDay(day, { closeTime: e.target.value })}
                                    className={inputCls}
                                />
                            </div>
                        )}
                    </div>
                ))}
                <div className="flex items-center gap-3 mt-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-200 active:scale-95 ${loading
                                ? 'bg-brand-gold/40 text-text-white/60 cursor-not-allowed'
                                : 'bg-brand-gold text-text-white hover:bg-brand-gold-hover cursor-pointer'
                            }`}
                    >
                        {loading && <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />}
                        {loading ? 'Saving…' : 'Save hours'}
                    </button>
                    {saved && (
                        <span className="flex items-center gap-1 text-[13px] font-black text-brand-green">
                            <Check size={14} strokeWidth={2.5} />
                            Saved
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OperatingHoursEditor;
