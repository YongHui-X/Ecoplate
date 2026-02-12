import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import {
  wsService,
  WS_EVENTS,
  type WSEventType,
  type WSEventPayload,
  type WSEventCallback,
} from "../services/websocket";

interface WebSocketContextType {
  isConnected: boolean;
  connectionState: "connecting" | "connected" | "disconnected";
  subscribe: <T extends WSEventPayload>(
    eventType: WSEventType,
    callback: WSEventCallback<T>
  ) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");

  // Connect when token is available
  useEffect(() => {
    const token = getToken();
    if (token) {
      wsService.connect(token);
    }

    // Listen for connection established event to update state
    const unsubscribeConnected = wsService.subscribe(
      WS_EVENTS.CONNECTION_ESTABLISHED,
      () => {
        setIsConnected(true);
        setConnectionState("connected");
      }
    );

    // Check connection state periodically
    const checkInterval = setInterval(() => {
      const state = wsService.getState();
      setConnectionState(state);
      setIsConnected(state === "connected");
    }, 1000);

    // Handle login event - connect when user logs in
    const handleLogin = () => {
      const token = getToken();
      if (token) {
        wsService.connect(token);
      }
    };

    // Handle logout event - disconnect when user logs out
    const handleLogout = () => {
      wsService.disconnect();
      setIsConnected(false);
      setConnectionState("disconnected");
    };

    window.addEventListener("auth:login", handleLogin);
    window.addEventListener("auth:logout", handleLogout);

    return () => {
      unsubscribeConnected();
      clearInterval(checkInterval);
      window.removeEventListener("auth:login", handleLogin);
      window.removeEventListener("auth:logout", handleLogout);
      wsService.disconnect();
    };
  }, []);

  const subscribe = useCallback(
    <T extends WSEventPayload>(
      eventType: WSEventType,
      callback: WSEventCallback<T>
    ) => {
      return wsService.subscribe(eventType, callback);
    },
    []
  );

  return (
    <WebSocketContext.Provider
      value={{ isConnected, connectionState, subscribe }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}

// Re-export event types and constants for convenience
export { WS_EVENTS };
export type {
  WSEventType,
  WSEventPayload,
  WSEventCallback,
  NewMessagePayload,
  UnreadCountUpdatePayload,
  ConnectionEstablishedPayload,
} from "../services/websocket";
