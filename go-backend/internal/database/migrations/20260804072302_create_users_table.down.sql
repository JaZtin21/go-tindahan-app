-- Write Down Migration SQL Here
-- ============================================================================
-- Write Down Migration SQL Here
-- Dropping objects in reverse order of creation to avoid constraint violations.
-- ============================================================================

-- 1. Drop CALL LOGS
DROP INDEX IF EXISTS idx_call_logs_vapi_id;
DROP TABLE IF EXISTS call_logs;

-- 2. Drop WAITLIST
DROP INDEX IF EXISTS idx_waitlist_restaurant_time;
DROP TABLE IF EXISTS waitlist;

-- 3. Drop BOOKINGS
DROP INDEX IF EXISTS idx_bookings_customer;
DROP INDEX IF EXISTS idx_bookings_restaurant_time;
DROP TABLE IF EXISTS bookings;

-- 4. Drop CUSTOMERS
DROP TABLE IF EXISTS customers;

-- 5. Drop CLOSURES
DROP INDEX IF EXISTS idx_closures_restaurant;
DROP TABLE IF EXISTS closures;

-- 6. Drop OPERATING HOURS
DROP INDEX IF EXISTS idx_operating_hours_restaurant;
DROP TABLE IF EXISTS operating_hours;

-- 7. Drop RESTAURANT TABLES
DROP INDEX IF EXISTS idx_restaurant_tables_restaurant;
DROP TABLE IF EXISTS restaurant_tables;

-- 8. Drop RESTAURANT STAFF
DROP INDEX IF EXISTS idx_restaurant_staff_restaurant;
DROP INDEX IF EXISTS idx_restaurant_staff_owner;
DROP TABLE IF EXISTS restaurant_staff;

-- 9. Drop RESTAURANT OWNERS
DROP TABLE IF EXISTS restaurant_owners;

-- 10. Drop RESTAURANTS
DROP TABLE IF EXISTS restaurants;

-- 11. Drop EXTENSIONS
-- Optional: Only include this if your platform requires wiping the extension.
-- If other schemas use btree_gist, you may want to omit this line.
DROP EXTENSION IF EXISTS btree_gist;
