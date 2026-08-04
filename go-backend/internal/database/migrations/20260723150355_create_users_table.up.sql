-- Phase 1: Structural Schema Extensions
ALTER TABLE shops ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE checkout_batches ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Phase 2: Backfill the Sync Column on the Existing Log Table
-- NOTE: item_action_history is already created by 20260717090000 WITHOUT
-- server_updated_at. A CREATE TABLE IF NOT EXISTS here would silently no-op
-- (table already exists) so the column would never be added, and Phase 3's
-- idx_item_action_history_sync would fail with 42703 on any fresh database.
-- An explicit ALTER is the only correct way to backfill it.
ALTER TABLE item_action_history ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Phase 3: Build Tracking Indices
CREATE INDEX IF NOT EXISTS idx_shops_sync ON shops (server_updated_at);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sync ON inventory_items (server_updated_at);
CREATE INDEX IF NOT EXISTS idx_checkout_batches_sync ON checkout_batches (server_updated_at);
CREATE INDEX IF NOT EXISTS idx_item_action_history_sync ON item_action_history (server_updated_at);
CREATE INDEX IF NOT EXISTS idx_item_action_history_shop_created_at ON item_action_history (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_action_history_action ON item_action_history (action);

-- Phase 4: Construct Stored Procedure Functions
CREATE OR REPLACE FUNCTION update_server_sync_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.server_updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Phase 5: Safely Attach Trigger Listeners to Populated Columns
DROP TRIGGER IF EXISTS tg_update_shops_sync ON shops;
CREATE TRIGGER tg_update_shops_sync 
    BEFORE UPDATE ON shops 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_server_sync_timestamp();

DROP TRIGGER IF EXISTS tg_update_inventory_items_sync ON inventory_items;
CREATE TRIGGER tg_update_inventory_items_sync 
    BEFORE UPDATE ON inventory_items 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_server_sync_timestamp();
