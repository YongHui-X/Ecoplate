import OpenAI from "openai";
import { products } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { getEmissionFactor, classifyCategory } from "../utils/co2-factors";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../db/schema";

export async function identifyIngredients(
  db: BunSQLiteDatabase<typeof schema>,
  userId: number,
  imageBase64: string
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  // Get user's fridge products with quantity > 0
  const fridgeProducts = await db.query.products.findMany({
    where: and(
      eq(products.userId, userId),
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

  const fridgeIdSet = new Set(fridgeProducts.map((p) => p.id));

  const openai = new OpenAI({ apiKey });

  console.log("[consumption/identify] Calling OpenAI API...");
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a kitchen ingredient identifier. Analyze this image of raw ingredients being prepared for cooking.

YOUR TASK:
Match visible ingredients to items in the user's fridge inventory using EXACT name matches only.

FRIDGE INVENTORY:
${JSON.stringify(fridgeList, null, 2)}

INSTRUCTIONS:
1. Look at the image and identify each visible food ingredient
2. Match each ingredient to an item in the fridge inventory by name. Only use product IDs from the inventory list above.
3. Estimate the PERCENTAGE (0-100) of that fridge item being used
4. Do NOT include ingredients that are not in the fridge inventory

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

FOR EACH INGREDIENT RETURN:
- productId: The ID from fridge inventory (MUST be an ID from the list above)
- name: What you see in the image (e.g., "chopped onion")
- matchedProductName: The exact fridge item name it matches
- percentageUsed: Estimated percentage of fridge item (0-100)

EXAMPLE:
If fridge has {"id": 5, "name": "Yellow Onion", "quantity": 3} and you see half an onion chopped:
{"productId": 5, "name": "chopped onion", "matchedProductName": "Yellow Onion", "percentageUsed": 17}

Return an empty ingredients array if no food ingredients are visible or none match the fridge inventory.`,
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
                  productId: { type: "number", description: "Fridge product ID (must be from inventory)" },
                  name: { type: "string", description: "What you see in the image" },
                  matchedProductName: { type: "string", description: "Exact fridge item name" },
                  percentageUsed: { type: "number", description: "Percentage of fridge item being used (0-100)" },
                },
                required: [
                  "productId",
                  "name",
                  "matchedProductName",
                  "percentageUsed",
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
    }>;
  };
  console.log("[consumption/identify] Parsed ingredients count:", parsed_response.ingredients?.length || 0);

  // Server-side filter: strip any result where productId doesn't match a real fridge product ID
  const filteredIngredients = parsed_response.ingredients.filter(
    (ing) => fridgeIdSet.has(ing.productId)
  );

  // Post-process: Convert percentage to actual quantity and add category/unitPrice/co2Emission from fridge data
  const processedIngredients = filteredIngredients.map((ing) => {
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
      co2Emission: fridgeProduct?.co2Emission || getEmissionFactor(ing.name, fridgeProduct?.category || undefined),
    };
  });

  return { ingredients: processedIngredients };
}

export async function analyzeWaste(
  imageBase64: string,
  ingredients: Array<{
    productId: number;
    productName: string;
    quantityUsed: number;
    category: string;
    unitPrice: number;
    co2Emission?: number;
  }>
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const openai = new OpenAI({ apiKey });

  const ingredientList = ingredients.map((i) => ({
    productId: i.productId,
    name: i.productName,
    quantityUsed: i.quantityUsed,
    category: i.category,
  }));

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
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

  return {
    wasteAnalysis: {
      wasteItems: processedWasteItems,
      overallObservation: parsed_response.overallObservation,
    },
  };
}
