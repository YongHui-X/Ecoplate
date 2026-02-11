import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationService } from "./notifications";
import { api } from "./api";

// Mock the api module
vi.mock("./api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNotifications", () => {
    it("should fetch notifications with default limit", async () => {
      const mockNotifications = [
        { id: 1, title: "Test", type: "badge_unlocked", isRead: false },
      ];
      vi.mocked(api.get).mockResolvedValue({ notifications: mockNotifications });

      const result = await notificationService.getNotifications();

      expect(api.get).toHaveBeenCalledWith("/notifications?limit=50");
      expect(result).toEqual({ notifications: mockNotifications });
    });

    it("should fetch notifications with custom limit", async () => {
      vi.mocked(api.get).mockResolvedValue({ notifications: [] });

      await notificationService.getNotifications(100);

      expect(api.get).toHaveBeenCalledWith("/notifications?limit=100");
    });

    it("should fetch only unread notifications when flag is set", async () => {
      vi.mocked(api.get).mockResolvedValue({ notifications: [] });

      await notificationService.getNotifications(50, true);

      expect(api.get).toHaveBeenCalledWith("/notifications?limit=50&unreadOnly=true");
    });

    it("should handle API errors", async () => {
      const error = new Error("Network error");
      vi.mocked(api.get).mockRejectedValue(error);

      await expect(notificationService.getNotifications()).rejects.toThrow("Network error");
    });
  });

  describe("getUnreadCount", () => {
    it("should fetch unread count", async () => {
      vi.mocked(api.get).mockResolvedValue({ count: 5 });

      const result = await notificationService.getUnreadCount();

      expect(api.get).toHaveBeenCalledWith("/notifications/unread-count");
      expect(result).toEqual({ count: 5 });
    });

    it("should return zero count", async () => {
      vi.mocked(api.get).mockResolvedValue({ count: 0 });

      const result = await notificationService.getUnreadCount();

      expect(result).toEqual({ count: 0 });
    });
  });

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      vi.mocked(api.post).mockResolvedValue({ success: true });

      const result = await notificationService.markAsRead(123);

      expect(api.post).toHaveBeenCalledWith("/notifications/123/read");
      expect(result).toEqual({ success: true });
    });

    it("should handle marking non-existent notification", async () => {
      vi.mocked(api.post).mockRejectedValue(new Error("Not found"));

      await expect(notificationService.markAsRead(999)).rejects.toThrow("Not found");
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all notifications as read", async () => {
      vi.mocked(api.post).mockResolvedValue({ success: true });

      const result = await notificationService.markAllAsRead();

      expect(api.post).toHaveBeenCalledWith("/notifications/read-all");
      expect(result).toEqual({ success: true });
    });
  });

  describe("deleteNotification", () => {
    it("should delete notification", async () => {
      vi.mocked(api.delete).mockResolvedValue({ success: true });

      const result = await notificationService.deleteNotification(123);

      expect(api.delete).toHaveBeenCalledWith("/notifications/123");
      expect(result).toEqual({ success: true });
    });

    it("should handle deleting non-existent notification", async () => {
      vi.mocked(api.delete).mockRejectedValue(new Error("Not found"));

      await expect(notificationService.deleteNotification(999)).rejects.toThrow("Not found");
    });
  });

  describe("getPreferences", () => {
    it("should fetch notification preferences", async () => {
      const mockPreferences = {
        expiringProducts: true,
        badgeUnlocked: true,
        streakMilestone: true,
        productStale: false,
        staleDaysThreshold: 7,
        expiryDaysThreshold: 3,
      };
      vi.mocked(api.get).mockResolvedValue({ preferences: mockPreferences });

      const result = await notificationService.getPreferences();

      expect(api.get).toHaveBeenCalledWith("/notifications/preferences");
      expect(result).toEqual({ preferences: mockPreferences });
    });
  });

  describe("updatePreferences", () => {
    it("should update notification preferences", async () => {
      const updateData = {
        expiringProducts: false,
        staleDaysThreshold: 14,
      };
      const mockResponse = {
        preferences: {
          expiringProducts: false,
          badgeUnlocked: true,
          streakMilestone: true,
          productStale: true,
          staleDaysThreshold: 14,
          expiryDaysThreshold: 3,
        },
      };
      vi.mocked(api.put).mockResolvedValue(mockResponse);

      const result = await notificationService.updatePreferences(updateData);

      expect(api.put).toHaveBeenCalledWith("/notifications/preferences", updateData);
      expect(result).toEqual(mockResponse);
    });

    it("should handle partial preference updates", async () => {
      const updateData = { expiryDaysThreshold: 5 };
      vi.mocked(api.put).mockResolvedValue({ preferences: { expiryDaysThreshold: 5 } });

      await notificationService.updatePreferences(updateData);

      expect(api.put).toHaveBeenCalledWith("/notifications/preferences", updateData);
    });
  });

  describe("triggerCheck", () => {
    it("should trigger notification check", async () => {
      const mockResponse = {
        message: "Notifications checked",
        created: { expiringProducts: 2, staleProducts: 1 },
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await notificationService.triggerCheck();

      expect(api.post).toHaveBeenCalledWith("/notifications/check");
      expect(result).toEqual(mockResponse);
    });

    it("should return zero created notifications", async () => {
      const mockResponse = {
        message: "No new notifications",
        created: { expiringProducts: 0, staleProducts: 0 },
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await notificationService.triggerCheck();

      expect(result.created.expiringProducts).toBe(0);
      expect(result.created.staleProducts).toBe(0);
    });
  });
});
