import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router, json, error } from "./utils/router";
import { authMiddleware } from "./middleware/auth";
import { registerAuthRoutes } from "./routes/auth";
import { registerMarketplaceRoutes } from "./routes/marketplace";
import { registerMyFridgeRoutes } from "./routes/myfridge";
import { registerConsumptionRoutes } from "./routes/consumption";
import { registerMessageRoutes } from "./routes/messages";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerGamificationRoutes } from "./routes/gamification";
import { registerUploadRoutes } from "./routes/upload";
import * as schema from "./db/schema";
import { existsSync } from "fs";
import { join } from "path";

// Initialize database
const sqlite = new Database("ecoplate.db");
sqlite.exec("PRAGMA journal_mode = WAL;");
export const db = drizzle(sqlite, { schema });

// Create routers
const publicRouter = new Router();
const protectedRouter = new Router();

// Apply auth middleware to protected routes
protectedRouter.use(authMiddleware);

// Register routes
registerAuthRoutes(publicRouter);
registerMarketplaceRoutes(protectedRouter);
registerMyFridgeRoutes(protectedRouter);
registerConsumptionRoutes(protectedRouter, db);
registerMessageRoutes(protectedRouter);
registerDashboardRoutes(protectedRouter);
registerGamificationRoutes(protectedRouter);
registerUploadRoutes(protectedRouter);

// Health check
publicRouter.get("/api/v1/health", () => json({ status: "ok" }));

// MIME types for static files
const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf("."));
  return mimeTypes[ext] || "application/octet-stream";
}

async function serveStatic(path: string): Promise<Response | null> {
  const publicDir = join(import.meta.dir, "../public");

  // Handle uploads directory (stored in public/uploads/)
  if (path.startsWith("/uploads/")) {
    const uploadPath = join(publicDir, path);
    if (existsSync(uploadPath)) {
      const file = Bun.file(uploadPath);
      return new Response(file, {
        headers: { "Content-Type": getMimeType(uploadPath) },
      });
    }
    return null;
  }

  let filePath = join(publicDir, path);

  // Default to index.html for root or non-existent files (SPA routing)
  if (path === "/" || !existsSync(filePath)) {
    filePath = join(publicDir, "index.html");
  }

  if (!existsSync(filePath)) {
    return null;
  }

  const file = Bun.file(filePath);
  return new Response(file, {
    headers: { "Content-Type": getMimeType(filePath) },
  });
}

// Main server
const server = Bun.serve({
  port: process.env.PORT || 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS for development
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // API routes
    if (url.pathname.startsWith("/api/")) {
      // Try public routes first
      let response = await publicRouter.handle(req);
      if (response) {
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      }

      // Then protected routes
      response = await protectedRouter.handle(req);
      if (response) {
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      }

      return error("Not found", 404);
    }

    // Static files / SPA
    const staticResponse = await serveStatic(url.pathname);
    if (staticResponse) {
      return staticResponse;
    }

    return error("Not found", 404);
  },
});

console.log(`EcoPlate server running at http://localhost:${server.port}`);
