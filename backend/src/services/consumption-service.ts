import { eq } from "drizzle-orm";
import { products, productSustainabilityMetrics, pendingConsumptionRecords } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../db/schema";
import {
  convertToKg,
  getEmissionFactor,
  DISPOSAL_EMISSION_FACTORS,
} from "../utils/co2-factors";

// Re-export from co2-factors for backwards compatibility with tests
export {
  EMISSION_FACTORS,
  CATEGORY_FALLBACKS,
  DISPOSAL_EMISSION_FACTORS,
  getEmissionFactor,
} from "../utils/co2-factors";

const DEFAULT_DISPOSAL_METHOD = "landfill";

// ==================== Types ====================

export interface IngredientInput {
  productId: number;
  productName: string;
  quantityUsed: number;
  unit?: string | null;
  category: string;
  unitPrice: number;
  co2Emission?: number;
}

export interface WasteItem {
  productName: string;
  quantityWasted: number;
  productId?: number;
}

export interface WasteMetrics {
  totalCO2Wasted: number;
  totalCO2Saved: number;
  disposalCO2: number;
  totalEconomicWaste: number;
  totalEconomicConsumed: number;
  wastePercentage: number;
  sustainabilityScore: number;
  sustainabilityRating: string;
  itemBreakdown: ItemBreakdown[];
}

export interface ItemBreakdown {
  productId: number;
  productName: string;
  quantityUsed: number;
  quantityWasted: number;
  co2Wasted: number;
  co2Saved: number;
  economicWaste: number;
  emissionFactor: number;
}

// ==================== Functions ====================

export function getSustainabilityRating(score: number): string {
  if (score <= 20) return "Excellent";
  if (score <= 40) return "Good";
  if (score <= 60) return "Moderate";
  if (score <= 80) return "Poor";
  return "Critical";
}

export function calculateWasteMetrics(
  ingredients: IngredientInput[],
  wasteItems: WasteItem[],
  disposalMethod: string = DEFAULT_DISPOSAL_METHOD
): WasteMetrics {
  const wasteMap = new Map<string, number>();
  for (const w of wasteItems) {
    const key = w.productId?.toString() ?? w.productName.toLowerCase();
    wasteMap.set(key, (wasteMap.get(key) ?? 0) + w.quantityWasted);
  }

  let totalCO2Wasted = 0;
  let totalCO2Saved = 0;
  let totalEconomicWaste = 0;
  let totalEconomicConsumed = 0;
  let totalWasteWeight = 0;
  let totalUsedWeight = 0;

  const itemBreakdown: ItemBreakdown[] = [];

  for (const ingredient of ingredients) {
    const ef =
      ingredient.co2Emission && ingredient.co2Emission > 0
        ? ingredient.co2Emission
        : getEmissionFactor(ingredient.productName, ingredient.category);

    let wastedQty =
      wasteMap.get(ingredient.productId.toString()) ??
      wasteMap.get(ingredient.productName.toLowerCase()) ??
      0;

    wastedQty = Math.min(wastedQty, ingredient.quantityUsed);

    const consumedQty = ingredient.quantityUsed - wastedQty;

    // Convert to kg for CO2 calculations (emission factors are per-kg)
    const wastedKg = convertToKg(wastedQty, ingredient.unit);
    const consumedKg = convertToKg(consumedQty, ingredient.unit);
    const usedKg = convertToKg(ingredient.quantityUsed, ingredient.unit);

    const co2Wasted = wastedKg * ef;
    const co2Saved = consumedKg * ef;
    // Economic waste ratio uses original units (ratio is unit-agnostic)
    const economicWaste =
      ingredient.quantityUsed > 0
        ? (wastedQty / ingredient.quantityUsed) * ingredient.unitPrice
        : 0;
    const economicConsumed = ingredient.unitPrice - economicWaste;

    totalCO2Wasted += co2Wasted;
    totalCO2Saved += co2Saved;
    totalEconomicWaste += economicWaste;
    totalEconomicConsumed += economicConsumed;
    totalWasteWeight += wastedKg;
    totalUsedWeight += usedKg;

    itemBreakdown.push({
      productId: ingredient.productId,
      productName: ingredient.productName,
      quantityUsed: ingredient.quantityUsed,
      quantityWasted: wastedQty,
      co2Wasted,
      co2Saved,
      economicWaste,
      emissionFactor: ef,
    });
  }

  const wastePercentage =
    totalUsedWeight > 0 ? (totalWasteWeight / totalUsedWeight) * 100 : 0;

  const disposalFactor = DISPOSAL_EMISSION_FACTORS[disposalMethod] ?? DISPOSAL_EMISSION_FACTORS.landfill;
  const disposalCO2 = totalWasteWeight * disposalFactor;

  const totalCost = totalEconomicWaste + totalEconomicConsumed;
  const economicScore =
    totalCost > 0
      ? Math.min((totalEconomicWaste / totalCost) * 100, 100)
      : 0;

  const totalCO2 = totalCO2Wasted + totalCO2Saved;
  const environmentalScore =
    totalCO2 > 0 ? Math.min((totalCO2Wasted / totalCO2) * 100, 100) : 0;

  const sustainabilityScore = Math.round(
    economicScore * 0.5 + environmentalScore * 0.5
  );

  const sustainabilityRating = getSustainabilityRating(sustainabilityScore);

  return {
    totalCO2Wasted: round2(totalCO2Wasted),
    totalCO2Saved: round2(totalCO2Saved),
    disposalCO2: round2(disposalCO2),
    totalEconomicWaste: round2(totalEconomicWaste),
    totalEconomicConsumed: round2(totalEconomicConsumed),
    wastePercentage: round2(wastePercentage),
    sustainabilityScore,
    sustainabilityRating,
    itemBreakdown,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ==================== DB Operations ====================

export async function confirmIngredients(
  db: BunSQLiteDatabase<typeof schema>,
  userId: number,
  ingredients: IngredientInput[],
  pendingRecordId?: number
): Promise<{ interactionIds: number[]; success: boolean; newBadges: Array<{ code: string; name: string; pointsAwarded: number }> }> {
  const interactionIds: number[] = [];
  const todayDate = new Date().toISOString().split("T")[0];

  for (const ing of ingredients) {
    const product = await db.query.products.findFirst({
      where: eq(products.id, ing.productId)
    });
    const quantityInKg = convertToKg(ing.quantityUsed, product?.unit);

    const [interaction] = await db.insert(productSustainabilityMetrics).values({
      productId: ing.productId,
      userId,
      todayDate,
      quantity: quantityInKg,
      unit: ing.unit || null,
      type: "consumed",
    }).returning();

    interactionIds.push(interaction.id);

    if (product) {
      await db.update(products)
        .set({ quantity: Math.max(0, product.quantity - ing.quantityUsed) })
        .where(eq(products.id, ing.productId));
    }
  }

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

  const { checkAndAwardBadges } = await import("./badge-service");
  const newBadges = await checkAndAwardBadges(userId);

  return { interactionIds, success: true, newBadges };
}

export async function confirmWaste(
  db: BunSQLiteDatabase<typeof schema>,
  userId: number,
  ingredients: IngredientInput[],
  wasteItems: Array<{ productId: number; productName: string; quantityWasted: number }>,
  pendingRecordId?: number
): Promise<{ metrics: WasteMetrics; success: boolean; newBadges: Array<{ code: string; name: string; pointsAwarded: number }> }> {
  const todayDate = new Date().toISOString().split("T")[0];

  for (const ing of ingredients) {
    const waste = wasteItems.find(w => w.productId === ing.productId);
    const wastedQty = waste?.quantityWasted || 0;

    if (wastedQty > 0) {
      const product = await db.query.products.findFirst({
        where: eq(products.id, ing.productId)
      });
      const wastedInKg = convertToKg(wastedQty, product?.unit);

      await db.insert(productSustainabilityMetrics).values({
        productId: ing.productId,
        userId,
        todayDate,
        quantity: wastedInKg,
        unit: ing.unit || null,
        type: "wasted",
      });
    }
  }

  const ingredientInputs: IngredientInput[] = ingredients.map((i) => ({
    productId: i.productId,
    productName: i.productName,
    quantityUsed: i.quantityUsed,
    unit: i.unit,
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

  if (pendingRecordId) {
    await db.delete(pendingConsumptionRecords)
      .where(eq(pendingConsumptionRecords.id, pendingRecordId));
  }

  const { checkAndAwardBadges } = await import("./badge-service");
  const newBadges = await checkAndAwardBadges(userId);

  return { metrics, success: true, newBadges };
}
