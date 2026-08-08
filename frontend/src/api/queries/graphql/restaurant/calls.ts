import { gql } from '@apollo/client';

// ============================================================================
// AI VOICE CALL LOGS (Vapi telemetry)
// ============================================================================

export const GET_CALL_LOGS_QUERY = gql`
  query GetCallLogs($restaurantId: String!) {
    callLogs(restaurantId: $restaurantId) {
      id restaurantId vapiCallId customerPhone customerName bookingId transcript outcome createdAt
    }
  }
`;

export const GET_CALL_LOG_QUERY = gql`
  query GetCallLog($vapiCallId: String!) {
    callLog(vapiCallId: $vapiCallId) {
      id restaurantId vapiCallId customerPhone customerName bookingId transcript outcome createdAt
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
