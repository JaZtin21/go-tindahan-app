CREATE TABLE IF NOT EXISTS item_action_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    inventory_item_id UUID,
    item_name VARCHAR(150) NOT NULL,
    action VARCHAR(50) NOT NULL,
    quantity INT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_item_action_history_shop FOREIGN KEY (shop_id)
        REFERENCES shops(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_action_history_inventory FOREIGN KEY (inventory_item_id)
        REFERENCES inventory_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_item_action_history_shop_created_at
    ON item_action_history(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_action_history_action
    ON item_action_history(action);
