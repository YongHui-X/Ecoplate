import { Leaf } from "lucide-react";
import { cn } from "../../lib/utils";

interface Co2BadgeProps {
  co2Saved: number | null;
  variant?: "compact" | "full";
  className?: string;
}

/**
 * CO2 Badge component to display environmental impact
 *
 * @param co2Saved - kg of CO2 saved (null if not available)
 * @param variant - "compact" for small inline badge, "full" for card-style display
 */
export function Co2Badge({ co2Saved, variant = "compact", className }: Co2BadgeProps) {
  if (co2Saved === null || co2Saved === undefined || co2Saved <= 0) {
    return null;
  }

  const formattedValue = co2Saved >= 1 ? co2Saved.toFixed(1) : co2Saved.toFixed(2);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          "bg-success/10 text-success",
          className
        )}
      >
        <Leaf className="h-3 w-3" />
        <span>{formattedValue}kg CO2</span>
      </div>
    );
  }

  // Full variant - card style
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl",
        "bg-success/10 border border-success/20",
        className
      )}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
        <Leaf className="h-5 w-5 text-success" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Total CO₂ Reduced</p>
        <p className="text-lg font-semibold text-success">{formattedValue} kg</p>
      </div>
    </div>
  );
}

/**
 * Product-specific emission factors (kg CO2e per kg food)
 * Must match backend/src/utils/co2-factors.ts
 */
const EMISSION_FACTORS: Record<string, number> = {
  // Meat & Poultry
  beef: 27.0, steak: 27.0, lamb: 39.2, pork: 12.1,
  chicken: 6.9, poultry: 6.9, turkey: 10.9,
  // Seafood
  salmon: 6.0, tuna: 6.1, shrimp: 18.0, prawn: 18.0, fish: 5.5,
  // Dairy & Eggs
  cheese: 13.5, milk: 3.2, butter: 12.0, yogurt: 2.2, yoghurt: 2.2,
  egg: 4.8, eggs: 4.8, cream: 7.6,
  // Grains & Bread
  rice: 2.7, bread: 0.9, pasta: 1.1, noodle: 1.1, flour: 0.9, cereal: 0.9, oat: 0.9,
  // Fruits
  banana: 0.7, apple: 0.3, orange: 0.3, citrus: 0.3, berr: 1.1,
  avocado: 0.8, mango: 0.8, grape: 1.4,
  // Vegetables
  tomato: 1.4, potato: 0.3, carrot: 0.2, lettuce: 0.2, salad: 0.2,
  broccoli: 0.4, onion: 0.3, cucumber: 0.3, pepper: 0.7, capsicum: 0.7,
  // Beverages
  coffee: 4.0, tea: 1.0, juice: 1.1, soda: 0.4, beer: 0.3, wine: 1.3,
  // Snacks & Processed
  chocolate: 19.0, cocoa: 19.0, cookie: 2.5, biscuit: 2.5,
  chips: 2.3, crisp: 2.3, candy: 3.0, sweet: 3.0,
  // Oils & Condiments
  oil: 3.0, sauce: 1.5, ketchup: 1.5,
  // Nuts & Seeds
  almond: 2.3, nut: 2.3,
  // Legacy/Other
  tofu: 3.0, legumes: 0.9, beans: 0.9, lentils: 0.9,
};

/**
 * CO2 factors by category for fallback
 * Must match backend/src/utils/co2-factors.ts
 */
const CATEGORY_FALLBACKS: Record<string, number> = {
  meat: 20.0, protein: 20.0, dairy: 7.0,
  produce: 1.0, vegetables: 1.0, fruits: 1.0,
  grains: 1.2, beverages: 1.0, snacks: 2.5,
  pantry: 2.0, bakery: 1.5, frozen: 4.0,
  seafood: 6.0, other: 2.5,
};

const DISPOSAL_FACTOR = 0.5;
const DEFAULT_EMISSION_FACTOR = 2.0;

/**
 * Get emission factor for a product (matches backend getEmissionFactor)
 */
function getEmissionFactor(productName: string, category?: string): number {
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
  if (category && CATEGORY_FALLBACKS[category.toLowerCase()] !== undefined) {
    return CATEGORY_FALLBACKS[category.toLowerCase()];
  }

  return DEFAULT_EMISSION_FACTOR;
}

/**
 * Convert quantity to kg for preview calculation
 */
function convertToKg(quantity: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase().trim();

  switch (normalizedUnit) {
    case "kg":
      return quantity;
    case "g":
      return quantity / 1000;
    case "l":
    case "ml":
      return normalizedUnit === "ml" ? quantity / 1000 : quantity;
    case "item":
    case "pcs":
    case "pack":
      return quantity * 0.3;
    default:
      return quantity * 0.3;
  }
}

/**
 * Calculate estimated CO2 reduced (for frontend preview)
 * This mirrors the backend calculation for preview purposes
 */
export function calculateCo2Preview(
  quantity: number,
  unit: string,
  category: string,
  productName?: string
): number {
  const weightKg = convertToKg(quantity, unit);
  const emissionFactor = productName
    ? getEmissionFactor(productName, category)
    : (CATEGORY_FALLBACKS[category.toLowerCase()] ?? CATEGORY_FALLBACKS.other);
  const totalFactor = emissionFactor + DISPOSAL_FACTOR;
  const co2Saved = weightKg * totalFactor;
  return Math.round(co2Saved * 100) / 100;
}
