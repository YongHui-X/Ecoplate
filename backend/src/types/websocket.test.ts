import { describe, it, expect } from "bun:test";
import {
  WS_EVENTS,
  WS_CLIENT_MESSAGES,
  isConnectionEstablished,
  isNewMessage,
  isUnreadCountUpdate,
  type WSEvent,
  type ConnectionEstablishedPayload,
  type NewMessagePayload,
  type UnreadCountUpdatePayload,
  type PongPayload,
} from "./websocket";

describe("WebSocket Types", () => {
  describe("WS_EVENTS constants", () => {
    it("should have correct event type values", () => {
      expect(WS_EVENTS.CONNECTION_ESTABLISHED).toBe("connection_established");
      expect(WS_EVENTS.NEW_MESSAGE).toBe("new_message");
      expect(WS_EVENTS.UNREAD_COUNT_UPDATE).toBe("unread_count_update");
      expect(WS_EVENTS.PONG).toBe("pong");
    });
  });

  describe("WS_CLIENT_MESSAGES constants", () => {
    it("should have correct client message type values", () => {
      expect(WS_CLIENT_MESSAGES.PING).toBe("ping");
    });
  });

  describe("isConnectionEstablished type guard", () => {
    it("should return true for connection_established events", () => {
      const event: WSEvent<ConnectionEstablishedPayload> = {
        type: WS_EVENTS.CONNECTION_ESTABLISHED,
        payload: { userId: 123 },
      };
      expect(isConnectionEstablished(event)).toBe(true);
    });

    it("should return false for other event types", () => {
      const event: WSEvent<UnreadCountUpdatePayload> = {
        type: WS_EVENTS.UNREAD_COUNT_UPDATE,
        payload: { count: 5 },
      };
      expect(isConnectionEstablished(event)).toBe(false);
    });
  });

  describe("isNewMessage type guard", () => {
    it("should return true for new_message events", () => {
      const event: WSEvent<NewMessagePayload> = {
        type: WS_EVENTS.NEW_MESSAGE,
        payload: {
          conversationId: 1,
          message: {
            id: 1,
            conversationId: 1,
            userId: 2,
            messageText: "Hello",
            isRead: false,
            createdAt: "2024-01-15T10:00:00Z",
            user: { id: 2, name: "John", avatarUrl: null },
          },
          senderId: 2,
          senderName: "John",
          listingTitle: "Fresh Apples",
        },
      };
      expect(isNewMessage(event)).toBe(true);
    });

    it("should return false for other event types", () => {
      const event: WSEvent<ConnectionEstablishedPayload> = {
        type: WS_EVENTS.CONNECTION_ESTABLISHED,
        payload: { userId: 123 },
      };
      expect(isNewMessage(event)).toBe(false);
    });
  });

  describe("isUnreadCountUpdate type guard", () => {
    it("should return true for unread_count_update events", () => {
      const event: WSEvent<UnreadCountUpdatePayload> = {
        type: WS_EVENTS.UNREAD_COUNT_UPDATE,
        payload: { count: 5 },
      };
      expect(isUnreadCountUpdate(event)).toBe(true);
    });

    it("should return false for other event types", () => {
      const event: WSEvent<PongPayload> = {
        type: WS_EVENTS.PONG,
        payload: {},
      };
      expect(isUnreadCountUpdate(event)).toBe(false);
    });
  });

  describe("Event payload structure", () => {
    it("should allow valid ConnectionEstablishedPayload", () => {
      const payload: ConnectionEstablishedPayload = { userId: 42 };
      expect(payload.userId).toBe(42);
    });

    it("should allow valid NewMessagePayload", () => {
      const payload: NewMessagePayload = {
        conversationId: 1,
        message: {
          id: 10,
          conversationId: 1,
          userId: 2,
          messageText: "Test message",
          isRead: false,
          createdAt: new Date().toISOString(),
          user: {
            id: 2,
            name: "Test User",
            avatarUrl: "https://example.com/avatar.png",
          },
        },
        senderId: 2,
        senderName: "Test User",
        listingTitle: "Test Listing",
      };

      expect(payload.conversationId).toBe(1);
      expect(payload.message.id).toBe(10);
      expect(payload.senderId).toBe(2);
      expect(payload.senderName).toBe("Test User");
      expect(payload.listingTitle).toBe("Test Listing");
    });

    it("should allow valid UnreadCountUpdatePayload", () => {
      const payload: UnreadCountUpdatePayload = { count: 10 };
      expect(payload.count).toBe(10);
    });

    it("should allow empty PongPayload", () => {
      const payload: PongPayload = {};
      expect(Object.keys(payload)).toHaveLength(0);
    });
  });

  describe("WSEvent structure", () => {
    it("should create valid event with type and payload", () => {
      const event: WSEvent<ConnectionEstablishedPayload> = {
        type: WS_EVENTS.CONNECTION_ESTABLISHED,
        payload: { userId: 1 },
      };

      expect(event.type).toBe("connection_established");
      expect(event.payload.userId).toBe(1);
    });
  });
});
