import { db } from "../db/connection";
import * as schema from "../db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

import { notifyStreakMilestone } from "./notification-service";

// Point values for different actions
export const POINT_VALUES = {
  consumed: 5,
  shared: 10,
  sold: 8,
  wasted: -3,
} as const;

export type PointAction = keyof typeof POINT_VALUES;

/**
 * Get or create user points record
 */
export async function getOrCreateUserPoints(userId: number) {
  let points = await db.query.userPoints.findFirst({
    where: eq(schema.userPoints.userId, userId),
  });

  if (!points) {
    const [created] = await db
      .insert(schema.userPoints)
      .values({ userId })
      .returning();
    points = created;
  }

  return points;
}

/**
 * Listing data for CO2 tracking on sale completion
 */
export interface ListingDataForCo2 {
  co2Saved: number | null;
  buyerId: number | null;
}

/**
 * Award points to a user for an action
 * Also records the sustainability metric for tracking
 *
 * For "sold" actions, pass listingData to award CO2 to both seller and buyer
 */
export async function awardPoints(
  userId: number,
  action: PointAction,
  productId?: number | null,
  quantity?: number,
  skipMetricRecording?: boolean,
  listingData?: ListingDataForCo2
) {
  const baseValue = POINT_VALUES[action];
  const scaled = Math.round(baseValue * (quantity ?? 1));
  // Ensure at least ±1 point (so tiny quantities don't round to zero)
  const amount = scaled === 0 ? Math.sign(baseValue) : scaled;
  const userPoints = await getOrCreateUserPoints(userId);

  const newTotal = Math.max(0, userPoints.totalPoints + amount);

  await db
    .update(schema.userPoints)
    .set({ totalPoints: newTotal })
    .where(eq(schema.userPoints.userId, userId));

  // Record the sustainability metric (skip if caller already recorded it)
  if (!skipMetricRecording) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await db.insert(schema.productSustainabilityMetrics).values({
      productId: productId ?? null,
      userId,
      todayDate: today,
      quantity: quantity ?? 1,
      type: action,
    });
  }

  // Only update streak for positive sustainability actions (not wasted)
  const streakActions = ["consumed", "shared", "sold"];
  if (streakActions.includes(action)) {
    await updateStreak(userId);
  } else if (action === "wasted") {
    await db
      .update(schema.userPoints)
      .set({ currentStreak: 0 })
      .where(eq(schema.userPoints.userId, userId));
  }

  // Handle CO2 tracking for sold items
  let co2Saved: number | null = null;
  if (action === "sold" && listingData?.co2Saved) {
    co2Saved = listingData.co2Saved;

    // Award CO2 to seller
    await db
      .update(schema.userPoints)
      .set({ totalCo2Saved: userPoints.totalCo2Saved + co2Saved })
      .where(eq(schema.userPoints.userId, userId));

    // Award CO2 to buyer if exists
    if (listingData.buyerId) {
      const buyerPoints = await getOrCreateUserPoints(listingData.buyerId);
      await db
        .update(schema.userPoints)
        .set({ totalCo2Saved: buyerPoints.totalCo2Saved + co2Saved })
        .where(eq(schema.userPoints.userId, listingData.buyerId));
    }
  }

  // Check and award any newly earned badges
  const { checkAndAwardBadges } = await import("./badge-service");
  const newBadges = await checkAndAwardBadges(userId);

  return { action, amount, newTotal, newBadges, co2Saved };
}

/**
 * Update user's daily streak (once per day only)
 * Uses ProductSustainabilityMetrics to check activity history
 * - Only increments if this is the FIRST qualifying interaction today
 * - Resets to 1 if user missed a day (no activity yesterday)
 */
export async function updateStreak(userId: number) {
  const userPoints = await getOrCreateUserPoints(userId);

  // Use UTC date strings to match how todayDate is stored (toISOString().slice(0, 10))
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayDate = new Date(now);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const streakActions = ["consumed", "shared", "sold"];

  // Fetch all qualifying interactions for this user
  const allInteractions = await db.query.productSustainabilityMetrics.findMany({
    where: and(
      eq(schema.productSustainabilityMetrics.userId, userId),
      inArray(schema.productSustainabilityMetrics.type, streakActions)
    ),
    orderBy: [desc(schema.productSustainabilityMetrics.todayDate)],
  });

  // Filter today's interactions using string comparison (matches storage format)
  const todayInteractions = allInteractions.filter((i) => i.todayDate === todayStr);

  // If more than 1 interaction today, streak already counted for today
  if (todayInteractions.length > 1) {
    return;
  }

  // Find the most recent interaction BEFORE today using string comparison.
  const previousInteraction = allInteractions.find((i) => i.todayDate < todayStr);

  let newStreak: number;

  if (!previousInteraction) {
    // First ever qualifying interaction - start streak at 1
    newStreak = 1;
  } else if (previousInteraction.todayDate === yesterdayStr) {
    // Last interaction was yesterday - continue streak
    newStreak = userPoints.currentStreak + 1;
  } else {
    // Last interaction was more than 1 day ago - reset streak
    newStreak = 1;
  }

  await db
    .update(schema.userPoints)
    .set({ currentStreak: newStreak })
    .where(eq(schema.userPoints.userId, userId));

  // Check for streak milestones and send notification
  const milestones = [3, 7, 14, 30, 60, 90, 100, 365];
  if (milestones.includes(newStreak)) {
    await notifyStreakMilestone(userId, newStreak);
  }
}

/**
 * Record a product interaction (consumed, wasted, shared, sold)
 */
export async function recordProductSustainabilityMetrics(
  productId: number | null,
  userId: number,
  quantity: number,
  type: "consumed" | "wasted" | "shared" | "sold"
) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await db.insert(schema.productSustainabilityMetrics).values({
    productId,
    userId,
    todayDate: today,
    quantity,
    type,
  });
}

/**
 * Get detailed points stats for the EcoPoints dashboard.
 * Computes streaks, time-windowed points, and breakdown by action type.
 */
export async function getDetailedPointsStats(userId: number) {
  const allInteractions = await db.query.productSustainabilityMetrics.findMany({
    where: eq(schema.productSustainabilityMetrics.userId, userId),
    orderBy: [desc(schema.productSustainabilityMetrics.todayDate)],
  });

  const streakActions = ["consumed", "shared", "sold"];
  const now = new Date();

  // Use UTC date strings to match how todayDate is stored
  const todayStr = now.toISOString().slice(0, 10);

  const weekAgoDate = new Date(now);
  weekAgoDate.setUTCDate(weekAgoDate.getUTCDate() - 7);
  const weekAgoStr = weekAgoDate.toISOString().slice(0, 10);

  const monthAgoDate = new Date(now);
  monthAgoDate.setUTCMonth(monthAgoDate.getUTCMonth() - 1);
  const monthAgoStr = monthAgoDate.toISOString().slice(0, 10);

  // Breakdown by type (all interactions)
  const breakdownByType: Record<string, { count: number; totalPoints: number }> = {
    consumed: { count: 0, totalPoints: 0 },
    shared: { count: 0, totalPoints: 0 },
    sold: { count: 0, totalPoints: 0 },
    wasted: { count: 0, totalPoints: 0 },
  };

  let pointsToday = 0;
  let pointsThisWeek = 0;
  let pointsThisMonth = 0;

  // Collect unique dates with positive actions for streak computation
  const activeDateSet = new Set<string>();
  // Track points per day for bestDayPoints
  const pointsByDay = new Map<string, number>();
  // Track points per month for monthly bar chart
  const pointsByMonth = new Map<string, number>();

  let firstActivityDate: string | null = null;
  let lastActiveDate: string | null = null;

  for (const interaction of allInteractions) {
    const type = (interaction.type || "").toLowerCase() as keyof typeof POINT_VALUES;
    const basePoints = POINT_VALUES[type] ?? 0;
    const scaled = Math.round(basePoints * (interaction.quantity ?? 1));
    const points = scaled === 0 ? Math.sign(basePoints) : scaled;
    // Use todayDate directly as dateKey — it's already stored as "YYYY-MM-DD"
    const dateKey = interaction.todayDate;

    // Breakdown
    if (breakdownByType[type]) {
      breakdownByType[type].count++;
      breakdownByType[type].totalPoints += points;
    }

    // Track first/last activity dates
    if (!lastActiveDate) lastActiveDate = dateKey;
    firstActivityDate = dateKey;

    // Points by day
    pointsByDay.set(dateKey, (pointsByDay.get(dateKey) || 0) + points);

    // Points by month
    const monthKey = dateKey.substring(0, 7); // YYYY-MM
    pointsByMonth.set(monthKey, (pointsByMonth.get(monthKey) || 0) + points);

    // Time-windowed points using string comparison (YYYY-MM-DD sorts lexicographically)
    if (dateKey >= todayStr) {
      pointsToday += points;
    }
    if (dateKey >= weekAgoStr) {
      pointsThisWeek += points;
    }
    if (dateKey >= monthAgoStr) {
      pointsThisMonth += points;
    }

    // Track active days for streak (positive actions only)
    if (streakActions.includes(type)) {
      activeDateSet.add(dateKey);
    }
  }

  // Compute longest streak from sorted unique active dates
  // Parse with explicit UTC suffix to avoid timezone shifts
  const activeDates = Array.from(activeDateSet)
    .sort()
    .map((d) => new Date(d + "T00:00:00Z"));

  let longestStreak = 0;
  let currentRun = 0;

  for (let i = 0; i < activeDates.length; i++) {
    if (i === 0) {
      currentRun = 1;
    } else {
      const prev = activeDates[i - 1];
      const curr = activeDates[i];
      const diffMs = curr.getTime() - prev.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        currentRun++;
      } else {
        currentRun = 1;
      }
    }
    if (currentRun > longestStreak) longestStreak = currentRun;
  }

  const totalActiveDays = activeDateSet.size;
  const totalPositivePoints = breakdownByType.consumed.totalPoints +
    breakdownByType.shared.totalPoints +
    breakdownByType.sold.totalPoints;
  const averagePointsPerActiveDay = totalActiveDays > 0
    ? Math.round(totalPositivePoints / totalActiveDays)
    : 0;

  const bestDayPoints = pointsByDay.size > 0
    ? Math.max(...pointsByDay.values())
    : 0;

  // Compute last 6 months of points for bar chart
  const last6Months: Array<{ month: string; points: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    last6Months.push({ month: key, points: pointsByMonth.get(key) || 0 });
  }

  return {
    longestStreak,
    totalActiveDays,
    lastActiveDate,
    firstActivityDate,
    pointsToday,
    pointsThisWeek,
    pointsThisMonth,
    bestDayPoints,
    averagePointsPerActiveDay,
    breakdownByType,
    pointsByMonth: last6Months,
  };
}

/**
 * Get user metrics computed from product_interaction table,
 * @ JASON , TONY , i left this here for your reference, delete if u think not needed, or modify
 * -yh
 */
export async function getUserMetrics(userId: number) {
  const interactions = await db.query.productSustainabilityMetrics.findMany({
    where: eq(schema.productSustainabilityMetrics.userId, userId),
  });

  const metrics = {
    totalItemsConsumed: 0,
    totalItemsWasted: 0,
    totalItemsShared: 0,
    totalItemsSold: 0,
  };

  for (const interaction of interactions) {
    switch ((interaction.type || "").toLowerCase()) {
      case "consumed":
      case "consume":
        metrics.totalItemsConsumed++;
        break;
      case "wasted":
      case "waste":
        metrics.totalItemsWasted++;
        break;
      case "shared":
        metrics.totalItemsShared++;
        break;
      case "sold":
        metrics.totalItemsSold++;
        break;
    }
  }

  // Calculate derived metrics
  const totalItems =
    metrics.totalItemsConsumed +
    metrics.totalItemsWasted +
    metrics.totalItemsShared +
    metrics.totalItemsSold;

  const itemsSaved =
    metrics.totalItemsConsumed + metrics.totalItemsShared + metrics.totalItemsSold;

  const wasteReductionRate = totalItems > 0 ? (itemsSaved / totalItems) * 100 : 100;

  // Estimate CO2 saved (0.5kg per saved item on average)
  const estimatedCo2Saved = itemsSaved * 0.5;

  // Estimate money saved (would need product prices for accuracy)
  const estimatedMoneySaved = itemsSaved * 5; // $5 average per item

  return {
    ...metrics,
    wasteReductionRate,
    estimatedCo2Saved,
    estimatedMoneySaved,
  };
}
