-- Write Up Migration SQL Here
-- Required for the EXCLUDE constraint on bookings further down (prevents
-- double-booking the same table for an overlapping time window, enforced
-- by Postgres itself). Safe/no-op if already enabled.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- RESTAURANTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurants (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        VARCHAR(150) NOT NULL,
    phone                       VARCHAR(30) NOT NULL,
    email                       VARCHAR(255),
    address_line1               VARCHAR(255) NOT NULL,
    suburb                      VARCHAR(100) NOT NULL,
    state                       VARCHAR(10) NOT NULL,
    postcode                    VARCHAR(10) NOT NULL,
    timezone                    VARCHAR(50) NOT NULL DEFAULT 'Australia/Sydney',
    cuisine_type                VARCHAR(100),
    seating_type                VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    default_turn_duration_min   INT NOT NULL DEFAULT 90,
    booking_buffer_min          INT NOT NULL DEFAULT 15,
    max_party_size              INT NOT NULL DEFAULT 12,
    is_active                   BOOLEAN NOT NULL DEFAULT true,
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_restaurants_seating_type CHECK (seating_type IN ('STANDARD', 'FIXED_SITTING'))
);

-- ============================================================================
-- RESTAURANT OWNERS (dashboard login accounts — one account can be linked
-- to many restaurants via restaurant_staff below)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurant_owners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_restaurant_owners_email UNIQUE (email)
);

-- ============================================================================
-- RESTAURANT STAFF (join table: which owner accounts can act on which
-- restaurants, and with what role)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurant_staff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL,
    owner_id        UUID NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'STAFF',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_restaurant_staff_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_restaurant_staff_owner FOREIGN KEY (owner_id)
        REFERENCES restaurant_owners(id) ON DELETE CASCADE,
    CONSTRAINT uq_restaurant_staff_restaurant_owner UNIQUE (restaurant_id, owner_id),
    CONSTRAINT chk_restaurant_staff_role CHECK (role IN ('OWNER', 'MANAGER', 'STAFF'))
);

CREATE INDEX IF NOT EXISTS idx_restaurant_staff_owner
    ON restaurant_staff(owner_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_staff_restaurant
    ON restaurant_staff(restaurant_id);

-- ============================================================================
-- RESTAURANT TABLES (physical tables in the restaurant)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL,
    table_number    VARCHAR(50) NOT NULL,
    capacity_min    INT NOT NULL DEFAULT 1,
    capacity_max    INT NOT NULL,
    section         VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_restaurant_tables_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT uq_restaurant_tables_restaurant_number UNIQUE (restaurant_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant
    ON restaurant_tables(restaurant_id);

-- ============================================================================
-- OPERATING HOURS (weekly recurring)
-- ============================================================================
CREATE TABLE IF NOT EXISTS operating_hours (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL,
    day_of_week     INT NOT NULL,
    open_time       TIME,
    close_time      TIME,
    is_closed       BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT fk_operating_hours_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT uq_operating_hours_restaurant_day UNIQUE (restaurant_id, day_of_week),
    CONSTRAINT chk_operating_hours_day_of_week CHECK (day_of_week BETWEEN 0 AND 6)
);

CREATE INDEX IF NOT EXISTS idx_operating_hours_restaurant
    ON operating_hours(restaurant_id);

-- ============================================================================
-- CLOSURES (one-off closures — public holidays, private events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS closures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL,
    closure_date    DATE NOT NULL,
    reason          VARCHAR(255),

    CONSTRAINT fk_closures_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT uq_closures_restaurant_date UNIQUE (restaurant_id, closure_date)
);

CREATE INDEX IF NOT EXISTS idx_closures_restaurant
    ON closures(restaurant_id);

-- ============================================================================
-- CUSTOMERS (diners — global by phone number)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(30) NOT NULL,
    name            VARCHAR(150),
    email           VARCHAR(255),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_customers_phone UNIQUE (phone)
);

-- ============================================================================
-- BOOKINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    table_id UUID,
    party_size INT NOT NULL,
    booking_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INT NOT NULL,
    
    -- FIXED: Ditch the GENERATED ALWAYS formula. Make it a standard column.
    time_range TSTZRANGE NOT NULL,
    
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    special_requests TEXT,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
    source VARCHAR(20) NOT NULL DEFAULT 'PHONE',
    idempotency_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_bookings_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id),
    CONSTRAINT uq_bookings_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT chk_bookings_party_size CHECK (party_size > 0),
    CONSTRAINT chk_bookings_status CHECK (status IN ('PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    CONSTRAINT chk_bookings_payment_status CHECK (payment_status IN ('NONE', 'PENDING', 'PAID', 'REFUNDED')),
    CONSTRAINT chk_bookings_source CHECK (source IN ('PHONE', 'WEB', 'WALK_IN', 'THIRD_PARTY')),
    CONSTRAINT excl_bookings_table_overlap EXCLUDE USING gist (
        table_id WITH =,
        time_range WITH &&
    ) WHERE (table_id IS NOT NULL AND status NOT IN ('CANCELLED', 'NO_SHOW'))
);



CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_time
    ON bookings(restaurant_id, booking_time);

CREATE INDEX IF NOT EXISTS idx_bookings_customer
    ON bookings(customer_id);

-- ============================================================================
-- WAITLIST
-- ============================================================================
CREATE TABLE IF NOT EXISTS waitlist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL,
    customer_id     UUID NOT NULL,
    party_size      INT NOT NULL,
    requested_time  TIMESTAMP WITH TIME ZONE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_waitlist_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_waitlist_customer FOREIGN KEY (customer_id)
        REFERENCES customers(id),
    CONSTRAINT chk_waitlist_party_size CHECK (party_size > 0),
    CONSTRAINT chk_waitlist_status
        CHECK (status IN ('WAITING', 'NOTIFIED', 'CONVERTED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_time
    ON waitlist(restaurant_id, requested_time);

-- ============================================================================
-- CALL LOGS (ties Vapi calls to bookings — written by the Go webhook
-- handler that Vapi/Groq call into)
-- ============================================================================
CREATE TABLE IF NOT EXISTS call_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID,
    vapi_call_id    VARCHAR(150) NOT NULL,
    customer_phone  VARCHAR(30),
    booking_id      UUID,
    transcript      TEXT,
    outcome         VARCHAR(30),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_call_logs_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id) ON DELETE SET NULL,
    CONSTRAINT fk_call_logs_booking FOREIGN KEY (booking_id)
        REFERENCES bookings(id),
    CONSTRAINT chk_call_logs_outcome
        CHECK (outcome IN ('BOOKED', 'NO_AVAILABILITY', 'TRANSFERRED', 'ABANDONED'))
);

CREATE INDEX IF NOT EXISTS idx_call_logs_vapi_id
    ON call_logs(vapi_call_id);