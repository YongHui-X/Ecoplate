import { Router, json } from "../utils/router";
import { db } from "../db/connection";
import * as schema from "../db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { getUser } from "../middleware/auth";
import { getOrCreateUserPoints, getUserMetrics, getDetailedPointsStats, awardPoints } from "../services/gamification-service";
import { POINT_VALUES } from "../services/gamification-service";
import { calculateCo2Saved } from "../utils/co2-calculator";
import { getBadgeProgress } from "../services/badge-service";

export function registerGamificationRoutes(router: Router) {
  // ================================
  // GET /api/v1/gamification/points
  // ================================
  router.get("/api/v1/gamification/points", async (req) => {
    try {
      const user = getUser(req);

      const points = await getOrCreateUserPoints(user.id);
      const detailedStats = await getDetailedPointsStats(user.id);

      // Get recent interactions as "transactions" for the UI
      const recentInteractions = await db.query.productSustainabilityMetrics.findMany({
        where: eq(schema.productSustainabilityMetrics.userId, user.id),
        orderBy: [
          desc(schema.productSustainabilityMetrics.todayDate),
          desc(schema.productSustainabilityMetrics.id),
        ],
        limit: 20,
        with: {
          product: {
            columns: { productName: true, unit: true, category: true },
          },
        },
      });

      // Map interactions to transaction like format, filtering out "add" entries
      const transactions = recentInteractions
        .filter((i) => {
          const t = (i.type || "").toLowerCase();
          return t !== "add" && t !== "shared";
        })
        .map((i) => {
          const normalizedType = (i.type || "").toLowerCase() as keyof typeof POINT_VALUES;
          const category = i.product?.category || "other";
          // Stored quantity is already in kg
          const co2Value = calculateCo2Saved(i.quantity ?? 1, "kg", category);
          let amount: number;
          if (normalizedType === "sold") {
            amount = Math.round(co2Value * 1.5);
          } else if (normalizedType === "wasted") {
            amount = -Math.round(co2Value);
          } else {
            amount = Math.round(co2Value);
          }
          if (amount === 0) amount = normalizedType === "wasted" ? -1 : 1;

          return {
            id: i.id,
            amount,
            type: amount < 0 ? "penalty" : "earned",
            action: normalizedType,
            createdAt: i.todayDate,
            productName: i.product?.productName || (({ sold: "Sold", consumed: "Consumed", wasted: "Wasted" } as Record<string, string>)[normalizedType] ?? normalizedType),
            quantity: i.quantity ?? 1,
            unit: i.product?.unit ?? "pcs",
          };
        });

      return json({
        points: {
          total: points.totalPoints,
          currentStreak: points.currentStreak,
          longestStreak: detailedStats.longestStreak,
        },
        stats: {
          totalActiveDays: detailedStats.totalActiveDays,
          lastActiveDate: detailedStats.lastActiveDate,
          firstActivityDate: detailedStats.firstActivityDate,
          pointsToday: detailedStats.pointsToday,
          pointsThisWeek: detailedStats.pointsThisWeek,
          pointsThisMonth: detailedStats.pointsThisMonth,
          bestDayPoints: detailedStats.bestDayPoints,
          averagePointsPerActiveDay: detailedStats.averagePointsPerActiveDay,
        },
        breakdown: detailedStats.breakdownByType,
        pointsByMonth: detailedStats.pointsByMonth,
        transactions,
      });
    } catch (error) {
      console.error("Error fetching gamification points:", error);
      return json({ error: "Failed to fetch points data" }, 500);
    }
  });

  // ================================
  // GET /api/v1/gamification/metrics
  // ================================
  router.get("/api/v1/gamification/metrics", async (req) => {
    const user = getUser(req);

    const metrics = await getUserMetrics(user.id);

    return json(metrics);
  });

  // ================================
  // GET /api/v1/gamification/leaderboard
  // ================================
  router.get("/api/v1/gamification/leaderboard", async (req) => {
    // Compute lifetime points = totalPoints + SUM(pointsSpent from redemptions)
    // This ensures leaderboard ranking is not affected by reward redemptions
    const rows = await db
      .select({
        userId: schema.userPoints.userId,
        totalPoints: schema.userPoints.totalPoints,
        currentStreak: schema.userPoints.currentStreak,
        spentPoints: sql<number>`COALESCE(SUM(${schema.userRedemptions.pointsSpent}), 0)`.as("spent_points"),
        lifetimePoints: sql<number>`${schema.userPoints.totalPoints} + COALESCE(SUM(${schema.userRedemptions.pointsSpent}), 0)`.as("lifetime_points"),
        userName: schema.users.name,
      })
      .from(schema.userPoints)
      .innerJoin(schema.users, eq(schema.users.id, schema.userPoints.userId))
      .leftJoin(schema.userRedemptions, eq(schema.userRedemptions.userId, schema.userPoints.userId))
      .groupBy(schema.userPoints.userId)
      .orderBy(sql`lifetime_points DESC`)
      .limit(10);

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      name: row.userName || "Unknown",
      points: row.lifetimePoints,
      streak: row.currentStreak,
    }));

    return json(leaderboard);
  });

  // ================================
  // GET /api/v1/gamification/badges
  // ================================
  router.get("/api/v1/gamification/badges", async (req) => {
    const user = getUser(req);

    // Get all badges
    const allBadges = await db.query.badges.findMany({
      orderBy: [schema.badges.sortOrder],
    });

    // Get user's earned badges
    const earnedBadges = await db.query.userBadges.findMany({
      where: eq(schema.userBadges.userId, user.id),
      with: {
        badge: true,
      },
    });

    const earnedBadgeIds = new Set(earnedBadges.map((ub) => ub.badgeId));

    // Get progress data for all badges
    const progress = await getBadgeProgress(user.id);

    // Combine all badges with earned status and progress
    const badgesWithStatus = allBadges.map((badge) => ({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      pointsAwarded: badge.pointsAwarded,
      imageUrl: badge.badgeImageUrl,
      earned: earnedBadgeIds.has(badge.id),
      earnedAt: earnedBadges.find((ub) => ub.badgeId === badge.id)?.earnedAt || null,
      progress: progress[badge.code] || null,
    }));

    return json({
      badges: badgesWithStatus,
      totalEarned: earnedBadges.length,
      totalAvailable: allBadges.length,
    });
  });

  // ================================
  // GET /api/v1/gamification/dashboard
  // ================================
  router.get("/api/v1/gamification/dashboard", async (req) => {
    const user = getUser(req);

    // Get all products in the user's fridge
    const userProducts = await db.query.products.findMany({
      where: eq(schema.products.userId, user.id),
    });

    // Get user listings
    const userListings = await db.query.marketplaceListings.findMany({
      where: eq(schema.marketplaceListings.sellerId, user.id),
    });

    const activeListings = userListings.filter((l) => l.status === "active");
    const soldListings = userListings.filter((l) => l.status === "completed");

    const points = await getOrCreateUserPoints(user.id);
    const metrics = await getUserMetrics(user.id);

    return json({
      products: {
        total: userProducts.length,
      },
      listings: {
        active: activeListings.length,
        sold: soldListings.length,
      },
      gamification: {
        points: points.totalPoints,
        streak: points.currentStreak,
        wasteReductionRate: metrics.wasteReductionRate,
        co2Saved: metrics.estimatedCo2Saved,
      },
    });
  });

  // ================================
  // POST /api/v1/gamification/sync-badges
  // Check and award any badges the user has earned but not received
  // ================================
  router.post("/api/v1/gamification/sync-badges", async (req) => {
    const user = getUser(req);

    const { checkAndAwardBadges } = await import("../services/badge-service");
    const newBadges = await checkAndAwardBadges(user.id);

    return json({
      message: newBadges.length > 0 ? `Awarded ${newBadges.length} new badges` : "No new badges earned",
      newBadges,
    });
  });

  // ================================
  // POST /api/v1/gamification/sync-sold-points
  // Backfill points for historical sold products
  // ================================
  router.post("/api/v1/gamification/sync-sold-points", async (req) => {
    const user = getUser(req);

    // Get all sold listings for this user
    const soldListings = await db.query.marketplaceListings.findMany({
      where: and(
        eq(schema.marketplaceListings.sellerId, user.id),
        eq(schema.marketplaceListings.status, "sold")
      ),
    });

    // Get existing "sold" metrics count for this user
    const existingMetrics = await db.query.productSustainabilityMetrics.findMany({
      where: and(
        eq(schema.productSustainabilityMetrics.userId, user.id),
        eq(schema.productSustainabilityMetrics.type, "sold")
      ),
    });

    const soldCount = soldListings.length;
    const metricCount = existingMetrics.length;

    // Calculate how many sales are missing points
    const missingSales = soldCount - metricCount;

    if (missingSales <= 0) {
      const userPoints = await getOrCreateUserPoints(user.id);
      return json({
        message: "All sold listings already have points",
        synced: 0,
        alreadySynced: soldCount,
        pointsAwarded: 0,
        newTotal: userPoints.totalPoints,
      });
    }

    // Award points for the missing sales
    let totalPointsAwarded = 0;
    for (let i = 0; i < missingSales; i++) {
      const result = await awardPoints(user.id, "sold");
      totalPointsAwarded += result.amount;
    }

    // Get updated total points
    const userPoints = await getOrCreateUserPoints(user.id);

    return json({
      message: `Synced ${missingSales} sold listings`,
      synced: missingSales,
      alreadySynced: metricCount,
      pointsAwarded: totalPointsAwarded,
      newTotal: userPoints.totalPoints,
    });
  });
}
