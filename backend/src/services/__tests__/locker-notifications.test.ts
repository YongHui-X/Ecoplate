import { describe, expect, test, beforeAll, beforeEach, afterAll } from "bun:test";
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

  CREATE TABLE rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    category TEXT NOT NULL,
    points_cost INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE user_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    points_spent INTEGER NOT NULL,
    redemption_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    collected_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
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

  CREATE TABLE lockers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    coordinates TEXT NOT NULL,
    total_compartments INTEGER NOT NULL DEFAULT 12,
    available_compartments INTEGER NOT NULL DEFAULT 12,
    operating_hours TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT,
    category TEXT,
    images TEXT,
    pickup_location TEXT,
    original_price REAL,
    expiry_date INTEGER,
    product_id INTEGER REFERENCES products(id),
    seller_id INTEGER NOT NULL REFERENCES users(id),
    buyer_id INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'active',
    co2_saved REAL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER
  );

  CREATE TABLE locker_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id),
    locker_id INTEGER NOT NULL REFERENCES lockers(id),
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER NOT NULL REFERENCES users(id),
    item_price REAL NOT NULL,
    delivery_fee REAL NOT NULL DEFAULT 2.0,
    total_price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_payment',
    reserved_at INTEGER NOT NULL DEFAULT (unixepoch()),
    payment_deadline INTEGER,
    paid_at INTEGER,
    pickup_scheduled_at INTEGER,
    rider_picked_up_at INTEGER,
    delivered_at INTEGER,
    picked_up_at INTEGER,
    expires_at INTEGER,
    pickup_pin TEXT,
    compartment_number INTEGER,
    cancel_reason TEXT
  );

  CREATE TABLE locker_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_id INTEGER NOT NULL REFERENCES locker_orders(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const testDb = drizzle(sqlite, { schema });

// Override the db instance before importing services
import { __setTestDb } from "../../db/connection";
__setTestDb(testDb);

// Dynamic imports so they pick up the test DB
const { confirmRiderPickup } = await import("../locker-service");

// ── Test data ────────────────────────────────────────────────────────

let buyerId: number;
let sellerId: number;

beforeAll(() => {
  const userStmt = sqlite.prepare(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id"
  );
  const buyer = userStmt.get("buyer@test.com", "hash1", "Test Buyer") as { id: number };
  buyerId = buyer.id;
  const seller = userStmt.get("seller@test.com", "hash2", "Test Seller") as { id: number };
  sellerId = seller.id;

  sqlite.prepare(
    "INSERT INTO lockers (id, name, address, coordinates, total_compartments, available_compartments, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(1, "Test Locker", "123 Test St", "1.3521,103.8198", 12, 10, "active");
});

beforeEach(() => {
  sqlite.exec("DELETE FROM locker_notifications");
  sqlite.exec("DELETE FROM notifications");
  sqlite.exec("DELETE FROM locker_orders");
  sqlite.exec("DELETE FROM marketplace_listings");
  sqlite.exec("DELETE FROM product_sustainability_metrics");
  sqlite.exec("DELETE FROM user_points");
  sqlite.exec("DELETE FROM user_badges");
});

afterAll(() => {
  sqlite.close();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("confirmRiderPickup notifications", () => {
  test("awards points and notifications do not contain specific point numbers", async () => {
    // Create a listing with co2Saved
    sqlite.prepare(
      "INSERT INTO marketplace_listings (id, title, price, quantity, seller_id, buyer_id, status, co2_saved, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(1, "Test Food Item", 10.0, 1, sellerId, buyerId, "reserved", 3.3, "dairy");

    // Create a locker order in pickup_scheduled state
    sqlite.prepare(
      `INSERT INTO locker_orders (id, listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(1, 1, 1, buyerId, sellerId, 10.0, 2.0, 12.0, "pickup_scheduled");

    // Call the actual function
    const result = await confirmRiderPickup(1, sellerId);

    // Points should be awarded
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBeGreaterThan(0);

    // Check locker notifications for the seller
    const lockerNotifs = await testDb.query.lockerNotifications.findMany({
      where: eq(schema.lockerNotifications.orderId, 1),
    });

    const pointsNotif = lockerNotifs.find((n) => n.type === "points_earned");
    expect(pointsNotif).toBeDefined();
    expect(pointsNotif!.message).toBe("You earned EcoPoints for this sale!");
    // Should NOT contain any digit (no specific point number)
    expect(pointsNotif!.message).not.toMatch(/\d/);

    // Check main (bell) notifications for the seller
    const mainNotifs = await testDb.query.notifications.findMany({
      where: eq(schema.notifications.userId, sellerId),
    });

    const bellPointsNotif = mainNotifs.find((n) => n.type === "locker_points_earned");
    expect(bellPointsNotif).toBeDefined();
    expect(bellPointsNotif!.message).toBe("You earned EcoPoints for your sale!");
    // Should NOT contain any digit (no specific point number)
    expect(bellPointsNotif!.message).not.toMatch(/\d/);
  });

  test("order transitions to in_transit status", async () => {
    sqlite.prepare(
      "INSERT INTO marketplace_listings (id, title, price, quantity, seller_id, buyer_id, status, co2_saved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(2, "Another Item", 5.0, 1, sellerId, buyerId, "reserved", 2.0);

    sqlite.prepare(
      `INSERT INTO locker_orders (id, listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(2, 2, 1, buyerId, sellerId, 5.0, 2.0, 7.0, "pickup_scheduled");

    const result = await confirmRiderPickup(2, sellerId);

    expect(result.success).toBe(true);
    expect(result.order?.status).toBe("in_transit");
    expect(result.order?.riderPickedUpAt).toBeDefined();
  });

  test("buyer receives in-transit notification", async () => {
    sqlite.prepare(
      "INSERT INTO marketplace_listings (id, title, price, quantity, seller_id, buyer_id, status, co2_saved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(3, "Third Item", 8.0, 1, sellerId, buyerId, "reserved", 1.5);

    sqlite.prepare(
      `INSERT INTO locker_orders (id, listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(3, 3, 1, buyerId, sellerId, 8.0, 2.0, 10.0, "pickup_scheduled");

    await confirmRiderPickup(3, sellerId);

    const buyerNotifs = await testDb.query.lockerNotifications.findMany({
      where: eq(schema.lockerNotifications.userId, buyerId),
    });

    const transitNotif = buyerNotifs.find((n) => n.type === "item_in_transit");
    expect(transitNotif).toBeDefined();
    expect(transitNotif!.title).toBe("Item In Transit");
  });
});
