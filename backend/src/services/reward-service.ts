import { db } from "../index";
import { rewards, userRedemptions, userPoints } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

// Generate a unique redemption code
function generateRedemptionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "EP-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all available rewards (active and in stock)
export async function getAvailableRewards() {
  return db
    .select()
    .from(rewards)
    .where(eq(rewards.isActive, true))
    .orderBy(rewards.pointsCost);
}

// Get user's current points balance
export async function getUserPointsBalance(userId: number): Promise<number> {
  const result = await db.query.userPoints.findFirst({
    where: eq(userPoints.userId, userId),
  });
  return result?.totalPoints ?? 0;
}

// Redeem a reward
export async function redeemReward(userId: number, rewardId: number) {
  // Get the reward
  const reward = await db.query.rewards.findFirst({
    where: eq(rewards.id, rewardId),
  });

  if (!reward) {
    throw new Error("Reward not found");
  }

  if (!reward.isActive) {
    throw new Error("Reward is not available");
  }

  if (reward.stock <= 0) {
    throw new Error("Reward is out of stock");
  }

  // Get user's points
  const userPointsRecord = await db.query.userPoints.findFirst({
    where: eq(userPoints.userId, userId),
  });

  const currentPoints = userPointsRecord?.totalPoints ?? 0;

  if (currentPoints < reward.pointsCost) {
    throw new Error("Insufficient points");
  }

  // Generate unique redemption code
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

  // Calculate expiry date (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Create redemption record
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

  // Deduct points from user
  await db
    .update(userPoints)
    .set({ totalPoints: currentPoints - reward.pointsCost })
    .where(eq(userPoints.userId, userId));

  // Decrease stock
  await db
    .update(rewards)
    .set({ stock: reward.stock - 1 })
    .where(eq(rewards.id, rewardId));

  return {
    ...redemption,
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
