import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { notificationService, Notification } from "../services/notifications";
import { storageGet, storageSet, storageGetSync } from "../services/capacitor";

const CACHE_KEY = "ecoplate_notification_count";
const TOKEN_KEY = "token";

interface NotificationContextType {
  unreadCount: number;
  notifications: Notification[];
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Synchronous initial value (for useState)
function getCachedCountSync(): number {
  const cached = storageGetSync(CACHE_KEY);
  if (cached) {
    return parseInt(cached, 10) || 0;
  }
  return 0;
}

// Async cache set for cross-platform support (Android/Web)
async function setCachedCount(count: number): Promise<void> {
  await storageSet(CACHE_KEY, String(count));
}

// Check if user is logged in (async for cross-platform support)
async function isLoggedIn(): Promise<boolean> {
  const token = await storageGet(TOKEN_KEY);
  return !!token;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(getCachedCountSync);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const unreadCountRef = useRef(unreadCount);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const refreshUnreadCount = useCallback(async () => {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      setUnreadCount(0);
      return;
    }
    try {
      const { count } = await notificationService.getUnreadCount();
      setUnreadCount(count);
      await setCachedCount(count);
    } catch {
      // Silently fail - keep showing cached value
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const { notifications: data } = await notificationService.getNotifications(50);
      setNotifications(data);
      // Also update unread count
      const unread = data.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
      await setCachedCount(unread);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      const newCount = Math.max(0, unreadCountRef.current - 1);
      setUnreadCount(newCount);
      await setCachedCount(newCount);
    } catch {
      // Silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      await setCachedCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  const deleteNotification = useCallback(async (id: number) => {
    try {
      const notification = notifications.find((n) => n.id === id);
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notification && !notification.isRead) {
        const newCount = Math.max(0, unreadCountRef.current - 1);
        setUnreadCount(newCount);
        await setCachedCount(newCount);
      }
    } catch {
      // Silently fail
    }
  }, [notifications]);

  useEffect(() => {
    // Fetch immediately on mount if logged in
    const initNotifications = async () => {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        refreshUnreadCount();
        // Also trigger a notification check on login
        notificationService.triggerCheck().catch((err) => console.error("Notification check failed:", err));
      }
    };
    initNotifications();

    // Listen for login event to refresh immediately
    const handleLogin = () => {
      refreshUnreadCount();
      notificationService.triggerCheck().catch((err) => console.error("Notification check failed:", err));
    };
    window.addEventListener("auth:login", handleLogin);

    // Poll every 30 seconds
    const interval = setInterval(async () => {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        refreshUnreadCount();
      }
    }, 30000);

    return () => {
      window.removeEventListener("auth:login", handleLogin);
      clearInterval(interval);
    };
  }, [refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        loading,
        refreshNotifications,
        refreshUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
