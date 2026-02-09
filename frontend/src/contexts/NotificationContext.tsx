import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { notificationService, Notification } from "../services/notifications";

const CACHE_KEY = "ecoplate_notification_count";

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

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(getCachedCount);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!isLoggedIn()) {
      setUnreadCount(0);
      return;
    }
    try {
      const { count } = await notificationService.getUnreadCount();
      setUnreadCount(count);
      setCachedCount(count);
    } catch {
      // Silently fail - keep showing cached value
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!isLoggedIn()) {
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
      setCachedCount(unread);
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
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setCachedCount(Math.max(0, unreadCount - 1));
    } catch {
      // Silently fail
    }
  }, [unreadCount]);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      setCachedCount(0);
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
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setCachedCount(Math.max(0, unreadCount - 1));
      }
    } catch {
      // Silently fail
    }
  }, [notifications, unreadCount]);

  useEffect(() => {
    // Fetch immediately on mount if logged in
    if (isLoggedIn()) {
      refreshUnreadCount();
      // Also trigger a notification check on login
      notificationService.triggerCheck().catch((err) => console.error("Notification check failed:", err));
    }

    // Listen for login event to refresh immediately
    const handleLogin = () => {
      refreshUnreadCount();
      notificationService.triggerCheck().catch((err) => console.error("Notification check failed:", err));
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
