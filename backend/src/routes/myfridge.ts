import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { products } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";

const productSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().optional(),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().optional(),
  purchaseDate: z.string().optional(),
  description: z.string().optional(),
  co2Emission: z.number().optional(),
});

const consumeSchema = z.object({
  action: z.enum(["consumed", "wasted", "shared", "sold"]),
  quantity: z.number().positive(),
});

export function registerMyFridgeRoutes(router: Router) {
  // Get all products for the authenticated user
  router.get("/api/v1/myfridge/products", async (req) => {
    const user = getUser(req);

    const result = await db.query.products.findMany({
      where: eq(products.userId, user.id),
    });

    return json(
      result.map((p) => ({
        id: p.id,
        name: p.productName,
        category: p.category,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        purchaseDate: p.purchaseDate ? p.purchaseDate.toISOString() : null,
        description: p.description,
        co2Emission: p.co2Emission,
      }))
    );
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
          productName: data.name,
          category: data.category,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          purchaseDate: data.purchaseDate
            ? new Date(data.purchaseDate)
            : undefined,
          description: data.description,
          co2Emission: data.co2Emission,
        })
        .returning();

      return json({
        id: product.id,
        name: product.productName,
        category: product.category,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        purchaseDate: product.purchaseDate
          ? product.purchaseDate.toISOString()
          : null,
        description: product.description,
        co2Emission: product.co2Emission,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Create product error:", e);
      return error("Failed to create product", 500);
    }
  });

  // Consume / share / sell / waste a product
  router.post("/api/v1/myfridge/products/:id/consume", async (req, params) => {
    try {
      const user = getUser(req);
      const productId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = consumeSchema.parse(body);

      const product = await db.query.products.findFirst({
        where: and(
          eq(products.id, productId),
          eq(products.userId, user.id)
        ),
      });

      if (!product) {
        return error("Product not found", 404);
      }

      // Remove the product
      await db.delete(products).where(eq(products.id, productId));

      const points: Record<string, number> = {
        consumed: 5,
        shared: 10,
        sold: 8,
        wasted: 0,
      };

      return json({
        message: `Product ${data.action}`,
        pointsEarned: points[data.action] || 0,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consume product error:", e);
      return error("Failed to update product", 500);
    }
  });

  // Delete a product
  router.delete("/api/v1/myfridge/products/:id", async (req, params) => {
    const user = getUser(req);
    const productId = parseInt(params.id, 10);

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.userId, user.id)
      ),
    });

    if (!product) {
      return error("Product not found", 404);
    }

    await db.delete(products).where(eq(products.id, productId));

    return json({ message: "Product deleted" });
  });
}
