import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { products, productSustainabilityMetrics, pendingConsumptionRecords } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import OpenAI from "openai";
import { awardPoints, type PointAction } from "../services/gamification-service";

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
  type: z.enum(["add", "consumed", "wasted"]),
  quantity: z.number().positive(),
  todayDate: z.string().optional(),
});

const pendingConsumptionSchema = z.object({
  rawPhoto: z.string().min(1, "Raw photo is required"),
  ingredients: z.array(z.object({
    id: z.string().optional(),
    productId: z.number(),
    name: z.string(),
    matchedProductName: z.string().optional().default(""),
    estimatedQuantity: z.number(),
    category: z.string(),
    unitPrice: z.number(),
    co2Emission: z.number(),
    confidence: z.enum(["high", "medium", "low"]).optional().default("low"),
  })).default([]),
  status: z.enum(["PENDING_WASTE_PHOTO", "COMPLETED"]).default("PENDING_WASTE_PHOTO"),
});

export function registerMyFridgeRoutes(router: Router) {
  // Get all products for the authenticated user
  router.get("/api/v1/myfridge/products", async (req) => {
    const user = getUser(req);

    const userProducts = await db.query.products.findMany({
      where: eq(products.userId, user.id),
      orderBy: [desc(products.id)],
    });

    return json(userProducts);
  });

  // Add a new product
  router.post("/api/v1/myfridge/products", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);
      const data = productSchema.parse(body);

      const [product] = await db
        .insert(products)
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

      // Log "add" interaction for sustainability tracking (no points awarded)
      const todayDate = new Date().toISOString().split("T")[0];
      await db.insert(productSustainabilityMetrics).values({
        productId: product.id,
        userId: user.id,
        todayDate,
        quantity: data.quantity,
        type: "add",
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

      // Convert purchaseDate string to Date if provided
      const updateData: Record<string, unknown> = { ...data };
      if (data.purchaseDate) {
        updateData.purchaseDate = new Date(data.purchaseDate);
      }

      const [updated] = await db
        .update(products)
        .set(updateData)
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

  // Log product interaction (consume, waste, share, sell)
  router.post("/api/v1/myfridge/products/:id/consume", async (req, params) => {
    try {
      const user = getUser(req);
      const productId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = interactionSchema.parse(body);

      const product = await db.query.products.findFirst({
        where: and(
          eq(products.id, productId),
          eq(products.userId, user.id)
        ),
      });

      if (!product) {
        return error("Product not found", 404);
      }

      // Deduct quantity from product
      const newQuantity = Math.max(0, (product.quantity || 0) - data.quantity);
      await db
        .update(products)
        .set({ quantity: newQuantity })
        .where(eq(products.id, productId));

      // Award/deduct points (also records the sustainability metric)
      const pointsResult = await awardPoints(
        user.id,
        data.type as PointAction,
        productId,
        data.quantity
      );

      return json({
        message: "Product interaction logged",
        pointsChange: pointsResult.amount,
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

  // Scan receipt (OpenAI Vision with structured output)
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
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this grocery receipt image and extract the food items. Only include food items. Ignore non-food items like bags, taxes, totals, etc. If no food items are found, return an empty items array.

For each item, determine its eco-focused sub-category (Ruminant meat, Non-ruminant meat, Seafood, Dairy, Eggs, Grains & cereals, Legumes & pulses, Vegetables, Fruits, Nuts & seeds, Oils & fats, Sugar & sweeteners, Processed plant-based foods) and use it to:
1. Map to the corresponding simple category:
   - Ruminant meat, Non-ruminant meat, Seafood → "meat"
   - Dairy, Eggs → "dairy"
   - Vegetables, Fruits, Legumes & pulses → "produce"
   - Grains & cereals, Nuts & seeds, Oils & fats, Sugar & sweeteners → "pantry"
   - Processed plant-based foods → "other"
2. Estimate co2Emission in kg CO2e per unit based on the eco-focused sub-category.
3. Determine the unit of measurement for the quantity (e.g. kg, g, ml, L, pcs, pack, loaf, dozen, bottle, can).
4. Extract the price of the item from the receipt. If the price is not visible, estimate a reasonable market price.`,
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
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "receipt_items",
            strict: true,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Product name" },
                      quantity: { type: "number", description: "Number of items" },
                      category: {
                        type: "string",
                        enum: ["produce", "dairy", "meat", "bakery", "frozen", "beverages", "pantry", "other"],
                        description: "Simple food category",
                      },
                      unit: {
                        type: "string",
                        description: "Unit of measurement for the quantity (e.g. kg, g, ml, L, pcs, pack, loaf, dozen, bottle, can)",
                      },
                      co2Emission: {
                        type: "number",
                        description: "Estimated kg CO2e per unit based on eco-focused sub-category",
                      },
                      unitPrice: {
                        type: "number",
                        description: "Price of the item as shown on the receipt",
                      },
                    },
                    required: ["name", "quantity", "category", "unit", "co2Emission", "unitPrice"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content || '{"items":[]}';
      console.log("OpenAI raw response:", content);
      console.log("Finish reason:", response.choices[0]?.finish_reason);
      console.log("Refusal:", response.choices[0]?.message?.refusal);
      const parsed = JSON.parse(content) as {
        items: Array<{ name: string; quantity: number; category: string; unit: string; co2Emission: number; unitPrice: number }>;
      };

      return json({ items: parsed.items });
    } catch (e) {
      console.error("Receipt scan error:", e);
      return error("Failed to scan receipt", 500);
    }
  });

  // ==================== Pending Consumption Records ====================

  // Get all pending consumption records for the authenticated user
  router.get("/api/v1/myfridge/consumption/pending", async (req) => {
    try {
      const user = getUser(req);

      const records = await db.query.pendingConsumptionRecords.findMany({
        where: and(
          eq(pendingConsumptionRecords.userId, user.id),
          eq(pendingConsumptionRecords.status, "PENDING_WASTE_PHOTO")
        ),
        orderBy: [desc(pendingConsumptionRecords.createdAt)],
      });

      // Parse ingredients JSON for each record
      const formattedRecords = records.map((record) => {
        let ingredients: unknown[] = [];
        try {
          ingredients = JSON.parse(record.ingredients);
        } catch {
          ingredients = [];
        }
        return {
          id: record.id,
          rawPhoto: record.rawPhoto,
          ingredients,
          status: record.status,
          createdAt: record.createdAt?.toISOString() || new Date().toISOString(),
        };
      });

      return json(formattedRecords);
    } catch (e) {
      console.error("Get pending consumptions error:", e);
      return error("Failed to get pending consumptions", 500);
    }
  });

  // Create a new pending consumption record
  router.post("/api/v1/myfridge/consumption/pending", async (req) => {
    console.log("[pending/create] Endpoint called");
    try {
      const user = getUser(req);
      console.log("[pending/create] User:", user.id);

      const body = await parseBody<{
        rawPhoto?: string;
        ingredients?: unknown[];
        status?: string;
      }>(req);
      console.log("[pending/create] Body received:", {
        hasRawPhoto: !!body?.rawPhoto,
        rawPhotoLength: body?.rawPhoto?.length || 0,
        ingredientsCount: Array.isArray(body?.ingredients) ? body.ingredients.length : 'not array',
        status: body?.status,
      });

      const parsed = pendingConsumptionSchema.safeParse(body);
      if (!parsed.success) {
        console.log("[pending/create] Validation failed:", parsed.error.errors);
        return error(parsed.error.errors[0].message, 400);
      }
      console.log("[pending/create] Validation passed");

      const { rawPhoto, ingredients, status } = parsed.data;

      const [record] = await db
        .insert(pendingConsumptionRecords)
        .values({
          userId: user.id,
          rawPhoto,
          ingredients: JSON.stringify(ingredients),
          status,
        })
        .returning();

      let parsedIngredients: unknown[] = [];
      try {
        parsedIngredients = JSON.parse(record.ingredients);
      } catch {
        parsedIngredients = [];
      }

      return json({
        id: record.id,
        rawPhoto: record.rawPhoto,
        ingredients: parsedIngredients,
        status: record.status,
        createdAt: record.createdAt?.toISOString() || new Date().toISOString(),
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Create pending consumption error:", e);
      return error("Failed to create pending consumption", 500);
    }
  });

  // Update a pending consumption record
  router.put("/api/v1/myfridge/consumption/pending/:id", async (req, params) => {
    try {
      const user = getUser(req);
      const recordId = parseInt(params.id, 10);
      const body = await parseBody(req);

      const parsed = pendingConsumptionSchema.partial().safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0].message, 400);
      }

      // Check if record exists and belongs to user
      const existing = await db.query.pendingConsumptionRecords.findFirst({
        where: and(
          eq(pendingConsumptionRecords.id, recordId),
          eq(pendingConsumptionRecords.userId, user.id)
        ),
      });

      if (!existing) {
        return error("Pending consumption record not found", 404);
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (parsed.data.rawPhoto !== undefined) {
        updateData.rawPhoto = parsed.data.rawPhoto;
      }
      if (parsed.data.ingredients !== undefined) {
        updateData.ingredients = JSON.stringify(parsed.data.ingredients);
      }
      if (parsed.data.status !== undefined) {
        updateData.status = parsed.data.status;
      }

      const [updated] = await db
        .update(pendingConsumptionRecords)
        .set(updateData)
        .where(eq(pendingConsumptionRecords.id, recordId))
        .returning();

      let updatedIngredients: unknown[] = [];
      try {
        updatedIngredients = JSON.parse(updated.ingredients);
      } catch {
        updatedIngredients = [];
      }

      return json({
        id: updated.id,
        rawPhoto: updated.rawPhoto,
        ingredients: updatedIngredients,
        status: updated.status,
        createdAt: updated.createdAt?.toISOString() || new Date().toISOString(),
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Update pending consumption error:", e);
      return error("Failed to update pending consumption", 500);
    }
  });

  // Delete a pending consumption record
  router.delete("/api/v1/myfridge/consumption/pending/:id", async (req, params) => {
    try {
      const user = getUser(req);
      const recordId = parseInt(params.id, 10);

      // Check if record exists and belongs to user
      const existing = await db.query.pendingConsumptionRecords.findFirst({
        where: and(
          eq(pendingConsumptionRecords.id, recordId),
          eq(pendingConsumptionRecords.userId, user.id)
        ),
      });

      if (!existing) {
        return error("Pending consumption record not found", 404);
      }

      await db
        .delete(pendingConsumptionRecords)
        .where(eq(pendingConsumptionRecords.id, recordId));

      return json({ message: "Pending consumption record deleted" });
    } catch (e) {
      console.error("Delete pending consumption error:", e);
      return error("Failed to delete pending consumption", 500);
    }
  });
}

