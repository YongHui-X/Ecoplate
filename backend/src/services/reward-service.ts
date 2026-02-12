import { db } from "../db/connection";
import { rewards, userRedemptions, userPoints } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getDetailedPointsStats } from "./gamification-service";

// Generate a unique redemption code
// Unique, not include 'I' and '1' & 'O' and '0'
function generateRedemptionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "EP-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all available rewards (active and in stock)
// checkout from rewards table, reward with active sign
export async function getAvailableRewards() {
  return db
    .select()
    .from(rewards)
    .where(eq(rewards.isActive, true))
    .orderBy(rewards.pointsCost);
}

// Get user's current points balance (uses computed total for consistency)
// use 'getDetailedPointsStats' by each user to get realtime ecopoints
export async function getUserPointsBalance(userId: number): Promise<number> {
  const stats = await getDetailedPointsStats(userId);
  return stats.computedTotalPoints;
}

// Redeem a reward (supports multiple quantities)
export async function redeemReward(userId: number, rewardId: number, quantity: number = 1) {
  // Get the reward
  const reward = await db.query.rewards.findFirst({
    where: eq(rewards.id, rewardId),
  });

  if (!reward) { // check reward still works or not
    throw new Error("Reward not found");
  }

  if (!reward.isActive) { // check reward on shelf or not
    throw new Error("Reward is not available");
  }

  if (reward.stock < quantity) { // check enough rewards stock
    throw new Error("Reward is out of stock");
  }

  // Get user's computed points balance
  const currentPoints = await getUserPointsBalance(userId);
  const totalCost = reward.pointsCost * quantity;

  if (currentPoints < totalCost) {
    throw new Error("Insufficient points");
  }

  // Calculate expiry date (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Create redemption records for each quantity
  const redemptions = [];
  for (let i = 0; i < quantity; i++) {
    // Generate unique redemption code for each (re-generate < 10 times if repeat)
    let redemptionCode = generateRedemptionCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.query.userRedemptions.findFirst({
        where: eq(userRedemptions.redemptionCode, redemptionCode),
      });
      if (!existing) break;
      redemptionCode = generateRedemptionCode();
      attempts++;
    }

    const [redemption] = await db
      .insert(userRedemptions)
      .values({
        userId,
        rewardId,
        pointsSpent: reward.pointsCost,
        redemptionCode,
        status: "pending",
        expiresAt,
      })
      .returning();

    redemptions.push(redemption);
  }

  // Deduct total points from stored balance
  const userPointsRecord = await db.query.userPoints.findFirst({
    where: eq(userPoints.userId, userId),
  });
  const storedPoints = userPointsRecord?.totalPoints ?? 0;
  await db
    .update(userPoints)
    .set({ totalPoints: storedPoints - totalCost })
    .where(eq(userPoints.userId, userId));

  // Decrease stock by quantity
  await db
    .update(rewards)
    .set({ stock: reward.stock - quantity })
    .where(eq(rewards.id, rewardId));

  return {
    redemptions,
    totalPointsSpent: totalCost,
    quantity,
    reward,
  };
}

// Get user's redemption history
export async function getUserRedemptions(userId: number) {
  const redemptions = await db
    .select({
      id: userRedemptions.id,
      pointsSpent: userRedemptions.pointsSpent,
      redemptionCode: userRedemptions.redemptionCode,
      status: userRedemptions.status,
      collectedAt: userRedemptions.collectedAt,
      expiresAt: userRedemptions.expiresAt,
      createdAt: userRedemptions.createdAt,
      reward: {
        id: rewards.id,
        name: rewards.name,
        description: rewards.description,
        imageUrl: rewards.imageUrl,
        category: rewards.category,
        pointsCost: rewards.pointsCost,
      },
    })
    .from(userRedemptions)
    .innerJoin(rewards, eq(userRedemptions.rewardId, rewards.id))
    .where(eq(userRedemptions.userId, userId))
    .orderBy(desc(userRedemptions.createdAt));

  return redemptions;
}
