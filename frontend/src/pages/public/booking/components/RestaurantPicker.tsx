import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_RESTAURANTS_QUERY } from '~/api/queries/graphql/restaurant';
import type { Restaurant } from '~/types/restaurant';

// ============================================================================
// STEP 1 — FIND A RESTAURANT
// Public discovery: list + filter by suburb / cuisine. No auth required.
// ============================================================================

const CUISINES = [
    'Italian', 'Japanese', 'Chinese', 'Thai', 'Mexican', 'Indian',
    'French', 'Greek', 'Korean', 'Vietnamese', 'Australian', 'Pizza',
];

interface RestaurantPickerProps {
    onSelect: (restaurant: Restaurant) => void;
}

export const RestaurantPicker = ({ onSelect }: RestaurantPickerProps) => {
    const [suburb, setSuburb] = useState('');
    const [cuisine, setCuisine] = useState<string | null>(null);

    const { data, loading, error } = useQuery(GET_RESTAURANTS_QUERY, {
        variables: { suburb: suburb || null, cuisineType: cuisine || null },
        fetchPolicy: 'network-only',
    });

    // NOTE: Apollo v4 doesn't type query results with our schema, so we cast
    // through `any` — same convention as the rest of this codebase.
    const restaurants: Restaurant[] = (data as any)?.restaurants ?? [];

    return (
        <div>
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <input
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    placeholder="Suburb (e.g. Surry Hills)"
                    className="flex-1 rounded-xl border border-border-main bg-bg-secondary px-4 py-2.5 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
                />
                <select
                    value={cuisine ?? ''}
                    onChange={(e) => setCuisine(e.target.value || null)}
                    className="rounded-xl border border-border-main bg-bg-secondary px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all cursor-pointer"
                >
                    <option value="">All cuisines</option>
                    {CUISINES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>

            {loading && (
                <div className="py-10 text-center text-sm text-text-muted">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-gold border-t-transparent align-middle mr-2" />
                    Finding restaurants…
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
                    Couldn't load restaurants. Is the backend running?
                </div>
            )}

            {!loading && !error && restaurants.length === 0 && (
                <div className="py-10 text-center text-sm text-text-muted">
                    No restaurants match that search — try a different suburb or clear the filters.
                </div>
            )}

            <ul className="flex flex-col gap-3">
                {restaurants.map((r) => (
                    <li key={r.id}>
                        <button
                            onClick={() => onSelect(r)}
                            className="w-full text-left rounded-2xl border border-border-main bg-bg-secondary/60 p-4 hover:border-brand-gold/60 hover:bg-item-hover hover:shadow-md transition-all duration-200 cursor-pointer group"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="font-black text-text-main group-hover:text-brand-gold transition-colors duration-200">
                                        {r.name}
                                    </h3>
                                    <p className="text-xs text-text-muted mt-0.5 truncate">
                                        {r.cuisineType ?? 'Modern Australian'} · {r.suburb}, {r.state} {r.postcode}
                                    </p>
                                    <p className="text-xs text-text-muted mt-0.5">
                                        Up to {r.maxPartySize} guests · {r.addressLine1}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-lg bg-brand-green/10 px-2.5 py-1 text-[11px] font-bold text-brand-green">
                                    Book →
                                </span>
                            </div>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};
