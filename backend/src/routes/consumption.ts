import { Router, json, error, parseBody } from "../utils/router";
import { products, productSustainabilityMetrics, pendingConsumptionRecords } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import OpenAI from "openai";
import {
  calculateWasteMetrics,
  getCO2Emission,
  classifyCategory,
  type IngredientInput,
} from "../services/consumption-service";
import { awardPoints } from "../services/gamification-service";
import { convertToKg } from "../utils/co2-calculator";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../db/schema";

// ==================== Validation Schemas ====================

// Max base64 image size: ~7MB (5MB image + base64 overhead)
const MAX_BASE64_SIZE = 7 * 1024 * 1024;

const identifySchema = z.object({
  imageBase64: z.string().min(1, "Image is required").max(MAX_BASE64_SIZE, "Image too large (max 5MB)"),
});

const ingredientSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().min(1).max(200),
  quantityUsed: z.number().positive().max(10000),
  unit: z.string().nullable().optional(),
  category: z.string().max(50),
  unitPrice: z.number().min(0).max(100000),
  co2Emission: z.number().min(0).max(10000).optional(),
});

const analyzeWasteSchema = z.object({
  imageBase64: z.string().min(1, "Image is required").max(MAX_BASE64_SIZE, "Image too large (max 5MB)"),
  ingredients: z.array(ingredientSchema).min(1, "Ingredients are required").max(50, "Too many ingredients"),
});

const confirmIngredientsSchema = z.object({
  ingredients: z.array(ingredientSchema).min(1, "Ingredients are required").max(50, "Too many ingredients"),
  pendingRecordId: z.number().int().positive().optional(),
});

const wasteItemSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().min(1).max(200),
  quantityWasted: z.number().min(0).max(10000),
});

const confirmWasteSchema = z.object({
  ingredients: z.array(ingredientSchema.extend({
    interactionId: z.number().int().positive().optional(),
  })).min(1, "Ingredients are required").max(50, "Too many ingredients"),
  wasteItems: z.array(wasteItemSchema).max(50, "Too many waste items"),
  pendingRecordId: z.number().int().positive().optional(),
});

// ==================== Route Registration ====================

export function registerConsumptionRoutes(
  router: Router,
  db: BunSQLiteDatabase<typeof schema>
) {

  // API 1: Identify ingredients from a photo of raw food
  router.post("/api/v1/consumption/identify", async (req) => {
    console.log("[consumption/identify] Endpoint called");
    try {
      const user = getUser(req);
      console.log("[consumption/identify] User:", user.id);

      const body = await parseBody<{ imageBase64?: string }>(req);
      console.log("[consumption/identify] Body received, imageBase64 length:", body?.imageBase64?.length || 0);

      const parsed = identifySchema.safeParse(body);
      if (!parsed.success) {
        console.log("[consumption/identify] Validation failed:", parsed.error.errors[0].message);
        return error(parsed.error.errors[0].message, 400);
      }

      const { imageBase64 } = parsed.data;
      console.log("[consumption/identify] Image validated, starts with 'data:':", imageBase64.startsWith("data:"));

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.log("[consumption/identify] ERROR: OpenAI API key not configured");
        return error("OpenAI API key not configured", 500);
      }
      console.log("[consumption/identify] OpenAI API key present");

      // Get user's fridge products with quantity > 0
      const fridgeProducts = await db.query.products.findMany({
        where: and(
          eq(products.userId, user.id),
          gt(products.quantity, 0)
        ),
      });
      console.log("[consumption/identify] Fridge products found:", fridgeProducts.length);

      const fridgeList = fridgeProducts.map((p) => ({
        id: p.id,
        name: p.productName,
        category: p.category,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        co2Emission: p.co2Emission,
      }));
      console.log("[consumption/identify] Fridge list:", JSON.stringify(fridgeList));

      const openai = new OpenAI({ apiKey });

      console.log("[consumption/identify] Calling OpenAI API...");
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a kitchen ingredient identifier. Analyze this image of raw ingredients being prepared for cooking.

YOUR TASK:
Match visible ingredients to items in the user's fridge inventory and estimate how much is being used.

FRIDGE INVENTORY:
${JSON.stringify(fridgeList, null, 2)}

INSTRUCTIONS:
1. Look at the image and identify each visible food ingredient
2. Match each ingredient to the closest item in the fridge inventory by name
3. Estimate the PERCENTAGE (0-100) of that fridge item being used

VISUAL CUES TO LOOK FOR:
- Raw vegetables (whole, chopped, or sliced)
- Raw meat or fish (uncooked appearance, raw texture)
- Eggs (whole or cracked)
- Liquids in measuring cups or poured amounts
- Dry goods (rice, pasta, flour in bowls or measured)

ESTIMATION GUIDE:
- A small handful = 10-20% of typical package
- Half an onion = 50%
- One egg from a dozen = 8%
- A cup of rice from a 2lb bag = 10%

CONFIDENCE LEVELS:
- "high": Clear match, ingredient clearly visible
- "medium": Likely match, partially visible or similar items in fridge
- "low": Uncertain match, guessing based on appearance

FOR EACH INGREDIENT RETURN:
- productId: The ID from fridge inventory (use -1 if no match found)
- name: What you see in the image (e.g., "chopped onion")
- matchedProductName: The fridge item name it matches (or "Unknown" if no match)
- percentageUsed: Estimated percentage of fridge item (0-100)
- confidence: "high", "medium", or "low"

EXAMPLE:
If fridge has {"id": 5, "name": "Yellow Onion", "quantity": 3} and you see half an onion chopped:
{"productId": 5, "name": "chopped onion", "matchedProductName": "Yellow Onion", "percentageUsed": 17, "confidence": "high"}

If you see an ingredient NOT in the fridge:
{"productId": -1, "name": "garlic clove", "matchedProductName": "Unknown", "percentageUsed": 100, "confidence": "medium"}

Return an empty ingredients array if no food ingredients are visible.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "identified_ingredients",
            strict: true,
            schema: {
              type: "object",
              properties: {
                ingredients: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      productId: { type: "number", description: "Fridge product ID (-1 if no match)" },
                      name: { type: "string", description: "What you see in the image" },
                      matchedProductName: { type: "string", description: "Fridge item name or 'Unknown'" },
                      percentageUsed: { type: "number", description: "Percentage of fridge item being used (0-100)" },
                      confidence: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                        description: "Confidence level of the match",
                      },
                    },
                    required: [
                      "productId",
                      "name",
                      "matchedProductName",
                      "percentageUsed",
                      "confidence",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["ingredients"],
              additionalProperties: false,
            },
          },
        },
      });

      console.log("[consumption/identify] OpenAI API call completed");
      const content =
        response.choices[0]?.message?.content || '{"ingredients":[]}';
      console.log("[consumption/identify] OpenAI raw response:", content);
      console.log("[consumption/identify] Finish reason:", response.choices[0]?.finish_reason);
      console.log("[consumption/identify] Refusal:", response.choices[0]?.message?.refusal);

      const parsed_response = JSON.parse(content) as {
        ingredients: Array<{
          productId: number;
          name: string;
          matchedProductName: string;
          percentageUsed: number;
          confidence: "high" | "medium" | "low";
        }>;
      };
      console.log("[consumption/identify] Parsed ingredients count:", parsed_response.ingredients?.length || 0);

      // Post-process: Convert percentage to actual quantity and add category/unitPrice/co2Emission from fridge data
      const processedIngredients = parsed_response.ingredients.map((ing) => {
        const fridgeProduct = fridgeProducts.find((p) => p.id === ing.productId);
        const fridgeQuantity = fridgeProduct?.quantity || 1;
        const estimatedQuantity = (ing.percentageUsed / 100) * fridgeQuantity;

        return {
          productId: ing.productId,
          name: ing.name,
          matchedProductName: ing.matchedProductName,
          estimatedQuantity: Math.round(estimatedQuantity * 100) / 100,
          unit: fridgeProduct?.unit || null,
          category: fridgeProduct?.category || classifyCategory(ing.name),
          unitPrice: fridgeProduct?.unitPrice || 0,
          co2Emission: fridgeProduct?.co2Emission || getCO2Emission(ing.name, fridgeProduct?.category || undefined),
          confidence: ing.confidence,
        };
      });

      return json({ ingredients: processedIngredients });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        console.log("[consumption/identify] Zod validation error:", e.errors[0].message);
        return error(e.errors[0].message, 400);
      }
      // Log detailed OpenAI error information
      const err = e as { status?: number; message?: string; code?: string; type?: string };
      console.error("[consumption/identify] ERROR:", {
        message: err.message,
        status: err.status,
        code: err.code,
        type: err.type,
        fullError: e,
      });
      return error("Failed to identify ingredients", 500);
    }
  });

  // API 2: Analyze waste from a photo of leftover food
  router.post("/api/v1/consumption/analyze-waste", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const parsed = analyzeWasteSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0].message, 400);
      }

      const { imageBase64, ingredients } = parsed.data;

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return error("OpenAI API key not configured", 500);
      }

      const openai = new OpenAI({ apiKey });

      // Ask OpenAI to identify waste from the image
      const ingredientList = ingredients.map((i) => ({
        productId: i.productId,
        name: i.productName,
        quantityUsed: i.quantityUsed,
        category: i.category,
      }));

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a food waste analyst. Analyze this image of plates/containers AFTER a meal to identify uneaten food.

WHAT COUNTS AS WASTE:
- Uneaten portions left on plates
- Food scraps (peels, bones, stems that could have been avoided)
- Spoiled or discarded food visible in image
- Leftovers that won't be saved

WHAT IS NOT WASTE:
- Empty plates (food was consumed)
- Unavoidable scraps (chicken bones, fruit pits, shells)
- Food in storage containers being saved

INGREDIENTS USED IN THIS MEAL:
${JSON.stringify(ingredientList, null, 2)}

INSTRUCTIONS:
1. Examine the image for any visible food waste
2. For each wasted item, match it to an ingredient from the list above
3. Estimate what PERCENTAGE of the original quantity was wasted

ESTIMATION GUIDE:
- A few bites left = 10-20% wasted
- Half portion remaining = 50% wasted
- Most of item uneaten = 70-90% wasted
- Completely untouched = 100% wasted

FOR EACH WASTED ITEM RETURN:
- productId: The ID from the ingredients list
- productName: Name of the ingredient
- percentageWasted: Percentage of original quantity wasted (0-100)

IMPORTANT:
- Only include items that appear as waste in the image
- If an ingredient has NO visible waste, do NOT include it
- If the image shows clean/empty plates, return empty wasteItems array

EXAMPLE:
If 2 eggs were used and you see about half an egg left on the plate:
{"productId": 3, "productName": "Eggs", "percentageWasted": 25}

Provide a brief overallObservation describing the waste level (e.g., "Minimal waste - most food consumed" or "Significant waste - large portions uneaten").`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "waste_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                wasteItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      productId: { type: "number", description: "ID from the ingredients list" },
                      productName: { type: "string", description: "Name of the ingredient" },
                      percentageWasted: { type: "number", description: "Percentage of original quantity wasted (0-100)" },
                    },
                    required: [
                      "productId",
                      "productName",
                      "percentageWasted",
                    ],
                    additionalProperties: false,
                  },
                },
                overallObservation: { type: "string", description: "Brief description of waste level" },
              },
              required: ["wasteItems", "overallObservation"],
              additionalProperties: false,
            },
          },
        },
      });

      const content =
        response.choices[0]?.message?.content ||
        '{"wasteItems":[],"overallObservation":"Unable to analyze"}';
      console.log("OpenAI analyze-waste raw response:", content);
      console.log("Finish reason:", response.choices[0]?.finish_reason);
      console.log("Refusal:", response.choices[0]?.message?.refusal);

      const parsed_response = JSON.parse(content) as {
        wasteItems: Array<{
          productId: number;
          productName: string;
          percentageWasted: number;
        }>;
        overallObservation: string;
      };

      // Post-process: Convert percentage to actual quantity based on quantityUsed
      const processedWasteItems = parsed_response.wasteItems.map((waste) => {
        const ingredient = ingredients.find((i) => i.productId === waste.productId);
        const quantityUsed = ingredient?.quantityUsed || 1;
        const quantityWasted = (waste.percentageWasted / 100) * quantityUsed;

        return {
          productId: waste.productId,
          productName: waste.productName,
          quantityWasted: Math.round(quantityWasted * 100) / 100,
        };
      });

      // Only return AI detection results - no recording here
      // Recording happens in confirm-waste endpoint
      return json({
        wasteAnalysis: {
          wasteItems: processedWasteItems,
          overallObservation: parsed_response.overallObservation,
        },
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consumption analyze-waste error:", e);
      return error("Failed to analyze waste", 500);
    }
  });

  // API 3: Confirm ingredients - records Consume interactions and deducts from products
  router.post("/api/v1/consumption/confirm-ingredients", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const parsed = confirmIngredientsSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0].message, 400);
      }

      const { ingredients, pendingRecordId } = parsed.data;
      const interactionIds: number[] = [];
      const todayDate = new Date().toISOString().split("T")[0];

      for (const ing of ingredients) {
        // Fetch product first to get unit for normalization
        const product = await db.query.products.findFirst({
          where: eq(products.id, ing.productId)
        });
        const quantityInKg = convertToKg(ing.quantityUsed, product?.unit);

        // 1. Record consumed interaction with normalized quantity
        const [interaction] = await db.insert(productSustainabilityMetrics).values({
          productId: ing.productId,
          userId: user.id,
          todayDate,
          quantity: quantityInKg,
          unit: ing.unit || null,
          type: "consumed",
        }).returning();

        interactionIds.push(interaction.id);

        // 2. Award points with normalized quantity (skip metric recording since we already recorded above)
        try {
          await awardPoints(user.id, "consumed", ing.productId, quantityInKg, true);
        } catch (pointsError) {
          console.error(`[Points] Failed to award points for user ${user.id} on product ${ing.productId}:`, pointsError);
          // Don't fail the entire request, just log the error
        }

        // 3. Deduct from product quantity (keep raw unit — this is inventory, not points)
        if (product) {
          await db.update(products)
            .set({ quantity: Math.max(0, product.quantity - ing.quantityUsed) })
            .where(eq(products.id, ing.productId));
        }
      }

      // 3. Update pending record with interaction IDs (for later waste adjustment)
      if (pendingRecordId) {
        await db.update(pendingConsumptionRecords)
          .set({
            ingredients: JSON.stringify(ingredients.map((ing, i) => ({
              ...ing,
              interactionId: interactionIds[i]
            }))),
            status: "PENDING_WASTE_PHOTO"
          })
          .where(eq(pendingConsumptionRecords.id, pendingRecordId));
      }

      return json({ interactionIds, success: true });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consumption confirm-ingredients error:", e);
      return error("Failed to confirm ingredients", 500);
    }
  });

  // API 4: Confirm waste - adjusts Consume interactions and creates Waste interactions
  router.post("/api/v1/consumption/confirm-waste", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const parsed = confirmWasteSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0].message, 400);
      }

      const { ingredients, wasteItems, pendingRecordId } = parsed.data;
      const todayDate = new Date().toISOString().split("T")[0];

      for (const ing of ingredients) {
        // Find waste for this ingredient
        const waste = wasteItems.find(w => w.productId === ing.productId);
        const wastedQty = waste?.quantityWasted || 0;

        // 1. Create wasted interaction if any waste
        if (wastedQty > 0) {
          const product = await db.query.products.findFirst({
            where: eq(products.id, ing.productId)
          });
          const wastedInKg = convertToKg(wastedQty, product?.unit);

          await db.insert(productSustainabilityMetrics).values({
            productId: ing.productId,
            userId: user.id,
            todayDate,
            quantity: wastedInKg,
            unit: ing.unit || null,
            type: "wasted",
          });

          // Penalize points for waste (skip metric recording since we already recorded above)
          try {
            await awardPoints(user.id, "wasted", ing.productId, wastedInKg, true);
          } catch (pointsError) {
            console.error(`[Points] Failed to penalize points for user ${user.id} on product ${ing.productId}:`, pointsError);
            // Don't fail the entire request, just log the error
          }
        }
      }

      // 3. Calculate metrics
      const ingredientInputs: IngredientInput[] = ingredients.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantityUsed: i.quantityUsed,
        category: i.category,
        unitPrice: i.unitPrice,
        co2Emission: i.co2Emission,
      }));

      const metrics = calculateWasteMetrics(
        ingredientInputs,
        wasteItems.map(w => ({
          productId: w.productId,
          productName: w.productName,
          quantityWasted: w.quantityWasted,
        }))
      );

      // 4. Delete pending record
      if (pendingRecordId) {
        await db.delete(pendingConsumptionRecords)
          .where(eq(pendingConsumptionRecords.id, pendingRecordId));
      }

      return json({ metrics, success: true });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Consumption confirm-waste error:", e);
      return error("Failed to confirm waste", 500);
    }
  });
}
