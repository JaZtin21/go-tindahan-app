import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    /** Current page, 1-based. */
    page: number;
    pageSize: number;
    /** Total number of items across all pages. */
    total: number;
    onChange: (page: number) => void;
}

const btnBase =
    'flex cursor-pointer items-center gap-1 rounded-lg border border-border-main/70 bg-bg-primary px-2.5 py-1.5 text-xs font-bold text-text-sub transition-colors duration-150 hover:bg-item-hover hover:text-text-main disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Themed client-side pagination — "Showing X–Y of Z" + prev/next with page
 * numbers (ellipsized when there are many). Renders nothing for a single page.
 */
export const Pagination = ({ page, pageSize, total, onChange }: PaginationProps) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1) return null;

    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const end = Math.min(safePage * pageSize, total);

    const pages: (number | '…')[] = [];
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) {
            pages.push(p);
        } else if (pages[pages.length - 1] !== '…') {
            pages.push('…');
        }
    }

    return (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-text-muted">
                Showing {start}–{end} of {total}
            </span>
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => onChange(safePage - 1)}
                    className={btnBase}
                >
                    <ChevronLeft size={13} strokeWidth={2.4} />
                    Prev
                </button>
                {pages.map((p, i) =>
                    p === '…' ? (
                        <span key={`e${i}`} className="px-1 text-xs font-bold text-text-muted">
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onChange(p)}
                            aria-current={p === safePage ? 'page' : undefined}
                            className={`flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-black transition-colors duration-150 ${
                                p === safePage
                                    ? 'bg-brand-gold text-text-white'
                                    : 'border border-border-main/70 bg-bg-primary text-text-sub hover:bg-item-hover hover:text-text-main'
                            }`}
                        >
                            {p}
                        </button>
                    )
                )}
                <button
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => onChange(safePage + 1)}
                    className={btnBase}
                >
                    Next
                    <ChevronRight size={13} strokeWidth={2.4} />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
