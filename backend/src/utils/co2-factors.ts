/**
 * Single source of truth for all CO2 emission factors, unit conversion,
 * category classification, and CO2 calculation utilities.
 */

// ==================== Emission Factors (kg CO2e per kg food) ====================

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

// ==================== Category Fallbacks ====================

export const CATEGORY_FALLBACKS: Record<string, number> = {
  meat: 20.0,
  protein: 20.0,
  dairy: 7.0,
  produce: 1.0,
  vegetables: 1.0,
  fruits: 1.0,
  grains: 1.2,
  beverages: 1.0,
  snacks: 2.5,
  pantry: 2.0,
  bakery: 1.5,
  frozen: 4.0,
  seafood: 6.0,
  other: 2.5,
};

// ==================== Disposal Emission Factors ====================

export const DISPOSAL_EMISSION_FACTORS: Record<string, number> = {
  landfill: 0.5,
  composting: 0.1,
  incineration: 0.9,
};

export const DEFAULT_EMISSION_FACTOR = 2.0;

// ==================== Re-export Aliases ====================

export const CO2_CATEGORY_FACTORS = CATEGORY_FALLBACKS;
export const CO2_DISPOSAL_FACTOR = DISPOSAL_EMISSION_FACTORS.landfill;

// ==================== Unit Conversion ====================

export function convertToKg(quantity: number, unit: string | null | undefined): number {
  const normalizedUnit = (unit || "item").toLowerCase().trim();

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
    case "bottle":
    case "bottles":
    case "can":
    case "cans":
    case "loaf":
    case "box":
    case "boxes":
    case "bunch":
    case "bunches":
    case "bag":
    case "bags":
    case "tray":
    case "trays":
    case "packs":
      return quantity * 0.3;
    case "dozen":
      return quantity * 12 * 0.3;
    default:
      return quantity * 0.3;
  }
}

// ==================== Emission Factor Lookup ====================

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

// ==================== CO2 Calculation ====================

function getCo2Factor(category: string | null | undefined): number {
  if (!category) {
    return CATEGORY_FALLBACKS.other;
  }
  const normalizedCategory = category.toLowerCase().trim();
  return CATEGORY_FALLBACKS[normalizedCategory] ?? CATEGORY_FALLBACKS.other;
}

export function calculateCo2Saved(
  quantity: number,
  unit: string | null | undefined,
  category: string | null | undefined,
  productName?: string
): number {
  const weightKg = convertToKg(quantity, unit);

  // Use product-specific emission factor if productName provided, otherwise fall back to category
  const emissionFactor = productName
    ? getEmissionFactor(productName, category || undefined)
    : getCo2Factor(category);

  const totalFactor = emissionFactor + DISPOSAL_EMISSION_FACTORS.landfill;

  const co2Saved = weightKg * totalFactor;

  return Math.round(co2Saved * 100) / 100;
}

export function getCategoryFactor(category: string | null | undefined): number {
  return getCo2Factor(category) + DISPOSAL_EMISSION_FACTORS.landfill;
}

// ==================== Category Classification ====================

export function classifyCategory(productName: string): string {
  const name = productName.toLowerCase();

  if (/beef|chicken|pork|lamb|turkey|duck|fish|salmon|tuna|shrimp|prawn|bacon|sausage|ham|steak|ground|seafood|crab|lobster/.test(name)) {
    return 'meat';
  }

  if (/milk|cheese|yogurt|butter|cream|cottage|sour cream|half.and.half|cheddar|mozzarella|parmesan/.test(name)) {
    return 'dairy';
  }

  if (/apple|banana|orange|lemon|lime|grape|berry|strawberr|blueberr|raspberr|mango|pineapple|watermelon|melon|peach|pear|plum|cherry|kiwi|avocado/.test(name)) {
    return 'produce';
  }
  if (/tomato|lettuce|spinach|kale|carrot|onion|potato|broccoli|cauliflower|celery|cucumber|pepper|zucchini|squash|corn|cabbage|mushroom|garlic|ginger/.test(name)) {
    return 'produce';
  }

  if (/bread|bagel|muffin|croissant|roll|bun|donut|doughnut|pastry|cake|cookie|pie|tort/.test(name)) {
    return 'bakery';
  }

  if (/frozen|ice cream|gelato|sorbet|popsicle|freezer|fries|nugget/.test(name)) {
    return 'frozen';
  }

  if (/juice|soda|pop|water|coffee|tea|drink|beverage|lemonade|smoothie|beer|wine|spirit/.test(name)) {
    return 'beverages';
  }

  if (/rice|pasta|noodle|flour|sugar|oil|cereal|oat|bean|lentil|chickpea|can|canned|sauce|soup|broth|stock|spice|seasoning|salt|pepper|vinegar|honey|syrup|jam|jelly|peanut butter|nut|almond|walnut/.test(name)) {
    return 'pantry';
  }

  if (/egg/.test(name)) {
    return 'dairy';
  }

  return 'other';
}
