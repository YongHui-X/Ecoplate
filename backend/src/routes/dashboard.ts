import { Router, json, error } from "../utils/router";
import { getUser } from "../middleware/auth";
import {
  getDashboardStats,
  getCO2Stats,
  getFinancialStats,
  getFoodStats,
} from "../services/dashboard-service";

type Period = "day" | "month" | "annual";

function parsePeriod(url: URL): Period {
  const p = url.searchParams.get("period") || "month";
  if (p === "day" || p === "month" || p === "annual") return p;
  return "month";
}

export function registerDashboardRoutes(router: Router) {
  router.get("/api/v1/dashboard/stats", async (req) => {
    try {
      const user = getUser(req);
      const url = new URL(req.url);
      const period = parsePeriod(url);
      const stats = await getDashboardStats(user.id, period);
      return json(stats);
    } catch (err: any) {
      return error(err.message || "Failed to load dashboard stats", 500);
    }
  });

  router.get("/api/v1/dashboard/co2", async (req) => {
    try {
      const user = getUser(req);
      const url = new URL(req.url);
      const period = parsePeriod(url);
      const stats = await getCO2Stats(user.id, period);
      return json(stats);
    } catch (err: any) {
      return error(err.message || "Failed to load CO2 stats", 500);
    }
  });

  router.get("/api/v1/dashboard/financial", async (req) => {
    try {
      const user = getUser(req);
      const url = new URL(req.url);
      const period = parsePeriod(url);
      const stats = await getFinancialStats(user.id, period);
      return json(stats);
    } catch (err: any) {
      return error(err.message || "Failed to load financial stats", 500);
    }
  });

  router.get("/api/v1/dashboard/food", async (req) => {
    try {
      const user = getUser(req);
      const url = new URL(req.url);
      const period = parsePeriod(url);
      const stats = await getFoodStats(user.id, period);
      return json(stats);
    } catch (err: any) {
      return error(err.message || "Failed to load food stats", 500);
    }
  });
}
