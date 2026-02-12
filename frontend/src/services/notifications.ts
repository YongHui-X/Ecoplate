import { api } from "./api";

export interface Notification {
  id: number;
  userId: number;
  type: "expiring_soon" | "badge_unlocked" | "streak_milestone" | "product_stale" | "locker_payment_received" | "locker_item_delivered" | "locker_pickup_complete" | "locker_order_cancelled";
  title: string;
  message: string;
  relatedId: number | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPreferences {
  expiringProducts: boolean;
  badgeUnlocked: boolean;
  streakMilestone: boolean;
  productStale: boolean;
  staleDaysThreshold: number;
  expiryDaysThreshold: number;
}

export const notificationService = {
  async getNotifications(limit = 50, unreadOnly = false): Promise<{ notifications: Notification[] }> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (unreadOnly) {
      params.set("unreadOnly", "true");
    }
    return api.get<{ notifications: Notification[] }>(`/notifications?${params.toString()}`);
  },

  async getUnreadCount(): Promise<{ count: number }> {
    return api.get<{ count: number }>("/notifications/unread-count");
  },

  async markAsRead(id: number): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>("/notifications/read-all");
  },

  async deleteNotification(id: number): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/notifications/${id}`);
  },

  async getPreferences(): Promise<{ preferences: NotificationPreferences }> {
    return api.get<{ preferences: NotificationPreferences }>("/notifications/preferences");
  },

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<{ preferences: NotificationPreferences }> {
    return api.put<{ preferences: NotificationPreferences }>("/notifications/preferences", prefs);
  },

  async triggerCheck(): Promise<{ message: string; created: { expiringProducts: number; staleProducts: number } }> {
    return api.post<{ message: string; created: { expiringProducts: number; staleProducts: number } }>("/notifications/check");
  },
};
