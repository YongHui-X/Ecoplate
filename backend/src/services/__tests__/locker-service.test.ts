import { describe, expect, test } from "bun:test";

// Constants from locker-service (copied to avoid importing server code)
const BASE_DELIVERY_FEE = 2.0;
const EXTRA_FEE_PER_KM = 0.5;
const FREE_KM_THRESHOLD = 5;

/**
 * Generate a 6-digit PIN code
 */
function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Calculate delivery fee based on distance
 * Base $2 + $0.50/km after 5km
 */
function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= FREE_KM_THRESHOLD) {
    return BASE_DELIVERY_FEE;
  }
  const extraKm = distanceKm - FREE_KM_THRESHOLD;
  return BASE_DELIVERY_FEE + extraKm * EXTRA_FEE_PER_KM;
}

describe("generatePin", () => {
  test("generates a 6-digit string", () => {
    const pin = generatePin();
    expect(pin).toHaveLength(6);
    expect(/^\d{6}$/.test(pin)).toBe(true);
  });

  test("generates numeric-only PIN", () => {
    const pin = generatePin();
    expect(/^\d+$/.test(pin)).toBe(true);
  });

  test("generates PIN within valid range (100000-999999)", () => {
    for (let i = 0; i < 100; i++) {
      const pin = generatePin();
      const numericPin = parseInt(pin, 10);
      expect(numericPin).toBeGreaterThanOrEqual(100000);
      expect(numericPin).toBeLessThanOrEqual(999999);
    }
  });

  test("generates different PINs (uniqueness)", () => {
    const pins = new Set<string>();
    for (let i = 0; i < 100; i++) {
      pins.add(generatePin());
    }
    // With 100 generated PINs, we should have at least 90 unique ones
    // (extremely unlikely to get many collisions)
    expect(pins.size).toBeGreaterThan(90);
  });
});

describe("calculateDeliveryFee", () => {
  test("returns base fee ($2) for distance under 5km", () => {
    expect(calculateDeliveryFee(0)).toBe(2.0);
    expect(calculateDeliveryFee(1)).toBe(2.0);
    expect(calculateDeliveryFee(3.5)).toBe(2.0);
    expect(calculateDeliveryFee(5)).toBe(2.0);
  });

  test("adds $0.50/km for distance over 5km", () => {
    expect(calculateDeliveryFee(6)).toBe(2.5); // 2 + (1 * 0.5)
    expect(calculateDeliveryFee(7)).toBe(3.0); // 2 + (2 * 0.5)
    expect(calculateDeliveryFee(10)).toBe(4.5); // 2 + (5 * 0.5)
    expect(calculateDeliveryFee(15)).toBe(7.0); // 2 + (10 * 0.5)
  });

  test("handles fractional kilometers", () => {
    expect(calculateDeliveryFee(5.5)).toBe(2.25); // 2 + (0.5 * 0.5)
    expect(calculateDeliveryFee(6.5)).toBe(2.75); // 2 + (1.5 * 0.5)
    expect(calculateDeliveryFee(10.8)).toBe(4.9); // 2 + (5.8 * 0.5)
  });

  test("handles exactly 5km threshold", () => {
    expect(calculateDeliveryFee(5)).toBe(2.0);
    expect(calculateDeliveryFee(5.01)).toBeCloseTo(2.005, 2);
  });

  test("handles large distances", () => {
    expect(calculateDeliveryFee(50)).toBe(24.5); // 2 + (45 * 0.5)
    expect(calculateDeliveryFee(100)).toBe(49.5); // 2 + (95 * 0.5)
  });

  test("handles zero distance", () => {
    expect(calculateDeliveryFee(0)).toBe(2.0);
  });
});
