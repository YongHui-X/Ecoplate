import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq, and, gte } from "drizzle-orm";
import * as schema from "../../db/schema";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;

type Period = "day" | "month" | "annual";

// Simplified implementation of dashboard service for testing
function getDateRange(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    case "month":
      return new Date(now.getFullYear() - 1, now.getMonth(), 1);
    case "annual":
      return new Date(now.getFullYear() - 5, 0, 1);
  }
}

function formatDate(date: Date, period: Period): string {
  switch (period) {
    case "day":
      return date.toISOString().slice(0, 10);
    case "month":
      return date.toISOString().slice(0, 7);
    case "annual":
      return date.getFullYear().toString();
  }
}

async function getDashboardStats(
  db: typeof testDb,
  userId: number,
  period: Period = "month"
) {
  const rangeStart = getDateRange(period);
  const rangeStartStr = rangeStart.toISOString().slice(0, 10);

  const metrics = await db.query.productSustainabilityMetrics.findMany({
    where: and(
      eq(schema.productSustainabilityMetrics.userId, userId),
      gte(schema.productSustainabilityMetrics.todayDate, rangeStartStr)
    ),
  });

  const products = await db.query.products.findMany({
    where: eq(schema.products.userId, userId),
  });

  const soldListings = await db.query.marketplaceListings.findMany({
    where: and(
      eq(schema.marketplaceListings.sellerId, userId),
      eq(schema.marketplaceListings.status, "sold"),
      gte(schema.marketplaceListings.completedAt, rangeStart)
    ),
  });

  const positiveMetrics = metrics.filter(
    (m) => m.type === "consumed" || m.type === "sold" || m.type === "shared"
  );

  let totalCo2Reduced = 0;
  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const m of positiveMetrics) {
    if (m.productId == null || m.quantity == null) continue;
    const product = productMap.get(m.productId);
    if (product?.co2Emission && product.quantity > 0) {
      totalCo2Reduced += product.co2Emission * (m.quantity / product.quantity);
    }
  }

  const totalFoodSaved = positiveMetrics.reduce((sum, m) => sum + (m.quantity ?? 0), 0);
  const totalMoneySaved = soldListings.reduce((sum, l) => sum + (l.price || 0), 0);

  const co2Map = new Map<string, number>();
  const foodMap = new Map<string, number>();

  for (const m of positiveMetrics) {
    const dateObj = new Date(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const product = m.productId != null ? productMap.get(m.productId) : undefined;
    const mQuantity = m.quantity ?? 0;
    const co2 =
      product?.co2Emission && product.quantity > 0
        ? product.co2Emission * (mQuantity / product.quantity)
        : 0;

    co2Map.set(dateKey, (co2Map.get(dateKey) || 0) + co2);
    foodMap.set(dateKey, (foodMap.get(dateKey) || 0) + mQuantity);
  }

  const co2ChartData = Array.from(co2Map.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const foodChartData = Array.from(foodMap.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const impactEquivalence = {
    carKmAvoided: Math.round(totalCo2Reduced * 6.0 * 10) / 10,
    treesPlanted: Math.round((totalCo2Reduced / 21.0) * 10) / 10,
    electricitySaved: Math.round(totalCo2Reduced * 3.6 * 10) / 10,
  };

  return {
    summary: {
      totalCo2Reduced: Math.round(totalCo2Reduced * 100) / 100,
      totalFoodSaved: Math.round(totalFoodSaved * 100) / 100,
      totalMoneySaved: Math.round(totalMoneySaved * 100) / 100,
    },
    co2ChartData,
    foodChartData,
    impactEquivalence,
  };
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

    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      category TEXT,
      quantity REAL NOT NULL DEFAULT 1,
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

  testDb = drizzle(sqlite, { schema });

  // Seed test user
  const [user] = await testDb
    .insert(schema.users)
    .values({
      email: "test@example.com",
      passwordHash: "hashed",
      name: "Test User",
    })
    .returning();
  testUserId = user.id;
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  await testDb.delete(schema.productSustainabilityMetrics);
  await testDb.delete(schema.marketplaceListings);
  await testDb.delete(schema.products);
});

describe("getDateRange", () => {
  test("returns date 30 days ago for day period", () => {
    const range = getDateRange("day");
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

    expect(range.getFullYear()).toBe(expected.getFullYear());
    expect(range.getMonth()).toBe(expected.getMonth());
    expect(range.getDate()).toBe(expected.getDate());
  });

  test("returns date 12 months ago for month period", () => {
    const range = getDateRange("month");
    const now = new Date();
    const expected = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    expect(range.getFullYear()).toBe(expected.getFullYear());
    expect(range.getMonth()).toBe(expected.getMonth());
  });

  test("returns date 5 years ago for annual period", () => {
    const range = getDateRange("annual");
    const now = new Date();
    const expected = new Date(now.getFullYear() - 5, 0, 1);

    expect(range.getFullYear()).toBe(expected.getFullYear());
    expect(range.getMonth()).toBe(0);
    expect(range.getDate()).toBe(1);
  });
});

describe("formatDate", () => {
  test("formats date as YYYY-MM-DD for day period", () => {
    const date = new Date("2025-01-15");
    const formatted = formatDate(date, "day");

    expect(formatted).toBe("2025-01-15");
  });

  test("formats date as YYYY-MM for month period", () => {
    const date = new Date("2025-01-15");
    const formatted = formatDate(date, "month");

    expect(formatted).toBe("2025-01");
  });

  test("formats date as YYYY for annual period", () => {
    const date = new Date("2025-01-15");
    const formatted = formatDate(date, "annual");

    expect(formatted).toBe("2025");
  });
});

describe("getDashboardStats", () => {
  test("returns zero stats for user with no activity", async () => {
    const stats = await getDashboardStats(testDb, testUserId);

    expect(stats.summary.totalCo2Reduced).toBe(0);
    expect(stats.summary.totalFoodSaved).toBe(0);
    expect(stats.summary.totalMoneySaved).toBe(0);
    expect(stats.co2ChartData).toEqual([]);
    expect(stats.foodChartData).toEqual([]);
  });

  test("calculates total food saved from positive metrics", async () => {
    const today = new Date().toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: today, type: "consumed", quantity: 2 },
      { userId: testUserId, todayDate: today, type: "shared", quantity: 1 },
      { userId: testUserId, todayDate: today, type: "sold", quantity: 3 },
    ]);

    const stats = await getDashboardStats(testDb, testUserId);

    expect(stats.summary.totalFoodSaved).toBe(6);
  });

  test("ignores wasted metrics in food saved calculation", async () => {
    const today = new Date().toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: today, type: "consumed", quantity: 5 },
      { userId: testUserId, todayDate: today, type: "wasted", quantity: 3 },
    ]);

    const stats = await getDashboardStats(testDb, testUserId);

    expect(stats.summary.totalFoodSaved).toBe(5);
  });

  test("calculates CO2 reduced from products", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Create a product with CO2 emission
    const [product] = await testDb
      .insert(schema.products)
      .values({
        userId: testUserId,
        productName: "Beef",
        quantity: 10,
        co2Emission: 27.0, // 27kg CO2 for 10 units
      })
      .returning();

    // Consume 5 units (half the product)
    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId: testUserId,
      productId: product.id,
      todayDate: today,
      type: "consumed",
      quantity: 5,
    });

    const stats = await getDashboardStats(testDb, testUserId);

    // 27 * (5/10) = 13.5 kg CO2 reduced
    expect(stats.summary.totalCo2Reduced).toBe(13.5);
  });

  test("calculates money saved from sold listings", async () => {
    const now = new Date();

    await testDb.insert(schema.marketplaceListings).values([
      {
        sellerId: testUserId,
        title: "Item 1",
        quantity: 1,
        price: 15.0,
        status: "sold",
        completedAt: now,
      },
      {
        sellerId: testUserId,
        title: "Item 2",
        quantity: 1,
        price: 25.0,
        status: "sold",
        completedAt: now,
      },
    ]);

    const stats = await getDashboardStats(testDb, testUserId);

    expect(stats.summary.totalMoneySaved).toBe(40);
  });

  test("ignores active listings in money saved", async () => {
    await testDb.insert(schema.marketplaceListings).values([
      {
        sellerId: testUserId,
        title: "Active Item",
        quantity: 1,
        price: 100.0,
        status: "active",
      },
    ]);

    const stats = await getDashboardStats(testDb, testUserId);

    expect(stats.summary.totalMoneySaved).toBe(0);
  });

  test("builds CO2 chart data grouped by date", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().slice(0, 10);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const [product] = await testDb
      .insert(schema.products)
      .values({
        userId: testUserId,
        productName: "Test",
        quantity: 10,
        co2Emission: 10.0,
      })
      .returning();

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, productId: product.id, todayDate: todayStr, type: "consumed", quantity: 2 },
      { userId: testUserId, productId: product.id, todayDate: yesterdayStr, type: "consumed", quantity: 3 },
    ]);

    const stats = await getDashboardStats(testDb, testUserId, "day");

    expect(stats.co2ChartData.length).toBe(2);
    expect(stats.co2ChartData.some((d) => d.date === todayStr)).toBe(true);
    expect(stats.co2ChartData.some((d) => d.date === yesterdayStr)).toBe(true);
  });

  test("builds food chart data grouped by date", async () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: todayStr, type: "consumed", quantity: 5 },
      { userId: testUserId, todayDate: todayStr, type: "shared", quantity: 3 },
    ]);

    const stats = await getDashboardStats(testDb, testUserId, "day");

    expect(stats.foodChartData.length).toBe(1);
    expect(stats.foodChartData[0].date).toBe(todayStr);
    expect(stats.foodChartData[0].value).toBe(8);
  });

  test("groups by month for month period", async () => {
    // Use relative dates to ensure they're within the range
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10);

    const thisMonthStr = thisMonth.toISOString().slice(0, 10);
    const thisMonth15 = new Date(now.getFullYear(), now.getMonth(), 20).toISOString().slice(0, 10);
    const lastMonthStr = lastMonth.toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: thisMonthStr, type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: thisMonth15, type: "consumed", quantity: 2 },
      { userId: testUserId, todayDate: lastMonthStr, type: "consumed", quantity: 3 },
    ]);

    const stats = await getDashboardStats(testDb, testUserId, "month");

    // Should have 2 months
    expect(stats.foodChartData.length).toBe(2);

    const thisMonthKey = thisMonth.toISOString().slice(0, 7);
    const lastMonthKey = lastMonth.toISOString().slice(0, 7);

    const thisMonthData = stats.foodChartData.find((d) => d.date === thisMonthKey);
    const lastMonthData = stats.foodChartData.find((d) => d.date === lastMonthKey);

    expect(thisMonthData?.value).toBe(3); // 1 + 2
    expect(lastMonthData?.value).toBe(3);
  });

  test("calculates impact equivalence", async () => {
    const today = new Date().toISOString().slice(0, 10);

    const [product] = await testDb
      .insert(schema.products)
      .values({
        userId: testUserId,
        productName: "Test",
        quantity: 10,
        co2Emission: 21.0, // 21 kg CO2 = 1 tree equivalent
      })
      .returning();

    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId: testUserId,
      productId: product.id,
      todayDate: today,
      type: "consumed",
      quantity: 10,
    });

    const stats = await getDashboardStats(testDb, testUserId);

    expect(stats.summary.totalCo2Reduced).toBe(21);
    expect(stats.impactEquivalence.treesPlanted).toBe(1);
    expect(stats.impactEquivalence.carKmAvoided).toBe(126); // 21 * 6
    expect(stats.impactEquivalence.electricitySaved).toBe(75.6); // 21 * 3.6
  });

  test("handles null quantities gracefully", async () => {
    const today = new Date().toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId: testUserId,
      todayDate: today,
      type: "consumed",
      quantity: null,
    });

    const stats = await getDashboardStats(testDb, testUserId);

    expect(stats.summary.totalFoodSaved).toBe(0);
  });

  test("handles null product IDs gracefully", async () => {
    const today = new Date().toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId: testUserId,
      productId: null,
      todayDate: today,
      type: "consumed",
      quantity: 5,
    });

    const stats = await getDashboardStats(testDb, testUserId);

    // Should still count the food saved even without product ID
    expect(stats.summary.totalFoodSaved).toBe(5);
    // But CO2 should be 0 since there's no product to link
    expect(stats.summary.totalCo2Reduced).toBe(0);
  });

  test("filters metrics by date range", async () => {
    const today = new Date();
    const oldDate = new Date(today);
    oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago

    const todayStr = today.toISOString().slice(0, 10);
    const oldDateStr = oldDate.toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: todayStr, type: "consumed", quantity: 5 },
      { userId: testUserId, todayDate: oldDateStr, type: "consumed", quantity: 10 },
    ]);

    const statsMonth = await getDashboardStats(testDb, testUserId, "month");
    const statsAnnual = await getDashboardStats(testDb, testUserId, "annual");

    // Month period (last 12 months) should only include today's metric
    expect(statsMonth.summary.totalFoodSaved).toBe(5);

    // Annual period (last 5 years) should include both
    expect(statsAnnual.summary.totalFoodSaved).toBe(15);
  });

  test("rounds values to 2 decimal places", async () => {
    const today = new Date().toISOString().slice(0, 10);

    await testDb.insert(schema.productSustainabilityMetrics).values({
      userId: testUserId,
      todayDate: today,
      type: "consumed",
      quantity: 3.333333,
    });

    const stats = await getDashboardStats(testDb, testUserId);

    expect(stats.summary.totalFoodSaved).toBe(3.33);
  });
});
