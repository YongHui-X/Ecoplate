/**
 * Convert quantity to kg based on unit
 * Ported from backend co2-factors.ts
 */
export function convertToKg(quantity: number, unit: string | null | undefined): number {
  const normalizedUnit = (unit || "item").toLowerCase().trim();
  switch (normalizedUnit) {
    case "kg":
      return quantity;
    case "g":
      return quantity / 1000;
    case "l":
      return quantity;
    case "ml":
      return quantity / 1000;
    case "dozen":
      return quantity * 12 * 0.3;
    default:
      // pcs, item, pack, bottle, can, box, bag, bunch, tray, etc.
      return quantity * 0.3;
  }
}

/**
 * Get CO2 emission color coding based on value
 * Low: < 1 kg (green), Medium: 1-3 kg (yellow), High: > 3 kg (red)
 */
export function getCO2ColorClass(co2Value: number): string {
  if (co2Value < 1) return "text-success";
  if (co2Value < 3) return "text-warning";
  return "text-destructive";
}

/**
 * Format CO2 emission value for display
 * Returns null if value is null/undefined
 */
export function formatCO2(co2Value: number | null): string | null {
  if (co2Value == null) return null;
  return `${co2Value.toFixed(1)} kg CO2`;
}

/**
 * Calculate CO2 for a single product (emission factor × weight in kg)
 */
export function calculateProductCO2(co2Emission: number, quantity: number, unit: string | null): number {
  const weightKg = convertToKg(quantity, unit);
  return co2Emission * weightKg;
}

/**
 * Calculate total CO2 emissions from product array
 * Converts quantity to kg before multiplying by per-kg emission factor
 */
export function calculateTotalCO2(products: Array<{ co2Emission: number | null; quantity: number; unit: string | null }>): number {
  return products.reduce((total, product) => {
    if (product.co2Emission == null) return total;
    const weightKg = convertToKg(product.quantity, product.unit);
    return total + (product.co2Emission * weightKg);
  }, 0);
}
