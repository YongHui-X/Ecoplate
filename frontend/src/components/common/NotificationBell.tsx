import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Clock, Award, Flame, AlertCircle, CheckCheck, X, Package } from "lucide-react";
import { useNotifications } from "../../contexts/NotificationContext";
import { Notification } from "../../services/notifications";

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "expiring_soon":
      return <Clock className="h-4 w-4 text-warning" />;
    case "badge_unlocked":
      return <Award className="h-4 w-4 text-success" />;
    case "streak_milestone":
      return <Flame className="h-4 w-4 text-primary" />;
    case "product_stale":
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    case "locker_payment_received":
    case "locker_item_delivered":
    case "locker_pickup_complete":
    case "locker_order_cancelled":
      return <Package className="h-4 w-4 text-primary" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    unreadCount,
    notifications,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 640) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);

    // Navigate based on notification type
    switch (notification.type) {
      case "expiring_soon":
        navigate("/marketplace/my-listings");
        break;
      case "badge_unlocked":
        navigate("/badges");
        break;
      case "streak_milestone":
        navigate("/ecopoints");
        break;
      case "product_stale":
        navigate("/myfridge");
        break;
      case "locker_payment_received":
      case "locker_item_delivered":
      case "locker_pickup_complete":
      case "locker_order_cancelled":
        navigate(`/ecolocker/orders/${notification.relatedId}`);
        break;
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    navigate("/notifications");
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl hover:bg-muted transition-colors flex-shrink-0"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold h-4 min-w-[16px] flex items-center justify-center rounded-full px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="sm:hidden fixed inset-0 bg-black/50 z-[9998]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown panel - fixed on mobile, absolute on desktop */}
          <div
            ref={dropdownRef}
            className="bg-card border shadow-lg overflow-hidden z-[9999] rounded-2xl sm:rounded-xl fixed inset-x-2 top-16 bottom-auto max-h-[70vh] sm:inset-auto sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-80 sm:max-h-[400px] notification-dropdown"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0">
              <h3 className="font-semibold text-foreground">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden p-1 rounded-lg hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto flex-1" style={{ maxHeight: "calc(70vh - 100px)" }}>
              {recentNotifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                recentNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-muted transition-colors text-left border-b last:border-b-0 ${!notification.isRead ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${!notification.isRead ? "font-medium text-foreground" : "text-muted-foreground"}`}
                        >
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="flex-shrink-0 h-2 w-2 bg-primary rounded-full mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t bg-card sticky bottom-0">
                <button
                  onClick={handleViewAll}
                  className="w-full text-center text-sm text-primary hover:text-primary/80 font-medium py-2"
                >
                  View All Notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
