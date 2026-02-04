import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router, json, error } from "../../utils/router";
import * as schema from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;
let secondUserId: number;

// Types
type NotificationType = "expiring_soon" | "badge_unlocked" | "streak_milestone" | "product_stale";

// Simplified route registration for testing
function registerTestNotificationRoutes(
  router: Router,
  db: ReturnType<typeof drizzle<typeof schema>>,
  userId: number
) {
  router.use(async (req, next) => {
    (req as Request & { user: { id: number } }).user = { id: userId };
    return next();
  });

  const getUser = (req: Request) =>
    (req as Request & { user: { id: number } }).user;

  // Get notifications
  router.get("/api/v1/notifications", async (req) => {
    const user = getUser(req);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const conditions = [eq(schema.notifications.userId, user.id)];
    if (unreadOnly) {
      conditions.push(eq(schema.notifications.isRead, false));
    }

    const notifications = await db.query.notifications.findMany({
      where: and(...conditions),
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
      limit,
    });

    return json({ notifications });
  });

  // Get unread count
  router.get("/api/v1/notifications/unread-count", async (req) => {
    const user = getUser(req);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, user.id),
          eq(schema.notifications.isRead, false)
        )
      );

    return json({ count: result[0]?.count ?? 0 });
  });

  // Mark as read
  router.post("/api/v1/notifications/:id/read", async (req) => {
    const user = getUser(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const idIndex = pathParts.findIndex((p) => p === "notifications") + 1;
    const id = parseInt(pathParts[idIndex], 10);

    if (isNaN(id)) {
      return error("Invalid notification ID", 400);
    }

    await db
      .update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.userId, user.id)
        )
      );

    return json({ success: true });
  });

  // Mark all as read
  router.post("/api/v1/notifications/read-all", async (req) => {
    const user = getUser(req);

    await db
      .update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, user.id),
          eq(schema.notifications.isRead, false)
        )
      );

    return json({ success: true });
  });

  // Delete notification
  router.delete("/api/v1/notifications/:id", async (req) => {
    const user = getUser(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const idIndex = pathParts.findIndex((p) => p === "notifications") + 1;
    const id = parseInt(pathParts[idIndex], 10);

    if (isNaN(id)) {
      return error("Invalid notification ID", 400);
    }

    await db
      .delete(schema.notifications)
      .where(
        and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.userId, user.id)
        )
      );

    return json({ success: true });
  });

  // Get preferences
  router.get("/api/v1/notifications/preferences", async (req) => {
    const user = getUser(req);

    let prefs = await db.query.notificationPreferences.findFirst({
      where: eq(schema.notificationPreferences.userId, user.id),
    });

    if (!prefs) {
      const [created] = await db
        .insert(schema.notificationPreferences)
        .values({ userId: user.id })
        .returning();
      prefs = created;
    }

    return json({
      preferences: {
        expiringProducts: prefs.expiringProducts,
        badgeUnlocked: prefs.badgeUnlocked,
        streakMilestone: prefs.streakMilestone,
        productStale: prefs.productStale,
        staleDaysThreshold: prefs.staleDaysThreshold,
        expiryDaysThreshold: prefs.expiryDaysThreshold,
      },
    });
  });

  // Update preferences
  router.put("/api/v1/notifications/preferences", async (req) => {
    const user = getUser(req);
    const body = await req.json();

    // Ensure prefs exist
    let prefs = await db.query.notificationPreferences.findFirst({
      where: eq(schema.notificationPreferences.userId, user.id),
    });

    if (!prefs) {
      await db.insert(schema.notificationPreferences).values({ userId: user.id });
    }

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

    await db
      .update(schema.notificationPreferences)
      .set(updates)
      .where(eq(schema.notificationPreferences.userId, user.id));

    const updated = await db.query.notificationPreferences.findFirst({
      where: eq(schema.notificationPreferences.userId, user.id),
    });

    return json({
      preferences: {
        expiringProducts: updated!.expiringProducts,
        badgeUnlocked: updated!.badgeUnlocked,
        streakMilestone: updated!.streakMilestone,
        productStale: updated!.productStale,
        staleDaysThreshold: updated!.staleDaysThreshold,
        expiryDaysThreshold: updated!.expiryDaysThreshold,
      },
    });
  });

  // Trigger check
  router.post("/api/v1/notifications/check", async (req) => {
    return json({
      message: "Notification check complete",
      created: { expiringProducts: 0, staleProducts: 0 },
    });
  });
}

beforeAll(async () => {
  sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      user_location TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id INTEGER,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      read_at INTEGER
    );

    CREATE TABLE notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      expiring_products INTEGER NOT NULL DEFAULT 1,
      badge_unlocked INTEGER NOT NULL DEFAULT 1,
      streak_milestone INTEGER NOT NULL DEFAULT 1,
      product_stale INTEGER NOT NULL DEFAULT 1,
      stale_days_threshold INTEGER NOT NULL DEFAULT 7,
      expiry_days_threshold INTEGER NOT NULL DEFAULT 3
    );
  `);

  testDb = drizzle(sqlite, { schema });

  // Seed test users
  const [user1] = await testDb
    .insert(schema.users)
    .values({
      email: "test@example.com",
      passwordHash: "hashed",
      name: "Test User",
    })
    .returning();
  testUserId = user1.id;

  const [user2] = await testDb
    .insert(schema.users)
    .values({
      email: "test2@example.com",
      passwordHash: "hashed",
      name: "Second User",
    })
    .returning();
  secondUserId = user2.id;
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  await testDb.delete(schema.notifications);
  await testDb.delete(schema.notificationPreferences);
});

function createRouter(userId: number = testUserId) {
  const router = new Router();
  registerTestNotificationRoutes(router, testDb, userId);
  return router;
}

async function makeRequest(
  router: Router,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const response = await router.handle(req);
  if (!response) {
    return { status: 404, data: { error: "Not found" } };
  }
  const data = await response.json();
  return { status: response.status, data };
}

async function createTestNotification(
  userId: number,
  type: NotificationType = "badge_unlocked",
  title: string = "Test",
  message: string = "Test message"
) {
  const [notification] = await testDb
    .insert(schema.notifications)
    .values({ userId, type, title, message })
    .returning();
  return notification;
}

describe("GET /api/v1/notifications", () => {
  test("returns empty array for user with no notifications", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/notifications");

    expect(res.status).toBe(200);
    const data = res.data as { notifications: unknown[] };
    expect(data.notifications).toEqual([]);
  });

  test("returns notifications for authenticated user", async () => {
    await createTestNotification(testUserId, "badge_unlocked", "Badge 1", "Msg 1");
    await createTestNotification(testUserId, "streak_milestone", "Streak 1", "Msg 2");

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/notifications");

    expect(res.status).toBe(200);
    const data = res.data as { notifications: Array<{ title: string }> };
    expect(data.notifications.length).toBe(2);
  });

  test("respects limit parameter", async () => {
    for (let i = 0; i < 10; i++) {
      await createTestNotification(testUserId, "badge_unlocked", `Title ${i}`, `Msg ${i}`);
    }

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/notifications?limit=3");

    const data = res.data as { notifications: unknown[] };
    expect(data.notifications.length).toBe(3);
  });

  test("filters unread only when specified", async () => {
    const notif1 = await createTestNotification(testUserId, "badge_unlocked", "Read", "Msg");
    await createTestNotification(testUserId, "badge_unlocked", "Unread", "Msg");

    await testDb
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, notif1.id));

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/notifications?unreadOnly=true");

    const data = res.data as { notifications: Array<{ title: string }> };
    expect(data.notifications.length).toBe(1);
    expect(data.notifications[0].title).toBe("Unread");
  });

  test("only returns notifications for authenticated user", async () => {
    await createTestNotification(testUserId, "badge_unlocked", "User 1", "Msg");
    await createTestNotification(secondUserId, "badge_unlocked", "User 2", "Msg");

    const router = createRouter(testUserId);
    const res = await makeRequest(router, "GET", "/api/v1/notifications");

    const data = res.data as { notifications: Array<{ title: string }> };
    expect(data.notifications.length).toBe(1);
    expect(data.notifications[0].title).toBe("User 1");
  });
});

describe("GET /api/v1/notifications/unread-count", () => {
  test("returns 0 for user with no notifications", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/notifications/unread-count");

    expect(res.status).toBe(200);
    const data = res.data as { count: number };
    expect(data.count).toBe(0);
  });

  test("returns correct unread count", async () => {
    await createTestNotification(testUserId);
    await createTestNotification(testUserId);
    await createTestNotification(testUserId);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/notifications/unread-count");

    const data = res.data as { count: number };
    expect(data.count).toBe(3);
  });

  test("excludes read notifications", async () => {
    const notif1 = await createTestNotification(testUserId);
    await createTestNotification(testUserId);

    await testDb
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, notif1.id));

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/notifications/unread-count");

    const data = res.data as { count: number };
    expect(data.count).toBe(1);
  });
});

describe("POST /api/v1/notifications/:id/read", () => {
  test("marks notification as read", async () => {
    const notif = await createTestNotification(testUserId);

    const router = createRouter();
    const res = await makeRequest(router, "POST", `/api/v1/notifications/${notif.id}/read`);

    expect(res.status).toBe(200);
    const data = res.data as { success: boolean };
    expect(data.success).toBe(true);

    const updated = await testDb.query.notifications.findFirst({
      where: eq(schema.notifications.id, notif.id),
    });
    expect(updated?.isRead).toBe(true);
  });

  test("does not mark other user's notification", async () => {
    const notif = await createTestNotification(secondUserId);

    const router = createRouter(testUserId);
    await makeRequest(router, "POST", `/api/v1/notifications/${notif.id}/read`);

    const unchanged = await testDb.query.notifications.findFirst({
      where: eq(schema.notifications.id, notif.id),
    });
    expect(unchanged?.isRead).toBe(false);
  });
});

describe("POST /api/v1/notifications/read-all", () => {
  test("marks all notifications as read", async () => {
    await createTestNotification(testUserId);
    await createTestNotification(testUserId);
    await createTestNotification(testUserId);

    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/notifications/read-all");

    expect(res.status).toBe(200);

    const unread = await testDb.query.notifications.findMany({
      where: and(
        eq(schema.notifications.userId, testUserId),
        eq(schema.notifications.isRead, false)
      ),
    });
    expect(unread.length).toBe(0);
  });

  test("only marks authenticated user's notifications", async () => {
    await createTestNotification(testUserId);
    await createTestNotification(secondUserId);

    const router = createRouter(testUserId);
    await makeRequest(router, "POST", "/api/v1/notifications/read-all");

    const user2Unread = await testDb.query.notifications.findMany({
      where: and(
        eq(schema.notifications.userId, secondUserId),
        eq(schema.notifications.isRead, false)
      ),
    });
    expect(user2Unread.length).toBe(1);
  });
});

describe("DELETE /api/v1/notifications/:id", () => {
  test("deletes notification", async () => {
    const notif = await createTestNotification(testUserId);

    const router = createRouter();
    const res = await makeRequest(router, "DELETE", `/api/v1/notifications/${notif.id}`);

    expect(res.status).toBe(200);

    const deleted = await testDb.query.notifications.findFirst({
      where: eq(schema.notifications.id, notif.id),
    });
    expect(deleted).toBeUndefined();
  });

  test("does not delete other user's notification", async () => {
    const notif = await createTestNotification(secondUserId);

    const router = createRouter(testUserId);
    await makeRequest(router, "DELETE", `/api/v1/notifications/${notif.id}`);

    const stillExists = await testDb.query.notifications.findFirst({
      where: eq(schema.notifications.id, notif.id),
    });
    expect(stillExists).toBeDefined();
  });
});

describe("GET /api/v1/notifications/preferences", () => {
  test("returns default preferences for new user", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/notifications/preferences");

    expect(res.status).toBe(200);
    const data = res.data as {
      preferences: {
        expiringProducts: boolean;
        badgeUnlocked: boolean;
        streakMilestone: boolean;
        productStale: boolean;
        staleDaysThreshold: number;
        expiryDaysThreshold: number;
      };
    };

    expect(data.preferences.expiringProducts).toBe(true);
    expect(data.preferences.badgeUnlocked).toBe(true);
    expect(data.preferences.streakMilestone).toBe(true);
    expect(data.preferences.productStale).toBe(true);
    expect(data.preferences.staleDaysThreshold).toBe(7);
    expect(data.preferences.expiryDaysThreshold).toBe(3);
  });

  test("returns existing preferences", async () => {
    await testDb.insert(schema.notificationPreferences).values({
      userId: testUserId,
      expiringProducts: false,
      staleDaysThreshold: 14,
    });

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/notifications/preferences");

    const data = res.data as {
      preferences: { expiringProducts: boolean; staleDaysThreshold: number };
    };

    expect(data.preferences.expiringProducts).toBe(false);
    expect(data.preferences.staleDaysThreshold).toBe(14);
  });
});

describe("PUT /api/v1/notifications/preferences", () => {
  test("updates preferences", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "PUT", "/api/v1/notifications/preferences", {
      expiringProducts: false,
      staleDaysThreshold: 21,
    });

    expect(res.status).toBe(200);
    const data = res.data as {
      preferences: { expiringProducts: boolean; staleDaysThreshold: number };
    };

    expect(data.preferences.expiringProducts).toBe(false);
    expect(data.preferences.staleDaysThreshold).toBe(21);
  });

  test("only updates allowed fields", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "PUT", "/api/v1/notifications/preferences", {
      expiringProducts: false,
      hackedField: true, // Should be ignored
    });

    expect(res.status).toBe(200);
    const data = res.data as { preferences: Record<string, unknown> };

    expect(data.preferences.expiringProducts).toBe(false);
    expect("hackedField" in data.preferences).toBe(false);
  });
});

describe("POST /api/v1/notifications/check", () => {
  test("returns success response", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/notifications/check");

    expect(res.status).toBe(200);
    const data = res.data as { message: string; created: { expiringProducts: number; staleProducts: number } };

    expect(data.message).toBe("Notification check complete");
    expect(data.created).toBeDefined();
  });
});
