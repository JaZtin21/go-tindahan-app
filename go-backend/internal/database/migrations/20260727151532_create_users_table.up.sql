-- Write Up Migration SQL Here
-- Enable trigram search for fuzzy/word-level product name matching.
-- Lets "TOMI SUPER Sweel Corn" (OCR noise) still match "TOMI SUPER Sweet Corn"
-- (owner-edited name) without requiring literal substring containment.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Stable recognition keys bound to an inventory item, independent of its
-- (owner-editable) display name. Populated from the vision model's top
-- candidate class name(s) at scan time, and appended to whenever a scan
-- result gets corrected into an existing item. This is what survives a
-- rename that the trigram fallback below can't — e.g. renaming
-- "TOMI SUPER Sweet Corn" to "Yellow Bag Snack #3" still resolves via this
-- key even though the two strings share almost no text.
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS visual_class_keys TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_inventory_items_visual_class_keys
    ON inventory_items USING gin (visual_class_keys);

-- Trigram index for fuzzy text search — the fallback layer used when no
-- visual_class_keys match is found (or none was supplied, e.g. manual typing).
CREATE INDEX IF NOT EXISTS idx_inventory_items_item_name_trgm
    ON inventory_items USING gin (item_name gin_trgm_ops);

-- Retraining / drift queue: every scan where the recognized text didn't
-- resolve to an existing item with confidence, or where a shop owner had to
-- manually correct a scan result. Lets you find real-world mismatches
-- between what the model predicts and what's actually on the shelf, instead
-- of guessing which products need retraining.
CREATE TABLE IF NOT EXISTS item_scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    inventory_item_id UUID,
    top_visual_candidate VARCHAR(150),
    visual_distance NUMERIC(6, 4),
    ocr_text TEXT,
    resolved_name VARCHAR(150),
    match_type VARCHAR(30) NOT NULL, -- 'visual_key' | 'trgm_fallback' | 'no_match' | 'manual_correction'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_item_scan_events_shop FOREIGN KEY (shop_id)
        REFERENCES shops(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_scan_events_inventory FOREIGN KEY (inventory_item_id)
        REFERENCES inventory_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_item_scan_events_shop_created_at
    ON item_scan_events(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_scan_events_match_type
    ON item_scan_events(match_type);