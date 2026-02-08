/**
 * Calculate CO2 emission based on product name and category
 * Ported from backend consumption-service.ts
 */
export function calculateCO2Emission(productName: string, category: string): number {
  const nameLower = productName.toLowerCase();

  // Meat & Poultry
  if (nameLower.includes("beef") || nameLower.includes("steak")) return 27.0;
  if (nameLower.includes("lamb")) return 39.2;
  if (nameLower.includes("pork")) return 12.1;
  if (nameLower.includes("chicken") || nameLower.includes("poultry")) return 6.9;
  if (nameLower.includes("turkey")) return 10.9;

  // Seafood
  if (nameLower.includes("salmon")) return 6.0;
  if (nameLower.includes("tuna")) return 6.1;
  if (nameLower.includes("shrimp") || nameLower.includes("prawn")) return 18.0;
  if (nameLower.includes("fish")) return 5.5;

  // Dairy & Eggs
  if (nameLower.includes("cheese")) return 13.5;
  if (nameLower.includes("milk")) return 3.2;
  if (nameLower.includes("butter")) return 12.0;
  if (nameLower.includes("yogurt") || nameLower.includes("yoghurt")) return 2.2;
  if (nameLower.includes("egg")) return 4.8;
  if (nameLower.includes("cream")) return 7.6;

  // Grains & Bread
  if (nameLower.includes("rice")) return 2.7;
  if (nameLower.includes("bread")) return 0.9;
  if (nameLower.includes("pasta") || nameLower.includes("noodle")) return 1.1;
  if (nameLower.includes("flour")) return 0.9;
  if (nameLower.includes("cereal") || nameLower.includes("oat")) return 0.9;

  // Fruits
  if (nameLower.includes("banana")) return 0.7;
  if (nameLower.includes("apple")) return 0.3;
  if (nameLower.includes("orange") || nameLower.includes("citrus")) return 0.3;
  if (nameLower.includes("berr")) return 1.1; // strawberry, blueberry, etc.
  if (nameLower.includes("avocado")) return 0.8;
  if (nameLower.includes("mango")) return 0.8;
  if (nameLower.includes("grape")) return 1.4;

  // Vegetables
  if (nameLower.includes("tomato")) return 1.4;
  if (nameLower.includes("potato")) return 0.3;
  if (nameLower.includes("carrot")) return 0.2;
  if (nameLower.includes("lettuce") || nameLower.includes("salad")) return 0.2;
  if (nameLower.includes("broccoli")) return 0.4;
  if (nameLower.includes("onion")) return 0.3;
  if (nameLower.includes("cucumber")) return 0.3;
  if (nameLower.includes("pepper") || nameLower.includes("capsicum")) return 0.7;

  // Beverages
  if (nameLower.includes("coffee")) return 4.0;
  if (nameLower.includes("tea")) return 1.0;
  if (nameLower.includes("juice")) return 1.1;
  if (nameLower.includes("soda") || nameLower.includes("soft drink")) return 0.4;
  if (nameLower.includes("beer")) return 0.3;
  if (nameLower.includes("wine")) return 1.3;

  // Snacks & Processed
  if (nameLower.includes("chocolate") || nameLower.includes("cocoa")) return 19.0;
  if (nameLower.includes("cookie") || nameLower.includes("biscuit")) return 2.5;
  if (nameLower.includes("chips") || nameLower.includes("crisp")) return 2.3;
  if (nameLower.includes("candy") || nameLower.includes("sweet")) return 3.0;

  // Oils & Condiments
  if (nameLower.includes("oil")) return 3.0;
  if (nameLower.includes("sauce") || nameLower.includes("ketchup")) return 1.5;

  // Nuts & Seeds
  if (nameLower.includes("almond") || nameLower.includes("nut")) return 2.3;

  // Category-based fallbacks
  const categoryLower = category.toLowerCase();
  if (categoryLower === "meat" || categoryLower === "protein") return 15.0;
  if (categoryLower === "dairy") return 5.0;
  if (categoryLower === "produce") return 0.5;
  if (categoryLower === "grains") return 1.2;
  if (categoryLower === "beverages") return 1.0;
  if (categoryLower === "snacks") return 2.5;

  // Default fallback
  return 3.0;
}
