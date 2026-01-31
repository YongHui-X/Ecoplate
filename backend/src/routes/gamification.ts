import { Router, json } from "../utils/router";
import { db } from "../index";
import * as schema from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { getUser } from "../middleware/auth";
import { getOrCreateUserPoints, getUserMetrics, getDetailedPointsStats } from "../services/gamification-service";
import { POINT_VALUES } from "../services/gamification-service";

export function registerGamificationRoutes(router: Router) {
  // ================================
  // GET /api/v1/gamification/points
  // ================================
  router.get("/api/v1/gamification/points", async (req) => {
    const user = getUser(req);

    const points = await getOrCreateUserPoints(user.id);
    const detailedStats = await getDetailedPointsStats(user.id);

    // Get recent interactions as "transactions" for the UI
    const recentInteractions = await db.query.productSustainabilityMetrics.findMany({
      where: eq(schema.productSustainabilityMetrics.userId, user.id),
      orderBy: [desc(schema.productSustainabilityMetrics.todayDate)],
      limit: 20,
      with: {
        product: {
          columns: { productName: true },
        },
      },
    });

    // Map interactions to transaction like format
    const transactions = recentInteractions.map((i) => {
      const amount = POINT_VALUES[i.type as keyof typeof POINT_VALUES] ?? 0;

      return {
        id: i.id,
        amount,
        type: amount < 0 ? "penalty" : "earned",
        action: i.type,
        createdAt: i.todayDate,
      };
    });

    return json({
      points: {
        total: points.totalPoints,
        available: points.totalPoints,
        lifetime: points.totalPoints,
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
      transactions,
    });
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
    // Get all users with their points
    const allUserPoints = await db.query.userPoints.findMany({
      with: {
        user: {
          columns: { id: true, name: true },
        },
      },
      orderBy: [desc(schema.userPoints.totalPoints)],
      limit: 10,
    });

    const leaderboard = allUserPoints.map((up, index) => ({
      rank: index + 1,
      userId: up.userId,
      name: up.user?.name || "Unknown",
      points: up.totalPoints,
      streak: up.currentStreak,
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

    // Combine all badges with earned status
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
}
