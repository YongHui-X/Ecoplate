import { describe, expect, test, beforeAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";

// ── In-memory DB setup ──────────────────────────────────────────────

const sqlite = new Database(":memory:");
sqlite.exec("PRAGMA journal_mode = WAL;");

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

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    category TEXT,
    quantity REAL NOT NULL,
    unit TEXT,
    unit_price REAL,
    purchase_date INTEGER,
    description TEXT,
    co2_emission REAL
  );

  CREATE TABLE user_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_points INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    total_co2_saved REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE product_sustainability_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    today_date TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    type TEXT
  );

  CREATE TABLE badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    badge_image_url TEXT
  );

  CREATE TABLE user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, badge_id)
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

  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    read_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const testDb = drizzle(sqlite, { schema });

// Override the db instance directly — avoids mock.module which is unreliable on Linux CI.
import { __setTestDb } from "../../db/connection";
__setTestDb(testDb);

// Import after db override and mocks are set up.
// Use dynamic imports to guarantee mocks are applied before module resolution.
const {
  POINT_VALUES,
  awardPoints,
  updateStreak,
  getDetailedPointsStats,
  getUserMetrics,
  getOrCreateUserPoints,
} = await import("../gamification-service");

// ── Seed data ────────────────────────────────────────────────────────

let userId: number;
let productId: number;

beforeAll(() => {
  // Seed a test user
  const userStmt = sqlite.prepare(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id"
  );
  const userRow = userStmt.get("test@eco.com", "hash123", "Test User") as { id: number };
  userId = userRow.id;

  // Seed a test product
  const prodStmt = sqlite.prepare(
      "INSERT INTO products (user_id, product_name, category, quantity) VALUES (?, ?, ?, ?) RETURNING id"
  );
  const prodRow = prodStmt.get(userId, "Milk", "dairy", 1) as { id: number };
  productId = prodRow.id;
});

beforeEach(() => {
  // Reset points and interactions between tests
  sqlite.exec("DELETE FROM user_badges");
  sqlite.exec("DELETE FROM product_sustainability_metrics");
  sqlite.exec("DELETE FROM user_points");
  sqlite.exec("DELETE FROM notifications");
  sqlite.exec("DELETE FROM notification_preferences");
});

// ── POINT_VALUES ─────────────────────────────────────────────────────

describe("POINT_VALUES", () => {
  test("consumed awards 5 points", () => {
    expect(POINT_VALUES.consumed).toBe(5);
  });

  test("shared awards 10 points", () => {
    expect(POINT_VALUES.shared).toBe(10);
  });

  test("sold awards 8 points", () => {
    expect(POINT_VALUES.sold).toBe(8);
  });

  test("wasted penalizes 3 points", () => {
    expect(POINT_VALUES.wasted).toBe(-3);
  });
});

// ── awardPoints ──────────────────────────────────────────────────────

describe("awardPoints", () => {
  test("awards correct positive points for consumed", async () => {
    const result = await awardPoints(userId, "consumed", productId);
    expect(result.amount).toBe(5);
    // newTotal is the action-level total (before badge bonuses modify the DB)
    expect(result.newTotal).toBe(5);
    expect(result.action).toBe("consumed");
  });

  test("awards correct positive points for sold", async () => {
    const result = await awardPoints(userId, "sold", productId);
    expect(result.amount).toBe(8);
    expect(result.newTotal).toBe(8);
  });

  test("awards correct positive points for shared", async () => {
    const result = await awardPoints(userId, "shared", productId);
    expect(result.amount).toBe(10);
    expect(result.newTotal).toBe(10);
  });

  test("penalizes points for wasted (negative)", async () => {
    // Seed user_points directly so no badge bonuses accumulate from awardPoints
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 10 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId);
    expect(result.amount).toBe(-3);
    expect(result.newTotal).toBe(7); // 10 - 3
  });

  test("scales points with quantity", async () => {
    const result = await awardPoints(userId, "consumed", productId, 3);
    expect(result.amount).toBe(15); // 5 * 3
    expect(result.newTotal).toBe(15);
  });

  test("total points floor at 0 (never goes negative)", async () => {
    const result = await awardPoints(userId, "wasted", productId, 100);
    // -3 * 100 = -300, but floor at 0
    expect(result.newTotal).toBe(0);
  });

  test("records a sustainability metric row", async () => {
    await awardPoints(userId, "consumed", productId);
    const metrics = await testDb.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, userId),
    });
    expect(metrics.length).toBe(1);
    expect(metrics[0].type).toBe("consumed");
    expect(metrics[0].productId).toBe(productId);
  });

  test("skips metric recording when skipMetricRecording=true", async () => {
    await awardPoints(userId, "consumed", productId, 1, true);
    const metrics = await testDb.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, userId),
    });
    expect(metrics.length).toBe(0);
  });

  test("wasted action resets streak to 0", async () => {
    // First set a streak via a positive action
    await awardPoints(userId, "consumed", productId);
    const pointsBefore = await getOrCreateUserPoints(userId);
    expect(pointsBefore.currentStreak).toBe(1);

    // Then waste should reset streak
    await awardPoints(userId, "wasted", productId);
    const pointsAfter = await getOrCreateUserPoints(userId);
    expect(pointsAfter.currentStreak).toBe(0);
  });

  test("consume with fractional qty (0.2) awards scaled points", async () => {
    const result = await awardPoints(userId, "consumed", productId, 0.2);
    // 5 * 0.2 = 1
    expect(result.amount).toBe(1);
  });

  test("wasted with fractional qty (0.3) awards scaled points", async () => {
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 10 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId, 0.3);
    // -3 * 0.3 = -0.9 → rounds to -1
    expect(result.amount).toBe(-1);
  });

  test("sold with qty=1 awards 8 points", async () => {
    const result = await awardPoints(userId, "sold", productId, 1);
    expect(result.amount).toBe(8);
  });

  test("sold with qty=3 awards 24 points", async () => {
    const result = await awardPoints(userId, "sold", productId, 3);
    expect(result.amount).toBe(24); // 8 * 3
  });

  // ── Quantity scaling by unit (kg, L, pcs) ──────────────────────────

  test("consumed 2.5 kg awards 13 pts (5 * 2.5 rounded)", async () => {
    const result = await awardPoints(userId, "consumed", productId, 2.5);
    expect(result.amount).toBe(13); // Math.round(5 * 2.5) = 13
  });

  test("consumed 0.5 kg awards 3 pts (scaled)", async () => {
    const result = await awardPoints(userId, "consumed", productId, 0.5);
    // 5 * 0.5 = 2.5 → rounds to 3
    expect(result.amount).toBe(3);
  });

  test("consumed 1.0 kg awards exactly base (5 pts)", async () => {
    const result = await awardPoints(userId, "consumed", productId, 1.0);
    expect(result.amount).toBe(5);
  });

  test("consumed 10 pcs awards 50 pts (5 * 10)", async () => {
    const result = await awardPoints(userId, "consumed", productId, 10);
    expect(result.amount).toBe(50);
  });

  test("wasted 2.0 kg penalizes 6 pts (-3 * 2)", async () => {
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 100 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId, 2.0);
    expect(result.amount).toBe(-6); // -3 * 2
    expect(result.newTotal).toBe(94); // 100 - 6
  });

  test("wasted 0.5 kg penalizes scaled (-2 pts)", async () => {
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 50 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId, 0.5);
    // -3 * 0.5 = -1.5 → Math.round(-1.5) = -1
    expect(result.amount).toBe(-1);
    expect(result.newTotal).toBe(49);
  });

  test("wasted 5.0 kg penalizes 15 pts (-3 * 5)", async () => {
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 100 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId, 5.0);
    expect(result.amount).toBe(-15);
    expect(result.newTotal).toBe(85);
  });

  test("shared 2.0 L awards 20 pts (10 * 2)", async () => {
    const result = await awardPoints(userId, "shared", productId, 2.0);
    expect(result.amount).toBe(20);
  });

  test("shared 0.3 L awards scaled (3 pts)", async () => {
    const result = await awardPoints(userId, "shared", productId, 0.3);
    // 10 * 0.3 = 3
    expect(result.amount).toBe(3);
  });

  test("sold 1.5 kg awards 12 pts (8 * 1.5)", async () => {
    const result = await awardPoints(userId, "sold", productId, 1.5);
    expect(result.amount).toBe(12);
  });

  test("cumulative points: consume 2kg + waste 0.5kg", async () => {
    // Consume 2kg first
    const r1 = await awardPoints(userId, "consumed", productId, 2.0);
    expect(r1.amount).toBe(10); // 5 * 2
    expect(r1.newTotal).toBe(10);

    // Then waste 0.5kg: -3 * 0.5 = -1.5 → Math.round(-1.5) = -1
    const r2 = await awardPoints(userId, "wasted", productId, 0.5);
    expect(r2.amount).toBe(-1);
    expect(r2.newTotal).toBe(9); // 10 - 1
  });

  test("cumulative points: multiple kg-based actions accumulate correctly", async () => {
    // Consume 3.0 kg → 15 pts
    const r1 = await awardPoints(userId, "consumed", productId, 3.0);
    expect(r1.newTotal).toBe(15);

    // Sold 2.0 kg → 16 pts
    const r2 = await awardPoints(userId, "sold", productId, 2.0);
    expect(r2.amount).toBe(16); // 8 * 2
    expect(r2.newTotal).toBe(31); // 15 + 16

    // Wasted 4.0 kg → -12 pts
    const r3 = await awardPoints(userId, "wasted", productId, 4.0);
    expect(r3.amount).toBe(-12); // -3 * 4
    expect(r3.newTotal).toBe(19); // 31 - 12
  });

  test("consume and sold increment streak only once per day", async () => {
    // First consume action should set streak to 1
    await awardPoints(userId, "consumed", productId);
    const after1 = await getOrCreateUserPoints(userId);
    expect(after1.currentStreak).toBe(1);

    // Second action on the same day should NOT increment streak
    await awardPoints(userId, "sold", productId);
    const after2 = await getOrCreateUserPoints(userId);
    expect(after2.currentStreak).toBe(1);
  });
});

// ── updateStreak ─────────────────────────────────────────────────────

describe("updateStreak", () => {
  test("first qualifying action sets streak to 1", async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Insert a qualifying metric
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId,
      productId,
      todayDate: today,
      quantity: 1,
      type: "consumed",
    });
    // Create user points record first
    await getOrCreateUserPoints(userId);

    await updateStreak(userId);

    const up = await getOrCreateUserPoints(userId);
    expect(up.currentStreak).toBe(1);
  });

  test("second qualifying action on same day does not double-increment", async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Insert two metrics for today
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "sold" },
    ]);
    await getOrCreateUserPoints(userId);

    await updateStreak(userId);

    const up = await getOrCreateUserPoints(userId);
    // Should still be 0 because there were already >1 interactions when updateStreak ran
    // (the check is: if todayInteractions.length > 1, return early)
    expect(up.currentStreak).toBe(0);
  });

  test("action on consecutive day increments streak", async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Yesterday's action
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: yesterdayStr, quantity: 1, type: "consumed",
    });
    // Set current streak to 1 (simulating yesterday's streak update)
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ currentStreak: 1 })
      .where(eq(schema.userPoints.userId, userId));

    // Today's action (exactly 1 for today so the >1 check doesn't trigger)
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: today, quantity: 1, type: "consumed",
    });

    await updateStreak(userId);

    const up = await getOrCreateUserPoints(userId);
    expect(up.currentStreak).toBe(2);
  });

  test("action after a gap day resets streak to 1", async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

    // Action two days ago
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: twoDaysAgoStr, quantity: 1, type: "consumed",
    });
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ currentStreak: 5 })
      .where(eq(schema.userPoints.userId, userId));

    // Today's action (gap of 1 day)
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: today, quantity: 1, type: "sold",
    });

    await updateStreak(userId);

    const up = await getOrCreateUserPoints(userId);
    expect(up.currentStreak).toBe(1);
  });
});

// ── getDetailedPointsStats ───────────────────────────────────────────

describe("getDetailedPointsStats", () => {
  test("returns correct breakdown counts by type", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "sold" },
      { userId, productId, todayDate: today, quantity: 1, type: "wasted" },
    ]);

    const stats = await getDetailedPointsStats(userId);

    expect(stats.breakdownByType.consumed.count).toBe(2);
    expect(stats.breakdownByType.sold.count).toBe(1);
    expect(stats.breakdownByType.wasted.count).toBe(1);
    expect(stats.breakdownByType.shared.count).toBe(0);
  });

  test("computes longestStreak from interaction history", async () => {
    const now = new Date();
    // Create 3 consecutive days of activity
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      await testDb.insert(schema.productSustainabilityMetrics).values({
        userId, productId, todayDate: dateStr, quantity: 1, type: "consumed",
      });
    }

    const stats = await getDetailedPointsStats(userId);
    expect(stats.longestStreak).toBe(3);
  });

  test("computes pointsToday correctly", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "sold" },
    ]);

    const stats = await getDetailedPointsStats(userId);
    // consumed=5, sold=8 → 13
    expect(stats.pointsToday).toBe(13);
  });

  test("computes pointsThisWeek correctly", async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: threeDaysAgoStr, quantity: 1, type: "sold" },
    ]);

    const stats = await getDetailedPointsStats(userId);
    // Both within the last 7 days
    expect(stats.pointsThisWeek).toBe(13);
  });

  test("computes pointsThisMonth correctly", async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // 40 days ago is outside the month window
    const fortyDaysAgo = new Date(now);
    fortyDaysAgo.setUTCDate(fortyDaysAgo.getUTCDate() - 40);
    const fortyDaysAgoStr = fortyDaysAgo.toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: fortyDaysAgoStr, quantity: 1, type: "sold" },
    ]);

    const stats = await getDetailedPointsStats(userId);
    // Only today's consumed (5) should be in this month
    expect(stats.pointsThisMonth).toBe(5);
  });

  test("points history shows correct amounts for fractional qty", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 0.2, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 0.3, type: "wasted" },
      { userId, productId, todayDate: today, quantity: 3, type: "sold" },
    ]);

    const stats = await getDetailedPointsStats(userId);

    // consumed: 5 * 0.2 = 1
    expect(stats.breakdownByType.consumed.totalPoints).toBe(1);
    // wasted: -3 * 0.3 = -0.9 → rounds to -1
    expect(stats.breakdownByType.wasted.totalPoints).toBe(-1);
    // sold: 8 * 3 = 24 (scaled, above base)
    expect(stats.breakdownByType.sold.totalPoints).toBe(24);
  });

  test("stats scale correctly with kg-based quantities", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 2.5, type: "consumed" },  // 2.5 kg
      { userId, productId, todayDate: today, quantity: 1.5, type: "sold" },      // 1.5 kg
      { userId, productId, todayDate: today, quantity: 0.8, type: "wasted" },    // 0.8 kg
    ]);

    const stats = await getDetailedPointsStats(userId);

    // consumed: 5 * 2.5 = 12.5 → rounds to 13, |13| >= |5| so 13
    expect(stats.breakdownByType.consumed.totalPoints).toBe(13);
    // sold: 8 * 1.5 = 12, |12| >= |8| so 12
    expect(stats.breakdownByType.sold.totalPoints).toBe(12);
    // wasted: -3 * 0.8 = -2.4 → rounds to -2
    expect(stats.breakdownByType.wasted.totalPoints).toBe(-2);

    // pointsToday = 13 + 12 + (-2) = 23
    expect(stats.pointsToday).toBe(23);
  });

  test("stats scale with large kg quantities across multiple entries", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 5.0, type: "consumed" },  // 5 kg rice
      { userId, productId, todayDate: today, quantity: 2.0, type: "consumed" },  // 2 L milk
      { userId, productId, todayDate: today, quantity: 3.0, type: "wasted" },    // 3 kg veggies
    ]);

    const stats = await getDetailedPointsStats(userId);

    // consumed entry 1: 5 * 5.0 = 25
    // consumed entry 2: 5 * 2.0 = 10
    // total consumed points: 35
    expect(stats.breakdownByType.consumed.totalPoints).toBe(35);
    expect(stats.breakdownByType.consumed.count).toBe(2);

    // wasted: -3 * 3.0 = -9
    expect(stats.breakdownByType.wasted.totalPoints).toBe(-9);

    // pointsToday = 35 + (-9) = 26
    expect(stats.pointsToday).toBe(26);
  });

  test("stats with mixed units: pcs (10), kg (0.5), L (2.0)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 10, type: "consumed" },   // 10 pcs eggs
      { userId, productId, todayDate: today, quantity: 0.5, type: "consumed" },  // 0.5 kg
      { userId, productId, todayDate: today, quantity: 2.0, type: "shared" },    // 2 L milk
    ]);

    const stats = await getDetailedPointsStats(userId);

    // consumed 10 pcs: 5 * 10 = 50
    // consumed 0.5 kg: 5 * 0.5 = 2.5 → round to 3
    // total consumed: 53
    expect(stats.breakdownByType.consumed.totalPoints).toBe(53);

    // shared 2.0 L: 10 * 2.0 = 20
    expect(stats.breakdownByType.shared.totalPoints).toBe(20);

    // pointsToday = 53 + 20 = 73
    expect(stats.pointsToday).toBe(73);
  });
});

// ── getUserMetrics ───────────────────────────────────────────────────

describe("getUserMetrics", () => {
  test("counts each type correctly", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "wasted" },
      { userId, productId, todayDate: today, quantity: 1, type: "sold" },
      { userId, productId, todayDate: today, quantity: 1, type: "shared" },
    ]);

    const metrics = await getUserMetrics(userId);
    expect(metrics.totalItemsConsumed).toBe(2);
    expect(metrics.totalItemsWasted).toBe(1);
    expect(metrics.totalItemsSold).toBe(1);
    expect(metrics.totalItemsShared).toBe(1);
  });

  test("handles case variants ('consume' vs 'consumed')", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "Consume" },
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "Waste" },
      { userId, productId, todayDate: today, quantity: 1, type: "wasted" },
    ]);

    const metrics = await getUserMetrics(userId);
    expect(metrics.totalItemsConsumed).toBe(2);
    expect(metrics.totalItemsWasted).toBe(2);
  });

  test("computes wasteReductionRate correctly", async () => {
    const today = new Date().toISOString().slice(0, 10);
    // 3 consumed, 1 wasted → saved=3, total=4, rate=75%
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "wasted" },
    ]);

    const metrics = await getUserMetrics(userId);
    expect(metrics.wasteReductionRate).toBeCloseTo(75, 1);
  });

  test("wasteReductionRate is 100 when no interactions", async () => {
    const metrics = await getUserMetrics(userId);
    expect(metrics.wasteReductionRate).toBe(100);
  });
});
