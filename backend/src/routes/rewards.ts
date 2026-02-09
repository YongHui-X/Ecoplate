import { Router, json, error, parseBody } from "../utils/router";
import { getUser } from "../middleware/auth";
import {
  getAvailableRewards,
  getUserPointsBalance,
  redeemReward,
  getUserRedemptions,
} from "../services/reward-service";
import { z } from "zod";

const redeemSchema = z.object({
  rewardId: z.number().int().positive(),
});

export function registerRewardsRoutes(router: Router) {
  // Get all available rewards
  router.get("/api/v1/rewards", async (req) => {
    try {
      getUser(req); // Ensure authenticated
      const rewards = await getAvailableRewards();
      return json(rewards);
    } catch (e) {
      console.error("Get rewards error:", e);
      return error("Failed to get rewards", 500);
    }
  });

  // Get user's points balance
  router.get("/api/v1/rewards/balance", async (req) => {
    try {
      const user = getUser(req);
      const balance = await getUserPointsBalance(user.id);
      return json({ balance });
    } catch (e) {
      console.error("Get balance error:", e);
      return error("Failed to get balance", 500);
    }
  });

  // Redeem a reward
  router.post("/api/v1/rewards/redeem", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);
      const data = redeemSchema.parse(body);

      const result = await redeemReward(user.id, data.rewardId);
      return json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      if (e.message === "Reward not found") {
        return error("Reward not found", 404);
      }
      if (e.message === "Reward is not available") {
        return error("Reward is not available", 400);
      }
      if (e.message === "Reward is out of stock") {
        return error("Reward is out of stock", 400);
      }
      if (e.message === "Insufficient points") {
        return error("Insufficient points", 400);
      }
      console.error("Redeem error:", e);
      return error("Failed to redeem reward", 500);
    }
  });

  // Get user's redemption history
  router.get("/api/v1/rewards/my-redemptions", async (req) => {
    try {
      const user = getUser(req);
      const redemptions = await getUserRedemptions(user.id);
      return json(redemptions);
    } catch (e) {
      console.error("Get redemptions error:", e);
      return error("Failed to get redemptions", 500);
    }
  });
}
