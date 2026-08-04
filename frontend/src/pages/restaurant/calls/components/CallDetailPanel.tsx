import React from 'react';
import type { CallLog } from '~/types/restaurant';

interface CallDetailPanelProps {
    call: CallLog | null;
}

export const CallDetailPanel = ({ call }: CallDetailPanelProps) => {
    if (!call) {
        return (
            <div className="border border-dashed border-border-main rounded-2xl py-16 px-4 text-center text-text-muted text-[13px] font-bold sticky top-4">
                Select a call to view its transcript and details.
            </div>
        );
    }

    return (
        <div className="border border-border-main rounded-2xl overflow-hidden sticky top-4 bg-bg-primary">
            <div className="px-4 py-3.5 bg-bg-secondary border-b border-border-main">
                <div className="font-black text-text-main text-sm">📞 Call {call.vapiCallId.slice(0, 8)}</div>
                <div className="text-xs font-bold text-text-muted mt-0.5">
                    {new Date(call.createdAt).toLocaleString('en-AU')}
                </div>
            </div>
            <div className="px-4 py-3.5 text-[13px] flex flex-col gap-2">
                <div className="text-xs font-bold">
                    <span className="text-text-muted">Caller: </span>
                    <span className="text-text-main">{call.customerPhone || '—'}</span>
                </div>
                <div className="text-xs font-bold">
                    <span className="text-text-muted">Booking: </span>
                    <span className="text-text-main">{call.bookingId ? call.bookingId.slice(0, 8) : 'None created'}</span>
                </div>
                <div className="text-xs font-bold">
                    <span className="text-text-muted">Outcome: </span>
                    <span className="text-text-main">{call.outcome ? call.outcome.replace('_', ' ') : '—'}</span>
                </div>
            </div>
            <div className="px-4 py-3.5 border-t border-border-sub">
                <div className="text-[11px] font-black text-text-muted mb-2 tracking-widest">TRANSCRIPT</div>
                {call.transcript ? (
                    <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap max-h-[360px] overflow-y-auto text-text-sub font-medium">
                        {call.transcript}
                    </p>
                ) : (
                    <p className="m-0 text-text-muted text-[13px] font-bold">No transcript available.</p>
                )}
            </div>
        </div>
    );
};

export default CallDetailPanel;
