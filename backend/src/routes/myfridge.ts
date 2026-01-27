import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { products, consumptionLogs, userPoints, userSustainabilityMetrics, pointTransactions } from "../db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import OpenAI from "openai";

const productSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().optional(),
  quantity: z.number().positive().default(1),
  unit: z.string().default("item"),
  purchaseDate: z.string().optional(),
  expiryDate: z.string().optional(),
  storageLocation: z.enum(["fridge", "freezer", "pantry"]).default("fridge"),
  notes: z.string().optional(),
  barcode: z.string().optional(),
});

const consumeSchema = z.object({
  action: z.enum(["consumed", "wasted", "shared", "sold"]),
  quantity: z.number().positive(),
  notes: z.string().optional(),
});

// Points awarded for different actions
const POINTS = {
  consumed: 5,
  shared: 10,
  sold: 8,
  wasted: -2,
  addProduct: 2,
};

// Estimated CO2 per kg of food waste prevented (kg)
const CO2_PER_KG_FOOD = 2.5;

export function registerMyFridgeRoutes(router: Router) {
  // Get all products
  router.get("/api/v1/myfridge/products", async (req) => {
    const user = getUser(req);

    const userProducts = await db.query.products.findMany({
      where: and(
        eq(products.userId, user.id),
        eq(products.isConsumed, false)
      ),
      orderBy: [desc(products.expiryDate)],
    });

    return json(userProducts);
  });

  // Add product
  router.post("/api/v1/myfridge/products", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);
      const data = productSchema.parse(body);

      const [product] = await db
        .insert(products)
        .values({
          userId: user.id,
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          unit: data.unit,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          storageLocation: data.storageLocation,
          notes: data.notes,
          barcode: data.barcode,
        })
        .returning();

      // Award points for adding a product
      await awardPoints(user.id, POINTS.addProduct, "earn", "product_added", "product", product.id);

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
      where: and(eq(products.id, productId), eq(products.userId, user.id)),
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
      const body = await parseBody(req);
      const data = productSchema.partial().parse(body);

      const existing = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.userId, user.id)),
      });

      if (!existing) {
        return error("Product not found", 404);
      }

      const [updated] = await db
        .update(products)
        .set({
          ...data,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : existing.purchaseDate,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : existing.expiryDate,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId))
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
      where: and(eq(products.id, productId), eq(products.userId, user.id)),
    });

    if (!existing) {
      return error("Product not found", 404);
    }

    await db.delete(products).where(eq(products.id, productId));

    return json({ message: "Product deleted" });
  });

  // Consume/waste product
  router.post("/api/v1/myfridge/products/:id/consume", async (req, params) => {
    try {
      const user = getUser(req);
      const productId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = consumeSchema.parse(body);

      const product = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.userId, user.id)),
      });

      if (!product) {
        return error("Product not found", 404);
      }

      // Log the consumption
      await db.insert(consumptionLogs).values({
        userId: user.id,
        productId,
        action: data.action,
        quantity: data.quantity,
        notes: data.notes,
      });

      // Update product quantity or mark as consumed
      const newQuantity = product.quantity - data.quantity;
      if (newQuantity <= 0) {
        await db
          .update(products)
          .set({ isConsumed: true, updatedAt: new Date() })
          .where(eq(products.id, productId));
      } else {
        await db
          .update(products)
          .set({ quantity: newQuantity, updatedAt: new Date() })
          .where(eq(products.id, productId));
      }

      // Award/deduct points based on action
      const pointsChange = POINTS[data.action];
      await awardPoints(
        user.id,
        pointsChange,
        pointsChange > 0 ? "earn" : "penalty",
        `product_${data.action}`,
        "product",
        productId
      );

      // Update sustainability metrics
      await updateSustainabilityMetrics(user.id, data.action, data.quantity);

      return json({ message: "Product consumption logged", pointsChange });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consume product error:", e);
      return error("Failed to log consumption", 500);
    }
  });

  // Scan receipt (OpenAI Vision)
  router.post("/api/v1/myfridge/receipt/scan", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody<{ imageBase64: string }>(req);

      if (!body.imageBase64) {
        return error("Image is required", 400);
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return error("OpenAI API key not configured", 500);
      }

      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this grocery receipt image and extract the food items. Return a JSON array with objects containing:
- name: product name (string)
- quantity: number of items (number)
- category: one of "produce", "dairy", "meat", "bakery", "frozen", "beverages", "pantry", "other"

Only include food items. Ignore non-food items like bags, taxes, etc.
Return ONLY the JSON array, no other text.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: body.imageBase64.startsWith("data:")
                    ? body.imageBase64
                    : `data:image/jpeg;base64,${body.imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || "[]";

      // Try to parse the response
      let items: Array<{ name: string; quantity: number; category: string }> = [];
      try {
        // Extract JSON from the response (handle markdown code blocks)
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          items = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error("Failed to parse receipt items:", content);
      }

      return json({ items });
    } catch (e) {
      console.error("Receipt scan error:", e);
      return error("Failed to scan receipt", 500);
    }
  });
}

async function awardPoints(
  userId: number,
  amount: number,
  type: string,
  action: string,
  referenceType?: string,
  referenceId?: number
) {
  // Record transaction
  await db.insert(pointTransactions).values({
    userId,
    amount,
    type,
    action,
    referenceType,
    referenceId,
  });

  // Update user points
  const currentPoints = await db.query.userPoints.findFirst({
    where: eq(userPoints.userId, userId),
  });

  if (currentPoints) {
    const newTotal = Math.max(0, (currentPoints.totalPoints ?? 0) + amount);
    const newAvailable = Math.max(0, (currentPoints.availablePoints ?? 0) + amount);
    const newLifetime =
      amount > 0 ? (currentPoints.lifetimePoints ?? 0) + amount : (currentPoints.lifetimePoints ?? 0);

    await db
      .update(userPoints)
      .set({
        totalPoints: newTotal,
        availablePoints: newAvailable,
        lifetimePoints: newLifetime,
        lastActivityDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userPoints.userId, userId));
  }
}

async function updateSustainabilityMetrics(
  userId: number,
  action: string,
  quantity: number
) {
  const metrics = await db.query.userSustainabilityMetrics.findFirst({
    where: eq(userSustainabilityMetrics.userId, userId),
  });

  if (!metrics) return;

  const updates: Record<string, number> = {};

  switch (action) {
    case "consumed":
      updates.totalItemsConsumed = (metrics.totalItemsConsumed ?? 0) + quantity;
      updates.estimatedCo2Saved = (metrics.estimatedCo2Saved ?? 0) + quantity * CO2_PER_KG_FOOD * 0.1;
      break;
    case "wasted":
      updates.totalItemsWasted = (metrics.totalItemsWasted ?? 0) + quantity;
      break;
    case "shared":
      updates.totalItemsShared = (metrics.totalItemsShared ?? 0) + quantity;
      updates.estimatedCo2Saved = (metrics.estimatedCo2Saved ?? 0) + quantity * CO2_PER_KG_FOOD * 0.2;
      break;
    case "sold":
      updates.totalItemsSold = (metrics.totalItemsSold ?? 0) + quantity;
      updates.estimatedCo2Saved = (metrics.estimatedCo2Saved ?? 0) + quantity * CO2_PER_KG_FOOD * 0.15;
      break;
  }

  // Calculate waste reduction rate
  const totalConsumed = updates.totalItemsConsumed ?? metrics.totalItemsConsumed;
  const totalWasted = updates.totalItemsWasted ?? metrics.totalItemsWasted;
  const totalItems = totalConsumed + totalWasted;
  updates.wasteReductionRate = totalItems > 0 ? (totalConsumed / totalItems) * 100 : 100;

  await db
    .update(userSustainabilityMetrics)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userSustainabilityMetrics.userId, userId));
}
