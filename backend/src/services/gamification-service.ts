import { db } from "../index";
import * as schema from "../db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

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
 * Award points to a user for an action
 */
export async function awardPoints(userId: number, action: PointAction) {
  const amount = POINT_VALUES[action];
  const userPoints = await getOrCreateUserPoints(userId);

  const newTotal = Math.max(0, userPoints.totalPoints + amount);

  await db
    .update(schema.userPoints)
    .set({ totalPoints: newTotal })
    .where(eq(schema.userPoints.userId, userId));

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

  return { action, amount, newTotal };
}

/**
 * Update user's daily streak (once per day only)
 * Uses ProductSustainabilityMetrics to check activity history
 * - Only increments if this is the FIRST qualifying interaction today
 * - Resets to 1 if user missed a day (no activity yesterday)
 */
export async function updateStreak(userId: number) {
  const userPoints = await getOrCreateUserPoints(userId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const streakActions = ["consumed", "shared", "sold"];

  // Fetch all qualifying interactions for this user
  const allInteractions = await db.query.ProductSustainabilityMetrics.findMany({
    where: and(
      eq(schema.ProductSustainabilityMetrics.userId, userId),
      inArray(schema.ProductSustainabilityMetrics.type, streakActions)
    ),
    orderBy: [desc(schema.ProductSustainabilityMetrics.todayDate)],
  });

  // Filter today's interactions in JavaScript (avoids timestamp format issues)
  const todayInteractions = allInteractions.filter((i) => {
    const interactionDate = new Date(i.todayDate);
    interactionDate.setHours(0, 0, 0, 0);
    return interactionDate.getTime() === today.getTime();
  });

  // If more than 1 interaction today, streak already counted for today
  if (todayInteractions.length > 1) {
    return;
  }

  // Find the most recent interaction BEFORE today
  const previousInteraction = allInteractions.find((i) => {
    const interactionDate = new Date(i.todayDate);
    interactionDate.setHours(0, 0, 0, 0);
    return interactionDate.getTime() < today.getTime();
  });

  let newStreak: number;

  if (!previousInteraction) {
    // First ever qualifying interaction - start streak at 1
    newStreak = 1;
  } else {
    const lastDate = new Date(previousInteraction.todayDate);
    lastDate.setHours(0, 0, 0, 0);

    if (lastDate.getTime() === yesterday.getTime()) {
      // Last interaction was yesterday - continue streak
      newStreak = userPoints.currentStreak + 1;
    } else {
      // Last interaction was more than 1 day ago - reset streak
      newStreak = 1;
    }
  }

  await db
    .update(schema.userPoints)
    .set({ currentStreak: newStreak })
    .where(eq(schema.userPoints.userId, userId));
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
  await db.insert(schema.ProductSustainabilityMetrics).values({
    productId,
    userId,
    quantity,
    type,
  });
}

/**
 * Get user metrics computed from product_interaction table,
 * @ JASON , TONY , i left this here for your reference, delete if u think not needed, or modify
 * -yh
 */
export async function getUserMetrics(userId: number) {
  const interactions = await db.query.ProductSustainabilityMetrics.findMany({
    where: eq(schema.ProductSustainabilityMetrics.userId, userId),
  });

  const metrics = {
    totalItemsConsumed: 0,
    totalItemsWasted: 0,
    totalItemsShared: 0,
    totalItemsSold: 0,
  };

  for (const interaction of interactions) {
    switch (interaction.type) {
      case "consumed":
        metrics.totalItemsConsumed++;
        break;
      case "wasted":
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
