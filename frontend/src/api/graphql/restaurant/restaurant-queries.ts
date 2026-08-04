import { gql } from '@apollo/client';

// ==========================================
// Restaurant Owner Auth & Restaurant GraphQL Operations
// ==========================================

/* --- RESTAURANT OWNER AUTH MUTATIONS --- */

export const REGISTER_RESTAURANT_OWNER_MUTATION = gql`
  mutation RegisterRestaurantOwner($input: RestaurantRegisterInput!) {
    registerRestaurantOwner(input: $input) {
      accessToken
      owner {
        id
        firstName
        lastName
        email
        createdAt
        restaurants {
          role
          restaurant {
            id
            name
          }
        }
      }
    }
  }
`;

export const LOGIN_RESTAURANT_OWNER_MUTATION = gql`
  mutation LoginRestaurantOwner($input: RestaurantLoginInput!) {
    loginRestaurantOwner(input: $input) {
      accessToken
      owner {
        id
        firstName
        lastName
        email
        createdAt
        restaurants {
          role
          restaurant {
            id
            name
          }
        }
      }
    }
  }
`;

export const REFRESH_RESTAURANT_TOKEN_MUTATION = gql`
  mutation RefreshRestaurantToken {
    refreshRestaurantToken {
      accessToken
      owner {
        id
        firstName
        lastName
        email
        createdAt
        restaurants {
          role
          restaurant {
            id
            name
          }
        }
      }
    }
  }
`;

export const LOGOUT_RESTAURANT_OWNER_MUTATION = gql`
  mutation LogoutRestaurantOwner {
    logoutRestaurantOwner
  }
`;

/* --- RESTAURANT MUTATIONS --- */

export const CREATE_RESTAURANT_MUTATION = gql`
  mutation CreateRestaurant($input: CreateRestaurantInput!) {
    createRestaurant(input: $input) {
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
      createdAt
    }
  }
`;

export const UPDATE_RESTAURANT_MUTATION = gql`
  mutation UpdateRestaurant($id: String!, $input: UpdateRestaurantInput!) {
    updateRestaurant(id: $id, input: $input) {
      id
      name
      phone
      email
      addressLine1
      suburb
      state
      postcode
      cuisineType
      seatingType
      defaultTurnDurationMin
      bookingBufferMin
      maxPartySize
      isActive
      updatedAt
    }
  }
`;

/* --- QUERIES --- */

export const CURRENT_RESTAURANT_OWNER_QUERY = gql`
  query CurrentRestaurantOwner {
    currentRestaurantOwner {
      id
      firstName
      lastName
      email
      createdAt
      restaurants {
        role
        restaurant {
          id
          name
          suburb
          state
        }
      }
    }
  }
`;

export const GET_RESTAURANT_QUERY = gql`
  query GetRestaurant($id: String!) {
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
      createdAt
      updatedAt
    }
  }
`;