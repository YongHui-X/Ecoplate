import { db } from "../index";
import { eq, sql, and, gte } from "drizzle-orm";
import * as schema from "../db/schema";

type Period = "day" | "month" | "annual";

function getDateRange(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30); // last 30 days
    case "month":
      return new Date(now.getFullYear() - 1, now.getMonth(), 1); // last 12 months
    case "annual":
      return new Date(now.getFullYear() - 5, 0, 1); // last 5 years
  }
}

function formatDate(date: Date, period: Period): string {
  switch (period) {
    case "day":
      return date.toISOString().slice(0, 10); // YYYY-MM-DD
    case "month":
      return date.toISOString().slice(0, 7); // YYYY-MM
    case "annual":
      return date.getFullYear().toString();
  }
}

export async function getDashboardStats(userId: number, period: Period = "month") {
  const rangeStart = getDateRange(period);
  const rangeStartStr = rangeStart.toISOString().slice(0, 10); // YYYY-MM-DD format

  // Get sustainability metrics for this user
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

  // Get products for co2 data
  const products = db
    .select()
    .from(schema.products)
    .where(eq(schema.products.userId, userId))
    .all();

  // Get sold listings for money saved (filtered by date range)
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

  // Calculate summary stats — consumed, sold, shared all count as food saved
  const positiveMetrics = metrics.filter(
    (m) => m.type === "consumed" || m.type === "sold" || m.type === "shared"
  );

  // CO2 from products linked to positive metrics, proportional to quantity used
  let totalCo2Reduced = 0;
  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const m of positiveMetrics) {
    if (m.productId == null) continue;
    const product = productMap.get(m.productId);
    if (product?.co2Emission && product.quantity > 0) {
      totalCo2Reduced += product.co2Emission * (m.quantity / product.quantity);
    }
  }

  const totalFoodSaved = positiveMetrics.reduce((sum, m) => sum + m.quantity, 0);
  const totalMoneySaved = soldListings.reduce((sum, l) => sum + (l.price || 0), 0);
  const ecoPointsEarned = positiveMetrics.length * 10 + soldListings.length * 25;

  // Build chart data grouped by period
  const co2Map = new Map<string, number>();
  const foodMap = new Map<string, number>();

  for (const m of positiveMetrics) {
    const dateObj = m.todayDate instanceof Date ? m.todayDate : new Date(m.todayDate);
    const dateKey = formatDate(dateObj, period);
    const product = m.productId != null ? productMap.get(m.productId) : undefined;
    const co2 = (product?.co2Emission && product.quantity > 0)
      ? product.co2Emission * (m.quantity / product.quantity)
      : 0;

    co2Map.set(dateKey, (co2Map.get(dateKey) || 0) + co2);
    foodMap.set(dateKey, (foodMap.get(dateKey) || 0) + m.quantity);
  }

  const co2ChartData = Array.from(co2Map.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const foodChartData = Array.from(foodMap.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Impact equivalence
  const impactEquivalence = {
    carKmAvoided: Math.round(totalCo2Reduced * 6.0 * 10) / 10,
    treesPlanted: Math.round((totalCo2Reduced / 21.0) * 10) / 10,
    electricitySaved: Math.round(totalCo2Reduced * 3.6 * 10) / 10,
  };

  return {
    summary: {
      totalCo2Reduced: Math.round(totalCo2Reduced * 100) / 100,
      totalFoodSaved: Math.round(totalFoodSaved * 100) / 100,
      totalMoneySaved: Math.round(totalMoneySaved * 100) / 100,
      ecoPointsEarned,
    },
    co2ChartData,
    foodChartData,
    impactEquivalence,
  };
}
