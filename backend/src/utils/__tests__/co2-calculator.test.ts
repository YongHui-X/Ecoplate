import { describe, expect, test } from "bun:test";
import {
  calculateCo2Saved,
  getCategoryFactor,
  CO2_CATEGORY_FACTORS,
  CO2_DISPOSAL_FACTOR,
} from "../co2-calculator";

describe("calculateCo2Saved", () => {
  describe("unit conversions", () => {
    test("converts kg correctly (1:1)", () => {
      // 1kg produce: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Saved(1, "kg", "produce");
      expect(result).toBe(1.5);
    });

    test("converts g correctly (/1000)", () => {
      // 500g produce: 0.5kg * (1.0 + 0.5) = 0.75
      const result = calculateCo2Saved(500, "g", "produce");
      expect(result).toBe(0.75);
    });

    test("converts L correctly (1:1)", () => {
      // 1L beverages: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Saved(1, "l", "beverages");
      expect(result).toBe(1.5);
    });

    test("converts ml correctly (/1000)", () => {
      // 500ml beverages: 0.5 * (1.0 + 0.5) = 0.75
      const result = calculateCo2Saved(500, "ml", "beverages");
      expect(result).toBe(0.75);
    });

    test("converts item correctly (*0.3)", () => {
      // 2 items produce: 0.6kg * (1.0 + 0.5) = 0.9
      const result = calculateCo2Saved(2, "item", "produce");
      expect(result).toBe(0.9);
    });

    test("converts pcs correctly (*0.3)", () => {
      // 3 pcs produce: 0.9kg * (1.0 + 0.5) = 1.35
      const result = calculateCo2Saved(3, "pcs", "produce");
      expect(result).toBe(1.35);
    });

    test("converts pack correctly (*0.3)", () => {
      // 1 pack produce: 0.3kg * (1.0 + 0.5) = 0.45
      const result = calculateCo2Saved(1, "pack", "produce");
      expect(result).toBe(0.45);
    });

    test("handles unknown unit as item (*0.3)", () => {
      // 1 unknown produce: 0.3kg * (1.0 + 0.5) = 0.45
      const result = calculateCo2Saved(1, "box", "produce");
      expect(result).toBe(0.45);
    });

    test("handles null unit as item", () => {
      // 1 null produce: 0.3kg * (1.0 + 0.5) = 0.45
      const result = calculateCo2Saved(1, null, "produce");
      expect(result).toBe(0.45);
    });

    test("handles undefined unit as item", () => {
      // 1 undefined produce: 0.3kg * (1.0 + 0.5) = 0.45
      const result = calculateCo2Saved(1, undefined, "produce");
      expect(result).toBe(0.45);
    });
  });

  describe("category factors", () => {
    test("uses correct factor for produce (1.0)", () => {
      // 1kg produce: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Saved(1, "kg", "produce");
      expect(result).toBe(1.5);
    });

    test("uses correct factor for dairy (7.0)", () => {
      // 1kg dairy: 1 * (7.0 + 0.5) = 7.5
      const result = calculateCo2Saved(1, "kg", "dairy");
      expect(result).toBe(7.5);
    });

    test("uses correct factor for meat (20.0)", () => {
      // 1kg meat: 1 * (20.0 + 0.5) = 20.5
      const result = calculateCo2Saved(1, "kg", "meat");
      expect(result).toBe(20.5);
    });

    test("uses correct factor for bakery (1.5)", () => {
      // 1kg bakery: 1 * (1.5 + 0.5) = 2.0
      const result = calculateCo2Saved(1, "kg", "bakery");
      expect(result).toBe(2);
    });

    test("uses correct factor for frozen (4.0)", () => {
      // 1kg frozen: 1 * (4.0 + 0.5) = 4.5
      const result = calculateCo2Saved(1, "kg", "frozen");
      expect(result).toBe(4.5);
    });

    test("uses correct factor for beverages (1.0)", () => {
      // 1kg beverages: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Saved(1, "kg", "beverages");
      expect(result).toBe(1.5);
    });

    test("uses correct factor for pantry (2.0)", () => {
      // 1kg pantry: 1 * (2.0 + 0.5) = 2.5
      const result = calculateCo2Saved(1, "kg", "pantry");
      expect(result).toBe(2.5);
    });

    test("uses other factor (2.5) for unknown categories", () => {
      // 1kg unknown: 1 * (2.5 + 0.5) = 3.0
      const result = calculateCo2Saved(1, "kg", "unknown");
      expect(result).toBe(3);
    });

    test("uses other factor for null category", () => {
      // 1kg null: 1 * (2.5 + 0.5) = 3.0
      const result = calculateCo2Saved(1, "kg", null);
      expect(result).toBe(3);
    });

    test("uses other factor for undefined category", () => {
      // 1kg undefined: 1 * (2.5 + 0.5) = 3.0
      const result = calculateCo2Saved(1, "kg", undefined);
      expect(result).toBe(3);
    });
  });

  describe("edge cases", () => {
    test("handles case-insensitive categories", () => {
      expect(calculateCo2Saved(1, "kg", "MEAT")).toBe(20.5);
      expect(calculateCo2Saved(1, "kg", "Dairy")).toBe(7.5);
      expect(calculateCo2Saved(1, "kg", "PRODUCE")).toBe(1.5);
    });

    test("handles case-insensitive units", () => {
      expect(calculateCo2Saved(1000, "G", "produce")).toBe(1.5);
      expect(calculateCo2Saved(1, "KG", "produce")).toBe(1.5);
      expect(calculateCo2Saved(1, "L", "beverages")).toBe(1.5);
    });

    test("rounds to 2 decimal places", () => {
      // 333g produce: 0.333 * (1.0 + 0.5) = 0.4995 -> rounds to 0.5
      const result = calculateCo2Saved(333, "g", "produce");
      expect(result).toBe(0.5);
    });

    test("handles fractional quantities", () => {
      // 0.5kg meat: 0.5 * (20.0 + 0.5) = 10.25
      const result = calculateCo2Saved(0.5, "kg", "meat");
      expect(result).toBe(10.25);
    });

    test("handles zero quantity", () => {
      const result = calculateCo2Saved(0, "kg", "meat");
      expect(result).toBe(0);
    });

    test("handles whitespace in unit", () => {
      const result = calculateCo2Saved(1, "  kg  ", "produce");
      expect(result).toBe(1.5);
    });

    test("handles whitespace in category", () => {
      const result = calculateCo2Saved(1, "kg", "  produce  ");
      expect(result).toBe(1.5);
    });
  });

  describe("real-world scenarios", () => {
    test("calculates correctly for 2kg of chicken", () => {
      // 2kg meat: 2 * (20.0 + 0.5) = 41.0
      const result = calculateCo2Saved(2, "kg", "meat");
      expect(result).toBe(41);
    });

    test("calculates correctly for 500g of cheese", () => {
      // 500g dairy: 0.5 * (7.0 + 0.5) = 3.75
      const result = calculateCo2Saved(500, "g", "dairy");
      expect(result).toBe(3.75);
    });

    test("calculates correctly for 2L of milk", () => {
      // 2L dairy: 2 * (7.0 + 0.5) = 15.0
      const result = calculateCo2Saved(2, "l", "dairy");
      expect(result).toBe(15);
    });

    test("calculates correctly for 6 pack of eggs", () => {
      // 6 items dairy: 1.8kg * (7.0 + 0.5) = 13.5
      const result = calculateCo2Saved(6, "item", "dairy");
      expect(result).toBe(13.5);
    });

    test("calculates correctly for 1 loaf of bread", () => {
      // 1 item bakery: 0.3kg * (1.5 + 0.5) = 0.6
      const result = calculateCo2Saved(1, "item", "bakery");
      expect(result).toBe(0.6);
    });
  });
});

describe("getCategoryFactor", () => {
  test("returns correct factor for produce", () => {
    expect(getCategoryFactor("produce")).toBe(1.5); // 1.0 + 0.5
  });

  test("returns correct factor for dairy", () => {
    expect(getCategoryFactor("dairy")).toBe(7.5); // 7.0 + 0.5
  });

  test("returns correct factor for meat", () => {
    expect(getCategoryFactor("meat")).toBe(20.5); // 20.0 + 0.5
  });

  test("returns other factor for unknown category", () => {
    expect(getCategoryFactor("random")).toBe(3); // 2.5 + 0.5
  });

  test("returns other factor for null category", () => {
    expect(getCategoryFactor(null)).toBe(3); // 2.5 + 0.5
  });
});

describe("exported constants", () => {
  test("CO2_CATEGORY_FACTORS contains expected categories", () => {
    expect(CO2_CATEGORY_FACTORS.produce).toBe(1.0);
    expect(CO2_CATEGORY_FACTORS.dairy).toBe(7.0);
    expect(CO2_CATEGORY_FACTORS.meat).toBe(20.0);
    expect(CO2_CATEGORY_FACTORS.bakery).toBe(1.5);
    expect(CO2_CATEGORY_FACTORS.frozen).toBe(4.0);
    expect(CO2_CATEGORY_FACTORS.beverages).toBe(1.0);
    expect(CO2_CATEGORY_FACTORS.pantry).toBe(2.0);
    expect(CO2_CATEGORY_FACTORS.other).toBe(2.5);
  });

  test("CO2_DISPOSAL_FACTOR is correct", () => {
    expect(CO2_DISPOSAL_FACTOR).toBe(0.5);
  });
});
