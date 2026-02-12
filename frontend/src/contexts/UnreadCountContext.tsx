import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { messageService } from "../services/messages";
import {
  useWebSocket,
  WS_EVENTS,
  type UnreadCountUpdatePayload,
} from "./WebSocketContext";

const CACHE_KEY = "ecoplate_unread_count";
const POLLING_INTERVAL = 60000; // 60 seconds (fallback polling)

interface UnreadCountContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const UnreadCountContext = createContext<UnreadCountContextType | undefined>(undefined);

// Get cached count from localStorage for instant display
function getCachedCount(): number {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return parseInt(cached, 10) || 0;
    }
  } catch {
    // localStorage not available
  }
  return 0;
}

// Save count to localStorage
function setCachedCount(count: number): void {
  try {
    localStorage.setItem(CACHE_KEY, String(count));
  } catch {
    // localStorage not available
  }
}

// Check if user is logged in
function isLoggedIn(): boolean {
  return !!localStorage.getItem("token");
}

export function UnreadCountProvider({ children }: { children: ReactNode }) {
  // Initialize with cached value for instant display
  const [unreadCount, setUnreadCount] = useState(getCachedCount);
  const { subscribe, isConnected } = useWebSocket();

  const refreshUnreadCount = useCallback(async () => {
    // Only fetch if logged in
    if (!isLoggedIn()) {
      setUnreadCount(0);
      return;
    }
    try {
      const { count } = await messageService.getUnreadCount();
      setUnreadCount(count);
      setCachedCount(count);
    } catch {
      // Silently fail - keep showing cached value
    }
  }, []);

  // Subscribe to WebSocket unread count updates
  useEffect(() => {
    const unsubscribe = subscribe<UnreadCountUpdatePayload>(
      WS_EVENTS.UNREAD_COUNT_UPDATE,
      (payload) => {
        setUnreadCount(payload.count);
        setCachedCount(payload.count);
      }
    );

    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    // Fetch immediately on mount if logged in
    if (isLoggedIn()) {
      refreshUnreadCount();
    }

    // Listen for login event to refresh immediately
    const handleLogin = () => {
      refreshUnreadCount();
    };
    window.addEventListener("auth:login", handleLogin);

    // Fallback polling every 60 seconds (increased from 30s since WebSocket handles real-time)
    const interval = setInterval(() => {
      if (isLoggedIn() && !isConnected) {
        // Only poll if WebSocket is not connected
        refreshUnreadCount();
      }
    }, POLLING_INTERVAL);

    return () => {
      window.removeEventListener("auth:login", handleLogin);
      clearInterval(interval);
    };
  }, [refreshUnreadCount, isConnected]);

  return (
    <UnreadCountContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </UnreadCountContext.Provider>
  );
}

export function useUnreadCount() {
  const context = useContext(UnreadCountContext);
  if (!context) {
    throw new Error("useUnreadCount must be used within UnreadCountProvider");
  }
  return context;
}
