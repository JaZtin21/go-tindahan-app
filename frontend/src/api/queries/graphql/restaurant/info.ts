import { gql } from '@apollo/client';

// ============================================================================
// RESTAURANT INFO & MENU (the AI voice agent answers these from live data)
// ============================================================================

export const GET_RESTAURANT_INFO_QUERY = gql`
  query GetRestaurantInfo($id: String!) {
    restaurant(id: $id) {
      id name phone email addressLine1 suburb state postcode timezone cuisineType
      seatingType defaultTurnDurationMin bookingBufferMin maxPartySize
      description parkingInfo isActive createdAt updatedAt
    }
  }
`;

export const UPDATE_RESTAURANT_INFO_MUTATION = gql`
  mutation UpdateRestaurantInfo($id: String!, $input: UpdateRestaurantInput!) {
    updateRestaurant(id: $id, input: $input) {
      id name phone email addressLine1 suburb state postcode timezone cuisineType
      seatingType defaultTurnDurationMin bookingBufferMin maxPartySize
      description parkingInfo isActive updatedAt
    }
  }
`;

// --- Menu items ------------------------------------------------------------

export const GET_MENU_ITEMS_QUERY = gql`
  query GetMenuItems($restaurantId: String!) {
    menuItems(restaurantId: $restaurantId) {
      id restaurantId name description priceCents category isAvailable allergens sortOrder
    }
  }
`;

export const CREATE_MENU_ITEM_MUTATION = gql`
  mutation CreateMenuItem($input: CreateMenuItemInput!) {
    createMenuItem(input: $input) {
      id restaurantId name description priceCents category isAvailable allergens sortOrder
    }
  }
`;

export const UPDATE_MENU_ITEM_MUTATION = gql`
  mutation UpdateMenuItem($id: String!, $input: UpdateMenuItemInput!) {
    updateMenuItem(id: $id, input: $input) {
      id restaurantId name description priceCents category isAvailable allergens sortOrder
    }
  }
`;

export const DELETE_MENU_ITEM_MUTATION = gql`
  mutation DeleteMenuItem($id: String!) {
    deleteMenuItem(id: $id)
  }
`;
