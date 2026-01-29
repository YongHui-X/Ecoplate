import { describe, expect, test, mock, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router, json, error } from "../../utils/router";
import { registerConsumptionRoutes } from "../consumption";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";

// Mock OpenAI module before importing the route
mock.module("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: async (params: any) => {
            // Determine which endpoint is calling based on prompt content
            const userMessage = params.messages[0]?.content;
            const textContent = Array.isArray(userMessage)
              ? userMessage.find((c: any) => c.type === "text")?.text ?? ""
              : userMessage ?? "";

            if (textContent.includes("identify") || textContent.includes("match")) {
              // API 1: identify ingredients
              return {
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        ingredients: [
                          {
                            productId: 1,
                            name: "Chicken Breast",
                            estimatedQuantity: 0.5,
                            confidence: "high",
                          },
                        ],
                      }),
                    },
                    finish_reason: "stop",
                  },
                ],
              };
            } else {
              // API 2: analyze waste
              return {
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        wasteItems: [
                          {
                            productName: "Chicken Breast",
                            quantityWasted: 0.1,
                            productId: 1,
                          },
                        ],
                        overallObservation:
                          "Minimal waste observed. Most food was consumed.",
                      }),
                    },
                    finish_reason: "stop",
                  },
                ],
              };
            }
          },
        },
      };
    },
  };
});

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;
let testProductId: number;

beforeAll(async () => {
  sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  // Create tables
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
      unit_price REAL,
      purchase_date TEXT,
      expiry_date TEXT,
      description TEXT,
      co2_emission REAL,
      is_consumed INTEGER DEFAULT 0
    );

    CREATE TABLE product_interaction (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      today_date TEXT,
      quantity REAL,
      type TEXT
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

  // Seed test product
  const [product] = await testDb
    .insert(schema.products)
    .values({
      userId: testUserId,
      productName: "Chicken Breast",
      category: "meat",
      quantity: 2,
      unitPrice: 8.0,
      co2Emission: 9.0,
    })
    .returning();
  testProductId = product.id;
});

afterAll(() => {
  sqlite.close();
});

// Helper to create a request and run through the router
function createRouter() {
  const router = new Router();
  // Simulate auth middleware by attaching user to request
  router.use(async (req, next) => {
    (req as any).user = {
      id: testUserId,
      email: "test@example.com",
      name: "Test User",
    };
    return next();
  });
  registerConsumptionRoutes(router, testDb as any);
  return router;
}

async function makeRequest(
  router: Router,
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: any }> {
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

describe("POST /api/v1/consumption/identify", () => {
  test("returns 400 when image is missing", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/consumption/identify",
      {}
    );

    expect(res.status).toBe(400);
    expect(res.data.error).toBeDefined();
  });

  test("returns ingredients list on valid image", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/consumption/identify",
      { imageBase64: "data:image/jpeg;base64,/9j/fakeimage" }
    );

    expect(res.status).toBe(200);
    expect(res.data.ingredients).toBeDefined();
    expect(Array.isArray(res.data.ingredients)).toBe(true);
    expect(res.data.ingredients.length).toBeGreaterThan(0);

    const ingredient = res.data.ingredients[0];
    expect(ingredient.name).toBeDefined();
    expect(ingredient.productId).toBeDefined();
  });
});

describe("POST /api/v1/consumption/analyze-waste", () => {
  test("returns 400 when image is missing", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/consumption/analyze-waste",
      {
        ingredients: [
          {
            productId: testProductId,
            productName: "Chicken Breast",
            quantityUsed: 0.5,
            category: "meat",
            unitPrice: 8.0,
            co2Emission: 9.0,
          },
        ],
      }
    );

    expect(res.status).toBe(400);
    expect(res.data.error).toBeDefined();
  });

  test("returns 400 when ingredients are missing", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/consumption/analyze-waste",
      { imageBase64: "data:image/jpeg;base64,/9j/fakeimage" }
    );

    expect(res.status).toBe(400);
    expect(res.data.error).toBeDefined();
  });

  test("returns metrics with correct structure", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/consumption/analyze-waste",
      {
        imageBase64: "data:image/jpeg;base64,/9j/fakeimage",
        ingredients: [
          {
            productId: testProductId,
            productName: "Chicken Breast",
            quantityUsed: 0.5,
            category: "meat",
            unitPrice: 8.0,
            co2Emission: 9.0,
          },
        ],
      }
    );

    expect(res.status).toBe(200);

    // Check metrics structure
    expect(res.data.metrics).toBeDefined();
    const m = res.data.metrics;
    expect(typeof m.totalCO2Wasted).toBe("number");
    expect(typeof m.totalCO2Saved).toBe("number");
    expect(typeof m.totalEconomicWaste).toBe("number");
    expect(typeof m.totalEconomicConsumed).toBe("number");
    expect(typeof m.wastePercentage).toBe("number");
    expect(typeof m.sustainabilityScore).toBe("number");
    expect(typeof m.sustainabilityRating).toBe("string");
    expect(Array.isArray(m.itemBreakdown)).toBe(true);

    // Check waste analysis structure
    expect(res.data.wasteAnalysis).toBeDefined();
    expect(res.data.wasteAnalysis.wasteItems).toBeDefined();

    // Check interactions recorded
    expect(res.data.interactions).toBeDefined();
    expect(res.data.interactions.recorded).toBe(true);
    expect(res.data.interactions.count).toBeGreaterThan(0);
  });

  test("records product interactions in database", async () => {
    // Clear any existing interactions first
    await testDb
      .delete(schema.productSustainabilityMetrics)
      .where(eq(schema.productSustainabilityMetrics.userId, testUserId));

    const router = createRouter();
    await makeRequest(router, "POST", "/api/v1/consumption/analyze-waste", {
      imageBase64: "data:image/jpeg;base64,/9j/fakeimage",
      ingredients: [
        {
          productId: testProductId,
          productName: "Chicken Breast",
          quantityUsed: 0.5,
          category: "meat",
          unitPrice: 8.0,
          co2Emission: 9.0,
        },
      ],
    });

    // Verify interactions in database
    const interactions = await testDb.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, testUserId),
    });

    expect(interactions.length).toBeGreaterThan(0);
    // Should have both Consume and Waste interactions (since mock returns waste)
    const types = interactions.map((i) => i.type);
    expect(types).toContain("Consume");
    expect(types).toContain("Waste");
  });

});
