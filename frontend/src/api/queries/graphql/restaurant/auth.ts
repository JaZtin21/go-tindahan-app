import { gql } from '@apollo/client';

// ============================================================================
// RESTAURANT OWNER AUTH
// ============================================================================

// Shared fragment so every auth payload carries the full restaurant profile
// the dashboard + feature pages render (backend already returns all columns).
const RESTAURANT_PROFILE_FRAGMENT = gql`
  fragment RestaurantProfile on Restaurant {
    id name phone email addressLine1 suburb state postcode timezone cuisineType
    seatingType defaultTurnDurationMin bookingBufferMin maxPartySize isActive createdAt updatedAt
  }
`;

export const REGISTER_RESTAURANT_OWNER_MUTATION = gql`
  mutation RegisterRestaurantOwner($input: RestaurantRegisterInput!) {
    registerRestaurantOwner(input: $input) {
      accessToken
      owner {
        id firstName lastName email createdAt updatedAt
        restaurants { role restaurant { ...RestaurantProfile } }
      }
    }
  }
  ${RESTAURANT_PROFILE_FRAGMENT}
`;

export const LOGIN_RESTAURANT_OWNER_MUTATION = gql`
  mutation LoginRestaurantOwner($input: RestaurantLoginInput!) {
    loginRestaurantOwner(input: $input) {
      accessToken
      owner {
        id firstName lastName email createdAt updatedAt
        restaurants { role restaurant { ...RestaurantProfile } }
      }
    }
  }
  ${RESTAURANT_PROFILE_FRAGMENT}
`;

export const REFRESH_RESTAURANT_TOKEN_MUTATION = gql`
  mutation RefreshRestaurantToken {
    refreshRestaurantToken {
      accessToken
      owner {
        id firstName lastName email createdAt updatedAt
        restaurants { role restaurant { ...RestaurantProfile } }
      }
    }
  }
  ${RESTAURANT_PROFILE_FRAGMENT}
`;

export const LOGOUT_RESTAURANT_OWNER_MUTATION = gql`
  mutation LogoutRestaurantOwner { logoutRestaurantOwner }
`;

export const CURRENT_RESTAURANT_OWNER_QUERY = gql`
  query CurrentRestaurantOwner {
    currentRestaurantOwner {
      id firstName lastName email createdAt updatedAt
      restaurants { role restaurant { ...RestaurantProfile } }
    }
  }
  ${RESTAURANT_PROFILE_FRAGMENT}
`;
