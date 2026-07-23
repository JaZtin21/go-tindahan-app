-- 1. Remove Triggers and Functions
DROP TRIGGER IF EXISTS tg_update_shops_sync ON shops;
DROP TRIGGER IF EXISTS tg_update_inventory_items_sync ON inventory_items;
DROP FUNCTION IF EXISTS update_server_sync_timestamp();

-- 2. Drop High-Performance and Custom UI Indexes
DROP INDEX IF EXISTS idx_shops_sync;
DROP INDEX IF EXISTS idx_inventory_items_sync;
DROP INDEX IF EXISTS idx_checkout_batches_sync;
DROP INDEX IF EXISTS idx_item_action_history_sync;
DROP INDEX IF EXISTS idx_item_action_history_shop_created_at;
DROP INDEX IF EXISTS idx_item_action_history_action;

-- 3. Clean up the Item Action History table
DROP TABLE IF EXISTS item_action_history;

-- 4. Strip Sync Columns away from Core Tables to Revert State
ALTER TABLE shops DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE shops DROP COLUMN IF EXISTS server_updated_at;

ALTER TABLE inventory_items DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS server_updated_at;

ALTER TABLE checkout_batches DROP COLUMN IF EXISTS server_updated_at;
