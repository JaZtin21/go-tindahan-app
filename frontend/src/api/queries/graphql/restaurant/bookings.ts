import { gql } from '@apollo/client';

// ============================================================================
// CUSTOMERS
// ============================================================================

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

// ============================================================================
// BOOKINGS
// ============================================================================

export const GET_BOOKING_QUERY = gql`
  query GetBooking($id: String!) {
    booking(id: $id) {
      id restaurantId customerId tableId partySize bookingTime durationMinutes status specialRequests paymentStatus source createdAt updatedAt
      customer { id name phone email }
    }
  }
`;

export const GET_BOOKINGS_QUERY = gql`
  query GetBookings($restaurantId: String!, $date: String, $status: BookingStatus) {
    bookings(restaurantId: $restaurantId, date: $date, status: $status) {
      id restaurantId customerId tableId partySize bookingTime durationMinutes status specialRequests paymentStatus source createdAt
      customer { id name phone email }
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

// NOTE: the backend's cancelBooking/assignTable both route through
// UpdateBooking, which RETURNS the full booking object. Selecting the full
// field set here matters: the bookings timeline upserts these responses into
// Redux, and a partial selection would clobber partySize/bookingTime/etc.
export const CANCEL_BOOKING_MUTATION = gql`
  mutation CancelBooking($id: String!) {
    cancelBooking(id: $id) {
      id restaurantId customerId tableId partySize bookingTime durationMinutes status specialRequests paymentStatus source createdAt updatedAt
      customer { id name phone email }
    }
  }
`;

export const ASSIGN_TABLE_MUTATION = gql`
  mutation AssignTable($bookingId: String!, $tableId: String!) {
    assignTable(bookingId: $bookingId, tableId: $tableId) {
      id restaurantId customerId tableId partySize bookingTime durationMinutes status specialRequests paymentStatus source createdAt updatedAt
      customer { id name phone email }
    }
  }
`;
