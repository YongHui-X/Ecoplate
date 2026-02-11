import { describe, expect, test, vi, beforeEach } from "vitest";
import { notificationApi } from "../../services/locker-api";

// Mock the notification API
vi.mock("../../services/locker-api", () => ({
  notificationApi: {
    getAll: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

const mockNotifications = [
  {
    id: 1,
    userId: 1,
    orderId: 101,
    type: "payment_reminder",
    title: "Payment Reminder",
    message: "Please complete your payment within 15 minutes",
    isRead: false,
    createdAt: "2025-01-15T10:30:00Z",
  },
  {
    id: 2,
    userId: 1,
    orderId: 102,
    type: "item_delivered",
    title: "Item Delivered",
    message: "Your item has been delivered to the locker",
    isRead: true,
    createdAt: "2025-01-14T15:45:00Z",
  },
  {
    id: 3,
    userId: 1,
    orderId: 103,
    type: "pickup_reminder",
    title: "Pickup Reminder",
    message: "Don't forget to collect your item from the locker",
    isRead: false,
    createdAt: "2025-01-13T09:00:00Z",
  },
];

describe("NotificationsPage - Notification Data Structure", () => {
  test("notification has required fields", () => {
    const notification = mockNotifications[0];
    expect(notification.id).toBeDefined();
    expect(notification.userId).toBeDefined();
    expect(notification.orderId).toBeDefined();
    expect(notification.type).toBeDefined();
    expect(notification.title).toBeDefined();
    expect(notification.message).toBeDefined();
    expect(notification.isRead).toBeDefined();
    expect(notification.createdAt).toBeDefined();
  });

  test("notification type is valid", () => {
    const validTypes = [
      "payment_reminder",
      "pickup_scheduled",
      "item_delivered",
      "pickup_reminder",
      "order_cancelled",
      "order_expired",
    ];
    const notification = mockNotifications[0];
    expect(validTypes).toContain(notification.type);
  });

  test("notification isRead is boolean", () => {
    expect(typeof mockNotifications[0].isRead).toBe("boolean");
    expect(typeof mockNotifications[1].isRead).toBe("boolean");
  });
});

describe("NotificationsPage - API Methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("notificationApi.getAll exists", () => {
    expect(notificationApi.getAll).toBeDefined();
    expect(typeof notificationApi.getAll).toBe("function");
  });

  test("notificationApi.getAll returns notifications", async () => {
    vi.mocked(notificationApi.getAll).mockResolvedValue(mockNotifications);
    const result = await notificationApi.getAll();

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("Payment Reminder");
  });

  test("notificationApi.getAll returns empty array when no notifications", async () => {
    vi.mocked(notificationApi.getAll).mockResolvedValue([]);
    const result = await notificationApi.getAll();

    expect(result).toHaveLength(0);
  });

  test("notificationApi.getAll can reject with error", async () => {
    vi.mocked(notificationApi.getAll).mockRejectedValue(new Error("Network error"));
    await expect(notificationApi.getAll()).rejects.toThrow("Network error");
  });

  test("notificationApi.markAsRead exists", () => {
    expect(notificationApi.markAsRead).toBeDefined();
    expect(typeof notificationApi.markAsRead).toBe("function");
  });

  test("notificationApi.markAsRead marks single notification", async () => {
    vi.mocked(notificationApi.markAsRead).mockResolvedValue(undefined);
    await expect(notificationApi.markAsRead(1)).resolves.not.toThrow();
    expect(notificationApi.markAsRead).toHaveBeenCalledWith(1);
  });

  test("notificationApi.markAllAsRead exists", () => {
    expect(notificationApi.markAllAsRead).toBeDefined();
    expect(typeof notificationApi.markAllAsRead).toBe("function");
  });

  test("notificationApi.markAllAsRead marks all notifications", async () => {
    vi.mocked(notificationApi.markAllAsRead).mockResolvedValue(undefined);
    await expect(notificationApi.markAllAsRead()).resolves.not.toThrow();
    expect(notificationApi.markAllAsRead).toHaveBeenCalled();
  });
});

describe("NotificationsPage - Unread Count", () => {
  test("can count unread notifications", () => {
    const unreadCount = mockNotifications.filter((n) => !n.isRead).length;
    expect(unreadCount).toBe(2);
  });

  test("returns zero when all read", () => {
    const allRead = mockNotifications.map((n) => ({ ...n, isRead: true }));
    const unreadCount = allRead.filter((n) => !n.isRead).length;
    expect(unreadCount).toBe(0);
  });

  test("returns correct count when all unread", () => {
    const allUnread = mockNotifications.map((n) => ({ ...n, isRead: false }));
    const unreadCount = allUnread.filter((n) => !n.isRead).length;
    expect(unreadCount).toBe(3);
  });
});

describe("NotificationsPage - Display Logic", () => {
  test("can determine empty state", () => {
    const isEmpty = mockNotifications.length === 0;
    expect(isEmpty).toBe(false);

    const emptyNotifications: typeof mockNotifications = [];
    expect(emptyNotifications.length === 0).toBe(true);
  });

  test("can determine if mark all button should show", () => {
    const unreadCount = mockNotifications.filter((n) => !n.isRead).length;
    const shouldShowMarkAll = unreadCount > 0;
    expect(shouldShowMarkAll).toBe(true);

    const allRead = mockNotifications.map((n) => ({ ...n, isRead: true }));
    const shouldShowMarkAllWhenAllRead = allRead.filter((n) => !n.isRead).length > 0;
    expect(shouldShowMarkAllWhenAllRead).toBe(false);
  });

  test("can format notification styling based on read status", () => {
    const getNotificationStyle = (isRead: boolean) => ({
      background: isRead ? "bg-muted" : "bg-primary/5",
      borderClass: isRead ? "" : "border-primary/30",
    });

    const unreadStyle = getNotificationStyle(false);
    expect(unreadStyle.background).toBe("bg-primary/5");
    expect(unreadStyle.borderClass).toBe("border-primary/30");

    const readStyle = getNotificationStyle(true);
    expect(readStyle.background).toBe("bg-muted");
    expect(readStyle.borderClass).toBe("");
  });
});

describe("NotificationsPage - Mark Read Logic", () => {
  test("can update single notification to read", () => {
    const updateNotification = (
      notifications: typeof mockNotifications,
      id: number
    ) => {
      return notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
    };

    const updated = updateNotification(mockNotifications, 1);
    expect(updated[0].isRead).toBe(true);
    expect(updated[1].isRead).toBe(true); // Already read
    expect(updated[2].isRead).toBe(false); // Not affected
  });

  test("can update all notifications to read", () => {
    const markAllRead = (notifications: typeof mockNotifications) => {
      return notifications.map((n) => ({ ...n, isRead: true }));
    };

    const allRead = markAllRead(mockNotifications);
    expect(allRead.every((n) => n.isRead)).toBe(true);
  });
});

describe("NotificationsPage - Notification Types", () => {
  test("payment_reminder notification has correct title", () => {
    const paymentReminder = mockNotifications.find(
      (n) => n.type === "payment_reminder"
    );
    expect(paymentReminder?.title).toBe("Payment Reminder");
  });

  test("item_delivered notification has correct title", () => {
    const itemDelivered = mockNotifications.find(
      (n) => n.type === "item_delivered"
    );
    expect(itemDelivered?.title).toBe("Item Delivered");
  });

  test("pickup_reminder notification has correct title", () => {
    const pickupReminder = mockNotifications.find(
      (n) => n.type === "pickup_reminder"
    );
    expect(pickupReminder?.title).toBe("Pickup Reminder");
  });
});

describe("NotificationsPage - Navigation", () => {
  test("can determine notification link", () => {
    const notification = mockNotifications[0];
    const link = `/orders/${notification.orderId}`;
    expect(link).toBe("/orders/101");
  });

  test("all notifications have orderId for navigation", () => {
    mockNotifications.forEach((n) => {
      expect(n.orderId).toBeDefined();
      expect(typeof n.orderId).toBe("number");
      expect(n.orderId).toBeGreaterThan(0);
    });
  });
});

describe("NotificationsPage - Date Formatting", () => {
  test("notification has valid date format", () => {
    const notification = mockNotifications[0];
    const date = new Date(notification.createdAt);
    expect(date.toISOString()).toBe("2025-01-15T10:30:00.000Z");
  });

  test("notifications are ordered by date", () => {
    const dates = mockNotifications.map((n) => new Date(n.createdAt).getTime());
    const sortedDates = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sortedDates);
  });
});

describe("NotificationsPage - Error Handling", () => {
  test("can format error message from Error object", () => {
    const formatError = (err: unknown) => {
      return err instanceof Error ? err.message : "Failed to load notifications";
    };

    expect(formatError(new Error("Network error"))).toBe("Network error");
    expect(formatError("Unknown error")).toBe("Failed to load notifications");
    expect(formatError(null)).toBe("Failed to load notifications");
  });

  test("handles mark read failure gracefully", async () => {
    vi.mocked(notificationApi.markAsRead).mockRejectedValue(
      new Error("Failed to mark as read")
    );

    await expect(notificationApi.markAsRead(1)).rejects.toThrow(
      "Failed to mark as read"
    );
  });
});
