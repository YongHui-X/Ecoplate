import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { products, productInteraction, userPoints } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";

const productSchema = z.object({
  productName: z.string().min(1).max(200),
  category: z.string().optional(),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().optional(),
  unitPrice: z.number().optional(),
  purchaseDate: z.string().optional(),
  description: z.string().optional(),
  co2Emission: z.number().optional(),
  description: z.string().optional(),
  co2Emission: z.number().optional(),
});

const interactionSchema = z.object({
  type: z.enum(["consumed", "wasted", "shared", "sold"]),
  quantity: z.number().positive(),
  todayDate: z.string().optional(),
});

// Points awarded for different actions
const POINTS = {
  consumed: 5,
  shared: 10,
  sold: 8,
  wasted: -2,
  addProduct: 2,
};

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
          unitPrice: data.unitPrice,
          purchaseDate: data.purchaseDate,
          description: data.description,
          co2Emission: data.co2Emission,
        })
        .returning();

      // Award points for adding a product
      await awardPoints(user.id, POINTS.addProduct);

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
        .set(data)
        .where(eq(products.id, productId))
        .returning();

      return json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Create product error:", e);
      return error("Failed to create product", 500);
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

      // Log the interaction
      await db.insert(productInteraction).values({
        productId,
        userId: user.id,
        todayDate: data.todayDate || new Date().toISOString().split("T")[0],
        quantity: data.quantity,
        type: data.type,
      });

      // Award/deduct points based on action
      const pointsChange = POINTS[data.type];
      await awardPoints(user.id, pointsChange);

      return json({ message: "Product interaction logged", pointsChange });
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
                text: "Analyze this grocery receipt image and extract the food items. Only include food items. Ignore non-food items like bags, taxes, totals, etc. If no food items are found, return an empty items array.",
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
                        enum: [
                                "Ruminant meat",
                                "Non-ruminant meat",
                                "Seafood",
                                "Dairy",
                                "Eggs",
                                "Grains & cereals",
                                "Legumes & pulses",
                                "Vegetables",
                                "Fruits",
                                "Nuts & seeds",
                                "Oils & fats",
                                "Sugar & sweeteners",
                                "Processed plant-based foods"
                              ]
,
                        description: "Food category",
                      },
                    },
                    required: ["name", "quantity", "price", "category"],
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
      const parsed = JSON.parse(content) as { items: Array<{ name: string; quantity: number; category: string }> };

      return json({ items: parsed.items });
    } catch (e) {
      console.error("Receipt scan error:", e);
      return error("Failed to scan receipt", 500);
    }
  });
}

async function awardPoints(userId: number, amount: number) {
  const currentPoints = await db.query.userPoints.findFirst({
    where: eq(userPoints.userId, userId),
  });

  if (currentPoints) {
    const newTotal = Math.max(0, (currentPoints.totalPoints ?? 0) + amount);
    await db
      .update(userPoints)
      .set({ totalPoints: newTotal })
      .where(eq(userPoints.userId, userId));
  }
}
