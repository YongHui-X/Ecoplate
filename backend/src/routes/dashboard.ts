import { Router, json, error } from "../utils/router";
import { getUser } from "../middleware/auth";
import { getDashboardStats } from "../services/dashboard-service";

export function registerDashboardRoutes(router: Router) {
  router.get("/api/v1/dashboard/stats", async (req) => {
    try {
      const user = getUser(req);
      const url = new URL(req.url);
      const period = (url.searchParams.get("period") || "month") as "day" | "month" | "annual";

      const stats = await getDashboardStats(user.id, period);
      return json(stats);
    } catch (err: any) {
      return error(err.message || "Failed to load dashboard stats", 500);
    }
  });
}
