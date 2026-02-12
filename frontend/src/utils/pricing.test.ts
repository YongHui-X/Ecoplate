import { describe, it, expect } from "vitest";
import { calculateDiscountPercentage, formatPrice } from "./pricing";

describe("pricing utils", () => {
  describe("calculateDiscountPercentage", () => {
    it("calculates correct discount percentage", () => {
      expect(calculateDiscountPercentage(100, 80)).toBe(20);
      expect(calculateDiscountPercentage(50, 25)).toBe(50);
      expect(calculateDiscountPercentage(200, 150)).toBe(25);
    });

    it("rounds to nearest integer", () => {
      expect(calculateDiscountPercentage(100, 33)).toBe(67);
      expect(calculateDiscountPercentage(100, 66)).toBe(34);
      expect(calculateDiscountPercentage(30, 19)).toBe(37);
    });

    it("returns null for null originalPrice", () => {
      expect(calculateDiscountPercentage(null, 50)).toBeNull();
    });

    it("returns null for undefined originalPrice", () => {
      expect(calculateDiscountPercentage(undefined, 50)).toBeNull();
    });

    it("returns null for null currentPrice", () => {
      expect(calculateDiscountPercentage(100, null)).toBeNull();
    });

    it("returns null for undefined currentPrice", () => {
      expect(calculateDiscountPercentage(100, undefined)).toBeNull();
    });

    it("returns null when originalPrice is zero", () => {
      expect(calculateDiscountPercentage(0, 50)).toBeNull();
    });

    it("returns null when originalPrice is negative", () => {
      expect(calculateDiscountPercentage(-100, 50)).toBeNull();
    });

    it("returns null when currentPrice equals originalPrice (no discount)", () => {
      expect(calculateDiscountPercentage(100, 100)).toBeNull();
    });

    it("returns null when currentPrice is greater than originalPrice (price increase)", () => {
      expect(calculateDiscountPercentage(50, 100)).toBeNull();
    });

    it("handles 100% discount (free item)", () => {
      // currentPrice must be > 0 for truthy check, so 0 returns null
      expect(calculateDiscountPercentage(100, 0)).toBeNull();
    });

    it("handles very small discounts", () => {
      expect(calculateDiscountPercentage(100, 99)).toBe(1);
    });

    it("handles very large discounts", () => {
      expect(calculateDiscountPercentage(100, 1)).toBe(99);
    });

    it("handles decimal prices", () => {
      expect(calculateDiscountPercentage(10.0, 7.5)).toBe(25);
      expect(calculateDiscountPercentage(9.99, 4.99)).toBe(50);
    });
  });

  describe("formatPrice", () => {
    it("formats price with two decimal places", () => {
      expect(formatPrice(10)).toBe("$10.00");
      expect(formatPrice(5.5)).toBe("$5.50");
      expect(formatPrice(99.99)).toBe("$99.99");
    });

    it("returns 'Free' for zero price", () => {
      expect(formatPrice(0)).toBe("Free");
    });

    it("returns 'Free' for null price", () => {
      expect(formatPrice(null)).toBe("Free");
    });

    it("returns 'Free' for undefined price", () => {
      expect(formatPrice(undefined)).toBe("Free");
    });

    it("formats small prices correctly", () => {
      expect(formatPrice(0.01)).toBe("$0.01");
      expect(formatPrice(0.99)).toBe("$0.99");
    });

    it("formats large prices correctly", () => {
      expect(formatPrice(1000)).toBe("$1000.00");
      expect(formatPrice(99999.99)).toBe("$99999.99");
    });

    it("rounds prices to two decimal places", () => {
      expect(formatPrice(10.999)).toBe("$11.00");
      expect(formatPrice(10.001)).toBe("$10.00");
      expect(formatPrice(10.005)).toBe("$10.01");
    });

    it("handles whole numbers", () => {
      expect(formatPrice(1)).toBe("$1.00");
      expect(formatPrice(100)).toBe("$100.00");
    });
  });
});
