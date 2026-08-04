import { gql } from '@apollo/client';

// ============================================================================
// RESTAURANTS (profile CRUD + list)
// ============================================================================

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
