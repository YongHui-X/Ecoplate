import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { notificationApi } from "../services/locker-api";

const CACHE_KEY = "ecoplate_locker_unread_count";

interface LockerUnreadContextType {
  lockerUnreadCount: number;
  refreshLockerUnreadCount: () => Promise<void>;
}

const LockerUnreadContext = createContext<LockerUnreadContextType | undefined>(undefined);

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

function setCachedCount(count: number): void {
  try {
    localStorage.setItem(CACHE_KEY, String(count));
  } catch {
    // localStorage not available
  }
}

function isLoggedIn(): boolean {
  return !!localStorage.getItem("token");
}

export function LockerUnreadProvider({ children }: { children: ReactNode }) {
  const [lockerUnreadCount, setLockerUnreadCount] = useState(getCachedCount);

  const refreshLockerUnreadCount = useCallback(async () => {
    if (!isLoggedIn()) {
      setLockerUnreadCount(0);
      return;
    }
    try {
      const { count } = await notificationApi.getUnreadCount();
      setLockerUnreadCount(count);
      setCachedCount(count);
    } catch {
      // Silently fail - keep showing cached value
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn()) {
      refreshLockerUnreadCount();
    }

    const handleLogin = () => {
      refreshLockerUnreadCount();
    };
    window.addEventListener("auth:login", handleLogin);

    const interval = setInterval(() => {
      if (isLoggedIn()) {
        refreshLockerUnreadCount();
      }
    }, 30000);

    return () => {
      window.removeEventListener("auth:login", handleLogin);
      clearInterval(interval);
    };
  }, [refreshLockerUnreadCount]);

  return (
    <LockerUnreadContext.Provider value={{ lockerUnreadCount, refreshLockerUnreadCount }}>
      {children}
    </LockerUnreadContext.Provider>
  );
}

export function useLockerUnread() {
  const context = useContext(LockerUnreadContext);
  if (!context) {
    throw new Error("useLockerUnread must be used within LockerUnreadProvider");
  }
  return context;
}
