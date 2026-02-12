import { describe, expect, test, mock, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router } from "../../utils/router";
import * as schema from "../../db/schema";
import { eq, and } from "drizzle-orm";

// Mock OpenAI before importing routes
mock.module("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    items: [
                      {
                        name: "Apple",
                        quantity: 3,
                        category: "produce",
                        unit: "pcs",
                        co2Emission: 0.5,
                        unitPrice: 1.5,
                      },
                      {
                        name: "Milk",
                        quantity: 1,
                        category: "dairy",
                        unit: "L",
                        co2Emission: 3.2,
                        unitPrice: 4.0,
                      },
                    ],
                  }),
                },
                finish_reason: "stop",
              },
            ],
          }),
        },
      };
    },
  };
});

// Note: We don't mock gamification-service or badge-service here
// because mock.module is global and would affect other test files.
// Instead, we set up the required tables for the real services to run.

// Mock auth middleware
// Include all exports from auth.ts to avoid module conflict issues when tests run together
let testUserId = 1;
mock.module("../../middleware/auth", () => ({
  hashPassword: async (password: string): Promise<string> => `hashed_${password}`,
  verifyPassword: async (password: string, hash: string): Promise<boolean> =>
    hash === `hashed_${password}`,
  generateToken: async (payload: { sub: string; email: string; name: string }): Promise<string> =>
    `token_${payload.sub}_${payload.email}`,
  verifyToken: async (token: string): Promise<{ sub: string; email: string; name: string } | null> => {
    const match = token.match(/^token_(\d+)_(.+)$/);
    if (!match) return null;
    return { sub: match[1], email: match[2], name: "Test User" };
  },
  getUser: () => ({
    id: testUserId,
    email: "test@example.com",
    name: "Test User",
  }),
  extractBearerToken: (req: Request): string | null => {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    return authHeader.slice(7);
  },
  authMiddleware: async (_req: Request, next: () => Promise<Response>) => next(),
  verifyRequestAuth: async (req: Request) => {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const match = token.match(/^token_(\d+)_(.+)$/);
    if (!match) return null;
    return { sub: match[1], email: match[2], name: "Test User" };
  },
}));

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  process.env.OPENAI_API_KEY = "test-api-key";

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

    CREATE TABLE pending_consumption_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      raw_photo TEXT NOT NULL,
      ingredients TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'PENDING_WASTE_PHOTO',
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

    CREATE TABLE badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon_url TEXT,
      category TEXT NOT NULL,
      threshold INTEGER NOT NULL DEFAULT 1,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
      earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(user_id, badge_id)
    );

    CREATE TABLE user_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_id INTEGER NOT NULL,
      points_spent INTEGER NOT NULL,
      redemption_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      collected_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
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

  // Inject test database BEFORE importing routes
  const { __setTestDb } = await import("../../db/connection");
  __setTestDb(testDb as any);

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
  // Clear products and metrics tables before each test
  await testDb.delete(schema.productSustainabilityMetrics);
  await testDb.delete(schema.pendingConsumptionRecords);
  await testDb.delete(schema.products);
});

// Import actual route registration function AFTER db is set up
let registerMyFridgeRoutes: (router: Router) => void;
beforeAll(async () => {
  const myFridgeModule = await import("../myfridge");
  registerMyFridgeRoutes = myFridgeModule.registerMyFridgeRoutes;
});

function createRouter() {
  const router = new Router();
  registerMyFridgeRoutes(router);
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

describe("GET /api/v1/myfridge/products", () => {
  test("returns empty array when no products", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/myfridge/products");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as unknown[]).length).toBe(0);
  });

  test("returns user products", async () => {
    const router = createRouter();

    // Add a product first
    await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Apple",
      category: "produce",
      quantity: 5,
    });

    const res = await makeRequest(router, "GET", "/api/v1/myfridge/products");

    expect(res.status).toBe(200);
    const data = res.data as Array<{ productName: string }>;
    expect(data.length).toBe(1);
    expect(data[0].productName).toBe("Apple");
  });

  test("returns products in descending order by id", async () => {
    const router = createRouter();

    await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "First",
      quantity: 1,
    });
    await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Second",
      quantity: 1,
    });

    const res = await makeRequest(router, "GET", "/api/v1/myfridge/products");

    expect(res.status).toBe(200);
    const data = res.data as Array<{ productName: string }>;
    expect(data[0].productName).toBe("Second");
    expect(data[1].productName).toBe("First");
  });
});

describe("POST /api/v1/myfridge/products", () => {
  test("creates product with required fields only", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Banana",
    });

    expect(res.status).toBe(200);
    const data = res.data as { id: number; productName: string; quantity: number };
    expect(data.productName).toBe("Banana");
    expect(data.quantity).toBe(1); // default value
    expect(data.id).toBeDefined();
  });

  test("creates product with all optional fields", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Milk",
      category: "dairy",
      quantity: 2,
      unit: "L",
      unitPrice: 3.5,
      purchaseDate: "2025-01-15",
      description: "Fresh milk",
      co2Emission: 2.5,
    });

    expect(res.status).toBe(200);
    const data = res.data as {
      productName: string;
      category: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      description: string;
      co2Emission: number;
    };
    expect(data.productName).toBe("Milk");
    expect(data.category).toBe("dairy");
    expect(data.quantity).toBe(2);
    expect(data.unit).toBe("L");
    expect(data.unitPrice).toBe(3.5);
    expect(data.description).toBe("Fresh milk");
    expect(data.co2Emission).toBe(2.5);
  });

  test("creates add sustainability metric when product is added", async () => {
    const router = createRouter();
    await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Cheese",
      quantity: 3,
    });

    const metrics = await testDb.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, testUserId),
    });

    expect(metrics.length).toBe(1);
    expect(metrics[0].type).toBe("add");
    expect(metrics[0].quantity).toBe(3);
  });

  test("returns 400 for missing product name", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      quantity: 5,
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 for empty product name", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "",
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 for product name exceeding max length", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "a".repeat(201),
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 for non-positive quantity", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Test",
      quantity: 0,
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 for negative quantity", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Test",
      quantity: -1,
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/myfridge/products/:id", () => {
  test("returns product by id", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Orange",
      quantity: 10,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(router, "GET", `/api/v1/myfridge/products/${product.id}`);

    expect(res.status).toBe(200);
    const data = res.data as { id: number; productName: string };
    expect(data.id).toBe(product.id);
    expect(data.productName).toBe("Orange");
  });

  test("returns 404 for non-existent product", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/myfridge/products/99999");

    expect(res.status).toBe(404);
    const data = res.data as { error: string };
    expect(data.error).toBe("Product not found");
  });
});

describe("PATCH /api/v1/myfridge/products/:id", () => {
  test("updates product name", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Original",
      quantity: 5,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "PATCH",
      `/api/v1/myfridge/products/${product.id}`,
      { productName: "Updated" }
    );

    expect(res.status).toBe(200);
    const data = res.data as { productName: string };
    expect(data.productName).toBe("Updated");
  });

  test("updates product quantity", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Test",
      quantity: 5,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "PATCH",
      `/api/v1/myfridge/products/${product.id}`,
      { quantity: 10 }
    );

    expect(res.status).toBe(200);
    const data = res.data as { quantity: number };
    expect(data.quantity).toBe(10);
  });

  test("updates multiple fields at once", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Test",
      quantity: 5,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "PATCH",
      `/api/v1/myfridge/products/${product.id}`,
      {
        productName: "Updated",
        quantity: 15,
        category: "pantry",
        description: "New description",
      }
    );

    expect(res.status).toBe(200);
    const data = res.data as {
      productName: string;
      quantity: number;
      category: string;
      description: string;
    };
    expect(data.productName).toBe("Updated");
    expect(data.quantity).toBe(15);
    expect(data.category).toBe("pantry");
    expect(data.description).toBe("New description");
  });

  test("returns 404 for non-existent product", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/myfridge/products/99999",
      { productName: "Test" }
    );

    expect(res.status).toBe(404);
  });

  test("returns 400 for invalid data", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Test",
      quantity: 5,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "PATCH",
      `/api/v1/myfridge/products/${product.id}`,
      { quantity: -5 }
    );

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/v1/myfridge/products/:id", () => {
  test("deletes product successfully", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "ToDelete",
      quantity: 1,
    });
    const product = createRes.data as { id: number };

    const deleteRes = await makeRequest(
      router,
      "DELETE",
      `/api/v1/myfridge/products/${product.id}`
    );

    expect(deleteRes.status).toBe(200);
    const data = deleteRes.data as { message: string };
    expect(data.message).toBe("Product deleted");

    // Verify product is deleted
    const getRes = await makeRequest(router, "GET", `/api/v1/myfridge/products/${product.id}`);
    expect(getRes.status).toBe(404);
  });

  test("returns 404 for non-existent product", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "DELETE", "/api/v1/myfridge/products/99999");

    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/myfridge/products/:id/consume", () => {
  test("logs consumed interaction successfully", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Apple",
      quantity: 10,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "POST",
      `/api/v1/myfridge/products/${product.id}/consume`,
      { type: "consumed", quantity: 3 }
    );

    expect(res.status).toBe(200);
    const data = res.data as { message: string; pointsChange: number; newQuantity: number };
    expect(data.message).toBe("Product interaction logged");
    expect(data.pointsChange).toBe(0); // consumed gives 0 points in actual route
    expect(data.newQuantity).toBe(7);
  });

  test("logs wasted interaction", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Bread",
      quantity: 5,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "POST",
      `/api/v1/myfridge/products/${product.id}/consume`,
      { type: "wasted", quantity: 2 }
    );

    expect(res.status).toBe(200);
    const data = res.data as { pointsChange: number; newQuantity: number };
    expect(data.pointsChange).toBe(0); // wasted gives 0 points in actual route
    expect(data.newQuantity).toBe(3);
  });

  test("creates sustainability metric record", async () => {
    // Clear existing metrics first
    await testDb.delete(schema.productSustainabilityMetrics);

    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Yogurt",
      quantity: 4,
    });
    const product = createRes.data as { id: number };

    await makeRequest(
      router,
      "POST",
      `/api/v1/myfridge/products/${product.id}/consume`,
      { type: "consumed", quantity: 1 }
    );

    const metrics = await testDb.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.productId, product.id),
    });

    // Should have 2 metrics: add (from product creation) and consumed
    expect(metrics.length).toBe(2);
    const consumeMetric = metrics.find((m) => m.type === "consumed");
    expect(consumeMetric).toBeDefined();
  });

  test("quantity cannot go below zero", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Small Item",
      quantity: 2,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "POST",
      `/api/v1/myfridge/products/${product.id}/consume`,
      { type: "consumed", quantity: 5 } // More than available
    );

    expect(res.status).toBe(200);
    const data = res.data as { newQuantity: number };
    expect(data.newQuantity).toBe(0); // Clamped to 0
  });

  test("returns 404 for non-existent product", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/myfridge/products/99999/consume",
      { type: "consumed", quantity: 1 }
    );

    expect(res.status).toBe(404);
  });

  test("returns 400 for invalid type", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Test",
      quantity: 5,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "POST",
      `/api/v1/myfridge/products/${product.id}/consume`,
      { type: "InvalidType", quantity: 1 }
    );

    expect(res.status).toBe(400);
  });

  test("returns 400 for non-positive quantity", async () => {
    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Test",
      quantity: 5,
    });
    const product = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "POST",
      `/api/v1/myfridge/products/${product.id}/consume`,
      { type: "consumed", quantity: 0 }
    );

    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/myfridge/receipt/scan", () => {
  test("returns parsed receipt items", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/receipt/scan", {
      imageBase64: "data:image/jpeg;base64,fakeimagedata",
    });

    expect(res.status).toBe(200);
    const data = res.data as { items: Array<{ name: string }> };
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBe(2);
    expect(data.items[0].name).toBe("Apple");
    expect(data.items[1].name).toBe("Milk");
  });

  test("returns 400 when image is missing", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/receipt/scan", {});

    expect(res.status).toBe(400);
    const data = res.data as { error: string };
    expect(data.error).toBe("Image is required");
  });
});

describe("GET /api/v1/myfridge/consumption/pending", () => {
  test("returns empty array when no pending records", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/myfridge/consumption/pending");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as unknown[]).length).toBe(0);
  });

  test("returns pending consumption records", async () => {
    const router = createRouter();

    // Create a pending record
    await makeRequest(router, "POST", "/api/v1/myfridge/consumption/pending", {
      rawPhoto: "data:image/jpeg;base64,testphoto",
      ingredients: [{ productId: 1, name: "Test", estimatedQuantity: 1, category: "test", unitPrice: 1, co2Emission: 1 }],
    });

    const res = await makeRequest(router, "GET", "/api/v1/myfridge/consumption/pending");

    expect(res.status).toBe(200);
    const data = res.data as Array<{ rawPhoto: string; status: string }>;
    expect(data.length).toBe(1);
    expect(data[0].status).toBe("PENDING_WASTE_PHOTO");
  });
});

describe("POST /api/v1/myfridge/consumption/pending", () => {
  test("creates pending consumption record", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/consumption/pending", {
      rawPhoto: "data:image/jpeg;base64,testphoto",
      ingredients: [{ productId: 1, name: "Apple", estimatedQuantity: 2, category: "produce", unitPrice: 1.5, co2Emission: 0.5 }],
    });

    expect(res.status).toBe(200);
    const data = res.data as { id: number; rawPhoto: string; status: string };
    expect(data.id).toBeDefined();
    expect(data.rawPhoto).toBe("data:image/jpeg;base64,testphoto");
    expect(data.status).toBe("PENDING_WASTE_PHOTO");
  });

  test("returns 400 when rawPhoto is missing", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/myfridge/consumption/pending", {
      ingredients: [],
    });

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/v1/myfridge/consumption/pending/:id", () => {
  test("updates pending consumption record", async () => {
    const router = createRouter();

    // Create a pending record first
    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/consumption/pending", {
      rawPhoto: "data:image/jpeg;base64,testphoto",
      ingredients: [],
    });
    const record = createRes.data as { id: number };

    const res = await makeRequest(
      router,
      "PUT",
      `/api/v1/myfridge/consumption/pending/${record.id}`,
      { status: "COMPLETED" }
    );

    expect(res.status).toBe(200);
    const data = res.data as { status: string };
    expect(data.status).toBe("COMPLETED");
  });

  test("returns 404 for non-existent record", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "PUT",
      "/api/v1/myfridge/consumption/pending/99999",
      { status: "COMPLETED" }
    );

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/myfridge/consumption/pending/:id", () => {
  test("deletes pending consumption record", async () => {
    const router = createRouter();

    // Create a pending record first
    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/consumption/pending", {
      rawPhoto: "data:image/jpeg;base64,testphoto",
      ingredients: [],
    });
    const record = createRes.data as { id: number };

    const deleteRes = await makeRequest(
      router,
      "DELETE",
      `/api/v1/myfridge/consumption/pending/${record.id}`
    );

    expect(deleteRes.status).toBe(200);
    const data = deleteRes.data as { message: string };
    expect(data.message).toBe("Pending consumption record deleted");
  });

  test("returns 404 for non-existent record", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "DELETE",
      "/api/v1/myfridge/consumption/pending/99999"
    );

    expect(res.status).toBe(404);
  });
});
