import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  type JWTPayload,
} from "../middleware/auth";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  userLocation: z.string().optional(),
  avatarUrl: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export function registerAuthRoutes(router: Router) {
  // Register
  router.post("/api/v1/auth/register", async (req) => {
    try {
      const body = await parseBody(req);
      const data = registerSchema.parse(body);

      const existing = await db.query.users.findFirst({
        where: eq(users.email, data.email),
      });

      if (existing) {
        return error("Email already registered", 400);
      }

      const passwordHash = await hashPassword(data.password);

      const [user] = await db
        .insert(users)
        .values({
          email: data.email,
          passwordHash,
          name: data.name,
          userLocation: data.userLocation,
          avatarUrl: data.avatarUrl,
        })
        .returning();

      const payload: JWTPayload = {
        sub: user.id.toString(),
        email: user.email,
        name: user.name,
      };

      const token = await generateToken(payload);

      return json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          userLocation: user.userLocation,
        },
        token,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Register error:", e);
      return error("Registration failed", 500);
    }
  });

  // Login
  router.post("/api/v1/auth/login", async (req) => {
    try {
      const body = await parseBody(req);
      const data = loginSchema.parse(body);

      const user = await db.query.users.findFirst({
        where: eq(users.email, data.email),
      });

      if (!user) {
        return error("Invalid email or password", 401);
      }

      const valid = await verifyPassword(data.password, user.passwordHash);
      if (!valid) {
        return error("Invalid email or password", 401);
      }

      const payload: JWTPayload = {
        sub: user.id.toString(),
        email: user.email,
        name: user.name,
      };

      const token = await generateToken(payload);

      return json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          userLocation: user.userLocation,
        },
        token,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Login error:", e);
      return error("Login failed", 500);
    }
  });

  // Get current user
  router.get("/api/v1/auth/me", async (req) => {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return error("Unauthorized", 401);
      }

      const token = authHeader.slice(7);
      const payload = await verifyToken(token);

      if (!payload) {
        return error("Invalid token", 401);
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(payload.sub, 10)),
      });

      if (!user) {
        return error("User not found", 404);
      }

      return json({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        userLocation: user.userLocation,
      });
    } catch (e) {
      console.error("Get user error:", e);
      return error("Failed to get user", 500);
    }
  });

  // Update profile
  router.patch("/api/v1/auth/profile", async (req) => {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return error("Unauthorized", 401);
      }

      const token = authHeader.slice(7);
      const payload = await verifyToken(token);

      if (!payload) {
        return error("Invalid token", 401);
      }

      const updateSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        avatarUrl: z.string().optional().nullable(),
        userLocation: z.string().optional().nullable(),
      });

      const body = await parseBody(req);
      const data = updateSchema.parse(body);

      const [updatedUser] = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, parseInt(payload.sub, 10)))
        .returning();

      return json({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatarUrl: updatedUser.avatarUrl,
        userLocation: updatedUser.userLocation,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Update profile error:", e);
      return error("Failed to update profile", 500);
    }
  });
}
