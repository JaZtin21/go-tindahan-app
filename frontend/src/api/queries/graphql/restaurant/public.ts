import { gql } from '@apollo/client';

// ============================================================================
// PUBLIC-FACING QUERIES (no auth required — customers & Vapi)
// ============================================================================

// Full restaurant detail incl. tables/operating hours/closures so the
// public booking page can render opening hours + pick a table.
export const GET_PUBLIC_RESTAURANT_QUERY = gql`
  query GetPublicRestaurant($id: String!) {
    restaurant(id: $id) {
      id
      name
      phone
      email
      addressLine1
      suburb
      state
      postcode
      timezone
      cuisineType
      seatingType
      defaultTurnDurationMin
      bookingBufferMin
      maxPartySize
      isActive
      tables {
        id
        restaurantId
        tableNumber
        capacityMin
        capacityMax
        section
        isActive
      }
      operatingHours {
        id
        dayOfWeek
        openTime
        closeTime
        isClosed
      }
      closures {
        id
        closureDate
        reason
      }
      createdAt
      updatedAt
    }
  }
`;
