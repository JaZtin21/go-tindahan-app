-- Rollback: menu & restaurant info additions
DROP TABLE IF EXISTS menu_items;
ALTER TABLE restaurants DROP COLUMN IF EXISTS parking_info;
ALTER TABLE restaurants DROP COLUMN IF EXISTS description;
