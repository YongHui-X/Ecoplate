/**
 * Pricing utility functions for marketplace listings
 */

/**
 * Calculate discount percentage between original and current price
 * @param originalPrice - The original price of the item
 * @param currentPrice - The current/sale price of the item
 * @returns Discount percentage (0-100) or null if not applicable
 */
export function calculateDiscountPercentage(
  originalPrice: number | null | undefined,
  currentPrice: number | null | undefined
): number | null {
  if (!originalPrice || !currentPrice || originalPrice <= 0) {
    return null;
  }

  if (currentPrice >= originalPrice) {
    return null;
  }

  return Math.round((1 - currentPrice / originalPrice) * 100);
}

/**
 * Format price for display
 * @param price - The price to format
 * @returns Formatted price string (e.g., "$10.00" or "Free")
 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || price === 0) {
    return "Free";
  }
  return `$${price.toFixed(2)}`;
}
