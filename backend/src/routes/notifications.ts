import { Router, json, error } from "../utils/router";
import { getUser } from "../middleware/auth";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getOrCreatePreferences,
  updatePreferences,
  runAllChecks,
} from "../services/notification-service";

export function registerNotificationRoutes(router: Router) {
  // ================================
  // GET /api/v1/notifications
  // Get user notifications (paginated)
  // ================================
  router.get("/api/v1/notifications", async (req) => {
    const user = getUser(req);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const notifications = await getUserNotifications(user.id, limit, unreadOnly);

    return json({ notifications });
  });

  // ================================
  // GET /api/v1/notifications/unread-count
  // Get unread notification count
  // ================================
  router.get("/api/v1/notifications/unread-count", async (req) => {
    const user = getUser(req);
    const count = await getUnreadCount(user.id);

    return json({ count });
  });

  // ================================
  // POST /api/v1/notifications/:id/read
  // Mark single notification as read
  // ================================
  router.post("/api/v1/notifications/:id/read", async (req) => {
    const user = getUser(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const idIndex = pathParts.findIndex((p) => p === "notifications") + 1;
    const id = parseInt(pathParts[idIndex], 10);

    if (isNaN(id)) {
      return error("Invalid notification ID", 400);
    }

    await markAsRead(id, user.id);

    return json({ success: true });
  });

  // ================================
  // POST /api/v1/notifications/read-all
  // Mark all notifications as read
  // ================================
  router.post("/api/v1/notifications/read-all", async (req) => {
    const user = getUser(req);
    await markAllAsRead(user.id);

    return json({ success: true });
  });

  // ================================
  // DELETE /api/v1/notifications/:id
  // Delete a notification
  // ================================
  router.delete("/api/v1/notifications/:id", async (req) => {
    const user = getUser(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const idIndex = pathParts.findIndex((p) => p === "notifications") + 1;
    const id = parseInt(pathParts[idIndex], 10);

    if (isNaN(id)) {
      return error("Invalid notification ID", 400);
    }

    await deleteNotification(id, user.id);

    return json({ success: true });
  });

  // ================================
  // GET /api/v1/notifications/preferences
  // Get user notification preferences
  // ================================
  router.get("/api/v1/notifications/preferences", async (req) => {
    const user = getUser(req);
    const preferences = await getOrCreatePreferences(user.id);

    return json({ preferences });
  });

  // ================================
  // PUT /api/v1/notifications/preferences
  // Update notification preferences
  // ================================
  router.put("/api/v1/notifications/preferences", async (req) => {
    const user = getUser(req);
    const body = await req.json();

    const allowedFields = [
      "expiringProducts",
      "badgeUnlocked",
      "streakMilestone",
      "productStale",
      "staleDaysThreshold",
      "expiryDaysThreshold",
    ];

    const updates: Record<string, boolean | number> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    const preferences = await updatePreferences(user.id, updates);

    return json({ preferences });
  });

  // ================================
  // POST /api/v1/notifications/check
  // Manually trigger notification check
  // ================================
  router.post("/api/v1/notifications/check", async (req) => {
    const user = getUser(req);
    const results = await runAllChecks(user.id);

    return json({
      message: "Notification check complete",
      created: results,
    });
  });
}
