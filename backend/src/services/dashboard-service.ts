import { db } from "../db/connection";
import { eq, and, gte } from "drizzle-orm";
import * as schema from "../db/schema";

type Period = "day" | "month" | "annual";

// Category CO2 factors (kg CO2e per kg food) - unified with consumption-service.ts
const CATEGORY_CO2_FACTORS: Record<string, number> = {
  meat: 15.0,
  protein: 15.0,
  dairy: 5.0,
  produce: 0.5,
  vegetables: 0.5,
  fruits: 0.5,
  grains: 1.2,
  pantry: 2.0,
  seafood: 6.0,
  bakery: 1.0,
  beverages: 1.0,
  snacks: 2.5,
  frozen: 3.0,
  other: 3.0,
};

function normalizeCategory(category: string | null): string {
  if (!category) return "other";
  return category.toLowerCase().trim();
}

function capitalizeCategory(category: string | null): string {
  const raw = category || "other";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function getDateRange(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    case "month":
      return new Date(now.getFullYear() - 1, now.getMonth(), 1);
    case "annual":
      return new Date(2000, 0, 1);
  }
}

function formatDate(date: Date, period: Period): string {
  switch (period) {
    case "day":
      return date.toISOString().slice(0, 10);
    case "month":
      return date.toISOString().slice(0, 7);
    case "annual":
      return date.getFullYear().toString();
  }
}

function parseMetricDate(todayDate: string): Date {
  return new Date(todayDate);
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ==================== Summary Stats ====================

export async function getDashboardStats(
  userId: number,
  period: Period = "month"
) {
  const rangeStart = getDateRange(period);
  const rangeStartStr = toDateString(rangeStart);

  const metrics = db
    .select()
    .from(schema.productSustainabilityMetrics)
    .where(
      and(
        eq(schema.productSustainabilityMetrics.userId, userId),
        gte(schema.productSustainabilityMetrics.todayDate, rangeStartStr)
      )
    )
    .all();

  const products = db
    .select()
    .from(schema.products)
    .where(eq(schema.products.userId, userId))
    .all();

  const soldListings = db
    .select()
    .from(schema.marketplaceListings)
    .where(
      and(
        eq(schema.marketplaceListings.sellerId, userId),
        eq(schema.marketplaceListings.status, "sold"),
        gte(schema.marketplaceListings.completedAt, rangeStart)
      )
    )
    .all();

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Helper to calculate CO2 for a metric
  const getCo2ForMetric = (m: typeof metrics[0]): number => {
    if (m.co2Value != null && m.co2Value > 0) {
      return m.co2Value;
    }
    if (m.productId == null) return 0;
    const product = productMap.get(m.productId);
    if (!product) return 0;
    const mQuantity = m.quantity ?? 0;
    if (product.co2Emission) {
      return product.co2Emission * mQuantity;
    }
    const cat = normalizeCategory(product.category);
    const factor = CATEGORY_CO2_FACTORS[cat] ?? CATEGORY_CO2_FACTORS["other"];
    return factor * mQuantity;
  };

  // CO2 Reduced = only from sold items (selling prevents waste)
  const soldMetrics = metrics.filter((m) => m.type === "sold");
  let totalCo2Reduced = 0;
  for (const m of soldMetrics) {
    totalCo2Reduced += getCo2ForMetric(m);
  }

  // CO2 Wasted = from wasted items in track consumption
  const wastedMetrics = metrics.filter((m) => m.type === "wasted");
  let totalCo2Wasted = 0;
  for (const m of wastedMetrics) {
    totalCo2Wasted += getCo2ForMetric(m);
  }

  const totalMoneySaved = soldListings.reduce(
    (sum, l) => sum + (l.price || 0),
    0
  );

  // Chart data for CO2 reduced (sold only)
  const co2Map = new Map<string, number>();
  for (const m of soldMetrics) {
    const dateObj = parseMetricDate(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const co2 = getCo2ForMetric(m);
    co2Map.set(dateKey, (co2Map.get(dateKey) || 0) + co2);
  }

  const co2ChartData = Array.from(co2Map.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Chart data for food saved (consumed + sold + shared)
  const positiveMetrics = metrics.filter(
    (m) => m.type && ["consumed", "sold", "shared"].includes(m.type)
  );
  const foodMap = new Map<string, number>();
  for (const m of positiveMetrics) {
    const dateObj = parseMetricDate(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const mQuantity = m.quantity ?? 0;
    foodMap.set(dateKey, (foodMap.get(dateKey) || 0) + mQuantity);
  }
  const foodChartData = Array.from(foodMap.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalFoodSaved = positiveMetrics.reduce(
    (sum, m) => sum + (m.quantity ?? 0),
    0
  );

  // Chart data for waste ratio (wasted / consumed per day)
  const consumedMetrics = metrics.filter((m) => m.type === "consumed");
  const wasteByDate = new Map<string, number>();
  const consumeByDate = new Map<string, number>();

  for (const m of wastedMetrics) {
    const dateObj = parseMetricDate(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const co2 = getCo2ForMetric(m);
    wasteByDate.set(dateKey, (wasteByDate.get(dateKey) || 0) + co2);
  }

  for (const m of consumedMetrics) {
    const dateObj = parseMetricDate(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const co2 = getCo2ForMetric(m);
    consumeByDate.set(dateKey, (consumeByDate.get(dateKey) || 0) + co2);
  }

  const allDates = new Set([...wasteByDate.keys(), ...consumeByDate.keys()]);
  const wasteRatioChartData = Array.from(allDates)
    .map((date) => {
      const wasted = wasteByDate.get(date) || 0;
      const consumed = consumeByDate.get(date) || 0;
      const total = wasted + consumed;
      const ratio = total > 0 ? Math.round((wasted / total) * 100) : 0;
      return { date, wasted: Math.round(wasted * 100) / 100, consumed: Math.round(consumed * 100) / 100, ratio };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const impactEquivalence = {
    carKmAvoided: Math.round(totalCo2Reduced * 6.0 * 10) / 10,
    treesPlanted: Math.round((totalCo2Reduced / 21.0) * 10) / 10,
    electricitySaved: Math.round(totalCo2Reduced * 3.6 * 10) / 10,
  };

  return {
    summary: {
      totalCo2Reduced: Math.round(totalCo2Reduced * 100) / 100,
      totalCo2Wasted: Math.round(totalCo2Wasted * 100) / 100,
      totalFoodSaved: Math.round(totalFoodSaved * 100) / 100,
      totalMoneySaved: Math.round(totalMoneySaved * 100) / 100,
    },
    co2ChartData,
    foodChartData,
    wasteRatioChartData,
    impactEquivalence,
  };
}

// ==================== CO2 Stats ====================

export async function getCO2Stats(userId: number, period: Period = "month") {
  const rangeStart = getDateRange(period);
  const rangeStartStr = toDateString(rangeStart);

  const metrics = db
    .select()
    .from(schema.productSustainabilityMetrics)
    .where(
      and(
        eq(schema.productSustainabilityMetrics.userId, userId),
        gte(schema.productSustainabilityMetrics.todayDate, rangeStartStr)
      )
    )
    .all();

  const products = db
    .select()
    .from(schema.products)
    .where(eq(schema.products.userId, userId))
    .all();

  const productMap = new Map(products.map((p) => [p.id, p]));

  const positiveMetrics = metrics.filter(
    (m) => m.type && ["consumed", "sold", "shared"].includes(m.type)
  );

  // CO2 Reduced = only from sold items (consistent with summary)
  const soldMetricsForCo2 = metrics.filter((m) => m.type === "sold");

  const categoryMap = new Map<string, number>();
  let totalCo2 = 0;  // This is for category breakdown (all positive metrics)
  let totalCo2Reduced = 0;  // Only sold items

  for (const m of positiveMetrics) {
    const mQuantity = m.quantity ?? 0;
    let co2: number;
    let catLabel: string;

    // Use pre-stored co2Value from metrics (calculated from products.co2Emission)
    if (m.co2Value != null && m.co2Value > 0) {
      co2 = m.co2Value;
      // Still need product for category
      const product = m.productId != null ? productMap.get(m.productId) : undefined;
      catLabel = capitalizeCategory(product?.category ?? null);
    } else {
      // Fallback for legacy data without co2Value
      if (m.productId == null) continue;
      const product = productMap.get(m.productId);
      if (!product) continue;
      if (product.co2Emission) {
        co2 = product.co2Emission * mQuantity;
      } else {
        const cat = normalizeCategory(product.category);
        const factor = CATEGORY_CO2_FACTORS[cat] ?? CATEGORY_CO2_FACTORS["other"];
        co2 = factor * mQuantity;
      }
      catLabel = capitalizeCategory(product.category);
    }

    totalCo2 += co2;
    categoryMap.set(catLabel, (categoryMap.get(catLabel) || 0) + co2);
  }

  // Calculate CO2 reduced only from sold items (consistent with Summary tab)
  for (const m of soldMetricsForCo2) {
    const mQuantity = m.quantity ?? 0;
    let co2: number;

    if (m.co2Value != null && m.co2Value > 0) {
      co2 = m.co2Value;
    } else {
      if (m.productId == null) continue;
      const product = productMap.get(m.productId);
      if (!product) continue;
      if (product.co2Emission) {
        co2 = product.co2Emission * mQuantity;
      } else {
        const cat = normalizeCategory(product.category);
        const factor = CATEGORY_CO2_FACTORS[cat] ?? CATEGORY_CO2_FACTORS["other"];
        co2 = factor * mQuantity;
      }
    }
    totalCo2Reduced += co2;
  }

  const trendMap = new Map<string, number>();
  for (const m of positiveMetrics) {
    const dateObj = parseMetricDate(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const mQuantity = m.quantity ?? 0;
    let co2: number;

    // Use pre-stored co2Value from metrics (calculated from products.co2Emission)
    if (m.co2Value != null && m.co2Value > 0) {
      co2 = m.co2Value;
    } else {
      // Fallback for legacy data without co2Value
      const product =
        m.productId != null ? productMap.get(m.productId) : undefined;
      if (product?.co2Emission) {
        co2 = product.co2Emission * mQuantity;
      } else if (product) {
        const cat = normalizeCategory(product.category);
        const factor = CATEGORY_CO2_FACTORS[cat] ?? CATEGORY_CO2_FACTORS["other"];
        co2 = factor * mQuantity;
      } else {
        co2 = CATEGORY_CO2_FACTORS["other"] * mQuantity;
      }
    }
    trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + co2);
  }

  const itemCo2 = new Map<string, number>();
  for (const m of positiveMetrics) {
    const mQuantity = m.quantity ?? 0;
    let co2: number;
    let productName: string;

    // Use pre-stored co2Value from metrics (calculated from products.co2Emission)
    if (m.co2Value != null && m.co2Value > 0) {
      co2 = m.co2Value;
      // Still need product for name
      const product = m.productId != null ? productMap.get(m.productId) : undefined;
      productName = product?.productName ?? "Unknown";
    } else {
      // Fallback for legacy data without co2Value
      if (m.productId == null) continue;
      const product = productMap.get(m.productId);
      if (!product) continue;
      if (product.co2Emission) {
        co2 = product.co2Emission * mQuantity;
      } else {
        const cat = normalizeCategory(product.category);
        co2 =
          (CATEGORY_CO2_FACTORS[cat] ?? CATEGORY_CO2_FACTORS["other"]) *
          mQuantity;
      }
      productName = product.productName;
    }
    itemCo2.set(productName, (itemCo2.get(productName) || 0) + co2);
  }

  const co2ByCategory = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  const co2Trend = Array.from(trendMap.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topItems = Array.from(itemCo2.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Helper to calculate CO2 for a metric
  const getCo2ForMetric = (m: typeof metrics[0]): number => {
    if (m.co2Value != null && m.co2Value > 0) {
      return m.co2Value;
    }
    if (m.productId == null) return 0;
    const product = productMap.get(m.productId);
    if (!product) return 0;
    const mQuantity = m.quantity ?? 0;
    if (product.co2Emission) {
      return product.co2Emission * mQuantity;
    }
    const cat = normalizeCategory(product.category);
    const factor = CATEGORY_CO2_FACTORS[cat] ?? CATEGORY_CO2_FACTORS["other"];
    return factor * mQuantity;
  };

  // Waste ratio chart data (wasted vs consumed per day)
  const consumedMetrics = metrics.filter((m) => m.type === "consumed");
  const wastedMetrics = metrics.filter((m) => m.type === "wasted");
  const wasteByDate = new Map<string, number>();
  const consumeByDate = new Map<string, number>();

  for (const m of wastedMetrics) {
    const dateObj = parseMetricDate(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const co2 = getCo2ForMetric(m);
    wasteByDate.set(dateKey, (wasteByDate.get(dateKey) || 0) + co2);
  }

  for (const m of consumedMetrics) {
    const dateObj = parseMetricDate(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const co2 = getCo2ForMetric(m);
    consumeByDate.set(dateKey, (consumeByDate.get(dateKey) || 0) + co2);
  }

  const allDates = new Set([...wasteByDate.keys(), ...consumeByDate.keys()]);
  const wasteRatioChartData = Array.from(allDates)
    .map((date) => {
      const wasted = wasteByDate.get(date) || 0;
      const consumed = consumeByDate.get(date) || 0;
      const total = wasted + consumed;
      const ratio = total > 0 ? Math.round((wasted / total) * 100) : 0;
      return { date, wasted: Math.round(wasted * 100) / 100, consumed: Math.round(consumed * 100) / 100, ratio };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const impactEquivalence = {
    carKmAvoided: Math.round(totalCo2Reduced * 6.0 * 10) / 10,
    treesPlanted: Math.round((totalCo2Reduced / 21.0) * 10) / 10,
    electricitySaved: Math.round(totalCo2Reduced * 3.6 * 10) / 10,
  };

  return {
    totalCo2Reduced: Math.round(totalCo2Reduced * 100) / 100,
    co2ByCategory,
    co2Trend,
    topItems,
    wasteRatioChartData,
    impactEquivalence,
  };
}

// ==================== Financial Stats ====================

export async function getFinancialStats(
  userId: number,
  period: Period = "month"
) {
  const rangeStart = getDateRange(period);

  const soldListings = db
    .select()
    .from(schema.marketplaceListings)
    .where(
      and(
        eq(schema.marketplaceListings.sellerId, userId),
        eq(schema.marketplaceListings.status, "sold"),
        gte(schema.marketplaceListings.completedAt, rangeStart)
      )
    )
    .all();

  const purchasedListings = db
    .select()
    .from(schema.marketplaceListings)
    .where(
      and(
        eq(schema.marketplaceListings.buyerId, userId),
        eq(schema.marketplaceListings.status, "sold"),
        gte(schema.marketplaceListings.completedAt, rangeStart)
      )
    )
    .all();

  const totalEarned = soldListings.reduce((sum, l) => sum + (l.price || 0), 0);
  const totalSpent = purchasedListings.reduce(
    (sum, l) => sum + (l.price || 0),
    0
  );
  const totalSavedByBuying = purchasedListings.reduce((sum, l) => {
    const orig = l.originalPrice || 0;
    const actual = l.price || 0;
    return sum + Math.max(0, orig - actual);
  }, 0);

  const savingsMap = new Map<string, number>();
  for (const l of soldListings) {
    if (!l.completedAt) continue;
    const dateKey = formatDate(l.completedAt, period);
    savingsMap.set(dateKey, (savingsMap.get(dateKey) || 0) + (l.price || 0));
  }

  const savingsOverTime = Array.from(savingsMap.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const priceComparison = soldListings
    .filter((l) => l.originalPrice && l.price)
    .slice(0, 10)
    .map((l) => ({
      name: l.title,
      originalPrice: Math.round((l.originalPrice || 0) * 100) / 100,
      sellingPrice: Math.round((l.price || 0) * 100) / 100,
    }));

  const discountBuckets: Record<string, number> = {
    "0-20%": 0,
    "20-40%": 0,
    "40-60%": 0,
    "60-80%": 0,
    "80-100%": 0,
  };
  for (const l of soldListings) {
    if (!l.originalPrice || !l.price || l.originalPrice === 0) continue;
    const discount = ((l.originalPrice - l.price) / l.originalPrice) * 100;
    if (discount < 20) discountBuckets["0-20%"]++;
    else if (discount < 40) discountBuckets["20-40%"]++;
    else if (discount < 60) discountBuckets["40-60%"]++;
    else if (discount < 80) discountBuckets["60-80%"]++;
    else discountBuckets["80-100%"]++;
  }

  const discountDistribution = Object.entries(discountBuckets).map(
    ([range, count]) => ({ range, count })
  );

  const speedBuckets: Record<string, number> = {
    "< 1 day": 0,
    "1-3 days": 0,
    "3-7 days": 0,
    "1-2 weeks": 0,
    "2+ weeks": 0,
  };
  for (const l of soldListings) {
    if (!l.completedAt || !l.createdAt) continue;
    const hoursToSell = Math.max(
      0,
      (l.completedAt.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60)
    );
    if (hoursToSell < 24) speedBuckets["< 1 day"]++;
    else if (hoursToSell < 72) speedBuckets["1-3 days"]++;
    else if (hoursToSell < 168) speedBuckets["3-7 days"]++;
    else if (hoursToSell < 336) speedBuckets["1-2 weeks"]++;
    else speedBuckets["2+ weeks"]++;
  }

  const salesSpeed = Object.entries(speedBuckets).map(([range, count]) => ({
    range,
    count,
  }));

  let avgTimeToSell = 0;
  const validSoldListings = soldListings.filter(
    (l) => l.completedAt && l.createdAt && l.completedAt >= l.createdAt
  );
  if (validSoldListings.length > 0) {
    const totalHours = validSoldListings.reduce((sum, l) => {
      return (
        sum +
        (l.completedAt!.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60)
      );
    }, 0);
    avgTimeToSell =
      Math.round((totalHours / validSoldListings.length) * 10) / 10;
  }

  return {
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalSavedByBuying: Math.round(totalSavedByBuying * 100) / 100,
    totalListingsSold: soldListings.length,
    totalPurchases: purchasedListings.length,
    avgTimeToSell,
    savingsOverTime,
    priceComparison,
    discountDistribution,
    salesSpeed,
  };
}

// ==================== Food Stats ====================

export async function getFoodStats(userId: number, period: Period = "month") {
  const rangeStart = getDateRange(period);
  const rangeStartStr = toDateString(rangeStart);

  const metrics = db
    .select()
    .from(schema.productSustainabilityMetrics)
    .where(
      and(
        eq(schema.productSustainabilityMetrics.userId, userId),
        gte(schema.productSustainabilityMetrics.todayDate, rangeStartStr)
      )
    )
    .all();

  const products = db
    .select()
    .from(schema.products)
    .where(eq(schema.products.userId, userId))
    .all();

  const productMap = new Map(products.map((p) => [p.id, p]));

  const consumed = metrics.filter((m) => m.type === "consumed");
  const wasted = metrics.filter((m) => m.type === "wasted");
  const shared = metrics.filter((m) => m.type === "shared");
  const sold = metrics.filter((m) => m.type === "sold");

  const totalConsumed = consumed.reduce(
    (sum, m) => sum + (m.quantity ?? 0),
    0
  );
  const totalWasted = wasted.reduce((sum, m) => sum + (m.quantity ?? 0), 0);
  const totalShared = shared.reduce((sum, m) => sum + (m.quantity ?? 0), 0);
  const totalSold = sold.reduce((sum, m) => sum + (m.quantity ?? 0), 0);
  const totalFood = totalConsumed + totalWasted + totalShared + totalSold;

  const wasteRate =
    totalFood > 0 ? Math.round((totalWasted / totalFood) * 1000) / 10 : 0;

  const categoryMap = new Map<string, number>();
  for (const m of metrics) {
    if (m.productId == null) continue;
    const product = productMap.get(m.productId);
    const catLabel = capitalizeCategory(product?.category ?? null);
    categoryMap.set(
      catLabel,
      (categoryMap.get(catLabel) || 0) + (m.quantity ?? 0)
    );
  }

  const foodByCategory = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  const savedTrendMap = new Map<string, number>();
  const wastedTrendMap = new Map<string, number>();

  for (const m of metrics) {
    const dateObj = parseMetricDate(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const qty = m.quantity ?? 0;

    if (m.type && ["consumed", "sold", "shared"].includes(m.type)) {
      savedTrendMap.set(dateKey, (savedTrendMap.get(dateKey) || 0) + qty);
    } else if (m.type === "wasted") {
      wastedTrendMap.set(dateKey, (wastedTrendMap.get(dateKey) || 0) + qty);
    }
  }

  const allDates = new Set([
    ...savedTrendMap.keys(),
    ...wastedTrendMap.keys(),
  ]);
  const foodTrend = Array.from(allDates)
    .map((date) => ({
      date,
      saved: Math.round((savedTrendMap.get(date) || 0) * 100) / 100,
      wasted: Math.round((wastedTrendMap.get(date) || 0) * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const itemMap = new Map<string, number>();
  for (const m of metrics) {
    if (m.productId == null) continue;
    const product = productMap.get(m.productId);
    if (!product) continue;
    itemMap.set(
      product.productName,
      (itemMap.get(product.productName) || 0) + (m.quantity ?? 0)
    );
  }

  const topItems = Array.from(itemMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    totalConsumed: Math.round(totalConsumed * 100) / 100,
    totalWasted: Math.round(totalWasted * 100) / 100,
    totalShared: Math.round(totalShared * 100) / 100,
    totalSold: Math.round(totalSold * 100) / 100,
    wasteRate,
    foodByCategory,
    foodTrend,
    topItems,
  };
}
