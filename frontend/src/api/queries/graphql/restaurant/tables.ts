import { gql } from '@apollo/client';

// ============================================================================
// TABLES (floor management)
// ============================================================================

export const GET_TABLES_QUERY = gql`
  query GetTables($restaurantId: String!) {
    tables(restaurantId: $restaurantId) {
      id restaurantId tableNumber capacityMin capacityMax section isActive
    }
  }
`;

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
