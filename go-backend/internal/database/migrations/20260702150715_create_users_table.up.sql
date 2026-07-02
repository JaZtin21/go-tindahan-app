-- 1. SHOPS TABLE
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id VARCHAR(255) NOT NULL,            -- Links to your User auth string ID
    shop_name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    description TEXT,                          -- Added for store narrative overview
    photo TEXT,                                -- Main cover picture URL
    photos TEXT[] NOT NULL DEFAULT '{}',       -- Array collection for extra storefront gallery images
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. INVENTORY ITEMS TABLE
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,                     -- Hard-linked back to the parent shop
    item_name VARCHAR(150) NOT NULL,
    description TEXT,                          -- Added for individual product text descriptions
    barcode VARCHAR(100),
    category VARCHAR(100),
    unit_of_measure VARCHAR(100),              -- Pushed defaults back to clean Go pointers or NULL
    photo TEXT,                                -- Product element thumbnail picture URL
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,    -- Protected Puhunan 
    selling_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Public Bentahan
    stock_quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 5,               -- Threshold indicator for low stock
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_shop FOREIGN KEY (shop_id) 
        REFERENCES shops(id) ON DELETE CASCADE          -- Wipes clean if a store admin deletes the entire shop
);

-- 3. SHOP REVIEWS TABLE (Public Customer Feedback System)
CREATE TABLE IF NOT EXISTS shop_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,                     -- Target shop profile relationship link
    user_id VARCHAR(255) NOT NULL,             -- Public reviewer authenticated string ID
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5), -- Constrains values from 1 to 5 stars
    comment TEXT,
    photos TEXT[] NOT NULL DEFAULT '{}',       -- Array for customer attachment uploads
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_review_shop FOREIGN KEY (shop_id) 
        REFERENCES shops(id) ON DELETE CASCADE
);

-- 4. CRITICAL PERFORMANCE LOOKUP INDEXES
-- For dashboard operations displaying an owner's set of storefronts
CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);

-- Case-insensitive pattern indexes matching ILIKE text tracking for searchShop
CREATE INDEX IF NOT EXISTS idx_shops_search ON shops USING gin (to_tsvector('english', shop_name || ' ' || address));

-- Composite index matching alphanumeric pagination streams sorting for getShopInventory and searchProduct
CREATE INDEX IF NOT EXISTS idx_inventory_shop_items ON inventory_items(shop_id, item_name ASC);
CREATE INDEX IF NOT EXISTS idx_inventory_search ON inventory_items USING gin (to_tsvector('english', item_name || ' ' || COALESCE(category, '')));

-- For aggregating and parsing feedback chronologically on public store displays
CREATE INDEX IF NOT EXISTS idx_reviews_shop ON shop_reviews(shop_id, created_at DESC);
