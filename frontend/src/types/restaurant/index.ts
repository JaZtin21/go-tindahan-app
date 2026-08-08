// ============================================================================
// RESTAURANT DOMAIN TYPES
// Mirrors the backend GraphQL schema (go-backend/internal/graph/schema/restaurant*.graphqls)
// ============================================================================

// --- Enums ---------------------------------------------------------------
export type SeatingType = 'STANDARD' | 'FIXED_SITTING';

export type RestaurantUserRole = 'OWNER' | 'MANAGER' | 'STAFF';

export type BookingStatus =
    | 'PENDING'
    | 'CONFIRMED'
    | 'SEATED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'NO_SHOW';

export type PaymentStatus = 'NONE' | 'PENDING' | 'PAID' | 'REFUNDED';

export type BookingSource = 'PHONE' | 'WEB' | 'WALK_IN' | 'THIRD_PARTY';

export type WaitlistStatus = 'WAITING' | 'NOTIFIED' | 'CONVERTED' | 'EXPIRED';

export type CallOutcome = 'BOOKED' | 'NO_AVAILABILITY' | 'TRANSFERRED' | 'ABANDONED';

// --- Core entities -------------------------------------------------------
export interface Restaurant {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    addressLine1: string;
    suburb: string;
    state: string;
    postcode: string;
    timezone: string;
    cuisineType?: string | null;
    seatingType: SeatingType;
    defaultTurnDurationMin: number;
    bookingBufferMin: number;
    maxPartySize: number;
    description?: string | null;
    parkingInfo?: string | null;
    isActive: boolean;
    tables?: RestaurantTable[];
    operatingHours?: OperatingHours[];
    closures?: Closure[];
    createdAt: string;
    updatedAt: string;
}

export interface RestaurantStaffRole {
    restaurant: Restaurant;
    role: RestaurantUserRole;
}

export interface RestaurantOwner {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    restaurants: RestaurantStaffRole[];
    createdAt: string;
    updatedAt: string;
}

export interface RestaurantTable {
    id: string;
    restaurantId: string;
    tableNumber: string;
    capacityMin: number;
    capacityMax: number;
    section?: string | null;
    isActive: boolean;
}

export interface OperatingHours {
    id: string;
    dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
    openTime?: string | null;
    closeTime?: string | null;
    isClosed: boolean;
}

export interface Closure {
    id: string;
    closureDate: string; // yyyy-MM-dd
    reason?: string | null;
}

export interface Customer {
    id: string;
    phone: string;
    name?: string | null;
    email?: string | null;
    createdAt: string;
}

export interface Booking {
    id: string;
    restaurantId: string;
    customerId: string;
    customer?: Customer | null;
    tableId?: string | null;
    partySize: number;
    bookingTime: string; // ISO 8601
    durationMinutes: number;
    status: BookingStatus;
    specialRequests?: string | null;
    paymentStatus: PaymentStatus;
    source: BookingSource;
    createdAt: string;
    updatedAt: string;
}

export interface MenuItem {
    id: string;
    restaurantId: string;
    name: string;
    description?: string | null;
    priceCents: number;
    category?: string | null;
    isAvailable: boolean;
    allergens: string[];
    sortOrder: number;
}

export interface WaitlistEntry {
    id: string;
    restaurantId: string;
    customerId: string;
    partySize: number;
    requestedTime: string; // ISO 8601
    status: WaitlistStatus;
    createdAt: string;
}

export interface CallLog {
    id: string;
    restaurantId?: string | null;
    vapiCallId: string;
    customerPhone?: string | null;
    bookingId?: string | null;
    transcript?: string | null;
    outcome?: CallOutcome | null;
    createdAt: string;
}

export interface AvailableSlot {
    table: RestaurantTable;
    startTime: string;
    endTime: string;
}

// --- Inputs ---------------------------------------------------------------
export interface CreateRestaurantInput {
    name: string;
    phone: string;
    email?: string | null;
    addressLine1?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    timezone?: string | null;
    cuisineType?: string | null;
    seatingType?: SeatingType | null;
    defaultTurnDurationMin?: number | null;
    bookingBufferMin?: number | null;
    maxPartySize?: number | null;
}

export interface UpdateRestaurantInput {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    addressLine1?: string | null;
    suburb?: string | null;
    state?: string | null;
    postcode?: string | null;
    cuisineType?: string | null;
    seatingType?: SeatingType | null;
    defaultTurnDurationMin?: number | null;
    bookingBufferMin?: number | null;
    maxPartySize?: number | null;
    description?: string | null;
    parkingInfo?: string | null;
    isActive?: boolean | null;
}

export interface CreateMenuItemInput {
    restaurantId: string;
    name: string;
    description?: string | null;
    priceCents: number;
    category?: string | null;
    allergens?: string[] | null;
}

export interface UpdateMenuItemInput {
    name?: string | null;
    description?: string | null;
    priceCents?: number | null;
    category?: string | null;
    isAvailable?: boolean | null;
    allergens?: string[] | null;
    sortOrder?: number | null;
}

export interface CreateTableInput {
    restaurantId: string;
    tableNumber: string;
    capacityMin: number;
    capacityMax: number;
    section?: string | null;
}

export interface UpdateTableInput {
    tableNumber?: string | null;
    capacityMin?: number | null;
    capacityMax?: number | null;
    section?: string | null;
    isActive?: boolean | null;
}

export interface SetOperatingHoursInput {
    dayOfWeek: number;
    openTime?: string | null;
    closeTime?: string | null;
    isClosed?: boolean | null;
}

export interface CreateClosureInput {
    restaurantId: string;
    closureDate: string;
    reason?: string | null;
}

export interface FindOrCreateCustomerInput {
    phone: string;
    name?: string | null;
    email?: string | null;
}

export interface CheckAvailabilityInput {
    restaurantId: string;
    partySize: number;
    requestedTime: string;
}

export interface CreateBookingInput {
    restaurantId: string;
    customerId: string;
    tableId?: string | null;
    partySize: number;
    bookingTime: string;
    specialRequests?: string | null;
    source?: BookingSource | null;
    idempotencyKey: string;
}

export interface UpdateBookingInput {
    tableId?: string | null;
    partySize?: number | null;
    bookingTime?: string | null;
    status?: BookingStatus | null;
    specialRequests?: string | null;
    paymentStatus?: PaymentStatus | null;
}

export interface CreateWaitlistEntryInput {
    restaurantId: string;
    customerId: string;
    partySize: number;
    requestedTime: string;
}

export interface LogCallInput {
    restaurantId?: string | null;
    vapiCallId: string;
    customerPhone?: string | null;
    bookingId?: string | null;
    transcript?: string | null;
    outcome?: CallOutcome | null;
}
