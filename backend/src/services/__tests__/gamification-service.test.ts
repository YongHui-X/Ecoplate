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
  // Product is "Milk" category "dairy": CO2 factor = 7.0 + 0.5 = 7.5
  // consumed: round(qty * 7.5)
  // sold: round(qty * 7.5 * 1.5)
  // wasted: -round(qty * 7.5)

  test("awards correct positive points for consumed (dairy, qty=1)", async () => {
    const result = await awardPoints(userId, "consumed", productId);
    // 1 * 7.5 = 7.5 → round = 8
    expect(result.amount).toBe(8);
    expect(result.newTotal).toBe(8);
    expect(result.action).toBe("consumed");
  });

  test("awards correct positive points for sold (dairy, qty=1)", async () => {
    const result = await awardPoints(userId, "sold", productId);
    // 1 * 7.5 * 1.5 = 11.25 → round = 11
    expect(result.amount).toBe(11);
    expect(result.newTotal).toBe(11);
  });

  test("awards correct positive points for shared (dairy, qty=1)", async () => {
    const result = await awardPoints(userId, "shared", productId);
    // shared uses consumed formula: round(1 * 7.5) = 8
    expect(result.amount).toBe(8);
    expect(result.newTotal).toBe(8);
  });

  test("penalizes points for wasted (negative)", async () => {
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 100 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId);
    // -round(1 * 7.5) = -8
    expect(result.amount).toBe(-8);
    expect(result.newTotal).toBe(92); // 100 - 8
  });

  test("scales points with quantity", async () => {
    const result = await awardPoints(userId, "consumed", productId, 3);
    // round(3 * 7.5) = round(22.5) = 23
    expect(result.amount).toBe(23);
    expect(result.newTotal).toBe(23);
  });

  test("total points floor at 0 (never goes negative)", async () => {
    const result = await awardPoints(userId, "wasted", productId, 100);
    // -round(100 * 7.5) = -750, but floor at 0
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
    // round(0.2 * 7.5) = round(1.5) = 2
    expect(result.amount).toBe(2);
  });

  test("wasted with fractional qty (0.3) awards scaled points", async () => {
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 100 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId, 0.3);
    // -round(0.3 * 7.5) = -round(2.25) = -2
    expect(result.amount).toBe(-2);
  });

  test("sold with qty=1 awards CO2-based points", async () => {
    const result = await awardPoints(userId, "sold", productId, 1);
    // round(1 * 7.5 * 1.5) = round(11.25) = 11
    expect(result.amount).toBe(11);
  });

  test("sold with qty=3 awards CO2-based points", async () => {
    const result = await awardPoints(userId, "sold", productId, 3);
    // round(3 * 7.5 * 1.5) = round(33.75) = 34
    expect(result.amount).toBe(34);
  });

  // ── Quantity scaling (dairy product, CO2 factor 7.5) ──────────────

  test("consumed 2.5 kg dairy awards 19 pts", async () => {
    const result = await awardPoints(userId, "consumed", productId, 2.5);
    // round(2.5 * 7.5) = round(18.75) = 19
    expect(result.amount).toBe(19);
  });

  test("consumed 0.5 kg dairy awards 4 pts", async () => {
    const result = await awardPoints(userId, "consumed", productId, 0.5);
    // round(0.5 * 7.5) = round(3.75) = 4
    expect(result.amount).toBe(4);
  });

  test("consumed 1.0 kg dairy awards 8 pts", async () => {
    const result = await awardPoints(userId, "consumed", productId, 1.0);
    // round(1.0 * 7.5) = 8
    expect(result.amount).toBe(8);
  });

  test("consumed 10 kg dairy awards 75 pts", async () => {
    const result = await awardPoints(userId, "consumed", productId, 10);
    // round(10 * 7.5) = 75
    expect(result.amount).toBe(75);
  });

  test("wasted 2.0 kg dairy penalizes 15 pts", async () => {
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 100 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId, 2.0);
    // -round(2.0 * 7.5) = -15
    expect(result.amount).toBe(-15);
    expect(result.newTotal).toBe(85); // 100 - 15
  });

  test("wasted 0.5 kg dairy penalizes 4 pts", async () => {
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 50 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId, 0.5);
    // -round(0.5 * 7.5) = -round(3.75) = -4
    expect(result.amount).toBe(-4);
    expect(result.newTotal).toBe(46);
  });

  test("wasted 5.0 kg dairy penalizes 38 pts", async () => {
    await getOrCreateUserPoints(userId);
    await testDb.update(schema.userPoints)
      .set({ totalPoints: 100 })
      .where(eq(schema.userPoints.userId, userId));

    const result = await awardPoints(userId, "wasted", productId, 5.0);
    // -round(5.0 * 7.5) = -38
    expect(result.amount).toBe(-38);
    expect(result.newTotal).toBe(62);
  });

  test("shared 2.0 kg dairy awards 15 pts", async () => {
    const result = await awardPoints(userId, "shared", productId, 2.0);
    // round(2.0 * 7.5) = 15
    expect(result.amount).toBe(15);
  });

  test("shared 0.3 kg dairy awards 2 pts", async () => {
    const result = await awardPoints(userId, "shared", productId, 0.3);
    // round(0.3 * 7.5) = round(2.25) = 2
    expect(result.amount).toBe(2);
  });

  test("sold 1.5 kg dairy awards 17 pts", async () => {
    const result = await awardPoints(userId, "sold", productId, 1.5);
    // round(1.5 * 7.5 * 1.5) = round(16.875) = 17
    expect(result.amount).toBe(17);
  });

  test("cumulative points: consume 2kg + waste 0.5kg (dairy)", async () => {
    // Consume 2kg: round(2 * 7.5) = 15
    const r1 = await awardPoints(userId, "consumed", productId, 2.0);
    expect(r1.amount).toBe(15);
    expect(r1.newTotal).toBe(15);

    // Waste 0.5kg: -round(0.5 * 7.5) = -4
    const r2 = await awardPoints(userId, "wasted", productId, 0.5);
    expect(r2.amount).toBe(-4);
    expect(r2.newTotal).toBe(11); // 15 - 4
  });

  test("cumulative points: multiple kg-based actions accumulate correctly (dairy)", async () => {
    // Consume 3.0 kg → round(3.0 * 7.5) = round(22.5) = 23
    const r1 = await awardPoints(userId, "consumed", productId, 3.0);
    expect(r1.newTotal).toBe(23);

    // Sold 2.0 kg → round(2.0 * 7.5 * 1.5) = round(22.5) = 23
    const r2 = await awardPoints(userId, "sold", productId, 2.0);
    expect(r2.amount).toBe(23);
    expect(r2.newTotal).toBe(46); // 23 + 23

    // Wasted 4.0 kg → -round(4.0 * 7.5) = -30
    const r3 = await awardPoints(userId, "wasted", productId, 4.0);
    expect(r3.amount).toBe(-30);
    expect(r3.newTotal).toBe(16); // 46 - 30
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

  test("no productId defaults to 'other' category (CO2 factor 3.0)", async () => {
    const result = await awardPoints(userId, "consumed", null, 1);
    // round(1 * 3.0) = 3
    expect(result.amount).toBe(3);
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

  test("computes pointsToday correctly (dairy product)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "sold" },
    ]);

    const stats = await getDetailedPointsStats(userId);
    // consumed: round(1*7.5)=8, sold: round(1*7.5*1.5)=round(11.25)=11 → 19
    expect(stats.pointsToday).toBe(19);
  });

  test("computes pointsThisWeek correctly (dairy product)", async () => {
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
    // consumed: 8, sold: 11 → 19
    expect(stats.pointsThisWeek).toBe(19);
  });

  test("computes pointsThisMonth correctly (dairy product)", async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const fortyDaysAgo = new Date(now);
    fortyDaysAgo.setUTCDate(fortyDaysAgo.getUTCDate() - 40);
    const fortyDaysAgoStr = fortyDaysAgo.toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: fortyDaysAgoStr, quantity: 1, type: "sold" },
    ]);

    const stats = await getDetailedPointsStats(userId);
    // Only today's consumed: round(1*7.5) = 8
    expect(stats.pointsThisMonth).toBe(8);
  });

  test("points history shows correct amounts for fractional qty (dairy)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 0.2, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 0.3, type: "wasted" },
      { userId, productId, todayDate: today, quantity: 3, type: "sold" },
    ]);

    const stats = await getDetailedPointsStats(userId);

    // consumed: round(0.2 * 7.5) = round(1.5) = 2
    expect(stats.breakdownByType.consumed.totalPoints).toBe(2);
    // wasted: -round(0.3 * 7.5) = -round(2.25) = -2
    expect(stats.breakdownByType.wasted.totalPoints).toBe(-2);
    // sold: round(3 * 7.5 * 1.5) = round(33.75) = 34
    expect(stats.breakdownByType.sold.totalPoints).toBe(34);
  });

  test("stats scale correctly with kg-based quantities (dairy)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 2.5, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1.5, type: "sold" },
      { userId, productId, todayDate: today, quantity: 0.8, type: "wasted" },
    ]);

    const stats = await getDetailedPointsStats(userId);

    // consumed: round(2.5 * 7.5) = round(18.75) = 19
    expect(stats.breakdownByType.consumed.totalPoints).toBe(19);
    // sold: round(1.5 * 7.5 * 1.5) = round(16.875) = 17
    expect(stats.breakdownByType.sold.totalPoints).toBe(17);
    // wasted: -round(0.8 * 7.5) = -round(6) = -6
    expect(stats.breakdownByType.wasted.totalPoints).toBe(-6);

    // pointsToday = 19 + 17 + (-6) = 30
    expect(stats.pointsToday).toBe(30);
  });

  test("stats scale with large kg quantities across multiple entries (dairy)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 5.0, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 2.0, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 3.0, type: "wasted" },
    ]);

    const stats = await getDetailedPointsStats(userId);

    // consumed entry 1: round(5.0 * 7.5) = 38
    // consumed entry 2: round(2.0 * 7.5) = 15
    // total consumed: 53
    expect(stats.breakdownByType.consumed.totalPoints).toBe(53);
    expect(stats.breakdownByType.consumed.count).toBe(2);

    // wasted: -round(3.0 * 7.5) = -23
    expect(stats.breakdownByType.wasted.totalPoints).toBe(-23);

    // pointsToday = 53 + (-23) = 30
    expect(stats.pointsToday).toBe(30);
  });

  test("stats with mixed quantities (dairy product)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 10, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 0.5, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 2.0, type: "shared" },
    ]);

    const stats = await getDetailedPointsStats(userId);

    // consumed 10 kg dairy: round(10 * 7.5) = 75
    // consumed 0.5 kg dairy: round(0.5 * 7.5) = round(3.75) = 4
    // total consumed: 79
    expect(stats.breakdownByType.consumed.totalPoints).toBe(79);

    // shared 2.0 kg dairy: round(2.0 * 7.5) = 15
    expect(stats.breakdownByType.shared.totalPoints).toBe(15);

    // pointsToday = 79 + 15 = 94
    expect(stats.pointsToday).toBe(94);
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
