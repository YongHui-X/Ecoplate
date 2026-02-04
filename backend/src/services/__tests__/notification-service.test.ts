import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "../../db/schema";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;
let secondUserId: number;

// Types
type NotificationType = "expiring_soon" | "badge_unlocked" | "streak_milestone" | "product_stale";

interface NotificationPreferences {
  expiringProducts: boolean;
  badgeUnlocked: boolean;
  streakMilestone: boolean;
  productStale: boolean;
  staleDaysThreshold: number;
  expiryDaysThreshold: number;
}

// Implementation of functions under test (simplified versions that use testDb)
async function getOrCreatePreferences(db: typeof testDb, userId: number): Promise<NotificationPreferences> {
  let prefs = await db.query.notificationPreferences.findFirst({
    where: eq(schema.notificationPreferences.userId, userId),
  });

  if (!prefs) {
    const [created] = await db
      .insert(schema.notificationPreferences)
      .values({ userId })
      .returning();
    prefs = created;
  }

  return {
    expiringProducts: prefs.expiringProducts,
    badgeUnlocked: prefs.badgeUnlocked,
    streakMilestone: prefs.streakMilestone,
    productStale: prefs.productStale,
    staleDaysThreshold: prefs.staleDaysThreshold,
    expiryDaysThreshold: prefs.expiryDaysThreshold,
  };
}

async function updatePreferences(
  db: typeof testDb,
  userId: number,
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  await getOrCreatePreferences(db, userId);

  await db
    .update(schema.notificationPreferences)
    .set(updates)
    .where(eq(schema.notificationPreferences.userId, userId));

  return getOrCreatePreferences(db, userId);
}

async function createNotification(
  db: typeof testDb,
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: number
) {
  const [notification] = await db
    .insert(schema.notifications)
    .values({
      userId,
      type,
      title,
      message,
      relatedId: relatedId ?? null,
    })
    .returning();

  return notification;
}

async function getUserNotifications(
  db: typeof testDb,
  userId: number,
  limit = 50,
  unreadOnly = false
) {
  const conditions = [eq(schema.notifications.userId, userId)];

  if (unreadOnly) {
    conditions.push(eq(schema.notifications.isRead, false));
  }

  const notifications = await db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
    limit,
  });

  return notifications;
}

async function getUnreadCount(db: typeof testDb, userId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      )
    );

  return result[0]?.count ?? 0;
}

async function markAsRead(db: typeof testDb, notificationId: number, userId: number): Promise<boolean> {
  await db
    .update(schema.notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, userId)
      )
    );

  return true;
}

async function markAllAsRead(db: typeof testDb, userId: number): Promise<void> {
  await db
    .update(schema.notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      )
    );
}

async function deleteNotification(db: typeof testDb, notificationId: number, userId: number): Promise<boolean> {
  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, userId)
      )
    );

  return true;
}

async function notifyBadgeUnlocked(
  db: typeof testDb,
  userId: number,
  badge: { code: string; name: string; pointsAwarded: number }
): Promise<void> {
  const prefs = await getOrCreatePreferences(db, userId);

  if (!prefs.badgeUnlocked) {
    return;
  }

  await createNotification(
    db,
    userId,
    "badge_unlocked",
    "Badge Unlocked!",
    `Congratulations! You've earned the "${badge.name}" badge and ${badge.pointsAwarded} bonus points!`
  );
}

async function notifyStreakMilestone(db: typeof testDb, userId: number, streakDays: number): Promise<void> {
  const prefs = await getOrCreatePreferences(db, userId);

  if (!prefs.streakMilestone) {
    return;
  }

  const milestones = [3, 7, 14, 30, 60, 90, 100, 365];
  if (!milestones.includes(streakDays)) {
    return;
  }

  // Check if we already sent a notification for this milestone
  const existing = await db.query.notifications.findFirst({
    where: and(
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.type, "streak_milestone"),
      eq(schema.notifications.relatedId, streakDays)
    ),
  });

  if (existing) {
    return;
  }

  const messages: Record<number, string> = {
    3: "Great start! You've maintained a 3-day streak!",
    7: "One week strong! Keep up the amazing work!",
    14: "Two weeks of eco-friendly habits! You're on fire!",
    30: "A whole month! You're an EcoPlate champion!",
  };

  await createNotification(
    db,
    userId,
    "streak_milestone",
    `${streakDays}-Day Streak!`,
    messages[streakDays] || `Amazing! You've reached a ${streakDays}-day streak!`,
    streakDays
  );
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

describe("getOrCreatePreferences", () => {
  test("creates preferences with defaults if not exists", async () => {
    const prefs = await getOrCreatePreferences(testDb, testUserId);

    expect(prefs).toBeDefined();
    expect(prefs.expiringProducts).toBe(true);
    expect(prefs.badgeUnlocked).toBe(true);
    expect(prefs.streakMilestone).toBe(true);
    expect(prefs.productStale).toBe(true);
    expect(prefs.staleDaysThreshold).toBe(7);
    expect(prefs.expiryDaysThreshold).toBe(3);
  });

  test("returns existing preferences", async () => {
    await testDb.insert(schema.notificationPreferences).values({
      userId: testUserId,
      expiringProducts: false,
      staleDaysThreshold: 10,
    });

    const prefs = await getOrCreatePreferences(testDb, testUserId);

    expect(prefs.expiringProducts).toBe(false);
    expect(prefs.staleDaysThreshold).toBe(10);
  });

  test("does not create duplicate records", async () => {
    await getOrCreatePreferences(testDb, testUserId);
    await getOrCreatePreferences(testDb, testUserId);

    const allPrefs = await testDb.query.notificationPreferences.findMany({
      where: eq(schema.notificationPreferences.userId, testUserId),
    });

    expect(allPrefs.length).toBe(1);
  });
});

describe("updatePreferences", () => {
  test("updates single preference", async () => {
    const prefs = await updatePreferences(testDb, testUserId, {
      expiringProducts: false,
    });

    expect(prefs.expiringProducts).toBe(false);
    expect(prefs.badgeUnlocked).toBe(true); // unchanged
  });

  test("updates multiple preferences", async () => {
    const prefs = await updatePreferences(testDb, testUserId, {
      expiringProducts: false,
      badgeUnlocked: false,
      staleDaysThreshold: 14,
    });

    expect(prefs.expiringProducts).toBe(false);
    expect(prefs.badgeUnlocked).toBe(false);
    expect(prefs.staleDaysThreshold).toBe(14);
  });

  test("creates preferences if not exists before updating", async () => {
    const prefs = await updatePreferences(testDb, testUserId, {
      staleDaysThreshold: 21,
    });

    expect(prefs.staleDaysThreshold).toBe(21);
  });
});

describe("createNotification", () => {
  test("creates notification with all fields", async () => {
    const notification = await createNotification(
      testDb,
      testUserId,
      "badge_unlocked",
      "Test Title",
      "Test Message",
      123
    );

    expect(notification).toBeDefined();
    expect(notification.userId).toBe(testUserId);
    expect(notification.type).toBe("badge_unlocked");
    expect(notification.title).toBe("Test Title");
    expect(notification.message).toBe("Test Message");
    expect(notification.relatedId).toBe(123);
    expect(notification.isRead).toBe(false);
  });

  test("creates notification without relatedId", async () => {
    const notification = await createNotification(
      testDb,
      testUserId,
      "streak_milestone",
      "Title",
      "Message"
    );

    expect(notification.relatedId).toBeNull();
  });
});

describe("getUserNotifications", () => {
  test("returns empty array for user with no notifications", async () => {
    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications).toEqual([]);
  });

  test("returns notifications for user", async () => {
    await createNotification(testDb, testUserId, "badge_unlocked", "Title 1", "Msg 1");
    await createNotification(testDb, testUserId, "streak_milestone", "Title 2", "Msg 2");

    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications.length).toBe(2);
  });

  test("only returns notifications for specified user", async () => {
    await createNotification(testDb, testUserId, "badge_unlocked", "User 1", "Msg");
    await createNotification(testDb, secondUserId, "badge_unlocked", "User 2", "Msg");

    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications.length).toBe(1);
    expect(notifications[0].title).toBe("User 1");
  });

  test("respects limit parameter", async () => {
    for (let i = 0; i < 10; i++) {
      await createNotification(testDb, testUserId, "badge_unlocked", `Title ${i}`, `Msg ${i}`);
    }

    const notifications = await getUserNotifications(testDb, testUserId, 5);

    expect(notifications.length).toBe(5);
  });

  test("filters unread only when specified", async () => {
    const notif1 = await createNotification(testDb, testUserId, "badge_unlocked", "Read", "Msg");
    await createNotification(testDb, testUserId, "badge_unlocked", "Unread", "Msg");

    await markAsRead(testDb, notif1.id, testUserId);

    const unreadOnly = await getUserNotifications(testDb, testUserId, 50, true);
    const all = await getUserNotifications(testDb, testUserId, 50, false);

    expect(unreadOnly.length).toBe(1);
    expect(unreadOnly[0].title).toBe("Unread");
    expect(all.length).toBe(2);
  });
});

describe("getUnreadCount", () => {
  test("returns 0 for user with no notifications", async () => {
    const count = await getUnreadCount(testDb, testUserId);

    expect(count).toBe(0);
  });

  test("returns correct count of unread notifications", async () => {
    await createNotification(testDb, testUserId, "badge_unlocked", "T1", "M1");
    await createNotification(testDb, testUserId, "badge_unlocked", "T2", "M2");
    await createNotification(testDb, testUserId, "badge_unlocked", "T3", "M3");

    const count = await getUnreadCount(testDb, testUserId);

    expect(count).toBe(3);
  });

  test("excludes read notifications from count", async () => {
    const notif1 = await createNotification(testDb, testUserId, "badge_unlocked", "T1", "M1");
    await createNotification(testDb, testUserId, "badge_unlocked", "T2", "M2");

    await markAsRead(testDb, notif1.id, testUserId);

    const count = await getUnreadCount(testDb, testUserId);

    expect(count).toBe(1);
  });

  test("only counts notifications for specified user", async () => {
    await createNotification(testDb, testUserId, "badge_unlocked", "T1", "M1");
    await createNotification(testDb, secondUserId, "badge_unlocked", "T2", "M2");
    await createNotification(testDb, secondUserId, "badge_unlocked", "T3", "M3");

    const count1 = await getUnreadCount(testDb, testUserId);
    const count2 = await getUnreadCount(testDb, secondUserId);

    expect(count1).toBe(1);
    expect(count2).toBe(2);
  });
});

describe("markAsRead", () => {
  test("marks notification as read", async () => {
    const notif = await createNotification(testDb, testUserId, "badge_unlocked", "T", "M");

    expect(notif.isRead).toBe(false);

    await markAsRead(testDb, notif.id, testUserId);

    const updated = await testDb.query.notifications.findFirst({
      where: eq(schema.notifications.id, notif.id),
    });

    expect(updated?.isRead).toBe(true);
    expect(updated?.readAt).toBeDefined();
  });

  test("does not mark other user's notifications", async () => {
    const notif = await createNotification(testDb, secondUserId, "badge_unlocked", "T", "M");

    await markAsRead(testDb, notif.id, testUserId);

    const unchanged = await testDb.query.notifications.findFirst({
      where: eq(schema.notifications.id, notif.id),
    });

    expect(unchanged?.isRead).toBe(false);
  });
});

describe("markAllAsRead", () => {
  test("marks all unread notifications as read", async () => {
    await createNotification(testDb, testUserId, "badge_unlocked", "T1", "M1");
    await createNotification(testDb, testUserId, "badge_unlocked", "T2", "M2");
    await createNotification(testDb, testUserId, "badge_unlocked", "T3", "M3");

    await markAllAsRead(testDb, testUserId);

    const count = await getUnreadCount(testDb, testUserId);
    expect(count).toBe(0);
  });

  test("only marks notifications for specified user", async () => {
    await createNotification(testDb, testUserId, "badge_unlocked", "T1", "M1");
    await createNotification(testDb, secondUserId, "badge_unlocked", "T2", "M2");

    await markAllAsRead(testDb, testUserId);

    const count1 = await getUnreadCount(testDb, testUserId);
    const count2 = await getUnreadCount(testDb, secondUserId);

    expect(count1).toBe(0);
    expect(count2).toBe(1);
  });
});

describe("deleteNotification", () => {
  test("deletes notification", async () => {
    const notif = await createNotification(testDb, testUserId, "badge_unlocked", "T", "M");

    await deleteNotification(testDb, notif.id, testUserId);

    const deleted = await testDb.query.notifications.findFirst({
      where: eq(schema.notifications.id, notif.id),
    });

    expect(deleted).toBeUndefined();
  });

  test("does not delete other user's notifications", async () => {
    const notif = await createNotification(testDb, secondUserId, "badge_unlocked", "T", "M");

    await deleteNotification(testDb, notif.id, testUserId);

    const unchanged = await testDb.query.notifications.findFirst({
      where: eq(schema.notifications.id, notif.id),
    });

    expect(unchanged).toBeDefined();
  });
});

describe("notifyBadgeUnlocked", () => {
  test("creates notification for badge unlock", async () => {
    await notifyBadgeUnlocked(testDb, testUserId, {
      code: "first_action",
      name: "First Steps",
      pointsAwarded: 25,
    });

    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe("badge_unlocked");
    expect(notifications[0].title).toBe("Badge Unlocked!");
    expect(notifications[0].message).toContain("First Steps");
    expect(notifications[0].message).toContain("25");
  });

  test("respects preference setting when disabled", async () => {
    await updatePreferences(testDb, testUserId, { badgeUnlocked: false });

    await notifyBadgeUnlocked(testDb, testUserId, {
      code: "first_action",
      name: "First Steps",
      pointsAwarded: 25,
    });

    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications.length).toBe(0);
  });
});

describe("notifyStreakMilestone", () => {
  test("creates notification for 3-day streak", async () => {
    await notifyStreakMilestone(testDb, testUserId, 3);

    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe("streak_milestone");
    expect(notifications[0].title).toBe("3-Day Streak!");
    expect(notifications[0].relatedId).toBe(3);
  });

  test("creates notification for 7-day streak", async () => {
    await notifyStreakMilestone(testDb, testUserId, 7);

    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications.length).toBe(1);
    expect(notifications[0].title).toBe("7-Day Streak!");
  });

  test("does not create notification for non-milestone streaks", async () => {
    await notifyStreakMilestone(testDb, testUserId, 5); // Not a milestone
    await notifyStreakMilestone(testDb, testUserId, 10); // Not a milestone

    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications.length).toBe(0);
  });

  test("does not create duplicate notifications for same milestone", async () => {
    await notifyStreakMilestone(testDb, testUserId, 7);
    await notifyStreakMilestone(testDb, testUserId, 7);

    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications.length).toBe(1);
  });

  test("respects preference setting when disabled", async () => {
    await updatePreferences(testDb, testUserId, { streakMilestone: false });

    await notifyStreakMilestone(testDb, testUserId, 7);

    const notifications = await getUserNotifications(testDb, testUserId);

    expect(notifications.length).toBe(0);
  });
});
