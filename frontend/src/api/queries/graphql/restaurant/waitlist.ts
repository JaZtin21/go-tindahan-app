import { gql } from '@apollo/client';

// ============================================================================
// WAITLIST
// ============================================================================

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
