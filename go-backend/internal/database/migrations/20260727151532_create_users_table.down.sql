-- Write Down Migration SQL Here
DROP TABLE IF EXISTS item_scan_events;

DROP INDEX IF EXISTS idx_inventory_items_item_name_trgm;
DROP INDEX IF EXISTS idx_inventory_items_visual_class_keys;

ALTER TABLE inventory_items
    DROP COLUMN IF EXISTS visual_class_keys;

-- Not dropping the pg_trgm extension by default — DROP EXTENSION is
-- cluster-wide and other tables/queries may end up depending on it later.
-- Uncomment only if you're sure nothing else in the DB uses it:
-- DROP EXTENSION IF EXISTS pg_trgm;