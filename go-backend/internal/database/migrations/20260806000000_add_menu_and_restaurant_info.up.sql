-- ============================================================================
-- MENU & RESTAURANT INFO (staff-edited, read aloud by the voice agent via the
-- restaurant_info tool) — 2026-08-06
-- ============================================================================

-- 1. Restaurant info fields staff edit in the dashboard (answered by Riley)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS parking_info TEXT;

-- 2. Menu items (name, price, description, allergens) — lightweight, no POS
--    integration. Price stored in cents to avoid float rounding.
CREATE TABLE IF NOT EXISTS menu_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    price_cents     INT NOT NULL DEFAULT 0,
    category        VARCHAR(100),
    is_available    BOOLEAN NOT NULL DEFAULT true,
    allergens       TEXT[] NOT NULL DEFAULT '{}',
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_menu_items_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant
    ON menu_items(restaurant_id);
