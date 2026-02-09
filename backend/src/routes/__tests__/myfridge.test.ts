import { describe, expect, test, mock, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router, json, error } from "../../utils/router";
import * as schema from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

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

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testUserId: number;

const productSchema = z.object({
  productName: z.string().min(1).max(200),
  category: z.string().optional(),
  quantity: z.number().positive().default(1),
  unit: z.string().optional(),
  unitPrice: z.number().optional(),
  purchaseDate: z.string().optional(),
  description: z.string().optional(),
  co2Emission: z.number().optional(),
});

const interactionSchema = z.object({
  type: z.enum(["Add", "Consume", "Waste"]),
  quantity: z.number().positive(),
  todayDate: z.string().optional(),
});

// Register routes function that takes db as parameter
function registerTestMyFridgeRoutes(
  router: Router,
  db: ReturnType<typeof drizzle<typeof schema>>,
  userId: number
) {
  router.use(async (req, next) => {
    (req as Request & { user: { id: number; email: string; name: string } }).user = {
      id: userId,
      email: "test@example.com",
      name: "Test User",
    };
    return next();
  });

  const getUser = (req: Request) =>
    (req as Request & { user: { id: number; email: string; name: string } }).user;

  // Get all products for the authenticated user
  router.get("/api/v1/myfridge/products", async (req) => {
    const user = getUser(req);

    const userProducts = await db.query.products.findMany({
      where: eq(schema.products.userId, user.id),
      orderBy: [desc(schema.products.id)],
    });

    return json(userProducts);
  });

  // Add a new product
  router.post("/api/v1/myfridge/products", async (req) => {
    try {
      const user = getUser(req);
      const body = await req.json();
      const data = productSchema.parse(body);

      const [product] = await db
        .insert(schema.products)
        .values({
          userId: user.id,
          productName: data.productName,
          category: data.category,
          quantity: data.quantity,
          unit: data.unit,
          unitPrice: data.unitPrice,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
          description: data.description,
          co2Emission: data.co2Emission,
        })
        .returning();

      // Log "Add" interaction for sustainability tracking
      const todayDate = new Date().toISOString().split("T")[0];
      await db.insert(schema.productSustainabilityMetrics).values({
        productId: product.id,
        userId: user.id,
        todayDate,
        quantity: data.quantity,
        type: "Add",
      });

      return json(product);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Add product error:", e);
      return error("Failed to add product", 500);
    }
  });

  // Get single product
  router.get("/api/v1/myfridge/products/:id", async (req, params) => {
    const user = getUser(req);
    const productId = parseInt(params.id, 10);

    const product = await db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.userId, user.id)),
    });

    if (!product) {
      return error("Product not found", 404);
    }

    return json(product);
  });

  // Update product
  router.patch("/api/v1/myfridge/products/:id", async (req, params) => {
    try {
      const user = getUser(req);
      const productId = parseInt(params.id, 10);
      const body = await req.json();
      const data = productSchema.partial().parse(body);

      const existing = await db.query.products.findFirst({
        where: and(eq(schema.products.id, productId), eq(schema.products.userId, user.id)),
      });

      if (!existing) {
        return error("Product not found", 404);
      }

      const updateData: Record<string, unknown> = { ...data };
      if (data.purchaseDate) {
        updateData.purchaseDate = new Date(data.purchaseDate);
      }

      const [updated] = await db
        .update(schema.products)
        .set(updateData)
        .where(eq(schema.products.id, productId))
        .returning();

      return json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Update product error:", e);
      return error("Failed to update product", 500);
    }
  });

  // Delete product
  router.delete("/api/v1/myfridge/products/:id", async (req, params) => {
    const user = getUser(req);
    const productId = parseInt(params.id, 10);

    const existing = await db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.userId, user.id)),
    });

    if (!existing) {
      return error("Product not found", 404);
    }

    await db.delete(schema.products).where(eq(schema.products.id, productId));

    return json({ message: "Product deleted" });
  });

  // Log product interaction (consume, waste)
  router.post("/api/v1/myfridge/products/:id/consume", async (req, params) => {
    try {
      const user = getUser(req);
      const productId = parseInt(params.id, 10);
      const body = await req.json();
      const data = interactionSchema.parse(body);

      const product = await db.query.products.findFirst({
        where: and(eq(schema.products.id, productId), eq(schema.products.userId, user.id)),
      });

      if (!product) {
        return error("Product not found", 404);
      }

      // Log the interaction
      await db.insert(schema.productSustainabilityMetrics).values({
        productId,
        userId: user.id,
        todayDate: data.todayDate || new Date().toISOString().split("T")[0],
        quantity: data.quantity,
        type: data.type,
      });

      // Deduct quantity from product
      const newQuantity = Math.max(0, (product.quantity || 0) - data.quantity);
      await db
        .update(schema.products)
        .set({ quantity: newQuantity })
        .where(eq(schema.products.id, productId));

      const POINTS: Record<string, number> = {
        Add: 2,
        Consume: 5,
        Waste: -2,
      };

      return json({
        message: "Product interaction logged",
        pointsChange: POINTS[data.type],
        newQuantity,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Product interaction error:", e);
      return error("Failed to log interaction", 500);
    }
  });

  // Scan receipt
  router.post("/api/v1/myfridge/receipt/scan", async (req) => {
    try {
      const body = await req.json() as { imageBase64?: string };

      if (!body.imageBase64) {
        return error("Image is required", 400);
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return error("OpenAI API key not configured", 500);
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [{ role: "user", content: "test" }],
      });

      const content = response.choices[0]?.message?.content || '{"items":[]}';
      const parsed = JSON.parse(content) as {
        items: Array<{
          name: string;
          quantity: number;
          category: string;
          unit: string;
          co2Emission: number;
          unitPrice: number;
        }>;
      };

      return json({ items: parsed.items });
    } catch (e) {
      console.error("Receipt scan error:", e);
      return error("Failed to scan receipt", 500);
    }
  });
}

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
  // Clear products and metrics tables before each test
  await testDb.delete(schema.productSustainabilityMetrics);
  await testDb.delete(schema.products);
});

function createRouter() {
  const router = new Router();
  registerTestMyFridgeRoutes(router, testDb, testUserId);
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

  test("creates Add sustainability metric when product is added", async () => {
    const router = createRouter();
    await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Cheese",
      quantity: 3,
    });

    const metrics = await testDb.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, testUserId),
    });

    expect(metrics.length).toBe(1);
    expect(metrics[0].type).toBe("Add");
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
  test("logs consume interaction successfully", async () => {
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
      { type: "Consume", quantity: 3 }
    );

    expect(res.status).toBe(200);
    const data = res.data as { message: string; pointsChange: number; newQuantity: number };
    expect(data.message).toBe("Product interaction logged");
    expect(data.pointsChange).toBe(5); // Consume gives 5 points
    expect(data.newQuantity).toBe(7);
  });

  test("logs waste interaction with negative points", async () => {
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
      { type: "Waste", quantity: 2 }
    );

    expect(res.status).toBe(200);
    const data = res.data as { pointsChange: number; newQuantity: number };
    expect(data.pointsChange).toBe(-2); // Waste deducts 2 points
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
      { type: "Consume", quantity: 1 }
    );

    const metrics = await testDb.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.productId, product.id),
    });

    // Should have 2 metrics: Add (from product creation) and Consume
    expect(metrics.length).toBe(2);
    const consumeMetric = metrics.find((m) => m.type === "Consume");
    expect(consumeMetric).toBeDefined();
    expect(consumeMetric?.quantity).toBe(1);
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
      { type: "Consume", quantity: 5 } // More than available
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
      { type: "Consume", quantity: 1 }
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
      { type: "Consume", quantity: 0 }
    );

    expect(res.status).toBe(400);
  });

  test("accepts custom todayDate", async () => {
    await testDb.delete(schema.productSustainabilityMetrics);

    const router = createRouter();

    const createRes = await makeRequest(router, "POST", "/api/v1/myfridge/products", {
      productName: "Custom Date",
      quantity: 5,
    });
    const product = createRes.data as { id: number };

    await makeRequest(
      router,
      "POST",
      `/api/v1/myfridge/products/${product.id}/consume`,
      { type: "Consume", quantity: 1, todayDate: "2025-01-01" }
    );

    const metrics = await testDb.query.productSustainabilityMetrics.findMany({
      where: and(
        eq(schema.productSustainabilityMetrics.productId, product.id),
        eq(schema.productSustainabilityMetrics.type, "Consume")
      ),
    });

    expect(metrics.length).toBe(1);
    expect(metrics[0].todayDate).toBe("2025-01-01");
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
