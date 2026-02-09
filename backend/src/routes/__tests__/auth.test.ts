import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router, json, error } from "../../utils/router";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

// Mock auth functions
const mockHashPassword = async (password: string): Promise<string> => {
  return `hashed_${password}`;
};

const mockVerifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return hash === `hashed_${password}`;
};

const mockGenerateToken = async (payload: { sub: string; email: string; name: string }): Promise<string> => {
  return `token_${payload.sub}_${payload.email}`;
};

const mockVerifyRequestAuth = async (req: Request): Promise<{ sub: string; email: string; name: string } | null> => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  // Parse mock token format: token_userId_email
  const match = token.match(/^token_(\d+)_(.+)$/);
  if (!match) return null;
  return { sub: match[1], email: match[2], name: "Test User" };
};

// Register schema
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

// Register routes with mocked auth functions
function registerTestAuthRoutes(router: Router, db: ReturnType<typeof drizzle<typeof schema>>) {
  router.post("/api/v1/auth/register", async (req) => {
    try {
      const body = await req.json();
      const data = registerSchema.parse(body);

      const existing = await db.query.users.findFirst({
        where: eq(schema.users.email, data.email),
      });

      if (existing) {
        return error("Email already registered", 400);
      }

      const passwordHash = await mockHashPassword(data.password);

      const [user] = await db
        .insert(schema.users)
        .values({
          email: data.email,
          passwordHash,
          name: data.name,
          userLocation: data.userLocation,
          avatarUrl: data.avatarUrl,
        })
        .returning();

      const token = await mockGenerateToken({
        sub: user.id.toString(),
        email: user.email,
        name: user.name,
      });

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

  router.post("/api/v1/auth/login", async (req) => {
    try {
      const body = await req.json();
      const data = loginSchema.parse(body);

      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, data.email),
      });

      if (!user) {
        return error("Invalid email or password", 401);
      }

      const valid = await mockVerifyPassword(data.password, user.passwordHash);
      if (!valid) {
        return error("Invalid email or password", 401);
      }

      const token = await mockGenerateToken({
        sub: user.id.toString(),
        email: user.email,
        name: user.name,
      });

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

  router.get("/api/v1/auth/me", async (req) => {
    try {
      const payload = await mockVerifyRequestAuth(req);
      if (!payload) {
        return error("Unauthorized", 401);
      }

      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, parseInt(payload.sub, 10)),
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

  router.patch("/api/v1/auth/profile", async (req) => {
    try {
      const payload = await mockVerifyRequestAuth(req);
      if (!payload) {
        return error("Unauthorized", 401);
      }

      const updateSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        avatarUrl: z.string().optional().nullable(),
        userLocation: z.string().optional().nullable(),
      });

      const body = await req.json();
      const data = updateSchema.parse(body);

      const [updatedUser] = await db
        .update(schema.users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, parseInt(payload.sub, 10)))
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

beforeAll(async () => {
  sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      user_location TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  testDb = drizzle(sqlite, { schema });
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  // Clear users table before each test
  await testDb.delete(schema.users);
});

function createRouter() {
  const router = new Router();
  registerTestAuthRoutes(router, testDb);
  return router;
}

async function makeRequest(
  router: Router,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  const response = await router.handle(req);
  if (!response) {
    return { status: 404, data: { error: "Not found" } };
  }
  const data = await response.json();
  return { status: response.status, data };
}

describe("POST /api/v1/auth/register", () => {
  test("successfully registers a new user", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "newuser@test.com",
      password: "password123",
      name: "New User",
    });

    expect(res.status).toBe(200);
    const data = res.data as { user: { id: number; email: string; name: string }; token: string };
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("newuser@test.com");
    expect(data.user.name).toBe("New User");
    expect(data.token).toBeDefined();
  });

  test("registers user with optional fields", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "withfields@test.com",
      password: "password123",
      name: "With Fields",
      userLocation: "Singapore",
      avatarUrl: "https://example.com/avatar.jpg",
    });

    expect(res.status).toBe(200);
    const data = res.data as { user: { userLocation: string; avatarUrl: string } };
    expect(data.user.userLocation).toBe("Singapore");
    expect(data.user.avatarUrl).toBe("https://example.com/avatar.jpg");
  });

  test("returns 400 for invalid email format", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "invalid-email",
      password: "password123",
      name: "Test User",
    });

    expect(res.status).toBe(400);
    const data = res.data as { error: string };
    expect(data.error).toBeDefined();
  });

  test("returns 400 for password too short", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "test@test.com",
      password: "123",
      name: "Test User",
    });

    expect(res.status).toBe(400);
    const data = res.data as { error: string };
    expect(data.error).toBeDefined();
  });

  test("returns 400 for empty name", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "test@test.com",
      password: "password123",
      name: "",
    });

    expect(res.status).toBe(400);
    const data = res.data as { error: string };
    expect(data.error).toBeDefined();
  });

  test("returns 400 for duplicate email", async () => {
    const router = createRouter();

    // Register first user
    await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "duplicate@test.com",
      password: "password123",
      name: "First User",
    });

    // Try to register with same email
    const res = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "duplicate@test.com",
      password: "password456",
      name: "Second User",
    });

    expect(res.status).toBe(400);
    const data = res.data as { error: string };
    expect(data.error).toBe("Email already registered");
  });

  test("returns 400 for missing required fields", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/auth/register", {});

    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/login", () => {
  test("successfully logs in with valid credentials", async () => {
    const router = createRouter();

    // First register a user
    await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "login@test.com",
      password: "password123",
      name: "Login User",
    });

    // Then try to login
    const res = await makeRequest(router, "POST", "/api/v1/auth/login", {
      email: "login@test.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    const data = res.data as { user: { email: string }; token: string };
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("login@test.com");
    expect(data.token).toBeDefined();
  });

  test("returns 401 for non-existent email", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/auth/login", {
      email: "nonexistent@test.com",
      password: "password123",
    });

    expect(res.status).toBe(401);
    const data = res.data as { error: string };
    expect(data.error).toBe("Invalid email or password");
  });

  test("returns 401 for wrong password", async () => {
    const router = createRouter();

    // First register a user
    await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "wrongpass@test.com",
      password: "password123",
      name: "Wrong Pass User",
    });

    // Try to login with wrong password
    const res = await makeRequest(router, "POST", "/api/v1/auth/login", {
      email: "wrongpass@test.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
    const data = res.data as { error: string };
    expect(data.error).toBe("Invalid email or password");
  });

  test("returns 400 for invalid email format", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/auth/login", {
      email: "invalid-email",
      password: "password123",
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 for missing password", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/auth/login", {
      email: "test@test.com",
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/auth/me", () => {
  test("returns current user with valid token", async () => {
    const router = createRouter();

    // First register a user
    const registerRes = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "me@test.com",
      password: "password123",
      name: "Me User",
    });
    const registerData = registerRes.data as { token: string };

    // Get current user
    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/auth/me",
      undefined,
      { Authorization: `Bearer ${registerData.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { email: string; name: string };
    expect(data.email).toBe("me@test.com");
    expect(data.name).toBe("Me User");
  });

  test("returns 401 without token", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "GET", "/api/v1/auth/me");

    expect(res.status).toBe(401);
    const data = res.data as { error: string };
    expect(data.error).toBe("Unauthorized");
  });

  test("returns 401 with invalid token", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/auth/me",
      undefined,
      { Authorization: "Bearer invalid_token" }
    );

    expect(res.status).toBe(401);
    const data = res.data as { error: string };
    expect(data.error).toBe("Unauthorized");
  });

  test("returns 401 with malformed Authorization header", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/auth/me",
      undefined,
      { Authorization: "Basic dXNlcjpwYXNz" }
    );

    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/v1/auth/profile", () => {
  test("updates user name successfully", async () => {
    const router = createRouter();

    // First register a user
    const registerRes = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "update@test.com",
      password: "password123",
      name: "Original Name",
    });
    const registerData = registerRes.data as { token: string };

    // Update profile
    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/auth/profile",
      { name: "Updated Name" },
      { Authorization: `Bearer ${registerData.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { name: string };
    expect(data.name).toBe("Updated Name");
  });

  test("updates user location successfully", async () => {
    const router = createRouter();

    const registerRes = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "location@test.com",
      password: "password123",
      name: "Location User",
    });
    const registerData = registerRes.data as { token: string };

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/auth/profile",
      { userLocation: "Singapore" },
      { Authorization: `Bearer ${registerData.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { userLocation: string };
    expect(data.userLocation).toBe("Singapore");
  });

  test("updates avatar URL successfully", async () => {
    const router = createRouter();

    const registerRes = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "avatar@test.com",
      password: "password123",
      name: "Avatar User",
    });
    const registerData = registerRes.data as { token: string };

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/auth/profile",
      { avatarUrl: "https://example.com/new-avatar.jpg" },
      { Authorization: `Bearer ${registerData.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { avatarUrl: string };
    expect(data.avatarUrl).toBe("https://example.com/new-avatar.jpg");
  });

  test("can set userLocation to null", async () => {
    const router = createRouter();

    const registerRes = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "nullloc@test.com",
      password: "password123",
      name: "Null Location",
      userLocation: "Singapore",
    });
    const registerData = registerRes.data as { token: string };

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/auth/profile",
      { userLocation: null },
      { Authorization: `Bearer ${registerData.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { userLocation: string | null };
    expect(data.userLocation).toBeNull();
  });

  test("returns 401 without token", async () => {
    const router = createRouter();
    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/auth/profile",
      { name: "New Name" }
    );

    expect(res.status).toBe(401);
  });

  test("returns 400 for empty name", async () => {
    const router = createRouter();

    const registerRes = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "emptyname@test.com",
      password: "password123",
      name: "Original",
    });
    const registerData = registerRes.data as { token: string };

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/auth/profile",
      { name: "" },
      { Authorization: `Bearer ${registerData.token}` }
    );

    expect(res.status).toBe(400);
  });

  test("returns 400 for name exceeding max length", async () => {
    const router = createRouter();

    const registerRes = await makeRequest(router, "POST", "/api/v1/auth/register", {
      email: "longname@test.com",
      password: "password123",
      name: "Original",
    });
    const registerData = registerRes.data as { token: string };

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/auth/profile",
      { name: "a".repeat(101) },
      { Authorization: `Bearer ${registerData.token}` }
    );

    expect(res.status).toBe(400);
  });
});
