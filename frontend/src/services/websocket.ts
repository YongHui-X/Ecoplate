import { Capacitor } from "@capacitor/core";

/**
 * WebSocket service for real-time messaging
 * - Connects with JWT token via query param
 * - Auto-reconnect with exponential backoff
 * - Ping/pong keep-alive every 30 seconds
 * - Event subscription system
 */

// Check if running on native platform
const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

// Event types matching backend
export const WS_EVENTS = {
  CONNECTION_ESTABLISHED: "connection_established",
  NEW_MESSAGE: "new_message",
  UNREAD_COUNT_UPDATE: "unread_count_update",
  PONG: "pong",
} as const;

export type WSEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

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

export type PongPayload = Record<string, never>;

export type WSEventPayload =
  | ConnectionEstablishedPayload
  | NewMessagePayload
  | UnreadCountUpdatePayload
  | PongPayload;

export interface WSEvent<T extends WSEventPayload = WSEventPayload> {
  type: WSEventType;
  payload: T;
}

// Subscription callback type
export type WSEventCallback<T extends WSEventPayload = WSEventPayload> = (
  payload: T
) => void;

interface Subscription {
  eventType: WSEventType;
  callback: WSEventCallback;
}

// Reconnection settings
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30000; // 30 seconds

class WebSocketService {
  private ws: WebSocket | null = null;
  private subscriptions: Subscription[] = [];
  private reconnectAttempts = 0;
  private reconnectDelay = INITIAL_RECONNECT_DELAY;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;
  private intentionalClose = false;
  private token: string | null = null;

  /**
   * Connect to WebSocket server with JWT token
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[WS] Already connected");
      return;
    }

    if (this.isConnecting) {
      console.log("[WS] Connection already in progress");
      return;
    }

    this.token = token;
    this.intentionalClose = false;
    this.isConnecting = true;

    // Build WebSocket URL
    let wsUrl: string;
    if (isNative) {
      // For Capacitor apps, use the deployment server
      // Use ws:// (not wss://) to avoid self-signed certificate issues
      const serverHost = import.meta.env.VITE_WS_URL || "ws://18.143.173.20";
      wsUrl = `${serverHost}/ws?token=${encodeURIComponent(token)}`;
    } else {
      // For web, use the same host as the page
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;
    }

    console.log("[WS] Connecting...");

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (err) {
      console.error("[WS] Failed to create WebSocket:", err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log("[WS] Disconnecting...");
    this.intentionalClose = true;
    this.clearTimers();
    this.token = null;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe<T extends WSEventPayload>(
    eventType: WSEventType,
    callback: WSEventCallback<T>
  ): () => void {
    const subscription: Subscription = {
      eventType,
      callback: callback as WSEventCallback,
    };
    this.subscriptions.push(subscription);

    // Return unsubscribe function
    return () => {
      const index = this.subscriptions.indexOf(subscription);
      if (index !== -1) {
        this.subscriptions.splice(index, 1);
      }
    };
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection state
   */
  getState(): "connecting" | "connected" | "disconnected" {
    if (this.isConnecting) return "connecting";
    if (this.ws?.readyState === WebSocket.OPEN) return "connected";
    return "disconnected";
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = INITIAL_RECONNECT_DELAY;
      this.startPingInterval();
    };

    this.ws.onclose = (event) => {
      console.log(`[WS] Closed: code=${event.code}, reason=${event.reason}`);
      this.isConnecting = false;
      this.clearTimers();

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error("[WS] Error:", error);
      this.isConnecting = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data);
        this.handleEvent(data);
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    };
  }

  private handleEvent(event: WSEvent): void {
    // Notify all subscribers for this event type
    for (const subscription of this.subscriptions) {
      if (subscription.eventType === event.type) {
        try {
          subscription.callback(event.payload);
        } catch (err) {
          console.error("[WS] Error in subscription callback:", err);
        }
      }
    }
  }

  private startPingInterval(): void {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL);
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private clearTimers(): void {
    this.clearPingInterval();
    this.clearReconnectTimeout();
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose || !this.token) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log("[WS] Max reconnect attempts reached, giving up");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[WS] Scheduling reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${this.reconnectDelay}ms`
    );

    this.reconnectTimeout = setTimeout(() => {
      if (this.token && !this.intentionalClose) {
        this.connect(this.token);
      }
    }, this.reconnectDelay);

    // Exponential backoff: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (max)
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      MAX_RECONNECT_DELAY
    );
  }
}

// Singleton instance
export const wsService = new WebSocketService();
