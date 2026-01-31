/**
 * Get CO2 emission color coding based on value
 * Low: < 1 kg (green), Medium: 1-3 kg (yellow), High: > 3 kg (red)
 */
export function getCO2ColorClass(co2Value: number): string {
  if (co2Value < 1) return "text-green-600";
  if (co2Value < 3) return "text-yellow-600";
  return "text-red-600";
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
 * Calculate total CO2 emissions from product array
 * Returns total considering quantity (co2 per unit × quantity)
 */
export function calculateTotalCO2(products: Array<{ co2Emission: number | null; quantity: number }>): number {
  return products.reduce((total, product) => {
    if (product.co2Emission == null) return total;
    return total + (product.co2Emission * product.quantity);
  }, 0);
}
