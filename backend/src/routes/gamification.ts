import { Router, json } from "../utils/router";
import { db } from "../db/connection";
import * as schema from "../db/schema";
import { eq, desc, and, sql, gt } from "drizzle-orm";
import { getUser } from "../middleware/auth";
import { getOrCreateUserPoints, getUserMetrics, getDetailedPointsStats, awardPoints, computeCo2Value, calculatePointsForAction } from "../services/gamification-service";
import { POINT_VALUES } from "../services/gamification-service";
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
            columns: { productName: true, unit: true, category: true, co2Emission: true },
          },
        },
      });

      // Map interactions to transaction like format, filtering out "add" entries
      const transactions = recentInteractions
        .filter((i) => {
          const t = (i.type || "").toLowerCase();
          return t !== "add" && t !== "shared" && t !== "consumed" && t !== "wasted" && t !== "badge";
        })
        .map((i) => {
          const normalizedType = (i.type || "").toLowerCase() as keyof typeof POINT_VALUES;
          const category = i.product?.category || "other";
          const co2Emission = i.product?.co2Emission ?? null;
          const co2Value = computeCo2Value(i.quantity ?? 1, co2Emission, category);
          const amount = calculatePointsForAction(normalizedType, co2Value);

          return {
            id: i.id,
            amount,
            type: amount < 0 ? "penalty" : "earned",
            action: normalizedType,
            createdAt: i.todayDate,
            productName: i.product?.productName || (({ sold: "Sold", consumed: "Consumed", wasted: "Wasted" } as Record<string, string>)[normalizedType] ?? normalizedType),
            quantity: i.quantity ?? 1,
            unit: i.product?.unit ?? "pcs",
            _timestamp: Date.parse(i.todayDate + "T00:00:00Z"),
          };
        });

      // Fetch recent redemptions
      const recentRedemptions = await db.query.userRedemptions.findMany({
        where: eq(schema.userRedemptions.userId, user.id),
        orderBy: [desc(schema.userRedemptions.createdAt)],
        limit: 20,
        with: { reward: { columns: { name: true } } },
      });

      // Map redemptions to transaction format
      const redemptionTx = recentRedemptions.map((r) => ({
        id: r.id + 1_000_000,
        amount: -r.pointsSpent,
        type: "redeemed" as const,
        action: "redeemed",
        createdAt: r.createdAt instanceof Date
          ? r.createdAt.toISOString().slice(0, 10)
          : typeof r.createdAt === "number"
            ? new Date(r.createdAt * 1000).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        productName: r.reward?.name || "Reward",
        quantity: 1,
        unit: "pcs",
        _timestamp: r.createdAt instanceof Date
          ? r.createdAt.getTime()
          : typeof r.createdAt === "number"
            ? r.createdAt * 1000
            : Date.now(),
      }));

      // Fetch badge awards as transactions
      const badgeAwards = await db
        .select({
          id: schema.userBadges.id,
          pointsAwarded: schema.badges.pointsAwarded,
          badgeName: schema.badges.name,
          earnedAt: schema.userBadges.earnedAt,
        })
        .from(schema.userBadges)
        .innerJoin(schema.badges, eq(schema.userBadges.badgeId, schema.badges.id))
        .where(
          and(
            eq(schema.userBadges.userId, user.id),
            gt(schema.badges.pointsAwarded, 0)
          )
        )
        .orderBy(desc(schema.userBadges.earnedAt))
        .limit(20);

      const badgeTx = badgeAwards.map((b) => ({
        id: b.id + 2_000_000,
        amount: b.pointsAwarded,
        type: "earned" as const,
        action: "badge",
        createdAt: b.earnedAt instanceof Date
          ? b.earnedAt.toISOString().slice(0, 10)
          : typeof b.earnedAt === "number"
            ? new Date(b.earnedAt * 1000).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        productName: b.badgeName,
        quantity: 1,
        unit: "pcs",
        _timestamp: b.earnedAt instanceof Date
          ? b.earnedAt.getTime()
          : typeof b.earnedAt === "number"
            ? b.earnedAt * 1000
            : Date.now(),
      }));

      // Merge and sort all transactions
      const allTransactions = [...transactions, ...redemptionTx, ...badgeTx]
        .sort((a, b) => b._timestamp - a._timestamp || b.id - a.id)
        .slice(0, 20);

      return json({
        points: {
          total: detailedStats.computedTotalPoints,
          currentStreak: points.currentStreak,
          longestStreak: Math.max(detailedStats.longestStreak, points.currentStreak),
        },
        stats: {
          totalActiveDays: detailedStats.totalActiveDays,
          lastActiveDate: detailedStats.lastActiveDate,
          firstActivityDate: detailedStats.firstActivityDate,
          pointsToday: detailedStats.pointsToday,
          pointsThisWeek: detailedStats.pointsThisWeek,
          pointsThisMonth: detailedStats.pointsThisMonth,
          pointsThisYear: detailedStats.pointsThisYear,
          bestDayPoints: detailedStats.bestDayPoints,
          averagePointsPerActiveDay: detailedStats.averagePointsPerActiveDay,
        },
        breakdown: detailedStats.breakdownByType,
        pointsByMonth: detailedStats.pointsByMonth,
        transactions: allTransactions,
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

    const detailedStats = await getDetailedPointsStats(user.id);
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
        points: detailedStats.computedTotalPoints,
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
