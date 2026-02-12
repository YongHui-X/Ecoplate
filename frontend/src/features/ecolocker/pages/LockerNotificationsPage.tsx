import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  BellOff,
  ChevronRight,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { notificationApi } from "../services/locker-api";
import { useLockerUnread } from "../contexts/LockerUnreadContext";
import type { LockerNotification } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function LockerNotificationsPage() {
  const { refreshLockerUnreadCount } = useLockerUnread();
  const [notifications, setNotifications] = useState<LockerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      setLoading(true);
      const data = await notificationApi.getAll();
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      refreshLockerUnreadCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark as read");
    }
  }

  async function handleMarkAsRead(id: number) {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      refreshLockerUnreadCount();
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Notifications</h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No notifications yet</p>
          <p className="text-sm text-muted-foreground">
            You'll receive updates about your orders here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onRead={() => handleMarkAsRead(notification.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  notification,
  onRead,
}: {
  notification: LockerNotification;
  onRead: () => void;
}) {
  return (
    <Link
      to={`/ecolocker/orders/${notification.orderId}`}
      onClick={onRead}
    >
      <Card
        className={cn(
          "hover:border-primary/50 transition-colors",
          !notification.isRead && "border-primary/30 bg-primary/5"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "p-2 rounded-full",
                notification.isRead ? "bg-muted" : "bg-primary/10"
              )}
            >
              <Bell
                className={cn(
                  "h-4 w-4",
                  notification.isRead ? "text-muted-foreground" : "text-primary"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{notification.title}</h3>
                {!notification.isRead && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {notification.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDateTime(notification.createdAt)}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
