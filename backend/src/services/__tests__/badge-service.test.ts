import { describe, expect, test, beforeAll, beforeEach, mock } from "bun:test";
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
`);

const testDb = drizzle(sqlite, { schema });

// Mock the db export used by badge-service and gamification-service
mock.module("../../index", () => ({ db: testDb }));

// Mock notification service to avoid DB calls to notifications table
mock.module("../notification-service", () => ({
  notifyStreakMilestone: async () => {},
  notifyBadgeUnlocked: async () => {},
}));

// Import AFTER mocking
import {
  BADGE_DEFINITIONS,
  checkAndAwardBadges,
  getBadgeProgress,
  getUserBadgeMetrics,
} from "../badge-service";
import { getOrCreateUserPoints } from "../gamification-service";

// ── Seed data ────────────────────────────────────────────────────────

let userId: number;
let productId: number;

beforeAll(() => {
  // Seed a test user
  const userStmt = sqlite.prepare(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id"
  );
  const userRow = userStmt.get("badge-test@eco.com", "hash456", "Badge Tester") as { id: number };
  userId = userRow.id;

  // Seed a test product
  const prodStmt = sqlite.prepare(
    "INSERT INTO products (user_id, product_name, category, quantity) VALUES (?, ?, ?, ?) RETURNING id"
  );
  const prodRow = prodStmt.get(userId, "Apple", "produce", 5) as { id: number };
  productId = prodRow.id;

  // Seed all badge definitions into the DB
  const badgeStmt = sqlite.prepare(
    "INSERT INTO badges (code, name, description, category, points_awarded, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const def of BADGE_DEFINITIONS) {
    badgeStmt.run(def.code, def.name, def.description, def.category, def.pointsAwarded, def.sortOrder);
  }
});

beforeEach(() => {
  // Clean between tests
  sqlite.exec("DELETE FROM user_badges");
  sqlite.exec("DELETE FROM product_sustainability_metrics");
  sqlite.exec("DELETE FROM user_points");
});

// ── BADGE_DEFINITIONS ────────────────────────────────────────────────

describe("BADGE_DEFINITIONS", () => {
  test("all definitions have required fields", () => {
    for (const def of BADGE_DEFINITIONS) {
      expect(def.code).toBeDefined();
      expect(typeof def.code).toBe("string");
      expect(def.code.length).toBeGreaterThan(0);

      expect(def.name).toBeDefined();
      expect(typeof def.name).toBe("string");

      expect(typeof def.condition).toBe("function");
      expect(typeof def.progress).toBe("function");

      expect(typeof def.pointsAwarded).toBe("number");
      expect(typeof def.sortOrder).toBe("number");
      expect(def.category).toBeDefined();
      expect(def.description).toBeDefined();
    }
  });

  test("condition functions return correct boolean for sample metrics", () => {
    const zeroMetrics = {
      totalPoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalConsumed: 0,
      totalWasted: 0,
      totalShared: 0,
      totalSold: 0,
      totalActions: 0,
      totalItems: 0,
      wasteReductionRate: 0,
    };

    const firstActionDef = BADGE_DEFINITIONS.find((d) => d.code === "first_action")!;
    expect(firstActionDef.condition(zeroMetrics)).toBe(false);
    expect(firstActionDef.condition({ ...zeroMetrics, totalActions: 1 })).toBe(true);

    const ecoStarterDef = BADGE_DEFINITIONS.find((d) => d.code === "eco_starter")!;
    expect(ecoStarterDef.condition({ ...zeroMetrics, totalActions: 9 })).toBe(false);
    expect(ecoStarterDef.condition({ ...zeroMetrics, totalActions: 10 })).toBe(true);

    const ecoChampionDef = BADGE_DEFINITIONS.find((d) => d.code === "eco_champion")!;
    expect(ecoChampionDef.condition({ ...zeroMetrics, totalPoints: 999 })).toBe(false);
    expect(ecoChampionDef.condition({ ...zeroMetrics, totalPoints: 1000 })).toBe(true);

    const firstConsumeDef = BADGE_DEFINITIONS.find((d) => d.code === "first_consume")!;
    expect(firstConsumeDef.condition(zeroMetrics)).toBe(false);
    expect(firstConsumeDef.condition({ ...zeroMetrics, totalConsumed: 1 })).toBe(true);

    const streak3Def = BADGE_DEFINITIONS.find((d) => d.code === "streak_3")!;
    expect(streak3Def.condition({ ...zeroMetrics, longestStreak: 2 })).toBe(false);
    expect(streak3Def.condition({ ...zeroMetrics, longestStreak: 3 })).toBe(true);

    const firstSaleDef = BADGE_DEFINITIONS.find((d) => d.code === "first_sale")!;
    expect(firstSaleDef.condition(zeroMetrics)).toBe(false);
    expect(firstSaleDef.condition({ ...zeroMetrics, totalSold: 1 })).toBe(true);
  });

  test("progress functions return { current, target, percentage } with percentage 0-100", () => {
    const zeroMetrics = {
      totalPoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalConsumed: 0,
      totalWasted: 0,
      totalShared: 0,
      totalSold: 0,
      totalActions: 0,
      totalItems: 0,
      wasteReductionRate: 0,
    };

    for (const def of BADGE_DEFINITIONS) {
      const p = def.progress(zeroMetrics);
      expect(p).toHaveProperty("current");
      expect(p).toHaveProperty("target");
      expect(p).toHaveProperty("percentage");
      expect(typeof p.current).toBe("number");
      expect(typeof p.target).toBe("number");
      expect(typeof p.percentage).toBe("number");
      expect(p.percentage).toBeGreaterThanOrEqual(0);
      expect(p.percentage).toBeLessThanOrEqual(100);
    }

    // Check a fully met condition gives 100%
    const firstActionDef = BADGE_DEFINITIONS.find((d) => d.code === "first_action")!;
    const metProgress = firstActionDef.progress({ ...zeroMetrics, totalActions: 5 });
    expect(metProgress.percentage).toBe(100);
    expect(metProgress.current).toBe(1); // capped at target
    expect(metProgress.target).toBe(1);
  });
});

// ── checkAndAwardBadges ──────────────────────────────────────────────

describe("checkAndAwardBadges", () => {
  test("awards 'first_action' badge after 1 qualifying action", async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Create the user_points record
    await getOrCreateUserPoints(userId);
    // Record 1 consumed interaction
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: today, quantity: 1, type: "consumed",
    });

    const awarded = await checkAndAwardBadges(userId);
    const firstAction = awarded.find((b) => b.code === "first_action");
    expect(firstAction).toBeDefined();
    expect(firstAction!.name).toBe("First Steps");

    // Also verify first_consume was awarded
    const firstConsume = awarded.find((b) => b.code === "first_consume");
    expect(firstConsume).toBeDefined();
  });

  test("does NOT double-award a badge already earned", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateUserPoints(userId);
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: today, quantity: 1, type: "consumed",
    });

    // First call awards the badge
    const first = await checkAndAwardBadges(userId);
    const firstActionCount = first.filter((b) => b.code === "first_action").length;
    expect(firstActionCount).toBe(1);

    // Add another interaction so conditions are still met
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: today, quantity: 1, type: "consumed",
    });

    // Second call should NOT re-award first_action
    const second = await checkAndAwardBadges(userId);
    const reAwarded = second.find((b) => b.code === "first_action");
    expect(reAwarded).toBeUndefined();
  });

  test("awards bonus points when a badge is earned", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateUserPoints(userId);
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: today, quantity: 1, type: "consumed",
    });

    await checkAndAwardBadges(userId);

    const up = await getOrCreateUserPoints(userId);
    // first_action awards 25 points, first_consume awards 25 points → 50 total badge bonus
    expect(up.totalPoints).toBe(50);
  });

  test("awards multiple badges if multiple conditions are met simultaneously", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateUserPoints(userId);
    // 1 consumed + 1 sold = satisfies first_action, first_consume, first_sale
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 1, type: "sold" },
    ]);

    const awarded = await checkAndAwardBadges(userId);
    const codes = awarded.map((b) => b.code);
    expect(codes).toContain("first_action");
    expect(codes).toContain("first_consume");
    expect(codes).toContain("first_sale");
    expect(awarded.length).toBeGreaterThanOrEqual(3);
  });

  test("badge bonus adds on top of kg-scaled action points", async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Simulate prior consume of 2kg = 5*2 = 10 action points already in totalPoints
    await getOrCreateUserPoints(userId);
    await testDb
      .update(schema.userPoints)
      .set({ totalPoints: 10 })
      .where(eq(schema.userPoints.userId, userId));

    // Record 1 consumed interaction → triggers first_action (25) + first_consume (25)
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: today, quantity: 2, type: "consumed",
    });

    await checkAndAwardBadges(userId);

    const up = await getOrCreateUserPoints(userId);
    // 10 (prior action pts) + 25 (first_action) + 25 (first_consume) = 60
    expect(up.totalPoints).toBe(60);
  });

  test("multiple kg-based interactions trigger correct badge bonuses", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateUserPoints(userId);

    // Insert 10 consumed interactions (each 2.5kg) → triggers first_action (25) + first_consume (25) + eco_starter (50)
    const rows = Array.from({ length: 10 }, () => ({
      userId, productId, todayDate: today, quantity: 2.5, type: "consumed" as const,
    }));
    await testDb.insert(schema.productSustainabilityMetrics).values(rows);

    const awarded = await checkAndAwardBadges(userId);
    const codes = awarded.map((b) => b.code);
    expect(codes).toContain("first_action");
    expect(codes).toContain("first_consume");
    expect(codes).toContain("eco_starter");

    const totalBonus = awarded.reduce((sum, b) => sum + b.pointsAwarded, 0);
    expect(totalBonus).toBe(100); // 25 + 25 + 50

    const up = await getOrCreateUserPoints(userId);
    expect(up.totalPoints).toBe(100);
  });

  test("wasted interactions don't count toward badge action totals", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateUserPoints(userId);

    // 1 consumed + 5 wasted
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 1, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 2, type: "wasted" },
      { userId, productId, todayDate: today, quantity: 3, type: "wasted" },
      { userId, productId, todayDate: today, quantity: 1.5, type: "wasted" },
      { userId, productId, todayDate: today, quantity: 0.5, type: "wasted" },
      { userId, productId, todayDate: today, quantity: 4, type: "wasted" },
    ]);

    const metrics = await getUserBadgeMetrics(userId);
    // totalActions counts only consumed+shared+sold, NOT wasted
    expect(metrics.totalActions).toBe(1);
    expect(metrics.totalWasted).toBe(5);

    const awarded = await checkAndAwardBadges(userId);
    const codes = awarded.map((b) => b.code);
    // Only first_action + first_consume should be awarded (totalActions=1)
    expect(codes).toContain("first_action");
    expect(codes).toContain("first_consume");
    // eco_starter requires 10 actions — should NOT be awarded
    expect(codes).not.toContain("eco_starter");
  });

  test("badge metrics count interactions not kg quantities", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateUserPoints(userId);

    // 1 interaction with quantity=50kg
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: today, quantity: 50, type: "consumed",
    });

    const metrics = await getUserBadgeMetrics(userId);
    // totalConsumed should be 1 (row count), not 50 (quantity)
    expect(metrics.totalConsumed).toBe(1);
    expect(metrics.totalActions).toBe(1);

    const awarded = await checkAndAwardBadges(userId);
    const codes = awarded.map((b) => b.code);
    expect(codes).toContain("first_action");
    expect(codes).toContain("first_consume");
    // waste_watcher needs 25 consumed interactions — should NOT be awarded with just 1
    expect(codes).not.toContain("waste_watcher");
  });
});

// ── getUserBadgeMetrics ──────────────────────────────────────────────

describe("getUserBadgeMetrics", () => {
  test("metrics count rows not quantity values", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateUserPoints(userId);

    // 3 consumed (qty: 10, 5, 0.5), 2 wasted (qty: 3, 1)
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 10, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 5, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 0.5, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 3, type: "wasted" },
      { userId, productId, todayDate: today, quantity: 1, type: "wasted" },
    ]);

    const metrics = await getUserBadgeMetrics(userId);
    expect(metrics.totalConsumed).toBe(3);
    expect(metrics.totalWasted).toBe(2);
    expect(metrics.totalActions).toBe(3); // consumed + shared + sold
    expect(metrics.totalItems).toBe(5);   // totalActions + totalWasted
    expect(metrics.wasteReductionRate).toBe((3 / 5) * 100); // 60%
  });

  test("mixed action types with various kg quantities", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateUserPoints(userId);

    // 2 consumed, 1 shared, 1 sold, 1 wasted — all with kg-based quantities
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId, productId, todayDate: today, quantity: 3.5, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 12, type: "consumed" },
      { userId, productId, todayDate: today, quantity: 0.75, type: "shared" },
      { userId, productId, todayDate: today, quantity: 8, type: "sold" },
      { userId, productId, todayDate: today, quantity: 25, type: "wasted" },
    ]);

    const metrics = await getUserBadgeMetrics(userId);
    // All counts are per-interaction, not per-kg
    expect(metrics.totalConsumed).toBe(2);
    expect(metrics.totalShared).toBe(1);
    expect(metrics.totalSold).toBe(1);
    expect(metrics.totalWasted).toBe(1);
    expect(metrics.totalActions).toBe(4); // 2+1+1
    expect(metrics.totalItems).toBe(5);   // 4+1
  });
});

// ── getBadgeProgress ─────────────────────────────────────────────────

describe("getBadgeProgress", () => {
  test("returns progress for all defined badge codes", async () => {
    await getOrCreateUserPoints(userId);
    const progress = await getBadgeProgress(userId);

    for (const def of BADGE_DEFINITIONS) {
      expect(progress[def.code]).toBeDefined();
      expect(progress[def.code]).toHaveProperty("current");
      expect(progress[def.code]).toHaveProperty("target");
      expect(progress[def.code]).toHaveProperty("percentage");
    }
  });

  test("percentage is 0 when no progress", async () => {
    await getOrCreateUserPoints(userId);
    const progress = await getBadgeProgress(userId);

    // first_action needs totalActions >= 1, with 0 interactions it should be 0
    expect(progress["first_action"].percentage).toBe(0);
    expect(progress["first_action"].current).toBe(0);

    // eco_starter needs 10 actions
    expect(progress["eco_starter"].percentage).toBe(0);
  });

  test("percentage is 100 when condition is met", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await getOrCreateUserPoints(userId);

    // Add 1 consumed interaction to satisfy first_action and first_consume
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId, productId, todayDate: today, quantity: 1, type: "consumed",
    });

    const progress = await getBadgeProgress(userId);

    expect(progress["first_action"].percentage).toBe(100);
    expect(progress["first_action"].current).toBe(1);
    expect(progress["first_action"].target).toBe(1);

    expect(progress["first_consume"].percentage).toBe(100);
    expect(progress["first_consume"].current).toBe(1);
    expect(progress["first_consume"].target).toBe(1);
  });
});
