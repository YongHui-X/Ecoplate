import { eq, and } from "drizzle-orm";
import { products, productSustainabilityMetrics } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../db/schema";

// ==================== Emission Factors ====================
// Source: sustainability_scoring_system.md - kg CO2e per kg food

export const EMISSION_FACTORS: Record<string, number> = {
  // Proteins
  beef: 99.0,
  lamb: 39.0,
  pork: 12.0,
  chicken: 9.0,
  fish: 13.0,
  salmon: 13.0,
  tuna: 13.0,
  shrimp: 13.0,
  prawns: 13.0,
  eggs: 4.5,
  tofu: 3.0,
  legumes: 0.9,
  beans: 0.9,
  lentils: 0.9,
  // Dairy
  cheese: 13.5,
  milk: 8.0,
  yogurt: 5.0,
  butter: 12.0,
  // Grains & Starches
  rice: 4.0,
  wheat: 1.5,
  bread: 1.5,
  pasta: 2.5,
  potatoes: 0.5,
  // Vegetables
  lettuce: 2.0,
  spinach: 2.0,
  kale: 2.0,
  carrots: 0.4,
  onions: 0.5,
  garlic: 0.5,
  tomatoes: 2.0,
  mushrooms: 2.5,
  broccoli: 2.0,
  cabbage: 2.0,
  peppers: 2.0,
  // Fruits
  berries: 1.5,
  apples: 0.6,
  bananas: 0.9,
  oranges: 0.7,
  lemons: 0.7,
  mango: 1.5,
  grapes: 1.5,
  // Processed
  canned: 3.0,
  frozen: 4.0,
  snacks: 5.0,
};

export const CATEGORY_FALLBACKS: Record<string, number> = {
  meat: 15.0,
  dairy: 9.0,
  produce: 1.5,
  pantry: 2.5,
  bakery: 1.5,
  frozen: 4.0,
  beverages: 1.0,
  other: 2.0,
};

const DEFAULT_EMISSION_FACTOR = 2.0;

// ==================== Types ====================

export interface IngredientInput {
  productId: number;
  productName: string;
  quantityUsed: number;
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

/**
 * Resolve emission factor by product name, then category fallback, then default.
 */
export function getEmissionFactor(
  productName: string,
  category?: string
): number {
  const nameLower = productName.toLowerCase();

  // Try exact key match first
  if (EMISSION_FACTORS[nameLower] !== undefined) {
    return EMISSION_FACTORS[nameLower];
  }

  // Try partial match: check if any emission factor key appears in the product name
  for (const [key, value] of Object.entries(EMISSION_FACTORS)) {
    if (nameLower.includes(key)) {
      return value;
    }
  }

  // Fallback to category
  if (category && CATEGORY_FALLBACKS[category] !== undefined) {
    return CATEGORY_FALLBACKS[category];
  }

  return DEFAULT_EMISSION_FACTOR;
}

/**
 * Get sustainability rating from score (0-100 scale, lower is better).
 */
export function getSustainabilityRating(score: number): string {
  if (score <= 20) return "Excellent";
  if (score <= 40) return "Good";
  if (score <= 60) return "Moderate";
  if (score <= 80) return "Poor";
  return "Critical";
}

/**
 * Calculate waste metrics from ingredients and waste items.
 */
export function calculateWasteMetrics(
  ingredients: IngredientInput[],
  wasteItems: WasteItem[]
): WasteMetrics {
  // Build waste lookup by productId or productName
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

    // Look up waste by productId first, then by name
    let wastedQty =
      wasteMap.get(ingredient.productId.toString()) ??
      wasteMap.get(ingredient.productName.toLowerCase()) ??
      0;

    // Clamp waste to used quantity
    wastedQty = Math.min(wastedQty, ingredient.quantityUsed);

    const consumedQty = ingredient.quantityUsed - wastedQty;

    const co2Wasted = wastedQty * ef;
    const co2Saved = consumedQty * ef;
    const economicWaste =
      ingredient.quantityUsed > 0
        ? (wastedQty / ingredient.quantityUsed) * ingredient.unitPrice
        : 0;
    const economicConsumed = ingredient.unitPrice - economicWaste;

    totalCO2Wasted += co2Wasted;
    totalCO2Saved += co2Saved;
    totalEconomicWaste += economicWaste;
    totalEconomicConsumed += economicConsumed;
    totalWasteWeight += wastedQty;
    totalUsedWeight += ingredient.quantityUsed;

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

  // Composite sustainability score (0-100, lower is better)
  // Economic component: waste cost ratio
  const totalCost = totalEconomicWaste + totalEconomicConsumed;
  const economicScore =
    totalCost > 0
      ? Math.min((totalEconomicWaste / totalCost) * 100, 100)
      : 0;

  // Environmental component: CO2 wasted ratio
  const totalCO2 = totalCO2Wasted + totalCO2Saved;
  const environmentalScore =
    totalCO2 > 0 ? Math.min((totalCO2Wasted / totalCO2) * 100, 100) : 0;

  // 50/50 weighting
  const sustainabilityScore = Math.round(
    economicScore * 0.5 + environmentalScore * 0.5
  );

  const sustainabilityRating = getSustainabilityRating(sustainabilityScore);

  return {
    totalCO2Wasted: round2(totalCO2Wasted),
    totalCO2Saved: round2(totalCO2Saved),
    totalEconomicWaste: round2(totalEconomicWaste),
    totalEconomicConsumed: round2(totalEconomicConsumed),
    wastePercentage: round2(wastePercentage),
    sustainabilityScore,
    sustainabilityRating,
    itemBreakdown,
  };
}

/**
 * Record consumption and waste interactions in the database.
 */
export async function recordConsumptionInteractions(
  db: BunSQLiteDatabase<typeof schema>,
  userId: number,
  ingredients: IngredientInput[],
  wasteItems: WasteItem[]
): Promise<{ recorded: boolean; count: number }> {
  // Build waste lookup
  const wasteMap = new Map<string, number>();
  for (const w of wasteItems) {
    const key = w.productId?.toString() ?? w.productName.toLowerCase();
    wasteMap.set(key, (wasteMap.get(key) ?? 0) + w.quantityWasted);
  }

  const todayDate = new Date().toISOString().split("T")[0];
  let count = 0;

  for (const ingredient of ingredients) {
    let wastedQty =
      wasteMap.get(ingredient.productId.toString()) ??
      wasteMap.get(ingredient.productName.toLowerCase()) ??
      0;
    wastedQty = Math.min(wastedQty, ingredient.quantityUsed);
    const consumedQty = ingredient.quantityUsed - wastedQty;

    if (consumedQty > 0) {
      await db.insert(productSustainabilityMetrics).values({
        productId: ingredient.productId,
        userId,
        todayDate,
        quantity: consumedQty,
        type: "Consume",
      });
      count++;
    }

    if (wastedQty > 0) {
      await db.insert(productSustainabilityMetrics).values({
        productId: ingredient.productId,
        userId,
        todayDate,
        quantity: wastedQty,
        type: "Waste",
      });
      count++;
    }
  }

  return { recorded: count > 0, count };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
