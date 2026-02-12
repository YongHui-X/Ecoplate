/**
 * WebSocket event types and payload interfaces for real-time messaging
 */

// Event type constants
export const WS_EVENTS = {
  CONNECTION_ESTABLISHED: "connection_established",
  NEW_MESSAGE: "new_message",
  UNREAD_COUNT_UPDATE: "unread_count_update",
  PONG: "pong",
} as const;

export type WSEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// Client to server message types
export const WS_CLIENT_MESSAGES = {
  PING: "ping",
} as const;

export type WSClientMessageType =
  (typeof WS_CLIENT_MESSAGES)[keyof typeof WS_CLIENT_MESSAGES];

// Event payload interfaces
export interface ConnectionEstablishedPayload {
  userId: number;
}

export interface NewMessagePayload {
  conversationId: number;
  message: {
    id: number;
    conversationId: number;
    userId: number;
    messageText: string;
    isRead: boolean;
    createdAt: string;
    user: {
      id: number;
      name: string;
      avatarUrl: string | null;
    };
  };
  senderId: number;
  senderName: string;
  listingTitle: string;
}

export interface UnreadCountUpdatePayload {
  count: number;
}

// Empty payload for pong
export type PongPayload = Record<string, never>;

// Union type for all payloads
export type WSEventPayload =
  | ConnectionEstablishedPayload
  | NewMessagePayload
  | UnreadCountUpdatePayload
  | PongPayload;

// WebSocket event message structure
export interface WSEvent<T extends WSEventPayload = WSEventPayload> {
  type: WSEventType;
  payload: T;
}

// Helper type guards
export function isConnectionEstablished(
  event: WSEvent
): event is WSEvent<ConnectionEstablishedPayload> {
  return event.type === WS_EVENTS.CONNECTION_ESTABLISHED;
}

export function isNewMessage(
  event: WSEvent
): event is WSEvent<NewMessagePayload> {
  return event.type === WS_EVENTS.NEW_MESSAGE;
}

export function isUnreadCountUpdate(
  event: WSEvent
): event is WSEvent<UnreadCountUpdatePayload> {
  return event.type === WS_EVENTS.UNREAD_COUNT_UPDATE;
}

// Client message structure
export interface WSClientMessage {
  type: WSClientMessageType;
}
