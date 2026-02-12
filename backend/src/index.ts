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
import { registerEcoLockerRoutes } from "./routes/ecolocker";
import { startLockerJobs } from "./jobs/locker-jobs";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerRewardsRoutes } from "./routes/rewards";
import * as schema from "./db/schema";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { db } from "./db/connection";

// Re-export db for backwards compatibility
export { db };

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
registerEcoLockerRoutes(protectedRouter);
registerNotificationRoutes(protectedRouter);
registerRewardsRoutes(protectedRouter);

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

// Generate a cryptographic nonce for CSP headers
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

// Inject nonce attribute into script, style, and stylesheet link tags
function injectNonce(html: string, nonce: string): string {
  return html
    .replace(/<script(?=[\s>])/gi, `<script nonce="${nonce}"`)
    .replace(/<style(?=[\s>])/gi, `<style nonce="${nonce}"`)
    .replace(/<link([^>]*rel=["']stylesheet["'])/gi, `<link nonce="${nonce}"$1`);
}

// Security headers to address OWASP ZAP findings
function addSecurityHeaders(response: Response, isApi: boolean = false, nonce?: string): Response {
  const headers = new Headers(response.headers);

  // Hide server version information (override Bun's default Server header)
  headers.set("Server", "");

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  headers.set("X-Frame-Options", "DENY");
  // XSS Protection (legacy, but still useful)
  headers.set("X-XSS-Protection", "1; mode=block");
  // Referrer policy
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy
  headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  // Cross-Origin isolation headers
  headers.set("Cross-Origin-Resource-Policy", "same-origin");

  if (isApi) {
    // API-specific headers
    headers.set("Content-Security-Policy", "default-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    headers.set("Pragma", "no-cache");
  } else {
    // SPA headers - use nonce-based CSP for scripts, unsafe-inline for styles (required for Google Maps)
    const scriptSrc = nonce ? `'self' 'nonce-${nonce}' https://maps.googleapis.com` : "'self' https://maps.googleapis.com";
    // Note: 'unsafe-inline' for styles is required because Google Maps dynamically injects inline styles
    const styleSrc = `'self' 'unsafe-inline' https://fonts.googleapis.com`;
    headers.set("Content-Security-Policy", `default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com; connect-src 'self' https://maps.googleapis.com; font-src 'self' https://fonts.gstatic.com; form-action 'self'; base-uri 'self'; object-src 'none'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Safely join a base directory with a user-supplied path, preventing directory traversal */
function safePath(baseDir: string, userPath: string): string | null {
  // nosemgrep: path-join-resolve-traversal — this function IS the path traversal guard
  const resolved = resolve(baseDir, userPath.replace(/^\/+/, ""));
  // Ensure the resolved path is still within the base directory
  if (!resolved.startsWith(resolve(baseDir))) { // nosemgrep: path-join-resolve-traversal
    return null;
  }
  return resolved;
}

async function serveStatic(path: string): Promise<Response | null> {
  const publicDir = resolve(join(import.meta.dir, "../public"));

  // Handle uploads directory (stored in public/uploads/)
  if (path.startsWith("/uploads/")) {
    const uploadPath = safePath(publicDir, path);
    if (!uploadPath || !existsSync(uploadPath)) return null;
    const file = Bun.file(uploadPath);
    return new Response(file, {
      headers: { "Content-Type": getMimeType(uploadPath) },
    });
  }

  let filePath = safePath(publicDir, path);

  // Default to index.html for root or non-existent files (SPA routing)
  if (!filePath || path === "/" || !existsSync(filePath)) {
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

    // Block TRACE/TRACK methods
    if (req.method === "TRACE" || req.method === "TRACK") {
      return new Response(null, { status: 405 });
    }

    // Handle CORS preflight — only for API routes
    if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
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
        return addSecurityHeaders(response, true);
      }

      // Then protected routes
      response = await protectedRouter.handle(req);
      if (response) {
        response.headers.set("Access-Control-Allow-Origin", "*");
        return addSecurityHeaders(response, true);
      }

      return addSecurityHeaders(error("Not found", 404), true);
    }

    // Static files / SPA
    const staticResponse = await serveStatic(url.pathname);
    if (staticResponse) {
      const contentType = staticResponse.headers.get("Content-Type") || "";
      if (contentType.includes("text/html")) {
        const nonce = generateNonce();
        const html = await staticResponse.text();
        const noncedResponse = new Response(injectNonce(html, nonce), {
          status: staticResponse.status,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
        return addSecurityHeaders(noncedResponse, false, nonce);
      }
      return addSecurityHeaders(staticResponse, false);
    }

    return addSecurityHeaders(error("Not found", 404), false);
  },
});

console.log(`EcoPlate server running at http://localhost:${server.port}`);

// Start EcoLocker background jobs
startLockerJobs();
