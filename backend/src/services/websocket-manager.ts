import type { ServerWebSocket } from "bun";
import {
  WS_EVENTS,
  type WSEvent,
  type WSEventPayload,
  type NewMessagePayload,
  type UnreadCountUpdatePayload,
  type ConnectionEstablishedPayload,
} from "../types/websocket";

// WebSocket data attached during upgrade
export interface WSData {
  userId: number;
  connectedAt: Date;
}

/**
 * WebSocketManager - Tracks active WebSocket connections by user ID
 * Supports multiple connections per user (multiple tabs/devices)
 */
class WebSocketManager {
  // Map of userId -> Set of WebSocket connections
  private connections: Map<number, Set<ServerWebSocket<WSData>>> = new Map();

  /**
   * Register a new WebSocket connection for a user
   */
  addConnection(ws: ServerWebSocket<WSData>): void {
    const userId = ws.data.userId;
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(ws);
    console.log(
      `[WS] User ${userId} connected. Total connections for user: ${this.connections.get(userId)!.size}`
    );
  }

  /**
   * Remove a WebSocket connection when closed
   */
  removeConnection(ws: ServerWebSocket<WSData>): void {
    const userId = ws.data.userId;
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
      console.log(
        `[WS] User ${userId} disconnected. Remaining connections: ${userConnections.size}`
      );
    }
  }

  /**
   * Send an event to all connections of a specific user
   */
  sendToUser<T extends WSEventPayload>(userId: number, event: WSEvent<T>): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      console.log(`[WS] User ${userId} not connected, skipping event`);
      return;
    }

    const message = JSON.stringify(event);
    let sentCount = 0;

    for (const ws of userConnections) {
      try {
        ws.send(message);
        sentCount++;
      } catch (err) {
        console.error(`[WS] Failed to send to user ${userId}:`, err);
        // Remove failed connection
        userConnections.delete(ws);
      }
    }

    console.log(
      `[WS] Sent ${event.type} to user ${userId} (${sentCount} connections)`
    );
  }

  /**
   * Send a new message notification to a user
   */
  sendNewMessage(userId: number, payload: NewMessagePayload): void {
    this.sendToUser(userId, {
      type: WS_EVENTS.NEW_MESSAGE,
      payload,
    });
  }

  /**
   * Send updated unread count to a user
   */
  sendUnreadCountUpdate(userId: number, count: number): void {
    const payload: UnreadCountUpdatePayload = { count };
    this.sendToUser(userId, {
      type: WS_EVENTS.UNREAD_COUNT_UPDATE,
      payload,
    });
  }

  /**
   * Send connection established event to a user
   */
  sendConnectionEstablished(ws: ServerWebSocket<WSData>): void {
    const payload: ConnectionEstablishedPayload = { userId: ws.data.userId };
    const message = JSON.stringify({
      type: WS_EVENTS.CONNECTION_ESTABLISHED,
      payload,
    });
    ws.send(message);
  }

  /**
   * Send pong response
   */
  sendPong(ws: ServerWebSocket<WSData>): void {
    const message = JSON.stringify({
      type: WS_EVENTS.PONG,
      payload: {},
    });
    ws.send(message);
  }

  /**
   * Check if a user is currently connected
   */
  isUserConnected(userId: number): boolean {
    const userConnections = this.connections.get(userId);
    return userConnections !== undefined && userConnections.size > 0;
  }

  /**
   * Get the number of connections for a user
   */
  getConnectionCount(userId: number): number {
    return this.connections.get(userId)?.size ?? 0;
  }

  /**
   * Get total number of active connections
   */
  getTotalConnections(): number {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.size;
    }
    return total;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
