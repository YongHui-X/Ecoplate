import { db } from "../db/connection";
import * as schema from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getOrCreateUserPoints } from "./gamification-service";
import { notifyBadgeUnlocked } from "./notification-service";

// ==================== Types ====================

interface BadgeMetrics {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  totalConsumed: number;
  totalWasted: number;
  totalShared: number;
  totalSold: number;
  totalActions: number; // consumed + shared + sold (positive only)
  totalItems: number; // all types including wasted
  wasteReductionRate: number; // percentage 0-100
}

interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  category: string;
  pointsAwarded: number;
  sortOrder: number;
  condition: (m: BadgeMetrics) => boolean;
  progress: (m: BadgeMetrics) => { current: number; target: number; percentage: number };
}

// ==================== Badge Definitions ====================

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // --- Milestones ---
  {
    code: "first_action",
    name: "First Steps",
    description: "Complete your first sustainability action",
    category: "milestones",
    pointsAwarded: 25,
    sortOrder: 1,
    condition: (m) => m.totalActions >= 1,
    progress: (m) => ({ current: Math.min(m.totalActions, 1), target: 1, percentage: Math.min(100, (m.totalActions / 1) * 100) }),
  },
  {
    code: "eco_starter",
    name: "Eco Starter",
    description: "Complete 10 sustainability actions",
    category: "milestones",
    pointsAwarded: 50,
    sortOrder: 2,
    condition: (m) => m.totalActions >= 10,
    progress: (m) => ({ current: Math.min(m.totalActions, 10), target: 10, percentage: Math.min(100, (m.totalActions / 10) * 100) }),
  },
  {
    code: "eco_enthusiast",
    name: "Eco Enthusiast",
    description: "Complete 50 sustainability actions",
    category: "milestones",
    pointsAwarded: 100,
    sortOrder: 3,
    condition: (m) => m.totalActions >= 50,
    progress: (m) => ({ current: Math.min(m.totalActions, 50), target: 50, percentage: Math.min(100, (m.totalActions / 50) * 100) }),
  },
  {
    code: "eco_champion",
    name: "Eco Champion",
    description: "Earn 1000 total EcoPoints",
    category: "milestones",
    pointsAwarded: 150,
    sortOrder: 4,
    condition: (m) => m.totalPoints >= 1000,
    progress: (m) => ({ current: Math.min(m.totalPoints, 1000), target: 1000, percentage: Math.min(100, (m.totalPoints / 1000) * 100) }),
  },

  // --- Waste Reduction ---
  {
    code: "first_consume",
    name: "Clean Plate",
    description: "Consume your first item",
    category: "waste-reduction",
    pointsAwarded: 25,
    sortOrder: 5,
    condition: (m) => m.totalConsumed >= 1,
    progress: (m) => ({ current: Math.min(m.totalConsumed, 1), target: 1, percentage: Math.min(100, (m.totalConsumed / 1) * 100) }),
  },
  {
    code: "waste_watcher",
    name: "Waste Watcher",
    description: "Consume 25 items",
    category: "waste-reduction",
    pointsAwarded: 75,
    sortOrder: 6,
    condition: (m) => m.totalConsumed >= 25,
    progress: (m) => ({ current: Math.min(m.totalConsumed, 25), target: 25, percentage: Math.min(100, (m.totalConsumed / 25) * 100) }),
  },
  {
    code: "waste_warrior",
    name: "Waste Warrior",
    description: "80%+ waste reduction rate (min 20 items)",
    category: "waste-reduction",
    pointsAwarded: 100,
    sortOrder: 7,
    condition: (m) => m.wasteReductionRate >= 80 && m.totalItems >= 20,
    progress: (m) => {
      if (m.totalItems < 20) {
        return { current: m.totalItems, target: 20, percentage: Math.min(100, (m.totalItems / 20) * 100) };
      }
      return { current: Math.min(Math.round(m.wasteReductionRate), 100), target: 80, percentage: Math.min(100, (m.wasteReductionRate / 80) * 100) };
    },
  },
  {
    code: "zero_waste_hero",
    name: "Zero Waste Hero",
    description: "95%+ waste reduction rate (min 50 items)",
    category: "waste-reduction",
    pointsAwarded: 200,
    sortOrder: 8,
    condition: (m) => m.wasteReductionRate >= 95 && m.totalItems >= 50,
    progress: (m) => {
      if (m.totalItems < 50) {
        return { current: m.totalItems, target: 50, percentage: Math.min(100, (m.totalItems / 50) * 100) };
      }
      return { current: Math.min(Math.round(m.wasteReductionRate), 100), target: 95, percentage: Math.min(100, (m.wasteReductionRate / 95) * 100) };
    },
  },

  // --- Sharing ---
  {
    code: "first_sale",
    name: "First Sale",
    description: "Sell your first marketplace item",
    category: "sharing",
    pointsAwarded: 25,
    sortOrder: 9,
    condition: (m) => m.totalSold >= 1,
    progress: (m) => ({ current: Math.min(m.totalSold, 1), target: 1, percentage: Math.min(100, (m.totalSold / 1) * 100) }),
  },
  {
    code: "marketplace_regular",
    name: "Market Regular",
    description: "Sell 5 items on the marketplace",
    category: "sharing",
    pointsAwarded: 75,
    sortOrder: 10,
    condition: (m) => m.totalSold >= 5,
    progress: (m) => ({ current: Math.min(m.totalSold, 5), target: 5, percentage: Math.min(100, (m.totalSold / 5) * 100) }),
  },
  {
    code: "marketplace_pro",
    name: "Marketplace Pro",
    description: "Sell 15 items on the marketplace",
    category: "sharing",
    pointsAwarded: 150,
    sortOrder: 11,
    condition: (m) => m.totalSold >= 15,
    progress: (m) => ({ current: Math.min(m.totalSold, 15), target: 15, percentage: Math.min(100, (m.totalSold / 15) * 100) }),
  },
  {
    code: "sharing_champion",
    name: "Sharing Champion",
    description: "Share or sell 25 items total",
    category: "sharing",
    pointsAwarded: 200,
    sortOrder: 12,
    condition: (m) => (m.totalSold + m.totalShared) >= 25,
    progress: (m) => {
      const total = m.totalSold + m.totalShared;
      return { current: Math.min(total, 25), target: 25, percentage: Math.min(100, (total / 25) * 100) };
    },
  },

  // --- Streaks ---
  {
    code: "streak_3",
    name: "Getting Started",
    description: "3-day sustainability streak",
    category: "streaks",
    pointsAwarded: 25,
    sortOrder: 13,
    condition: (m) => m.longestStreak >= 3,
    progress: (m) => ({ current: Math.min(m.longestStreak, 3), target: 3, percentage: Math.min(100, (m.longestStreak / 3) * 100) }),
  },
  {
    code: "streak_7",
    name: "Week Warrior",
    description: "7-day sustainability streak",
    category: "streaks",
    pointsAwarded: 75,
    sortOrder: 14,
    condition: (m) => m.longestStreak >= 7,
    progress: (m) => ({ current: Math.min(m.longestStreak, 7), target: 7, percentage: Math.min(100, (m.longestStreak / 7) * 100) }),
  },
  {
    code: "streak_14",
    name: "Two-Week Titan",
    description: "14-day sustainability streak",
    category: "streaks",
    pointsAwarded: 125,
    sortOrder: 15,
    condition: (m) => m.longestStreak >= 14,
    progress: (m) => ({ current: Math.min(m.longestStreak, 14), target: 14, percentage: Math.min(100, (m.longestStreak / 14) * 100) }),
  },
  {
    code: "streak_30",
    name: "Monthly Champion",
    description: "30-day sustainability streak",
    category: "streaks",
    pointsAwarded: 250,
    sortOrder: 16,
    condition: (m) => m.longestStreak >= 30,
    progress: (m) => ({ current: Math.min(m.longestStreak, 30), target: 30, percentage: Math.min(100, (m.longestStreak / 30) * 100) }),
  },
];

// ==================== Metrics ====================

/**
 * Get user metrics from productSustainabilityMetrics, handling case-insensitive type values.
 * Some records may have "Consume"/"Waste" instead of "consumed"/"wasted".
 */
export async function getUserBadgeMetrics(userId: number): Promise<BadgeMetrics> {
  const userPoints = await getOrCreateUserPoints(userId);

  const interactions = await db.query.productSustainabilityMetrics.findMany({
    where: eq(schema.productSustainabilityMetrics.userId, userId),
  });

  let totalConsumed = 0;
  let totalWasted = 0;
  let totalShared = 0;
  let totalSold = 0;

  // Collect unique active dates for streak calculation
  const activeDateSet = new Set<string>();
  const streakActions = ["consumed", "consume", "shared", "sold"];

  for (const interaction of interactions) {
    const type = (interaction.type || "").toLowerCase();

    if (type === "consumed" || type === "consume") {
      totalConsumed++;
    } else if (type === "wasted" || type === "waste") {
      totalWasted++;
    } else if (type === "shared") {
      totalShared++;
    } else if (type === "sold") {
      totalSold++;
    }

    // Track active dates for streak (positive actions only)
    if (streakActions.includes(type)) {
      const d = new Date(interaction.todayDate);
      d.setHours(0, 0, 0, 0);
      activeDateSet.add(d.toISOString().split("T")[0]);
    }
  }

  // Compute longest streak from sorted unique active dates
  const activeDates = Array.from(activeDateSet)
    .sort()
    .map((d) => new Date(d));

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

  const totalActions = totalConsumed + totalShared + totalSold;
  const totalItems = totalActions + totalWasted;
  const wasteReductionRate = totalItems > 0 ? (totalActions / totalItems) * 100 : 0;

  return {
    totalPoints: userPoints.totalPoints,
    currentStreak: userPoints.currentStreak,
    longestStreak,
    totalConsumed,
    totalWasted,
    totalShared,
    totalSold,
    totalActions,
    totalItems,
    wasteReductionRate,
  };
}

// ==================== Badge Evaluation ====================

/**
 * Check all badge conditions for a user and award any newly earned badges.
 * Returns array of newly awarded badges.
 */
export async function checkAndAwardBadges(
  userId: number
): Promise<Array<{ code: string; name: string; pointsAwarded: number }>> {
  const metrics = await getUserBadgeMetrics(userId);

  // Get all badge rows from DB
  const allBadges = await db.query.badges.findMany();
  const badgeByCode = new Map(allBadges.map((b) => [b.code, b]));

  // Get already-earned badge IDs for this user
  const earnedUserBadges = await db.query.userBadges.findMany({
    where: eq(schema.userBadges.userId, userId),
  });
  const earnedBadgeIds = new Set(earnedUserBadges.map((ub) => ub.badgeId));

  const newlyAwarded: Array<{ code: string; name: string; pointsAwarded: number }> = [];

  for (const def of BADGE_DEFINITIONS) {
    const dbBadge = badgeByCode.get(def.code);
    if (!dbBadge) continue; // Badge not in DB yet

    // Already earned — skip
    if (earnedBadgeIds.has(dbBadge.id)) continue;

    // Check condition
    if (!def.condition(metrics)) continue;

    // Try to award the badge - use try-catch to handle race conditions
    // The unique constraint on (userId, badgeId) prevents duplicates
    try {
      await db.insert(schema.userBadges).values({
        userId,
        badgeId: dbBadge.id,
      });

      // Award bonus points only if insert succeeded
      if (dbBadge.pointsAwarded > 0) {
        const userPoints = await getOrCreateUserPoints(userId);
        await db
          .update(schema.userPoints)
          .set({ totalPoints: userPoints.totalPoints + dbBadge.pointsAwarded })
          .where(eq(schema.userPoints.userId, userId));
      }

      newlyAwarded.push({
        code: def.code,
        name: def.name,
        pointsAwarded: dbBadge.pointsAwarded,
      });

      // Send notification for badge unlock
      await notifyBadgeUnlocked(userId, {
        code: def.code,
        name: def.name,
        pointsAwarded: dbBadge.pointsAwarded,
      });
    } catch (err) {
      // Unique constraint violation - badge already awarded, skip silently
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("UNIQUE constraint failed") || errorMessage.includes("SQLITE_CONSTRAINT")) {
        continue;
      }
      // Re-throw unexpected errors
      throw err;
    }
  }

  return newlyAwarded;
}

// ==================== Progress ====================

/**
 * Get progress data for all badges for a given user.
 */
export async function getBadgeProgress(
  userId: number
): Promise<Record<string, { current: number; target: number; percentage: number }>> {
  const metrics = await getUserBadgeMetrics(userId);

  const progress: Record<string, { current: number; target: number; percentage: number }> = {};

  for (const def of BADGE_DEFINITIONS) {
    const p = def.progress(metrics);
    progress[def.code] = {
      current: p.current,
      target: p.target,
      percentage: Math.round(p.percentage),
    };
  }

  return progress;
}
