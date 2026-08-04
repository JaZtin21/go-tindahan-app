import { gql } from '@apollo/client';

// ==========================================
// Restaurant Owner Auth & Restaurant GraphQL Operations
// ==========================================

/* --- RESTAURANT OWNER AUTH MUTATIONS --- */

// =========================================================================
// 1. RESTAURANT OWNER AUTH MUTATIONS
// =========================================================================
export const REGISTER_RESTAURANT_OWNER_MUTATION = gql`
  mutation RegisterRestaurantOwner($input: RestaurantRegisterInput!) {
    registerRestaurantOwner(input: $input) {
      accessToken
      owner {
        id firstName lastName email createdAt
        restaurants { role restaurant { id name } }
      }
    }
  }
`;

export const LOGIN_RESTAURANT_OWNER_MUTATION = gql`
  mutation LoginRestaurantOwner($input: RestaurantLoginInput!) {
    loginRestaurantOwner(input: $input) {
      accessToken
      owner {
        id firstName lastName email createdAt
        restaurants { role restaurant { id name } }
      }
    }
  }
`;

export const REFRESH_RESTAURANT_TOKEN_MUTATION = gql`
  mutation RefreshRestaurantToken {
    refreshRestaurantToken {
      accessToken
      owner {
        id firstName lastName email createdAt
        restaurants { role restaurant { id name } }
      }
    }
  }
`;

export const LOGOUT_RESTAURANT_OWNER_MUTATION = gql`
  mutation LogoutRestaurantOwner { logoutRestaurantOwner }
`;

// =========================================================================
// 2. RESTAURANT MUTATIONS & QUERIES
// =========================================================================
export const CREATE_RESTAURANT_MUTATION = gql`
  mutation CreateRestaurant($input: CreateRestaurantInput!) {
    createRestaurant(input: $input) {
      id name phone email addressLine1 suburb state postcode timezone cuisineType seatingType defaultTurnDurationMin bookingBufferMin maxPartySize isActive createdAt
    }
  }
`;

export const UPDATE_RESTAURANT_MUTATION = gql`
  mutation UpdateRestaurant($id: String!, $input: UpdateRestaurantInput!) {
    updateRestaurant(id: $id, input: $input) {
      id name phone email addressLine1 suburb state postcode cuisineType seatingType defaultTurnDurationMin bookingBufferMin maxPartySize isActive updatedAt
    }
  }
`;

export const CURRENT_RESTAURANT_OWNER_QUERY = gql`
  query CurrentRestaurantOwner {
    currentRestaurantOwner {
      id firstName lastName email createdAt
      restaurants { role restaurant { id name suburb state } }
    }
  }
`;

export const GET_RESTAURANT_QUERY = gql`
  query GetRestaurant($id: String!) {
    restaurant(id: $id) {
      id name phone email addressLine1 suburb state postcode timezone cuisineType seatingType defaultTurnDurationMin bookingBufferMin maxPartySize isActive createdAt updatedAt
    }
  }
`;

export const GET_RESTAURANTS_QUERY = gql`
  query GetRestaurants($suburb: String, $cuisineType: String) {
    restaurants(suburb: $suburb, cuisineType: $cuisineType) {
      id name phone email addressLine1 suburb state postcode timezone cuisineType seatingType defaultTurnDurationMin bookingBufferMin maxPartySize isActive
    }
  }
`;

// =========================================================================
// 3. ADDED: TABLES MUTATIONS
// =========================================================================
export const CREATE_TABLE_MUTATION = gql`
  mutation CreateTable($input: CreateTableInput!) {
    createTable(input: $input) {
      id restaurantId tableNumber capacityMin capacityMax section isActive
    }
  }
`;

export const UPDATE_TABLE_MUTATION = gql`
  mutation UpdateTable($id: String!, $input: UpdateTableInput!) {
    updateTable(id: $id, input: $input) {
      id restaurantId tableNumber capacityMin capacityMax section isActive
    }
  }
`;

export const DELETE_TABLE_MUTATION = gql`
  mutation DeleteTable($id: String!) {
    deleteTable(id: $id)
  }
`;

export const SET_OPERATING_HOURS_MUTATION = gql`
  mutation SetOperatingHours($restaurantId: String!, $hours: [SetOperatingHoursInput!]!) {
    setOperatingHours(restaurantId: $restaurantId, hours: $hours) {
      id dayOfWeek openTime closeTime isClosed
    }
  }
`;

// =========================================================================
// 4. OPERATING HOURS & CLOSURES MUTATIONS (CONTINUED)
// =========================================================================
export const CREATE_CLOSURE_MUTATION = gql`
  mutation CreateClosure($input: CreateClosureInput!) {
    createClosure(input: $input) {
      id closureDate reason
    }
  }
`;

export const DELETE_CLOSURE_MUTATION = gql`
  mutation DeleteClosure($id: String!) {
    deleteClosure(id: $id)
  }
`;

// =========================================================================
// 5. CUSTOMERS QUERIES & MUTATIONS
// =========================================================================
export const GET_CUSTOMER_QUERY = gql`
  query GetCustomer($phone: String!) {
    customer(phone: $phone) {
      id phone name email createdAt
    }
  }
`;

export const FIND_OR_CREATE_CUSTOMER_MUTATION = gql`
  mutation FindOrCreateCustomer($input: FindOrCreateCustomerInput!) {
    findOrCreateCustomer(input: $input) {
      id phone name email createdAt
    }
  }
`;

// =========================================================================
// 6. BOOKINGS QUERIES & MUTATIONS
// =========================================================================
export const GET_BOOKING_QUERY = gql`
  query GetBooking($id: String!) {
    booking(id: $id) {
      id restaurantId customerId tableId partySize bookingTime durationMinutes status specialRequests paymentStatus source createdAt updatedAt
    }
  }
`;

export const GET_BOOKINGS_QUERY = gql`
  query GetBookings($restaurantId: String!, $date: String, $status: BookingStatus) {
    bookings(restaurantId: $restaurantId, date: $date, status: $status) {
      id restaurantId customerId tableId partySize bookingTime durationMinutes status specialRequests paymentStatus source createdAt
    }
  }
`;

export const CHECK_AVAILABILITY_QUERY = gql`
  query CheckAvailability($input: CheckAvailabilityInput!) {
    checkAvailability(input: $input) {
      table { id restaurantId tableNumber capacityMin capacityMax section isActive }
      startTime
      endTime
    }
  }
`;

export const CREATE_BOOKING_MUTATION = gql`
  mutation CreateBooking($input: CreateBookingInput!) {
    createBooking(input: $input) {
      id restaurantId customerId tableId partySize bookingTime durationMinutes status specialRequests paymentStatus source createdAt updatedAt
    }
  }
`;

export const UPDATE_BOOKING_MUTATION = gql`
  mutation UpdateBooking($id: String!, $input: UpdateBookingInput!) {
    updateBooking(id: $id, input: $input) {
      id restaurantId customerId tableId partySize bookingTime durationMinutes status specialRequests paymentStatus
    }
  }
`;

export const CANCEL_BOOKING_MUTATION = gql`
  mutation CancelBooking($id: String!) {
    cancelBooking(id: $id) {
      id status
    }
  }
`;

export const ASSIGN_TABLE_MUTATION = gql`
  mutation AssignTable($bookingId: String!, $tableId: String!) {
    assignTable(bookingId: $bookingId, tableId: $tableId) {
      id tableId status
    }
  }
`;

// =========================================================================
// 7. WAITLIST QUERIES & MUTATIONS
// =========================================================================
export const GET_WAITLIST_QUERY = gql`
  query GetWaitlist($restaurantId: String!, $status: WaitlistStatus) {
    waitlist(restaurantId: $restaurantId, status: $status) {
      id restaurantId customerId partySize requestedTime status createdAt
    }
  }
`;

export const CREATE_WAITLIST_ENTRY_MUTATION = gql`
  mutation CreateWaitlistEntry($input: CreateWaitlistEntryInput!) {
    createWaitlistEntry(input: $input) {
      id restaurantId customerId partySize requestedTime status createdAt
    }
  }
`;

export const UPDATE_WAITLIST_STATUS_MUTATION = gql`
  mutation UpdateWaitlistStatus($id: String!, $status: WaitlistStatus!) {
    updateWaitlistStatus(id: $id, status: $status) {
      id status
    }
  }
`;

export const CONVERT_WAITLIST_TO_BOOKING_MUTATION = gql`
  mutation ConvertWaitlistToBooking($id: String!, $tableId: String!) {
    convertWaitlistToBooking(id: $id, tableId: $tableId) {
      id restaurantId customerId tableId partySize bookingTime durationMinutes status
    }
  }
`;

// =========================================================================
// 8. CALL LOGS QUERIES & MUTATIONS
// =========================================================================
export const GET_CALL_LOG_QUERY = gql`
  query GetCallLog($vapiCallId: String!) {
    callLog(vapiCallId: $vapiCallId) {
      id restaurantId vapiCallId customerPhone bookingId transcript outcome createdAt
    }
  }
`;

export const LOG_CALL_MUTATION = gql`
  mutation LogCall($input: LogCallInput!) {
    logCall(input: $input) {
      id restaurantId vapiCallId customerPhone bookingId transcript outcome createdAt
    }
  }
`;
