import { describe, expect, test, beforeAll, beforeEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";

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

  CREATE TABLE user_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_points INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    total_co2_saved REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    category TEXT NOT NULL DEFAULT 'physical',
    points_cost INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE user_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id INTEGER NOT NULL REFERENCES rewards(id),
    points_spent INTEGER NOT NULL,
    redemption_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    collected_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
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

  CREATE TABLE marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buyer_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    quantity REAL NOT NULL,
    unit TEXT,
    price REAL,
    original_price REAL,
    expiry_date INTEGER,
    pickup_location TEXT,
    images TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER,
    co2_saved REAL
  );
`);

const testDb = drizzle(sqlite, { schema });

// Override the db instance
import { __setTestDb as setDbConnection } from "../../db/connection";
setDbConnection(testDb);

// Import after db override is set up
import {
  getAvailableRewards,
  getUserPointsBalance,
  redeemReward,
  getUserRedemptions,
} from "../reward-service";

// ── Seed data ────────────────────────────────────────────────────────

let userId: number;
let secondUserId: number;

beforeAll(() => {
  // Seed test users
  const userStmt = sqlite.prepare(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id"
  );
  const userRow = userStmt.get("reward-test@eco.com", "hash123", "Reward Tester") as { id: number };
  userId = userRow.id;

  const userRow2 = userStmt.get("reward-test2@eco.com", "hash456", "Reward Tester 2") as { id: number };
  secondUserId = userRow2.id;
});

beforeEach(() => {
  // Clean between tests
  sqlite.exec("DELETE FROM user_redemptions");
  sqlite.exec("DELETE FROM rewards");
  sqlite.exec("DELETE FROM user_points");
  sqlite.exec("DELETE FROM product_sustainability_metrics");
  sqlite.exec("DELETE FROM user_badges");
});

// ── Helper function to give user points via sold interactions ────────────
// Each "sold" interaction with quantity=1, category=produce gives ~3-4 points (minimum 3).
// To get N points, we add enough sold interactions.

function giveUserPoints(uid: number, minPoints: number) {
  // Clear existing data
  sqlite.exec(`DELETE FROM user_points WHERE user_id = ${uid}`);
  sqlite.exec(`DELETE FROM product_sustainability_metrics WHERE user_id = ${uid}`);
  sqlite.exec(`DELETE FROM user_badges WHERE user_id = ${uid}`);
  sqlite.exec(`DELETE FROM user_redemptions WHERE user_id = ${uid}`);

  // Add a product with known CO2 emission to get predictable points
  // sold with co2_emission=2.0 gives: round(2.0 * 1.5) = 3 points each
  const productStmt = sqlite.prepare(
    "INSERT INTO products (user_id, product_name, category, quantity, co2_emission) VALUES (?, ?, ?, ?, ?) RETURNING id"
  );
  const product = productStmt.get(uid, "Test Product", "produce", 1, 2.0) as { id: number };

  // Each sold interaction gives 3 points (CO2 2.0 * 1.5 = 3)
  const pointsPerSale = 3;
  const numSales = Math.ceil(minPoints / pointsPerSale);
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < numSales; i++) {
    sqlite.exec(`
      INSERT INTO product_sustainability_metrics (product_id, user_id, today_date, quantity, type)
      VALUES (${product.id}, ${uid}, '${today}', 1, 'sold');
    `);
  }

  // Initialize user_points record
  sqlite.exec(`INSERT INTO user_points (user_id, total_points) VALUES (${uid}, 0)`);

  return numSales * pointsPerSale;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("getAvailableRewards", () => {
  test("returns empty array when no rewards exist", async () => {
    const rewards = await getAvailableRewards();
    expect(rewards).toEqual([]);
  });

  test("returns only active rewards", async () => {
    sqlite.exec(`
      INSERT INTO rewards (name, description, category, points_cost, stock, is_active)
      VALUES ('Active Reward', 'Test', 'physical', 100, 10, 1);
    `);
    sqlite.exec(`
      INSERT INTO rewards (name, description, category, points_cost, stock, is_active)
      VALUES ('Inactive Reward', 'Test', 'physical', 200, 5, 0);
    `);

    const rewards = await getAvailableRewards();

    expect(rewards.length).toBe(1);
    expect(rewards[0].name).toBe("Active Reward");
  });

  test("returns rewards sorted by points cost", async () => {
    sqlite.exec(`
      INSERT INTO rewards (name, description, category, points_cost, stock, is_active)
      VALUES ('Expensive', 'Test', 'physical', 1000, 10, 1);
    `);
    sqlite.exec(`
      INSERT INTO rewards (name, description, category, points_cost, stock, is_active)
      VALUES ('Cheap', 'Test', 'voucher', 100, 10, 1);
    `);
    sqlite.exec(`
      INSERT INTO rewards (name, description, category, points_cost, stock, is_active)
      VALUES ('Medium', 'Test', 'physical', 500, 10, 1);
    `);

    const rewards = await getAvailableRewards();

    expect(rewards.length).toBe(3);
    expect(rewards[0].name).toBe("Cheap");
    expect(rewards[1].name).toBe("Medium");
    expect(rewards[2].name).toBe("Expensive");
  });

  test("includes all reward fields", async () => {
    sqlite.exec(`
      INSERT INTO rewards (name, description, image_url, category, points_cost, stock, is_active)
      VALUES ('Full Reward', 'Full description', 'http://example.com/img.jpg', 'voucher', 250, 50, 1);
    `);

    const rewards = await getAvailableRewards();

    expect(rewards[0].name).toBe("Full Reward");
    expect(rewards[0].description).toBe("Full description");
    expect(rewards[0].imageUrl).toBe("http://example.com/img.jpg");
    expect(rewards[0].category).toBe("voucher");
    expect(rewards[0].pointsCost).toBe(250);
    expect(rewards[0].stock).toBe(50);
    expect(rewards[0].isActive).toBe(true);
  });
});

describe("getUserPointsBalance", () => {
  test("returns 0 for user with no points or interactions", async () => {
    sqlite.exec(`INSERT INTO user_points (user_id, total_points) VALUES (${userId}, 0)`);
    const balance = await getUserPointsBalance(userId);
    expect(balance).toBe(0);
  });

  test("returns computed points from interactions", async () => {
    const actualPoints = giveUserPoints(userId, 100);

    const balance = await getUserPointsBalance(userId);
    // Points should be at least what we calculated
    expect(balance).toBeGreaterThanOrEqual(actualPoints);
  });

  test("returns different balances for different users", async () => {
    const points1 = giveUserPoints(userId, 50);
    const points2 = giveUserPoints(secondUserId, 100);

    const balance1 = await getUserPointsBalance(userId);
    const balance2 = await getUserPointsBalance(secondUserId);

    expect(balance1).toBeGreaterThanOrEqual(points1);
    expect(balance2).toBeGreaterThanOrEqual(points2);
    expect(balance2).toBeGreaterThan(balance1);
  });
});

describe("redeemReward", () => {
  test("successfully redeems a reward", async () => {
    const actualPoints = giveUserPoints(userId, 100);

    sqlite.exec(`
      INSERT INTO rewards (name, description, category, points_cost, stock, is_active)
      VALUES ('Test Reward', 'Test', 'physical', 50, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Test Reward'").get() as { id: number };

    const result = await redeemReward(userId, rewardId.id);

    expect(result.redemptions.length).toBe(1);
    expect(result.redemptions[0].redemptionCode).toMatch(/^EP-[A-Z0-9]{8}$/);
    expect(result.redemptions[0].pointsSpent).toBe(50);
    expect(result.totalPointsSpent).toBe(50);
    expect(result.quantity).toBe(1);
    expect(result.reward.name).toBe("Test Reward");
  });

  test("redeems multiple quantities", async () => {
    giveUserPoints(userId, 500);

    sqlite.exec(`
      INSERT INTO rewards (name, description, category, points_cost, stock, is_active)
      VALUES ('Multi Reward', 'Test', 'physical', 30, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Multi Reward'").get() as { id: number };

    const result = await redeemReward(userId, rewardId.id, 3);

    expect(result.redemptions.length).toBe(3);
    expect(result.totalPointsSpent).toBe(90);
    expect(result.quantity).toBe(3);
  });

  test("deducts points from user balance", async () => {
    const initialPoints = giveUserPoints(userId, 200);

    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('Deduct Test', 'physical', 50, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Deduct Test'").get() as { id: number };

    const balanceBefore = await getUserPointsBalance(userId);
    await redeemReward(userId, rewardId.id);
    const balanceAfter = await getUserPointsBalance(userId);

    expect(balanceAfter).toBe(balanceBefore - 50);
  });

  test("decreases reward stock", async () => {
    giveUserPoints(userId, 100);

    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('Stock Test', 'physical', 20, 5, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Stock Test'").get() as { id: number };

    await redeemReward(userId, rewardId.id, 2);

    const reward = sqlite.query(`SELECT stock FROM rewards WHERE id = ${rewardId.id}`).get() as { stock: number };
    expect(reward.stock).toBe(3);
  });

  test("throws error for non-existent reward", async () => {
    giveUserPoints(userId, 100);
    await expect(redeemReward(userId, 9999)).rejects.toThrow("Reward not found");
  });

  test("throws error for inactive reward", async () => {
    giveUserPoints(userId, 100);

    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('Inactive Test', 'physical', 20, 10, 0);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Inactive Test'").get() as { id: number };

    await expect(redeemReward(userId, rewardId.id)).rejects.toThrow("Reward is not available");
  });

  test("throws error for out of stock reward", async () => {
    giveUserPoints(userId, 100);

    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('No Stock', 'physical', 20, 0, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'No Stock'").get() as { id: number };

    await expect(redeemReward(userId, rewardId.id)).rejects.toThrow("Reward is out of stock");
  });

  test("throws error for insufficient stock when redeeming multiple", async () => {
    giveUserPoints(userId, 500);

    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('Low Stock', 'physical', 20, 2, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Low Stock'").get() as { id: number };

    await expect(redeemReward(userId, rewardId.id, 5)).rejects.toThrow("Reward is out of stock");
  });

  test("throws error for insufficient points", async () => {
    giveUserPoints(userId, 50);

    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('Expensive', 'physical', 1000, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Expensive'").get() as { id: number };

    await expect(redeemReward(userId, rewardId.id)).rejects.toThrow("Insufficient points");
  });

  test("creates redemption with correct expiry date", async () => {
    giveUserPoints(userId, 100);

    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('Expiry Test', 'physical', 30, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Expiry Test'").get() as { id: number };

    const result = await redeemReward(userId, rewardId.id);

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Expiry should be approximately 30 days from now (within 1 day tolerance)
    const expiryDate = result.redemptions[0].expiresAt;
    expect(expiryDate).toBeDefined();
    const diff = Math.abs(new Date(expiryDate!).getTime() - thirtyDaysLater.getTime());
    expect(diff).toBeLessThan(24 * 60 * 60 * 1000); // Within 1 day
  });

  test("generates unique redemption codes for multiple quantities", async () => {
    giveUserPoints(userId, 300);

    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('Unique Code Test', 'physical', 30, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Unique Code Test'").get() as { id: number };

    const result = await redeemReward(userId, rewardId.id, 3);

    const codes = result.redemptions.map((r) => r.redemptionCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(3);
  });
});

describe("getUserRedemptions", () => {
  test("returns empty array for user with no redemptions", async () => {
    const redemptions = await getUserRedemptions(userId);
    expect(redemptions).toEqual([]);
  });

  test("returns user's redemptions with reward details", async () => {
    sqlite.exec(`
      INSERT INTO rewards (name, description, image_url, category, points_cost, stock, is_active)
      VALUES ('Redemption Test', 'Test description', 'http://test.com/img.jpg', 'voucher', 500, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Redemption Test'").get() as { id: number };

    sqlite.exec(`
      INSERT INTO user_redemptions (user_id, reward_id, points_spent, redemption_code, status)
      VALUES (${userId}, ${rewardId.id}, 500, 'EP-TEST1234', 'pending');
    `);

    const redemptions = await getUserRedemptions(userId);

    expect(redemptions.length).toBe(1);
    expect(redemptions[0].redemptionCode).toBe("EP-TEST1234");
    expect(redemptions[0].pointsSpent).toBe(500);
    expect(redemptions[0].status).toBe("pending");
    expect(redemptions[0].reward.name).toBe("Redemption Test");
    expect(redemptions[0].reward.description).toBe("Test description");
    expect(redemptions[0].reward.category).toBe("voucher");
  });

  test("returns only current user's redemptions", async () => {
    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('User Test', 'physical', 100, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'User Test'").get() as { id: number };

    sqlite.exec(`
      INSERT INTO user_redemptions (user_id, reward_id, points_spent, redemption_code, status)
      VALUES (${userId}, ${rewardId.id}, 100, 'EP-USER1111', 'pending');
    `);
    sqlite.exec(`
      INSERT INTO user_redemptions (user_id, reward_id, points_spent, redemption_code, status)
      VALUES (${secondUserId}, ${rewardId.id}, 100, 'EP-USER2222', 'pending');
    `);

    const redemptions = await getUserRedemptions(userId);

    expect(redemptions.length).toBe(1);
    expect(redemptions[0].redemptionCode).toBe("EP-USER1111");
  });

  test("returns multiple redemptions sorted by creation date (newest first)", async () => {
    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('Sort Test', 'physical', 100, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Sort Test'").get() as { id: number };

    // Insert with specific timestamps to ensure order
    sqlite.exec(`
      INSERT INTO user_redemptions (user_id, reward_id, points_spent, redemption_code, status, created_at)
      VALUES (${userId}, ${rewardId.id}, 100, 'EP-OLDER', 'pending', unixepoch() - 1000);
    `);
    sqlite.exec(`
      INSERT INTO user_redemptions (user_id, reward_id, points_spent, redemption_code, status, created_at)
      VALUES (${userId}, ${rewardId.id}, 100, 'EP-NEWER', 'pending', unixepoch());
    `);

    const redemptions = await getUserRedemptions(userId);

    expect(redemptions.length).toBe(2);
    expect(redemptions[0].redemptionCode).toBe("EP-NEWER");
    expect(redemptions[1].redemptionCode).toBe("EP-OLDER");
  });

  test("returns redemptions with different statuses", async () => {
    sqlite.exec(`
      INSERT INTO rewards (name, category, points_cost, stock, is_active)
      VALUES ('Status Test', 'physical', 100, 10, 1);
    `);
    const rewardId = sqlite.query("SELECT id FROM rewards WHERE name = 'Status Test'").get() as { id: number };

    sqlite.exec(`
      INSERT INTO user_redemptions (user_id, reward_id, points_spent, redemption_code, status)
      VALUES (${userId}, ${rewardId.id}, 100, 'EP-PENDING', 'pending');
    `);
    sqlite.exec(`
      INSERT INTO user_redemptions (user_id, reward_id, points_spent, redemption_code, status, collected_at)
      VALUES (${userId}, ${rewardId.id}, 100, 'EP-COLLECTED', 'collected', unixepoch());
    `);

    const redemptions = await getUserRedemptions(userId);

    expect(redemptions.length).toBe(2);
    const statuses = redemptions.map((r) => r.status);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("collected");
  });
});
