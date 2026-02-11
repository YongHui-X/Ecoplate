import { eq, and } from "drizzle-orm";
import { products, productSustainabilityMetrics } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../db/schema";
import { convertToKg } from "../utils/co2-calculator";

// ==================== Emission Factors ====================
// Source: Unified with frontend/src/utils/co2Calculator.ts (kg CO2e per kg food)

export const EMISSION_FACTORS: Record<string, number> = {
  // Meat & Poultry
  beef: 27.0,
  steak: 27.0,
  lamb: 39.2,
  pork: 12.1,
  chicken: 6.9,
  poultry: 6.9,
  turkey: 10.9,
  // Seafood
  salmon: 6.0,
  tuna: 6.1,
  shrimp: 18.0,
  prawn: 18.0,
  fish: 5.5,
  // Dairy & Eggs
  cheese: 13.5,
  milk: 3.2,
  butter: 12.0,
  yogurt: 2.2,
  yoghurt: 2.2,
  egg: 4.8,
  eggs: 4.8,
  cream: 7.6,
  // Grains & Bread
  rice: 2.7,
  bread: 0.9,
  pasta: 1.1,
  noodle: 1.1,
  flour: 0.9,
  cereal: 0.9,
  oat: 0.9,
  // Fruits
  banana: 0.7,
  apple: 0.3,
  orange: 0.3,
  citrus: 0.3,
  berr: 1.1,
  avocado: 0.8,
  mango: 0.8,
  grape: 1.4,
  // Vegetables
  tomato: 1.4,
  potato: 0.3,
  carrot: 0.2,
  lettuce: 0.2,
  salad: 0.2,
  broccoli: 0.4,
  onion: 0.3,
  cucumber: 0.3,
  pepper: 0.7,
  capsicum: 0.7,
  // Beverages
  coffee: 4.0,
  tea: 1.0,
  juice: 1.1,
  soda: 0.4,
  beer: 0.3,
  wine: 1.3,
  // Snacks & Processed
  chocolate: 19.0,
  cocoa: 19.0,
  cookie: 2.5,
  biscuit: 2.5,
  chips: 2.3,
  crisp: 2.3,
  candy: 3.0,
  sweet: 3.0,
  // Oils & Condiments
  oil: 3.0,
  sauce: 1.5,
  ketchup: 1.5,
  // Nuts & Seeds
  almond: 2.3,
  nut: 2.3,
  // Legacy/Other
  tofu: 3.0,
  legumes: 0.9,
  beans: 0.9,
  lentils: 0.9,
};

export const CATEGORY_FALLBACKS: Record<string, number> = {
  meat: 15.0,
  protein: 15.0,
  dairy: 5.0,
  produce: 0.5,
  grains: 1.2,
  beverages: 1.0,
  snacks: 2.5,
  pantry: 2.0,
  bakery: 1.0,
  frozen: 3.0,
  other: 3.0,
};

export const DISPOSAL_EMISSION_FACTORS: Record<string, number> = {
  landfill: 0.5,
  composting: 0.1,
  incineration: 0.9,
};

const DEFAULT_EMISSION_FACTOR = 2.0;
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
  wasteItems: WasteItem[],
  disposalMethod: string = DEFAULT_DISPOSAL_METHOD
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

    // Convert to kg for CO2 calculation (consistent with confirm-ingredients)
    const consumedInKg = convertToKg(consumedQty, ingredient.unit);
    const wastedInKg = convertToKg(wastedQty, ingredient.unit);

    const co2Wasted = wastedInKg * ef;
    const co2Saved = consumedInKg * ef;
    const economicWaste =
      ingredient.quantityUsed > 0
        ? (wastedQty / ingredient.quantityUsed) * ingredient.unitPrice
        : 0;
    const economicConsumed = ingredient.unitPrice - economicWaste;

    totalCO2Wasted += co2Wasted;
    totalCO2Saved += co2Saved;
    totalEconomicWaste += economicWaste;
    totalEconomicConsumed += economicConsumed;
    totalWasteWeight += wastedInKg;
    totalUsedWeight += consumedInKg + wastedInKg;

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

  // Calculate disposal CO2 based on method
  const disposalFactor = DISPOSAL_EMISSION_FACTORS[disposalMethod] ?? DISPOSAL_EMISSION_FACTORS.landfill;
  const disposalCO2 = totalWasteWeight * disposalFactor;

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
    disposalCO2: round2(disposalCO2),
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
        type: "consumed",
      });
      count++;
    }

    if (wastedQty > 0) {
      await db.insert(productSustainabilityMetrics).values({
        productId: ingredient.productId,
        userId,
        todayDate,
        quantity: wastedQty,
        type: "wasted",
      });
      count++;
    }
  }

  return { recorded: count > 0, count };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ==================== CO2 and Category Helper Functions ====================

/**
 * Get CO2 emission estimate based on product name keywords.
 * Used when the AI model doesn't provide CO2 values (offloading calculation to backend).
 */
export function getCO2Emission(productName: string, category?: string): number {
  const name = productName.toLowerCase();

  // Check specific keywords first (ordered by specificity)
  if (name.includes('beef') || name.includes('steak') || name.includes('ground beef')) return 27.0;
  if (name.includes('lamb')) return 39.0;
  if (name.includes('chicken') || name.includes('poultry') || name.includes('turkey')) return 6.9;
  if (name.includes('pork') || name.includes('bacon') || name.includes('ham') || name.includes('sausage')) return 7.2;
  if (name.includes('salmon')) return 6.0;
  if (name.includes('tuna')) return 5.5;
  if (name.includes('shrimp') || name.includes('prawn')) return 12.0;
  if (name.includes('fish') || name.includes('cod') || name.includes('tilapia')) return 5.0;
  if (name.includes('milk')) return 3.2;
  if (name.includes('cheese')) return 13.5;
  if (name.includes('yogurt')) return 2.5;
  if (name.includes('butter')) return 12.0;
  if (name.includes('cream')) return 8.0;
  if (name.includes('egg')) return 4.8;
  if (name.includes('rice')) return 2.7;
  if (name.includes('bread') || name.includes('bagel') || name.includes('muffin')) return 1.4;
  if (name.includes('pasta') || name.includes('noodle')) return 1.8;
  if (name.includes('tofu') || name.includes('tempeh')) return 2.0;
  if (name.includes('bean') || name.includes('lentil') || name.includes('chickpea')) return 0.9;
  if (name.includes('apple') || name.includes('orange') || name.includes('banana')) return 0.4;
  if (name.includes('berry') || name.includes('strawberr') || name.includes('blueberr')) return 1.1;
  if (name.includes('tomato') || name.includes('lettuce') || name.includes('spinach')) return 0.7;
  if (name.includes('potato') || name.includes('carrot') || name.includes('onion')) return 0.3;
  if (name.includes('broccoli') || name.includes('cauliflower')) return 0.8;
  if (name.includes('avocado')) return 2.5;
  if (name.includes('oil') || name.includes('olive')) return 3.5;
  if (name.includes('sugar') || name.includes('honey')) return 1.2;
  if (name.includes('coffee')) return 8.0;
  if (name.includes('tea')) return 0.5;
  if (name.includes('juice') || name.includes('soda') || name.includes('drink')) return 0.8;
  if (name.includes('water')) return 0.1;
  if (name.includes('cereal') || name.includes('oat')) return 1.5;
  if (name.includes('flour')) return 1.1;
  if (name.includes('nut') || name.includes('almond') || name.includes('walnut') || name.includes('peanut')) return 2.3;

  // Fallback to category-based defaults
  const categoryDefaults: Record<string, number> = {
    meat: 15.0,
    dairy: 5.0,
    produce: 1.0,
    bakery: 1.5,
    frozen: 3.0,
    beverages: 0.8,
    pantry: 2.0,
    other: 3.0,
  };

  return categoryDefaults[category || 'other'] || 3.0;
}

/**
 * Classify product into a category based on product name keywords.
 * Used when the AI model doesn't provide category (offloading classification to backend).
 */
export function classifyCategory(productName: string): string {
  const name = productName.toLowerCase();

  // Meat & Seafood
  if (/beef|chicken|pork|lamb|turkey|duck|fish|salmon|tuna|shrimp|prawn|bacon|sausage|ham|steak|ground|seafood|crab|lobster/.test(name)) {
    return 'meat';
  }

  // Dairy
  if (/milk|cheese|yogurt|butter|cream|cottage|sour cream|half.and.half|cheddar|mozzarella|parmesan/.test(name)) {
    return 'dairy';
  }

  // Produce (fruits and vegetables)
  if (/apple|banana|orange|lemon|lime|grape|berry|strawberr|blueberr|raspberr|mango|pineapple|watermelon|melon|peach|pear|plum|cherry|kiwi|avocado/.test(name)) {
    return 'produce';
  }
  if (/tomato|lettuce|spinach|kale|carrot|onion|potato|broccoli|cauliflower|celery|cucumber|pepper|zucchini|squash|corn|cabbage|mushroom|garlic|ginger/.test(name)) {
    return 'produce';
  }

  // Bakery
  if (/bread|bagel|muffin|croissant|roll|bun|donut|doughnut|pastry|cake|cookie|pie|tort/.test(name)) {
    return 'bakery';
  }

  // Frozen
  if (/frozen|ice cream|gelato|sorbet|popsicle|freezer|fries|nugget/.test(name)) {
    return 'frozen';
  }

  // Beverages
  if (/juice|soda|pop|water|coffee|tea|drink|beverage|lemonade|smoothie|beer|wine|spirit/.test(name)) {
    return 'beverages';
  }

  // Pantry (grains, canned goods, staples)
  if (/rice|pasta|noodle|flour|sugar|oil|cereal|oat|bean|lentil|chickpea|can|canned|sauce|soup|broth|stock|spice|seasoning|salt|pepper|vinegar|honey|syrup|jam|jelly|peanut butter|nut|almond|walnut/.test(name)) {
    return 'pantry';
  }

  // Eggs
  if (/egg/.test(name)) {
    return 'dairy'; // Eggs are typically grouped with dairy in grocery categories
  }

  return 'other';
}
