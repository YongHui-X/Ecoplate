/**
 * CO2 Calculator for Marketplace Listings
 *
 * Calculates estimated CO2 emissions saved when food is shared
 * instead of being wasted. Based on food category emission factors.
 */

// CO2 emission factors by food category (kg CO2e per kg food)
// Sources: WRAP UK, FAO, various LCA studies
const CO2_FACTORS: Record<string, number> = {
  produce: 1.0, // Fruits, vegetables - low emissions
  dairy: 7.0, // Milk, yogurt, cheese - moderate (production + refrigeration)
  meat: 20.0, // Beef, chicken, pork weighted average - high emissions
  bakery: 1.5, // Wheat-based products
  frozen: 4.0, // Processing and cold chain energy
  beverages: 1.0, // Low impact drinks
  pantry: 2.0, // Grains, canned goods, dry goods
  other: 2.5, // Default for uncategorized items
};

// Additional disposal emissions avoided (kg CO2e per kg food waste)
// Accounts for landfill methane, collection, processing
const DISPOSAL_EMISSION_FACTOR = 0.5;

/**
 * Convert quantity to kilograms based on unit
 */
export function convertToKg(quantity: number, unit: string | null | undefined): number {
  const normalizedUnit = (unit || "item").toLowerCase().trim();

  switch (normalizedUnit) {
    case "kg":
      return quantity;
    case "g":
      return quantity / 1000;
    case "l":
    case "ml":
      // For liquids, assume water density (1L = 1kg)
      // ml needs conversion
      return normalizedUnit === "ml" ? quantity / 1000 : quantity;
    case "item":
    case "pcs":
    case "pack":
      // Estimated average weight per item/pack
      return quantity * 0.3;
    default:
      // Default: assume it's already in reasonable units
      return quantity * 0.3;
  }
}

/**
 * Get CO2 factor for a food category
 */
function getCo2Factor(category: string | null | undefined): number {
  if (!category) {
    return CO2_FACTORS.other;
  }
  const normalizedCategory = category.toLowerCase().trim();
  return CO2_FACTORS[normalizedCategory] ?? CO2_FACTORS.other;
}

/**
 * Calculate estimated CO2 saved by sharing food instead of wasting it
 *
 * Formula: CO2 = weight_in_kg * (category_factor + disposal_factor)
 *
 * @param quantity - Amount of food
 * @param unit - Unit of measurement (kg, g, L, item, etc.)
 * @param category - Food category (produce, dairy, meat, etc.)
 * @returns Estimated kg of CO2 saved, rounded to 2 decimal places
 */
export function calculateCo2Saved(
  quantity: number,
  unit: string | null | undefined,
  category: string | null | undefined
): number {
  const weightKg = convertToKg(quantity, unit);
  const categoryFactor = getCo2Factor(category);
  const totalFactor = categoryFactor + DISPOSAL_EMISSION_FACTOR;

  const co2Saved = weightKg * totalFactor;

  // Round to 2 decimal places
  return Math.round(co2Saved * 100) / 100;
}

/**
 * Get the CO2 factor for a category (for frontend preview)
 */
export function getCategoryFactor(category: string | null | undefined): number {
  return getCo2Factor(category) + DISPOSAL_EMISSION_FACTOR;
}

/**
 * Export factors for reference/documentation
 */
export const CO2_CATEGORY_FACTORS = CO2_FACTORS;
export const CO2_DISPOSAL_FACTOR = DISPOSAL_EMISSION_FACTOR;
