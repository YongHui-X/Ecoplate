/**
 * Product Unit Constants
 * Units of measurement for products and marketplace listings
 */

export const PRODUCT_UNITS = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "L", label: "Liters (L)" },
  { value: "mL", label: "Milliliters (mL)" },
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "bottles", label: "Bottles" },
  { value: "cans", label: "Cans" },
  { value: "boxes", label: "Boxes" },
  { value: "packs", label: "Packs" },
  { value: "bunches", label: "Bunches" },
  { value: "bags", label: "Bags" },
  { value: "trays", label: "Trays" },
] as const;

export type ProductUnit = typeof PRODUCT_UNITS[number]["value"];

/**
 * Format quantity with unit
 * @param quantity - Numeric quantity
 * @param unit - Unit of measurement
 * @returns Formatted string like "2.5 kg" or "3 bottles"
 */
export function formatQuantityWithUnit(
  quantity: number,
  unit?: string | null
): string {
  if (!unit) {
    return String(quantity);
  }
  return `${quantity} ${unit}`;
}
