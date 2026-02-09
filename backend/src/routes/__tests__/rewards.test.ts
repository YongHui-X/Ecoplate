import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router, json, error, parseBody } from "../../utils/router";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;
let secondUserId: number;

const redeemSchema = z.object({
  rewardId: z.number().int().positive(),
});

// Simplified route registration for testing
function registerTestRewardsRoutes(
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

  // Get all available rewards
  router.get("/api/v1/rewards", async () => {
    const rewards = await db
      .select()
      .from(schema.rewards)
      .where(eq(schema.rewards.isActive, true))
      .orderBy(schema.rewards.pointsCost);
    return json(rewards);
  });

  // Get user's points balance
  router.get("/api/v1/rewards/balance", async (req) => {
    const user = getUser(req);
    const result = await db.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, user.id),
    });
    return json({ balance: result?.totalPoints ?? 0 });
  });

  // Redeem a reward
  router.post("/api/v1/rewards/redeem", async (req) => {
    const user = getUser(req);
    const body = await parseBody(req);
    const data = redeemSchema.parse(body);

    // Get the reward
    const reward = await db.query.rewards.findFirst({
      where: eq(schema.rewards.id, data.rewardId),
    });

    if (!reward) {
      return error("Reward not found", 404);
    }

    if (!reward.isActive) {
      return error("Reward is not available", 400);
    }

    if (reward.stock <= 0) {
      return error("Reward is out of stock", 400);
    }

    // Get user's points
    const userPointsRecord = await db.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, user.id),
    });

    const currentPoints = userPointsRecord?.totalPoints ?? 0;

    if (currentPoints < reward.pointsCost) {
      return error("Insufficient points", 400);
    }

    // Generate unique redemption code
    const redemptionCode = `EP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Calculate expiry date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create redemption record
    const [redemption] = await db
      .insert(schema.userRedemptions)
      .values({
        userId: user.id,
        rewardId: data.rewardId,
        pointsSpent: reward.pointsCost,
        redemptionCode,
        status: "pending",
        expiresAt,
      })
      .returning();

    // Deduct points from user
    await db
      .update(schema.userPoints)
      .set({ totalPoints: currentPoints - reward.pointsCost })
      .where(eq(schema.userPoints.userId, user.id));

    // Decrease stock
    await db
      .update(schema.rewards)
      .set({ stock: reward.stock - 1 })
      .where(eq(schema.rewards.id, data.rewardId));

    return json({
      ...redemption,
      reward,
    });
  });

  // Get user's redemption history
  router.get("/api/v1/rewards/my-redemptions", async (req) => {
    const user = getUser(req);

    const redemptions = await db
      .select({
        id: schema.userRedemptions.id,
        pointsSpent: schema.userRedemptions.pointsSpent,
        redemptionCode: schema.userRedemptions.redemptionCode,
        status: schema.userRedemptions.status,
        expiresAt: schema.userRedemptions.expiresAt,
        createdAt: schema.userRedemptions.createdAt,
        reward: {
          id: schema.rewards.id,
          name: schema.rewards.name,
          description: schema.rewards.description,
          category: schema.rewards.category,
          pointsCost: schema.rewards.pointsCost,
        },
      })
      .from(schema.userRedemptions)
      .innerJoin(schema.rewards, eq(schema.userRedemptions.rewardId, schema.rewards.id))
      .where(eq(schema.userRedemptions.userId, user.id));

    return json(redemptions);
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
  // Clear data before each test
  await testDb.delete(schema.userRedemptions);
  await testDb.delete(schema.userPoints);
  await testDb.delete(schema.rewards);
});

function createRouter(userId: number = testUserId) {
  const router = new Router();
  registerTestRewardsRoutes(router, testDb, userId);
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

describe("GET /api/v1/rewards", () => {
  test("returns empty array when no rewards exist", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/rewards");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as unknown[]).length).toBe(0);
  });

  test("returns only active rewards", async () => {
    await testDb.insert(schema.rewards).values([
      { name: "Active Reward", pointsCost: 100, stock: 10, isActive: true, category: "physical" },
      { name: "Inactive Reward", pointsCost: 200, stock: 5, isActive: false, category: "physical" },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/rewards");

    expect(res.status).toBe(200);
    const data = res.data as Array<{ name: string }>;
    expect(data.length).toBe(1);
    expect(data[0].name).toBe("Active Reward");
  });

  test("returns rewards sorted by points cost", async () => {
    await testDb.insert(schema.rewards).values([
      { name: "Expensive", pointsCost: 1000, stock: 10, isActive: true, category: "physical" },
      { name: "Cheap", pointsCost: 100, stock: 10, isActive: true, category: "voucher" },
      { name: "Medium", pointsCost: 500, stock: 10, isActive: true, category: "physical" },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/rewards");

    expect(res.status).toBe(200);
    const data = res.data as Array<{ name: string; pointsCost: number }>;
    expect(data.length).toBe(3);
    expect(data[0].name).toBe("Cheap");
    expect(data[1].name).toBe("Medium");
    expect(data[2].name).toBe("Expensive");
  });

  test("includes all reward fields", async () => {
    await testDb.insert(schema.rewards).values({
      name: "Test Reward",
      description: "A test reward",
      imageUrl: "http://example.com/image.jpg",
      category: "voucher",
      pointsCost: 500,
      stock: 25,
      isActive: true,
    });

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/rewards");

    expect(res.status).toBe(200);
    const data = res.data as Array<{
      name: string;
      description: string;
      imageUrl: string;
      category: string;
      pointsCost: number;
      stock: number;
      isActive: boolean;
    }>;
    expect(data[0].name).toBe("Test Reward");
    expect(data[0].description).toBe("A test reward");
    expect(data[0].imageUrl).toBe("http://example.com/image.jpg");
    expect(data[0].category).toBe("voucher");
    expect(data[0].pointsCost).toBe(500);
    expect(data[0].stock).toBe(25);
    expect(data[0].isActive).toBe(true);
  });
});

describe("GET /api/v1/rewards/balance", () => {
  test("returns 0 for user with no points record", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/rewards/balance");

    expect(res.status).toBe(200);
    expect((res.data as { balance: number }).balance).toBe(0);
  });

  test("returns correct balance for user with points", async () => {
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 1500,
    });

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/rewards/balance");

    expect(res.status).toBe(200);
    expect((res.data as { balance: number }).balance).toBe(1500);
  });

  test("returns correct balance for specific user", async () => {
    await testDb.insert(schema.userPoints).values([
      { userId: testUserId, totalPoints: 1000 },
      { userId: secondUserId, totalPoints: 2000 },
    ]);

    const router1 = createRouter(testUserId);
    const res1 = await makeRequest(router1, "GET", "/api/v1/rewards/balance");
    expect((res1.data as { balance: number }).balance).toBe(1000);

    const router2 = createRouter(secondUserId);
    const res2 = await makeRequest(router2, "GET", "/api/v1/rewards/balance");
    expect((res2.data as { balance: number }).balance).toBe(2000);
  });
});

describe("POST /api/v1/rewards/redeem", () => {
  test("successfully redeems a reward", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Test Reward",
        pointsCost: 500,
        stock: 10,
        isActive: true,
        category: "physical",
      })
      .returning();

    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 1000,
    });

    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/rewards/redeem", {
      rewardId: reward.id,
    });

    expect(res.status).toBe(200);
    const data = res.data as {
      id: number;
      redemptionCode: string;
      pointsSpent: number;
      reward: { name: string };
    };
    expect(data.redemptionCode).toMatch(/^EP-[A-Z0-9]+$/);
    expect(data.pointsSpent).toBe(500);
    expect(data.reward.name).toBe("Test Reward");
  });

  test("deducts points from user balance", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Test Reward",
        pointsCost: 300,
        stock: 10,
        isActive: true,
        category: "physical",
      })
      .returning();

    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 1000,
    });

    const router = createRouter();
    await makeRequest(router, "POST", "/api/v1/rewards/redeem", {
      rewardId: reward.id,
    });

    const points = await testDb.query.userPoints.findFirst({
      where: eq(schema.userPoints.userId, testUserId),
    });

    expect(points?.totalPoints).toBe(700);
  });

  test("decreases reward stock", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Test Reward",
        pointsCost: 100,
        stock: 5,
        isActive: true,
        category: "physical",
      })
      .returning();

    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 500,
    });

    const router = createRouter();
    await makeRequest(router, "POST", "/api/v1/rewards/redeem", {
      rewardId: reward.id,
    });

    const updatedReward = await testDb.query.rewards.findFirst({
      where: eq(schema.rewards.id, reward.id),
    });

    expect(updatedReward?.stock).toBe(4);
  });

  test("returns 404 for non-existent reward", async () => {
    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 1000,
    });

    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/rewards/redeem", {
      rewardId: 9999,
    });

    expect(res.status).toBe(404);
    expect((res.data as { error: string }).error).toBe("Reward not found");
  });

  test("returns 400 for inactive reward", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Inactive Reward",
        pointsCost: 100,
        stock: 10,
        isActive: false,
        category: "physical",
      })
      .returning();

    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 1000,
    });

    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/rewards/redeem", {
      rewardId: reward.id,
    });

    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toBe("Reward is not available");
  });

  test("returns 400 for out of stock reward", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Out of Stock",
        pointsCost: 100,
        stock: 0,
        isActive: true,
        category: "physical",
      })
      .returning();

    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 1000,
    });

    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/rewards/redeem", {
      rewardId: reward.id,
    });

    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toBe("Reward is out of stock");
  });

  test("returns 400 for insufficient points", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Expensive Reward",
        pointsCost: 1000,
        stock: 10,
        isActive: true,
        category: "physical",
      })
      .returning();

    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 500,
    });

    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/rewards/redeem", {
      rewardId: reward.id,
    });

    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toBe("Insufficient points");
  });

  test("returns 400 for user with no points record", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Test Reward",
        pointsCost: 100,
        stock: 10,
        isActive: true,
        category: "physical",
      })
      .returning();

    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/rewards/redeem", {
      rewardId: reward.id,
    });

    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toBe("Insufficient points");
  });

  test("creates redemption record with correct status", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Test Reward",
        pointsCost: 100,
        stock: 10,
        isActive: true,
        category: "physical",
      })
      .returning();

    await testDb.insert(schema.userPoints).values({
      userId: testUserId,
      totalPoints: 500,
    });

    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/rewards/redeem", {
      rewardId: reward.id,
    });

    const redemption = await testDb.query.userRedemptions.findFirst({
      where: eq(schema.userRedemptions.userId, testUserId),
    });

    expect(redemption).toBeDefined();
    expect(redemption?.status).toBe("pending");
    expect(redemption?.pointsSpent).toBe(100);
    expect(redemption?.rewardId).toBe(reward.id);
  });
});

describe("GET /api/v1/rewards/my-redemptions", () => {
  test("returns empty array for user with no redemptions", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/rewards/my-redemptions");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as unknown[]).length).toBe(0);
  });

  test("returns user's redemptions", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Test Reward",
        pointsCost: 500,
        stock: 10,
        isActive: true,
        category: "voucher",
      })
      .returning();

    await testDb.insert(schema.userRedemptions).values({
      userId: testUserId,
      rewardId: reward.id,
      pointsSpent: 500,
      redemptionCode: "EP-TEST1234",
      status: "pending",
    });

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/rewards/my-redemptions");

    expect(res.status).toBe(200);
    const data = res.data as Array<{
      redemptionCode: string;
      pointsSpent: number;
      status: string;
      reward: { name: string };
    }>;
    expect(data.length).toBe(1);
    expect(data[0].redemptionCode).toBe("EP-TEST1234");
    expect(data[0].pointsSpent).toBe(500);
    expect(data[0].status).toBe("pending");
    expect(data[0].reward.name).toBe("Test Reward");
  });

  test("returns only current user's redemptions", async () => {
    const [reward] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Test Reward",
        pointsCost: 100,
        stock: 10,
        isActive: true,
        category: "physical",
      })
      .returning();

    await testDb.insert(schema.userRedemptions).values([
      {
        userId: testUserId,
        rewardId: reward.id,
        pointsSpent: 100,
        redemptionCode: "EP-USER1",
        status: "pending",
      },
      {
        userId: secondUserId,
        rewardId: reward.id,
        pointsSpent: 100,
        redemptionCode: "EP-USER2",
        status: "pending",
      },
    ]);

    const router = createRouter(testUserId);
    const res = await makeRequest(router, "GET", "/api/v1/rewards/my-redemptions");

    const data = res.data as Array<{ redemptionCode: string }>;
    expect(data.length).toBe(1);
    expect(data[0].redemptionCode).toBe("EP-USER1");
  });

  test("returns multiple redemptions for user", async () => {
    const [reward1] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Reward 1",
        pointsCost: 100,
        stock: 10,
        isActive: true,
        category: "physical",
      })
      .returning();

    const [reward2] = await testDb
      .insert(schema.rewards)
      .values({
        name: "Reward 2",
        pointsCost: 200,
        stock: 10,
        isActive: true,
        category: "voucher",
      })
      .returning();

    await testDb.insert(schema.userRedemptions).values([
      {
        userId: testUserId,
        rewardId: reward1.id,
        pointsSpent: 100,
        redemptionCode: "EP-R1",
        status: "pending",
      },
      {
        userId: testUserId,
        rewardId: reward2.id,
        pointsSpent: 200,
        redemptionCode: "EP-R2",
        status: "collected",
      },
    ]);

    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/rewards/my-redemptions");

    const data = res.data as Array<{ redemptionCode: string }>;
    expect(data.length).toBe(2);
  });
});
