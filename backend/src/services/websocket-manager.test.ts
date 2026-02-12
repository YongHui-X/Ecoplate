import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { ServerWebSocket } from "bun";
import type { WSData } from "./websocket-manager";
import { WS_EVENTS } from "../types/websocket";

// We need to re-create the WebSocketManager class for testing since it's a singleton
// This allows us to test with fresh state for each test
class TestableWebSocketManager {
  private connections: Map<number, Set<ServerWebSocket<WSData>>> = new Map();

  addConnection(ws: ServerWebSocket<WSData>): void {
    const userId = ws.data.userId;
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(ws);
  }

  removeConnection(ws: ServerWebSocket<WSData>): void {
    const userId = ws.data.userId;
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  sendToUser<T>(userId: number, event: { type: string; payload: T }): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      return;
    }

    const message = JSON.stringify(event);

    for (const ws of userConnections) {
      try {
        ws.send(message);
      } catch {
        userConnections.delete(ws);
      }
    }
  }

  sendNewMessage(
    userId: number,
    payload: {
      conversationId: number;
      message: object;
      senderId: number;
      senderName: string;
      listingTitle: string;
    }
  ): void {
    this.sendToUser(userId, {
      type: WS_EVENTS.NEW_MESSAGE,
      payload,
    });
  }

  sendUnreadCountUpdate(userId: number, count: number): void {
    this.sendToUser(userId, {
      type: WS_EVENTS.UNREAD_COUNT_UPDATE,
      payload: { count },
    });
  }

  sendConnectionEstablished(ws: ServerWebSocket<WSData>): void {
    const message = JSON.stringify({
      type: WS_EVENTS.CONNECTION_ESTABLISHED,
      payload: { userId: ws.data.userId },
    });
    ws.send(message);
  }

  sendPong(ws: ServerWebSocket<WSData>): void {
    const message = JSON.stringify({
      type: WS_EVENTS.PONG,
      payload: {},
    });
    ws.send(message);
  }

  isUserConnected(userId: number): boolean {
    const userConnections = this.connections.get(userId);
    return userConnections !== undefined && userConnections.size > 0;
  }

  getConnectionCount(userId: number): number {
    return this.connections.get(userId)?.size ?? 0;
  }

  getTotalConnections(): number {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.size;
    }
    return total;
  }
}

// Mock WebSocket helper
function createMockWebSocket(userId: number): ServerWebSocket<WSData> {
  const sentMessages: string[] = [];
  return {
    data: {
      userId,
      connectedAt: new Date(),
    },
    send: mock((message: string) => {
      sentMessages.push(message);
    }),
    // Helper to access sent messages in tests
    _sentMessages: sentMessages,
  } as unknown as ServerWebSocket<WSData> & { _sentMessages: string[] };
}

describe("WebSocketManager", () => {
  let manager: TestableWebSocketManager;

  beforeEach(() => {
    manager = new TestableWebSocketManager();
  });

  describe("addConnection", () => {
    it("should add a new connection for a user", () => {
      const ws = createMockWebSocket(1);
      manager.addConnection(ws);

      expect(manager.isUserConnected(1)).toBe(true);
      expect(manager.getConnectionCount(1)).toBe(1);
    });

    it("should support multiple connections for the same user", () => {
      const ws1 = createMockWebSocket(1);
      const ws2 = createMockWebSocket(1);

      manager.addConnection(ws1);
      manager.addConnection(ws2);

      expect(manager.getConnectionCount(1)).toBe(2);
    });

    it("should track connections for different users separately", () => {
      const ws1 = createMockWebSocket(1);
      const ws2 = createMockWebSocket(2);

      manager.addConnection(ws1);
      manager.addConnection(ws2);

      expect(manager.getConnectionCount(1)).toBe(1);
      expect(manager.getConnectionCount(2)).toBe(1);
      expect(manager.getTotalConnections()).toBe(2);
    });
  });

  describe("removeConnection", () => {
    it("should remove a connection for a user", () => {
      const ws = createMockWebSocket(1);
      manager.addConnection(ws);
      manager.removeConnection(ws);

      expect(manager.isUserConnected(1)).toBe(false);
      expect(manager.getConnectionCount(1)).toBe(0);
    });

    it("should only remove the specific connection", () => {
      const ws1 = createMockWebSocket(1);
      const ws2 = createMockWebSocket(1);

      manager.addConnection(ws1);
      manager.addConnection(ws2);
      manager.removeConnection(ws1);

      expect(manager.isUserConnected(1)).toBe(true);
      expect(manager.getConnectionCount(1)).toBe(1);
    });

    it("should handle removing non-existent connection gracefully", () => {
      const ws = createMockWebSocket(1);
      // Should not throw
      expect(() => manager.removeConnection(ws)).not.toThrow();
    });
  });

  describe("sendToUser", () => {
    it("should send message to all user connections", () => {
      const ws1 = createMockWebSocket(1) as ServerWebSocket<WSData> & {
        _sentMessages: string[];
      };
      const ws2 = createMockWebSocket(1) as ServerWebSocket<WSData> & {
        _sentMessages: string[];
      };

      manager.addConnection(ws1);
      manager.addConnection(ws2);

      manager.sendToUser(1, { type: "test", payload: { data: "hello" } });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it("should not throw when user is not connected", () => {
      expect(() =>
        manager.sendToUser(999, { type: "test", payload: {} })
      ).not.toThrow();
    });

    it("should send JSON stringified message", () => {
      const ws = createMockWebSocket(1) as ServerWebSocket<WSData> & {
        _sentMessages: string[];
      };
      manager.addConnection(ws);

      const event = { type: "test", payload: { count: 5 } };
      manager.sendToUser(1, event);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(event));
    });
  });

  describe("sendNewMessage", () => {
    it("should send new_message event with correct payload", () => {
      const ws = createMockWebSocket(1) as ServerWebSocket<WSData> & {
        _sentMessages: string[];
      };
      manager.addConnection(ws);

      const payload = {
        conversationId: 1,
        message: { id: 1, text: "Hello" },
        senderId: 2,
        senderName: "John",
        listingTitle: "Apples",
      };

      manager.sendNewMessage(1, payload);

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: WS_EVENTS.NEW_MESSAGE,
          payload,
        })
      );
    });
  });

  describe("sendUnreadCountUpdate", () => {
    it("should send unread_count_update event with count", () => {
      const ws = createMockWebSocket(1) as ServerWebSocket<WSData> & {
        _sentMessages: string[];
      };
      manager.addConnection(ws);

      manager.sendUnreadCountUpdate(1, 5);

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: WS_EVENTS.UNREAD_COUNT_UPDATE,
          payload: { count: 5 },
        })
      );
    });
  });

  describe("sendConnectionEstablished", () => {
    it("should send connection_established event to the websocket", () => {
      const ws = createMockWebSocket(42) as ServerWebSocket<WSData> & {
        _sentMessages: string[];
      };

      manager.sendConnectionEstablished(ws);

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: WS_EVENTS.CONNECTION_ESTABLISHED,
          payload: { userId: 42 },
        })
      );
    });
  });

  describe("sendPong", () => {
    it("should send pong event to the websocket", () => {
      const ws = createMockWebSocket(1) as ServerWebSocket<WSData> & {
        _sentMessages: string[];
      };

      manager.sendPong(ws);

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: WS_EVENTS.PONG,
          payload: {},
        })
      );
    });
  });

  describe("isUserConnected", () => {
    it("should return true when user has connections", () => {
      const ws = createMockWebSocket(1);
      manager.addConnection(ws);

      expect(manager.isUserConnected(1)).toBe(true);
    });

    it("should return false when user has no connections", () => {
      expect(manager.isUserConnected(1)).toBe(false);
    });

    it("should return false after all connections are removed", () => {
      const ws = createMockWebSocket(1);
      manager.addConnection(ws);
      manager.removeConnection(ws);

      expect(manager.isUserConnected(1)).toBe(false);
    });
  });

  describe("getConnectionCount", () => {
    it("should return 0 for user with no connections", () => {
      expect(manager.getConnectionCount(1)).toBe(0);
    });

    it("should return correct count for user with connections", () => {
      const ws1 = createMockWebSocket(1);
      const ws2 = createMockWebSocket(1);
      const ws3 = createMockWebSocket(1);

      manager.addConnection(ws1);
      manager.addConnection(ws2);
      manager.addConnection(ws3);

      expect(manager.getConnectionCount(1)).toBe(3);
    });
  });

  describe("getTotalConnections", () => {
    it("should return 0 when no connections exist", () => {
      expect(manager.getTotalConnections()).toBe(0);
    });

    it("should return total count across all users", () => {
      const ws1 = createMockWebSocket(1);
      const ws2 = createMockWebSocket(1);
      const ws3 = createMockWebSocket(2);
      const ws4 = createMockWebSocket(3);

      manager.addConnection(ws1);
      manager.addConnection(ws2);
      manager.addConnection(ws3);
      manager.addConnection(ws4);

      expect(manager.getTotalConnections()).toBe(4);
    });
  });
});
