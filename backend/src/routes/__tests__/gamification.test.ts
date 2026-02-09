import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router, json } from "../../utils/router";
import * as schema from "../../db/schema";
import { eq, desc } from "drizzle-orm";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;
let secondUserId: number;

const POINT_VALUES = {
  consumed: 5,
  shared: 10,
  sold: 8,
  wasted: -3,
} as const;

// Simplified route registration for testing
function registerTestGamificationRoutes(
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

  // Get user points
  router.get("/api/v1/gamification/points", async (req) => {
    const user = getUser(req);

    let points = await db.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, user.id),
    });

    if (!points) {
      const [created] = await db
        .insert(schema.userPoints)
        .values({ userId: user.id })
        .returning();
      points = created;
    }

    const recentInteractions = await db.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, user.id),
      orderBy: [desc(schema.productSustainabilityMetrics.todayDate)],
      limit: 20,
    });

    const transactions = recentInteractions
      .filter((i) => i.type !== "Add")
      .map((i) => {
        const baseAmount = POINT_VALUES[i.type as keyof typeof POINT_VALUES] ?? 0;
        const scaled = Math.round(baseAmount * (i.quantity ?? 1));
        const amount = scaled === 0 ? Math.sign(baseAmount) : scaled;
        return {
          id: i.id,
          amount,
          type: amount < 0 ? "penalty" : "earned",
          action: i.type,
          createdAt: i.todayDate,
          quantity: i.quantity ?? 1,
        };
      });

    return json({
      points: {
        total: points.totalPoints,
        available: points.totalPoints,
        lifetime: points.totalPoints,
        currentStreak: points.currentStreak,
        longestStreak: 0, // Simplified for tests
      },
      stats: {
        totalActiveDays: 0,
        lastActiveDate: null,
        firstActivityDate: null,
        pointsToday: 0,
        pointsThisWeek: 0,
        pointsThisMonth: 0,
        bestDayPoints: 0,
        averagePointsPerActiveDay: 0,
      },
      breakdown: {},
      pointsByMonth: [],
      transactions,
    });
  });

  // Get user metrics
  router.get("/api/v1/gamification/metrics", async (req) => {
    const user = getUser(req);

    const interactions = await db.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, user.id),
    });

    const metrics = {
      totalItemsConsumed: 0,
      totalItemsWasted: 0,
      totalItemsShared: 0,
      totalItemsSold: 0,
    };

    for (const interaction of interactions) {
      switch (interaction.type) {
        case "consumed":
          metrics.totalItemsConsumed++;
          break;
        case "wasted":
          metrics.totalItemsWasted++;
          break;
        case "shared":
          metrics.totalItemsShared++;
          break;
        case "sold":
          metrics.totalItemsSold++;
          break;
      }
    }

    const totalItems =
      metrics.totalItemsConsumed +
      metrics.totalItemsWasted +
      metrics.totalItemsShared +
      metrics.totalItemsSold;

    const itemsSaved =
      metrics.totalItemsConsumed + metrics.totalItemsShared + metrics.totalItemsSold;

    const wasteReductionRate = totalItems > 0 ? (itemsSaved / totalItems) * 100 : 100;

    return json({
      ...metrics,
      wasteReductionRate,
      estimatedCo2Saved: itemsSaved * 0.5,
      estimatedMoneySaved: itemsSaved * 5,
    });
  });

  // Get leaderboard
  router.get("/api/v1/gamification/leaderboard", async () => {
    const allUserPoints = await db.query.userPoints.findMany({
      with: {
        user: {
          columns: { id: true, name: true },
        },
      },
      orderBy: [desc(schema.userPoints.totalPoints)],
      limit: 10,
    });

    const leaderboard = allUserPoints.map((up, index) => ({
      rank: index + 1,
      userId: up.userId,
      name: up.user?.name || "Unknown",
      points: up.totalPoints,
      streak: up.currentStreak,
    }));

    return json(leaderboard);
  });

  // Get badges
  router.get("/api/v1/gamification/badges", async (req) => {
    const user = getUser(req);

    const allBadges = await db.query.badges.findMany({
      orderBy: [schema.badges.sortOrder],
    });

    const earnedBadges = await db.query.userBadges.findMany({
      where: eq(schema.userBadges.userId, user.id),
    });

    const earnedBadgeIds = new Set(earnedBadges.map((ub) => ub.badgeId));

    const badgesWithStatus = allBadges.map((badge) => ({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      pointsAwarded: badge.pointsAwarded,
      imageUrl: badge.badgeImageUrl,
      earned: earnedBadgeIds.has(badge.id),
      earnedAt: earnedBadges.find((ub) => ub.badgeId === badge.id)?.earnedAt || null,
      progress: null,
    }));

    return json({
      badges: badgesWithStatus,
      totalEarned: earnedBadges.length,
      totalAvailable: allBadges.length,
    });
  });

  // Get dashboard
  router.get("/api/v1/gamification/dashboard", async (req) => {
    const user = getUser(req);

    const userProducts = await db.query.products.findMany({
      where: eq(schema.products.userId, user.id),
    });

    const userListings = await db.query.marketplaceListings.findMany({
      where: eq(schema.marketplaceListings.sellerId, user.id),
    });

    const activeListings = userListings.filter((l) => l.status === "active");
    const soldListings = userListings.filter((l) => l.status === "completed");

    let points = await db.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, user.id),
    });

    if (!points) {
      const [created] = await db
        .insert(schema.userPoints)
        .values({ userId: user.id })
        .returning();
      points = created;
    }

    return json({
      products: {
        total: userProducts.length,
      },
      listings: {
        active: activeListings.length,
        sold: soldListings.length,
      },
      gamification: {
        points: points.totalPoints,
        streak: points.currentStreak,
        wasteReductionRate: 100,
        co2Saved: 0,
      },
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

    CREATE TABLE user_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      total_points INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      total_co2_saved REAL NOT NULL DEFAULT 0
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
      earned_at INTEGER NOT NULL DEFAULT (unixepoch())
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

  // Seed test badges
  await testDb.insert(schema.badges).values([
    {
      code: "first_action",
      name: "First Steps",
      description: "Complete your first sustainability action",
      category: "milestones",
      pointsAwarded: 25,
      sortOrder: 1,
    },
    {
      code: "eco_starter",
      name: "Eco Starter",
      description: "Complete 10 sustainability actions",
      category: "milestones",
      pointsAwarded: 50,
      sortOrder: 2,
    },
  ]);
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  // Clear data before each test
  await testDb.delete(schema.productSustainabilityMetrics);
  await testDb.delete(schema.userBadges);
  await testDb.delete(schema.userPoints);
  await testDb.delete(schema.marketplaceListings);
  await testDb.delete(schema.products);
});

function createRouter(userId: number = testUserId) {
  const router = new Router();
  registerTestGamificationRoutes(router, testDb, userId);
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

describe("GET /api/v1/gamification/points", () => {
  test("returns initial points for new user", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/points");

    expect(res.status).toBe(200);
    const data = res.data as {
      points: { total: number; currentStreak: number };
      transactions: unknown[];
    };
    expect(data.points).toBeDefined();
    expect(data.points.total).toBe(0);
    expect(data.points.currentStreak).toBe(0);
    expect(data.transactions).toEqual([]);
  });

  test("creates userPoints record if not exists", async () => {
    const router = createRouter();
    await makeRequest(router, "GET", "/api/v1/gamification/points");

    const points = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, testUserId),
    });

    expect(points).toBeDefined();
    expect(points?.totalPoints).toBe(0);
  });

  test("returns user points with correct values", async () => {
    // Create user points with some values
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 100,
      currentStreak: 5,
    });

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/points");

    expect(res.status).toBe(200);
    const data = res.data as { points: { total: number; currentStreak: number } };
    expect(data.points.total).toBe(100);
    expect(data.points.currentStreak).toBe(5);
  });

  test("returns recent transactions", async () => {
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 50,
    });

    // Create some interactions
    await testDb.insert(schema.productSustainabilityMetrics).values([
      {
        userId: testUserId,
        todayDate: "2025-01-15",
        type: "consumed",
        quantity: 1,
      },
      {
        userId: testUserId,
        todayDate: "2025-01-14",
        type: "wasted",
        quantity: 1,
      },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/points");

    expect(res.status).toBe(200);
    const data = res.data as { transactions: Array<{ action: string; amount: number; type: string }> };
    expect(data.transactions.length).toBe(2);

    const consumedTx = data.transactions.find((t) => t.action === "consumed");
    expect(consumedTx?.amount).toBe(5);
    expect(consumedTx?.type).toBe("earned");

    const wastedTx = data.transactions.find((t) => t.action === "wasted");
    expect(wastedTx?.amount).toBe(-3);
    expect(wastedTx?.type).toBe("penalty");
  });

  test("filters out Add transactions", async () => {
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
    });

    await testDb.insert(schema.productSustainabilityMetrics).values([
      {
        userId: testUserId,
        todayDate: "2025-01-15",
        type: "Add",
        quantity: 1,
      },
      {
        userId: testUserId,
        todayDate: "2025-01-15",
        type: "consumed",
        quantity: 1,
      },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/points");

    const data = res.data as { transactions: Array<{ action: string }> };
    expect(data.transactions.length).toBe(1);
    expect(data.transactions[0].action).toBe("consumed");
  });

  test("transactions with fractional qty show scaled values", async () => {
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 50,
    });

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 0.2 },
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 0.3 },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/points");

    const data = res.data as { transactions: Array<{ action: string; amount: number }> };
    const consumedTx = data.transactions.find((t) => t.action === "consumed");
    expect(consumedTx?.amount).toBe(1); // 5 × 0.2 = 1

    const wastedTx = data.transactions.find((t) => t.action === "wasted");
    expect(wastedTx?.amount).toBe(-1); // Math.round(-3 × 0.3) = -1
  });

  test("transactions for consume, wasted, sold show correct amounts", async () => {
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 100,
    });

    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 3 },
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 5 },
      { userId: testUserId, todayDate: "2025-01-15", type: "sold", quantity: 1 },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/points");

    const data = res.data as { transactions: Array<{ action: string; amount: number; type: string }> };
    const consumedTx = data.transactions.find((t) => t.action === "consumed");
    expect(consumedTx?.amount).toBe(15); // 5 * 3
    expect(consumedTx?.type).toBe("earned");

    const wastedTx = data.transactions.find((t) => t.action === "wasted");
    expect(wastedTx?.amount).toBe(-15); // -3 * 5
    expect(wastedTx?.type).toBe("penalty");

    const soldTx = data.transactions.find((t) => t.action === "sold");
    expect(soldTx?.amount).toBe(8); // 8 * 1
    expect(soldTx?.type).toBe("earned");
  });
});

describe("GET /api/v1/gamification/metrics", () => {
  test("returns zero metrics for new user", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/metrics");

    expect(res.status).toBe(200);
    const data = res.data as {
      totalItemsConsumed: number;
      totalItemsWasted: number;
      wasteReductionRate: number;
    };
    expect(data.totalItemsConsumed).toBe(0);
    expect(data.totalItemsWasted).toBe(0);
    expect(data.wasteReductionRate).toBe(100); // 100% when no items
  });

  test("calculates correct metrics from interactions", async () => {
    // Add various interactions
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "consumed", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-14", type: "wasted", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-14", type: "shared", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-14", type: "sold", quantity: 1 },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/metrics");

    expect(res.status).toBe(200);
    const data = res.data as {
      totalItemsConsumed: number;
      totalItemsWasted: number;
      totalItemsShared: number;
      totalItemsSold: number;
      wasteReductionRate: number;
      estimatedCo2Saved: number;
      estimatedMoneySaved: number;
    };
    expect(data.totalItemsConsumed).toBe(3);
    expect(data.totalItemsWasted).toBe(1);
    expect(data.totalItemsShared).toBe(1);
    expect(data.totalItemsSold).toBe(1);

    // Waste reduction: (3+1+1) / (3+1+1+1) * 100 = 5/6 * 100 = 83.33%
    expect(data.wasteReductionRate).toBeCloseTo(83.33, 1);

    // CO2 saved: 5 items * 0.5 = 2.5
    expect(data.estimatedCo2Saved).toBe(2.5);

    // Money saved: 5 items * $5 = $25
    expect(data.estimatedMoneySaved).toBe(25);
  });

  test("handles 100% waste scenario", async () => {
    await testDb.insert(schema.productSustainabilityMetrics).values([
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 1 },
      { userId: testUserId, todayDate: "2025-01-15", type: "wasted", quantity: 1 },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/metrics");

    const data = res.data as { wasteReductionRate: number };
    expect(data.wasteReductionRate).toBe(0);
  });
});

describe("GET /api/v1/gamification/leaderboard", () => {
  test("returns empty leaderboard when no user points", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/leaderboard");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as unknown[]).length).toBe(0);
  });

  test("returns users sorted by points descending", async () => {
    // Add points for both users
    await testDb.insert(schema.userPoints).values([
      { userId: testUserId, totalPoints: 50, currentStreak: 2 },
      { userId: secondUserId, totalPoints: 100, currentStreak: 5 },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/leaderboard");

    expect(res.status).toBe(200);
    const data = res.data as Array<{ rank: number; userId: number; points: number }>;
    expect(data.length).toBe(2);

    // Second user should be first (higher points)
    expect(data[0].rank).toBe(1);
    expect(data[0].userId).toBe(secondUserId);
    expect(data[0].points).toBe(100);

    expect(data[1].rank).toBe(2);
    expect(data[1].userId).toBe(testUserId);
    expect(data[1].points).toBe(50);
  });

  test("limits to top 10 users", async () => {
    // Create 12 users with points
    for (let i = 0; i < 12; i++) {
      const [user] = await testDb
        .insert(schema.users)
        .values({
          email: `leaderboard${i}@test.com`,
          passwordHash: "hash",
          name: `User ${i}`,
        })
        .returning();

      await testDb.insert(schema.userPoints).values({
        userId: user.id,
        totalPoints: i * 10,
      });
    }

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/leaderboard");

    const data = res.data as unknown[];
    expect(data.length).toBe(10);
  });
});

describe("GET /api/v1/gamification/badges", () => {
  test("returns all badges with earned status", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/badges");

    expect(res.status).toBe(200);
    const data = res.data as {
      badges: Array<{ code: string; earned: boolean }>;
      totalEarned: number;
      totalAvailable: number;
    };

    expect(data.badges.length).toBe(2);
    expect(data.totalEarned).toBe(0);
    expect(data.totalAvailable).toBe(2);

    // All badges should be unearned
    expect(data.badges.every((b) => b.earned === false)).toBe(true);
  });

  test("shows earned badges correctly", async () => {
    // Award first badge to user
    const badge = await testDb.query.badges.findFirst({
      where: eq(schema.badges.code, "first_action"),
    });

    if (badge) {
      await testDb.insert(schema.userBadges).values({
        userId: testUserId,
        badgeId: badge.id,
      });
    }

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/badges");

    const data = res.data as {
      badges: Array<{ code: string; earned: boolean }>;
      totalEarned: number;
    };

    expect(data.totalEarned).toBe(1);

    const firstAction = data.badges.find((b) => b.code === "first_action");
    expect(firstAction?.earned).toBe(true);

    const ecoStarter = data.badges.find((b) => b.code === "eco_starter");
    expect(ecoStarter?.earned).toBe(false);
  });

  test("returns badges in sort order", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/badges");

    const data = res.data as { badges: Array<{ code: string }> };

    // first_action (sortOrder: 1) should come before eco_starter (sortOrder: 2)
    expect(data.badges[0].code).toBe("first_action");
    expect(data.badges[1].code).toBe("eco_starter");
  });
});

describe("GET /api/v1/gamification/dashboard", () => {
  test("returns dashboard data for user with no activity", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/dashboard");

    expect(res.status).toBe(200);
    const data = res.data as {
      products: { total: number };
      listings: { active: number; sold: number };
      gamification: { points: number; streak: number };
    };

    expect(data.products.total).toBe(0);
    expect(data.listings.active).toBe(0);
    expect(data.listings.sold).toBe(0);
    expect(data.gamification.points).toBe(0);
    expect(data.gamification.streak).toBe(0);
  });

  test("returns correct product count", async () => {
    // Add some products
    await testDb.insert(schema.products).values([
      { userId: testUserId, productName: "Apple", quantity: 5 },
      { userId: testUserId, productName: "Banana", quantity: 3 },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/dashboard");

    const data = res.data as { products: { total: number } };
    expect(data.products.total).toBe(2);
  });

  test("returns correct listing counts", async () => {
    // Add some listings
    await testDb.insert(schema.marketplaceListings).values([
      {
        sellerId: testUserId,
        title: "Active Listing 1",
        quantity: 1,
        status: "active",
      },
      {
        sellerId: testUserId,
        title: "Active Listing 2",
        quantity: 1,
        status: "active",
      },
      {
        sellerId: testUserId,
        title: "Completed Listing",
        quantity: 1,
        status: "completed",
      },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/dashboard");

    const data = res.data as { listings: { active: number; sold: number } };
    expect(data.listings.active).toBe(2);
    expect(data.listings.sold).toBe(1);
  });

  test("returns gamification stats", async () => {
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 150,
      currentStreak: 7,
    });

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/gamification/dashboard");

    const data = res.data as { gamification: { points: number; streak: number } };
    expect(data.gamification.points).toBe(150);
    expect(data.gamification.streak).toBe(7);
  });
});
