CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_shop_barcode_uidx
    ON inventory_items (shop_id, barcode)
    WHERE barcode IS NOT NULL AND barcode <> '';