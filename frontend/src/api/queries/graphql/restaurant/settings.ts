import { gql } from '@apollo/client';

// ============================================================================
// OPERATING HOURS & CLOSURES (settings)
// ============================================================================

export const GET_OPERATING_HOURS_QUERY = gql`
  query GetOperatingHours($restaurantId: String!) {
    operatingHours(restaurantId: $restaurantId) {
      id dayOfWeek openTime closeTime isClosed
    }
  }
`;

export const SET_OPERATING_HOURS_MUTATION = gql`
  mutation SetOperatingHours($restaurantId: String!, $hours: [SetOperatingHoursInput!]!) {
    setOperatingHours(restaurantId: $restaurantId, hours: $hours) {
      id dayOfWeek openTime closeTime isClosed
    }
  }
`;

export const GET_CLOSURES_QUERY = gql`
  query GetClosures($restaurantId: String!) {
    closures(restaurantId: $restaurantId) {
      id closureDate reason
    }
  }
`;

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
