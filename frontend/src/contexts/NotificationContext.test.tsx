import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { NotificationProvider, useNotifications } from "./NotificationContext";
import { notificationService } from "../services/notifications";

// Mock the notification service
vi.mock("../services/notifications", () => ({
  notificationService: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    triggerCheck: vi.fn(),
  },
}));

// Mock the capacitor service - delegate to localStorage directly for web testing
vi.mock("../services/capacitor", () => {
  return {
    isNative: false,
    storageGet: (key: string): Promise<string | null> => {
      return Promise.resolve(window.localStorage.getItem(key));
    },
    storageSet: (key: string, value: string): Promise<void> => {
      window.localStorage.setItem(key, value);
      return Promise.resolve();
    },
    storageRemove: (key: string): Promise<void> => {
      window.localStorage.removeItem(key);
      return Promise.resolve();
    },
    storageGetSync: (key: string): string | null => {
      return window.localStorage.getItem(key);
    },
  };
});

// Test component to access context
function TestConsumer() {
  const {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  return (
    <div>
      <span data-testid="unread-count">{unreadCount}</span>
      <span data-testid="loading">{loading ? "true" : "false"}</span>
      <span data-testid="notification-count">{notifications.length}</span>
      <ul data-testid="notifications">
        {notifications.map((n) => (
          <li key={n.id} data-testid={`notification-${n.id}`}>
            {n.title} - {n.isRead ? "read" : "unread"}
          </li>
        ))}
      </ul>
      <button data-testid="refresh-notifications" onClick={refreshNotifications}>
        Refresh Notifications
      </button>
      <button data-testid="refresh-unread" onClick={refreshUnreadCount}>
        Refresh Unread
      </button>
      <button data-testid="mark-read-1" onClick={() => markAsRead(1)}>
        Mark Read 1
      </button>
      <button data-testid="mark-all-read" onClick={markAllAsRead}>
        Mark All Read
      </button>
      <button data-testid="delete-1" onClick={() => deleteNotification(1)}>
        Delete 1
      </button>
      <button data-testid="delete-2" onClick={() => deleteNotification(2)}>
        Delete 2
      </button>
    </div>
  );
}

const mockNotifications = [
  {
    id: 1,
    userId: 1,
    type: "expiring_soon" as const,
    title: "Product Expiring",
    message: "Your milk expires soon",
    relatedId: null,
    isRead: false,
    createdAt: new Date().toISOString(),
    readAt: null,
  },
  {
    id: 2,
    userId: 1,
    type: "badge_unlocked" as const,
    title: "Badge Earned",
    message: "You earned a badge",
    relatedId: null,
    isRead: true,
    createdAt: new Date().toISOString(),
    readAt: new Date().toISOString(),
  },
];

describe("NotificationContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default mock implementations
    vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ count: 0 });
    vi.mocked(notificationService.getNotifications).mockResolvedValue({ notifications: [] });
    vi.mocked(notificationService.markAsRead).mockResolvedValue({ success: true });
    vi.mocked(notificationService.markAllAsRead).mockResolvedValue({ success: true });
    vi.mocked(notificationService.deleteNotification).mockResolvedValue({ success: true });
    vi.mocked(notificationService.triggerCheck).mockResolvedValue({
      message: "ok",
      created: { expiringProducts: 0, staleProducts: 0 },
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("useNotifications hook", () => {
    it("should throw error when used outside NotificationProvider", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useNotifications must be used within NotificationProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("NotificationProvider - Initial State", () => {
    it("should render with initial state", async () => {
      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("notification-count")).toHaveTextContent("0");
    });

    it("should read cached count from localStorage", async () => {
      localStorage.setItem("ecoplate_notification_count", "5");

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      expect(screen.getByTestId("unread-count")).toHaveTextContent("5");
    });

    it("should handle invalid cached count in localStorage", async () => {
      localStorage.setItem("ecoplate_notification_count", "invalid");

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      // Should default to 0 when parsing fails
      expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
    });
  });

  describe("NotificationProvider - refreshUnreadCount", () => {
    it("should fetch unread count when logged in", async () => {
      localStorage.setItem("token", "test-token");
      vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ count: 3 });

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-unread").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("unread-count")).toHaveTextContent("3");
      });

      expect(notificationService.getUnreadCount).toHaveBeenCalled();
    });

    it("should reset count to 0 when not logged in", async () => {
      localStorage.removeItem("token");
      localStorage.setItem("ecoplate_notification_count", "5");

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-unread").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
      });

      expect(notificationService.getUnreadCount).not.toHaveBeenCalled();
    });

    it("should handle API error gracefully", async () => {
      localStorage.setItem("token", "test-token");
      localStorage.setItem("ecoplate_notification_count", "2");
      vi.mocked(notificationService.getUnreadCount).mockRejectedValue(new Error("API Error"));

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-unread").click();
      });

      // Should keep cached value on error
      await waitFor(() => {
        expect(screen.getByTestId("unread-count")).toHaveTextContent("2");
      });
    });
  });

  describe("NotificationProvider - refreshNotifications", () => {
    it("should fetch notifications when logged in", async () => {
      localStorage.setItem("token", "test-token");
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
      });
      // Mock getUnreadCount to match expected unread count (1 unread in mockNotifications)
      vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ count: 1 });

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("1"); // 1 unread
      });
    });

    it("should set loading state during fetch", async () => {
      localStorage.setItem("token", "test-token");

      let resolvePromise: (value: any) => void;
      vi.mocked(notificationService.getNotifications).mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      expect(screen.getByTestId("loading")).toHaveTextContent("true");

      await act(async () => {
        resolvePromise!({ notifications: [] });
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
      });
    });

    it("should clear notifications when not logged in", async () => {
      localStorage.removeItem("token");

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      expect(screen.getByTestId("notification-count")).toHaveTextContent("0");
      expect(notificationService.getNotifications).not.toHaveBeenCalled();
    });

    it("should handle API error gracefully", async () => {
      localStorage.setItem("token", "test-token");
      vi.mocked(notificationService.getNotifications).mockRejectedValue(new Error("API Error"));

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
      });
    });
  });

  describe("NotificationProvider - markAsRead (optimistic update)", () => {
    it("should optimistically update notification to read", async () => {
      localStorage.setItem("token", "test-token");
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
      });
      // Mock getUnreadCount to match expected unread count
      vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ count: 1 });

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      // First load notifications
      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("notification-1")).toHaveTextContent("unread");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
      });

      // Mark as read
      await act(async () => {
        screen.getByTestId("mark-read-1").click();
      });

      // Should update immediately (optimistic)
      await waitFor(() => {
        expect(screen.getByTestId("notification-1")).toHaveTextContent("read");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
      });

      // API should be called
      expect(notificationService.markAsRead).toHaveBeenCalledWith(1);
    });

    it("should handle API failure gracefully (keep optimistic update)", async () => {
      localStorage.setItem("token", "test-token");
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
      });
      vi.mocked(notificationService.markAsRead).mockRejectedValue(new Error("API Error"));

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("notification-1")).toHaveTextContent("unread");
      });

      await act(async () => {
        screen.getByTestId("mark-read-1").click();
      });

      // Should still show as read (optimistic update kept)
      await waitFor(() => {
        expect(screen.getByTestId("notification-1")).toHaveTextContent("read");
      });
    });
  });

  describe("NotificationProvider - markAllAsRead (optimistic update)", () => {
    it("should optimistically mark all notifications as read", async () => {
      localStorage.setItem("token", "test-token");
      const allUnread = [
        { ...mockNotifications[0], id: 1, isRead: false },
        { ...mockNotifications[1], id: 2, isRead: false },
      ];
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        notifications: allUnread,
      });
      // Mock getUnreadCount to match expected unread count
      vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ count: 2 });

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("unread-count")).toHaveTextContent("2");
      });

      await act(async () => {
        screen.getByTestId("mark-all-read").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("notification-1")).toHaveTextContent("read");
        expect(screen.getByTestId("notification-2")).toHaveTextContent("read");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
      });

      expect(notificationService.markAllAsRead).toHaveBeenCalled();
    });
  });

  describe("NotificationProvider - deleteNotification (optimistic update)", () => {
    it("should optimistically delete unread notification and update count", async () => {
      localStorage.setItem("token", "test-token");
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
      });
      // Mock getUnreadCount to match expected unread count
      vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ count: 1 });

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
      });

      // Delete unread notification (id: 1)
      await act(async () => {
        screen.getByTestId("delete-1").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("notification-count")).toHaveTextContent("1");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
        expect(screen.queryByTestId("notification-1")).not.toBeInTheDocument();
      });

      expect(notificationService.deleteNotification).toHaveBeenCalledWith(1);
    });

    it("should delete read notification without changing unread count", async () => {
      localStorage.setItem("token", "test-token");
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
      });
      // Mock getUnreadCount to match expected unread count
      vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ count: 1 });

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
      });

      // Delete read notification (id: 2)
      await act(async () => {
        screen.getByTestId("delete-2").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("notification-count")).toHaveTextContent("1");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("1"); // Still 1
        expect(screen.queryByTestId("notification-2")).not.toBeInTheDocument();
      });
    });

    it("should handle deleting non-existent notification", async () => {
      localStorage.setItem("token", "test-token");
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        notifications: [],
      });

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-notifications").click();
      });

      // Should not throw when deleting non-existent notification
      await act(async () => {
        screen.getByTestId("delete-1").click();
      });

      expect(screen.getByTestId("notification-count")).toHaveTextContent("0");
    });
  });

  describe("NotificationProvider - useEffect (auto-refresh)", () => {
    it("should trigger check on mount when logged in", async () => {
      localStorage.setItem("token", "test-token");

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(notificationService.triggerCheck).toHaveBeenCalled();
        expect(notificationService.getUnreadCount).toHaveBeenCalled();
      });
    });

    it("should not trigger check when not logged in", async () => {
      localStorage.removeItem("token");

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      // Wait a bit to ensure nothing is called
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(notificationService.triggerCheck).not.toHaveBeenCalled();
    });

    it("should respond to auth:login event", async () => {
      localStorage.removeItem("token");

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      // Simulate login
      localStorage.setItem("token", "test-token");

      await act(async () => {
        window.dispatchEvent(new Event("auth:login"));
      });

      await waitFor(() => {
        expect(notificationService.getUnreadCount).toHaveBeenCalled();
        expect(notificationService.triggerCheck).toHaveBeenCalled();
      });
    });
  });

  describe("NotificationProvider - localStorage edge cases", () => {
    it("should handle localStorage.getItem throwing error", async () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error("localStorage error");
      });

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      // Should default to 0 on error
      expect(screen.getByTestId("unread-count")).toHaveTextContent("0");

      localStorage.getItem = originalGetItem;
    });

    it("should handle localStorage.setItem throwing error", async () => {
      localStorage.setItem("token", "test-token");
      vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ count: 5 });

      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn((key) => {
        if (key === "ecoplate_notification_count") {
          throw new Error("localStorage error");
        }
        originalSetItem.call(localStorage, key, "test-token");
      });

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await act(async () => {
        screen.getByTestId("refresh-unread").click();
      });

      // Should still update state even if localStorage fails
      await waitFor(() => {
        expect(screen.getByTestId("unread-count")).toHaveTextContent("5");
      });

      localStorage.setItem = originalSetItem;
    });
  });
});
