import { describe, expect, test } from "bun:test";
import {
  getEmissionFactor,
  calculateWasteMetrics,
  getSustainabilityRating,
  EMISSION_FACTORS,
  DISPOSAL_EMISSION_FACTORS,
  CATEGORY_FALLBACKS,
} from "../consumption-service";

describe("getEmissionFactor", () => {
  test("resolves by exact product name match (case-insensitive)", () => {
    expect(getEmissionFactor("Beef", "meat")).toBe(99.0);
    expect(getEmissionFactor("chicken", "meat")).toBe(9.0);
    expect(getEmissionFactor("Rice", "pantry")).toBe(4.0);
    expect(getEmissionFactor("MILK", "dairy")).toBe(8.0);
  });

  test("resolves by partial name match", () => {
    expect(getEmissionFactor("Chicken Breast", "meat")).toBe(9.0);
    expect(getEmissionFactor("Organic Beef Steak", "meat")).toBe(99.0);
    expect(getEmissionFactor("Fresh Salmon Fish", "meat")).toBe(13.0);
  });

  test("falls back to category when name not matched", () => {
    expect(getEmissionFactor("Unknown Protein Bar", "meat")).toBe(
      CATEGORY_FALLBACKS.meat
    );
    expect(getEmissionFactor("Mystery Dairy Item", "dairy")).toBe(
      CATEGORY_FALLBACKS.dairy
    );
    expect(getEmissionFactor("Exotic Vegetable", "produce")).toBe(
      CATEGORY_FALLBACKS.produce
    );
  });

  test("returns default factor when no name or category match", () => {
    expect(getEmissionFactor("Something Unknown", "unknown")).toBe(2.0);
    expect(getEmissionFactor("Random Item", undefined)).toBe(2.0);
  });
});

describe("calculateWasteMetrics", () => {
  test("computes correct metrics for a single item with partial waste", () => {
    const ingredients = [
      {
        productId: 1,
        productName: "Chicken Breast",
        quantityUsed: 1.0,
        category: "meat",
        unitPrice: 8.0,
        co2Emission: 9.0,
      },
    ];
    const wasteItems = [
      {
        productName: "Chicken Breast",
        quantityWasted: 0.25,
        productId: 1,
      },
    ];

    const result = calculateWasteMetrics(ingredients, wasteItems, "landfill");

    // CO2 wasted: 0.25 * 9.0 = 2.25
    expect(result.totalCO2Wasted).toBeCloseTo(2.25, 2);
    // CO2 saved: (1.0 - 0.25) * 9.0 = 6.75
    expect(result.totalCO2Saved).toBeCloseTo(6.75, 2);
    // Disposal CO2: 0.25 * 0.5 = 0.125, rounded to 0.13
    expect(result.disposalCO2).toBeCloseTo(0.13, 2);
    // Economic waste: (0.25 / 1.0) * 8.0 = 2.0
    expect(result.totalEconomicWaste).toBeCloseTo(2.0, 2);
    // Economic consumed: 8.0 - 2.0 = 6.0
    expect(result.totalEconomicConsumed).toBeCloseTo(6.0, 2);
    // Waste percentage: (0.25 / 1.0) * 100 = 25
    expect(result.wastePercentage).toBeCloseTo(25.0, 1);
    // Sustainability score should be in 0-100 range
    expect(result.sustainabilityScore).toBeGreaterThanOrEqual(0);
    expect(result.sustainabilityScore).toBeLessThanOrEqual(100);
    // Item breakdown should have the ingredient
    expect(result.itemBreakdown).toHaveLength(1);
    expect(result.itemBreakdown[0].productName).toBe("Chicken Breast");
  });

  test("handles zero waste (clean plate)", () => {
    const ingredients = [
      {
        productId: 1,
        productName: "Rice",
        quantityUsed: 0.5,
        category: "pantry",
        unitPrice: 3.0,
        co2Emission: 4.0,
      },
    ];
    const wasteItems: Array<{
      productName: string;
      quantityWasted: number;
      productId?: number;
    }> = [];

    const result = calculateWasteMetrics(ingredients, wasteItems, "landfill");

    expect(result.totalCO2Wasted).toBe(0);
    expect(result.totalCO2Saved).toBeCloseTo(2.0, 2); // 0.5 * 4.0
    expect(result.disposalCO2).toBe(0);
    expect(result.totalEconomicWaste).toBe(0);
    expect(result.wastePercentage).toBe(0);
    expect(result.sustainabilityRating).toBe("Excellent");
  });

  test("handles full waste (everything thrown away)", () => {
    const ingredients = [
      {
        productId: 2,
        productName: "Lettuce",
        quantityUsed: 0.3,
        category: "produce",
        unitPrice: 4.0,
        co2Emission: 2.0,
      },
    ];
    const wasteItems = [
      {
        productName: "Lettuce",
        quantityWasted: 0.3,
        productId: 2,
      },
    ];

    const result = calculateWasteMetrics(ingredients, wasteItems, "landfill");

    expect(result.totalCO2Wasted).toBeCloseTo(0.6, 2); // 0.3 * 2.0
    expect(result.totalCO2Saved).toBe(0);
    expect(result.totalEconomicWaste).toBeCloseTo(4.0, 2);
    expect(result.totalEconomicConsumed).toBe(0);
    expect(result.wastePercentage).toBeCloseTo(100.0, 1);
  });

  test("clamps waste quantity to used quantity", () => {
    const ingredients = [
      {
        productId: 1,
        productName: "Bread",
        quantityUsed: 0.5,
        category: "bakery",
        unitPrice: 5.0,
        co2Emission: 1.5,
      },
    ];
    // Waste exceeds used quantity
    const wasteItems = [
      {
        productName: "Bread",
        quantityWasted: 0.8, // More than 0.5 used
        productId: 1,
      },
    ];

    const result = calculateWasteMetrics(ingredients, wasteItems, "landfill");

    // Should be clamped to 0.5
    expect(result.wastePercentage).toBeCloseTo(100.0, 1);
    expect(result.totalCO2Wasted).toBeCloseTo(0.75, 2); // 0.5 * 1.5
    expect(result.totalCO2Saved).toBe(0);
  });

  test("computes correct metrics with multiple items", () => {
    const ingredients = [
      {
        productId: 1,
        productName: "Chicken Breast",
        quantityUsed: 1.0,
        category: "meat",
        unitPrice: 8.0,
        co2Emission: 9.0,
      },
      {
        productId: 2,
        productName: "Rice",
        quantityUsed: 0.5,
        category: "pantry",
        unitPrice: 3.0,
        co2Emission: 4.0,
      },
      {
        productId: 3,
        productName: "Tomatoes",
        quantityUsed: 0.3,
        category: "produce",
        unitPrice: 4.0,
        co2Emission: 2.0,
      },
    ];
    const wasteItems = [
      { productName: "Chicken Breast", quantityWasted: 0.2, productId: 1 },
      { productName: "Rice", quantityWasted: 0.1, productId: 2 },
    ];

    const result = calculateWasteMetrics(
      ingredients,
      wasteItems,
      "composting"
    );

    // Total waste weight: 0.2 + 0.1 = 0.3
    // Total used weight: 1.0 + 0.5 + 0.3 = 1.8
    expect(result.wastePercentage).toBeCloseTo((0.3 / 1.8) * 100, 1);

    // CO2 wasted: 0.2*9.0 + 0.1*4.0 = 1.8 + 0.4 = 2.2
    expect(result.totalCO2Wasted).toBeCloseTo(2.2, 2);

    // CO2 saved: 0.8*9.0 + 0.4*4.0 + 0.3*2.0 = 7.2 + 1.6 + 0.6 = 9.4
    expect(result.totalCO2Saved).toBeCloseTo(9.4, 2);

    // Disposal CO2 (composting = 0.1): 0.3 * 0.1 = 0.03
    expect(result.disposalCO2).toBeCloseTo(0.03, 3);

    // Item breakdown should have all 3 items
    expect(result.itemBreakdown).toHaveLength(3);
  });

  test("uses co2Emission from ingredient when available", () => {
    const ingredients = [
      {
        productId: 1,
        productName: "Custom Food",
        quantityUsed: 1.0,
        category: "other",
        unitPrice: 10.0,
        co2Emission: 15.0, // Custom value
      },
    ];
    const wasteItems = [
      { productName: "Custom Food", quantityWasted: 0.5, productId: 1 },
    ];

    const result = calculateWasteMetrics(ingredients, wasteItems, "landfill");

    // Should use the provided co2Emission (15.0), not look up from factors
    expect(result.totalCO2Wasted).toBeCloseTo(7.5, 2); // 0.5 * 15.0
    expect(result.totalCO2Saved).toBeCloseTo(7.5, 2); // 0.5 * 15.0
  });
});

describe("getSustainabilityRating", () => {
  test("returns Excellent for score 0-20", () => {
    expect(getSustainabilityRating(0)).toBe("Excellent");
    expect(getSustainabilityRating(10)).toBe("Excellent");
    expect(getSustainabilityRating(20)).toBe("Excellent");
  });

  test("returns Good for score 21-40", () => {
    expect(getSustainabilityRating(21)).toBe("Good");
    expect(getSustainabilityRating(30)).toBe("Good");
    expect(getSustainabilityRating(40)).toBe("Good");
  });

  test("returns Moderate for score 41-60", () => {
    expect(getSustainabilityRating(41)).toBe("Moderate");
    expect(getSustainabilityRating(50)).toBe("Moderate");
    expect(getSustainabilityRating(60)).toBe("Moderate");
  });

  test("returns Poor for score 61-80", () => {
    expect(getSustainabilityRating(61)).toBe("Poor");
    expect(getSustainabilityRating(70)).toBe("Poor");
    expect(getSustainabilityRating(80)).toBe("Poor");
  });

  test("returns Critical for score 81-100", () => {
    expect(getSustainabilityRating(81)).toBe("Critical");
    expect(getSustainabilityRating(90)).toBe("Critical");
    expect(getSustainabilityRating(100)).toBe("Critical");
  });
});

describe("constant maps", () => {
  test("EMISSION_FACTORS contains key food types", () => {
    expect(EMISSION_FACTORS.beef).toBe(99.0);
    expect(EMISSION_FACTORS.chicken).toBe(9.0);
    expect(EMISSION_FACTORS.rice).toBe(4.0);
    expect(EMISSION_FACTORS.milk).toBe(8.0);
    expect(EMISSION_FACTORS.potatoes).toBe(0.5);
  });

  test("DISPOSAL_EMISSION_FACTORS contains all methods", () => {
    expect(DISPOSAL_EMISSION_FACTORS.landfill).toBe(0.5);
    expect(DISPOSAL_EMISSION_FACTORS.composting).toBe(0.1);
    expect(DISPOSAL_EMISSION_FACTORS.incineration).toBe(0.9);
  });

  test("CATEGORY_FALLBACKS covers main categories", () => {
    expect(CATEGORY_FALLBACKS.meat).toBeDefined();
    expect(CATEGORY_FALLBACKS.dairy).toBeDefined();
    expect(CATEGORY_FALLBACKS.produce).toBeDefined();
    expect(CATEGORY_FALLBACKS.pantry).toBeDefined();
  });
});
