import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { messageService } from "../services/messages";

const CACHE_KEY = "ecoplate_unread_count";

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

    // Poll every 30 seconds
    const interval = setInterval(() => {
      if (isLoggedIn()) {
        refreshUnreadCount();
      }
    }, 30000);

    return () => {
      window.removeEventListener("auth:login", handleLogin);
      clearInterval(interval);
    };
  }, [refreshUnreadCount]);

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
