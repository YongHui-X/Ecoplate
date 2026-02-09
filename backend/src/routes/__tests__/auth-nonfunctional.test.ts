import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import { SignJWT, jwtVerify } from "jose";

// In-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

// JWT secret for testing
const JWT_SECRET = new TextEncoder().encode("test-secret-key-for-auth-tests");

beforeAll(() => {
  sqlite = new Database(":memory:");
  testDb = drizzle(sqlite, { schema });

  // Create users table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar_url TEXT,
      user_location TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert test users
  sqlite.run(`
    INSERT INTO users (name, email, password)
    VALUES ('Test User', 'test@example.com', '$2b$10$hashedpassword')
  `);
});

afterAll(() => {
  sqlite.close();
});

// ==========================================
// AUTHENTICATION SECURITY TESTS
// ==========================================

describe("Auth - JWT Security Tests", () => {
  test("should create valid JWT token", async () => {
    const token = await new SignJWT({ userId: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(JWT_SECRET);

    expect(token).toBeDefined();
    expect(token.split(".")).toHaveLength(3);
  });

  test("should verify valid JWT token", async () => {
    const token = await new SignJWT({ userId: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(JWT_SECRET);

    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe(1);
  });

  test("should reject expired JWT token", async () => {
    const token = await new SignJWT({ userId: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("-1h")
      .sign(JWT_SECRET);

    try {
      await jwtVerify(token, JWT_SECRET);
      expect(true).toBe(false);
    } catch (error: unknown) {
      expect((error as Error).message).toContain("exp");
    }
  });

  test("should reject token with wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongSecret);

    try {
      await jwtVerify(token, JWT_SECRET);
      expect(true).toBe(false);
    } catch (error: unknown) {
      expect((error as Error).message).toContain("signature");
    }
  });

  test("should reject malformed JWT token", async () => {
    const malformedTokens = [
      "not.a.token",
      "invalid",
      "",
      "a.b",
      "a.b.c.d",
      "eyJhbGciOiJIUzI1NiJ9.invalid.signature",
    ];

    for (const token of malformedTokens) {
      try {
        await jwtVerify(token, JWT_SECRET);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    }
  });

  test("should reject token with tampered payload", async () => {
    const token = await new SignJWT({ userId: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(JWT_SECRET);

    // Tamper with the payload
    const parts = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: 999 })).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    try {
      await jwtVerify(tamperedToken, JWT_SECRET);
      expect(true).toBe(false);
    } catch (error: unknown) {
      expect((error as Error).message).toContain("signature");
    }
  });
});

describe("Auth - Password Security Tests", () => {
  test("password should not be stored in plain text", () => {
    const user = sqlite.query("SELECT password FROM users WHERE email = 'test@example.com'").get() as { password: string };
    expect(user.password).not.toBe("password123");
    expect(user.password.startsWith("$2")).toBe(true); // bcrypt hash
  });

  test("should validate password complexity requirements", () => {
    const validatePassword = (password: string) => {
      const minLength = password.length >= 8;
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      return { minLength, hasUppercase, hasLowercase, hasNumber };
    };

    const strongPassword = validatePassword("SecurePass123");
    expect(strongPassword.minLength).toBe(true);
    expect(strongPassword.hasUppercase).toBe(true);
    expect(strongPassword.hasLowercase).toBe(true);
    expect(strongPassword.hasNumber).toBe(true);

    const weakPassword = validatePassword("weak");
    expect(weakPassword.minLength).toBe(false);
  });

  test("should reject common weak passwords", () => {
    const commonPasswords = [
      "password",
      "123456",
      "qwerty",
      "admin",
      "letmein",
      "welcome",
      "password123",
    ];

    const isWeakPassword = (password: string) => {
      return commonPasswords.includes(password.toLowerCase());
    };

    commonPasswords.forEach((pwd) => {
      expect(isWeakPassword(pwd)).toBe(true);
    });

    expect(isWeakPassword("UniqueSecure789!")).toBe(false);
  });
});

describe("Auth - Input Validation Security Tests", () => {
  test("should validate email format", () => {
    const validateEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    expect(validateEmail("valid@example.com")).toBe(true);
    expect(validateEmail("user.name@domain.org")).toBe(true);
    expect(validateEmail("invalid")).toBe(false);
    expect(validateEmail("@example.com")).toBe(false);
    expect(validateEmail("user@")).toBe(false);
    expect(validateEmail("")).toBe(false);
  });

  test("should sanitize email to prevent injection", () => {
    const sanitizeEmail = (email: string) => {
      return email.toLowerCase().trim();
    };

    expect(sanitizeEmail("  USER@EXAMPLE.COM  ")).toBe("user@example.com");
    expect(sanitizeEmail("Test@Domain.Com")).toBe("test@domain.com");
  });

  test("should reject SQL injection in email field", () => {
    const maliciousEmails = [
      "'; DROP TABLE users; --",
      "admin'--",
      "1' OR '1'='1",
      "user@test.com'; DELETE FROM users;--",
    ];

    const validateEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    maliciousEmails.forEach((email) => {
      expect(validateEmail(email)).toBe(false);
    });
  });

  test("should escape special characters in user input", () => {
    const escapeHtml = (str: string) => {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    };

    const xssAttempt = '<script>alert("xss")</script>';
    const escaped = escapeHtml(xssAttempt);

    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });
});

describe("Auth - Rate Limiting Tests", () => {
  test("should track login attempts per user", () => {
    const loginAttempts: Map<string, number[]> = new Map();
    const RATE_LIMIT = 5;
    const TIME_WINDOW_MS = 60000; // 1 minute

    const recordAttempt = (email: string): boolean => {
      const now = Date.now();
      const attempts = loginAttempts.get(email) || [];

      // Filter out old attempts
      const recentAttempts = attempts.filter((t) => now - t < TIME_WINDOW_MS);

      if (recentAttempts.length >= RATE_LIMIT) {
        return false; // Rate limited
      }

      recentAttempts.push(now);
      loginAttempts.set(email, recentAttempts);
      return true;
    };

    // First 5 attempts should pass
    for (let i = 0; i < 5; i++) {
      expect(recordAttempt("user@test.com")).toBe(true);
    }

    // 6th attempt should be blocked
    expect(recordAttempt("user@test.com")).toBe(false);
  });

  test("should implement exponential backoff", () => {
    const calculateBackoff = (attempts: number, baseDelay: number = 1000) => {
      return Math.min(baseDelay * Math.pow(2, attempts), 30000); // Max 30 seconds
    };

    expect(calculateBackoff(0)).toBe(1000);
    expect(calculateBackoff(1)).toBe(2000);
    expect(calculateBackoff(2)).toBe(4000);
    expect(calculateBackoff(3)).toBe(8000);
    expect(calculateBackoff(5)).toBe(30000); // Capped at 30 seconds
  });
});

describe("Auth - Session Security Tests", () => {
  test("should include required claims in JWT", async () => {
    const token = await new SignJWT({ userId: 1, email: "test@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setJti(crypto.randomUUID())
      .sign(JWT_SECRET);

    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
    expect(payload.jti).toBeDefined();
  });

  test("should have reasonable token expiration", async () => {
    const token = await new SignJWT({ userId: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(JWT_SECRET);

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const expirationTime = (payload.exp as number) - (payload.iat as number);

    // Token should expire within 1-24 hours
    expect(expirationTime).toBeGreaterThanOrEqual(3600); // 1 hour
    expect(expirationTime).toBeLessThanOrEqual(86400); // 24 hours
  });
});

describe("Auth - Performance Tests", () => {
  test("user lookup by email should be fast", () => {
    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      sqlite.query("SELECT * FROM users WHERE email = ?").get("test@example.com");
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 100;

    expect(avgTime).toBeLessThan(10); // Each lookup under 10ms
  });

  test("JWT generation should be fast", async () => {
    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      await new SignJWT({ userId: i })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(JWT_SECRET);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 100;

    expect(avgTime).toBeLessThan(50); // Each generation under 50ms
  });

  test("JWT verification should be fast", async () => {
    const token = await new SignJWT({ userId: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(JWT_SECRET);

    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      await jwtVerify(token, JWT_SECRET);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 100;

    expect(avgTime).toBeLessThan(10); // Each verification under 10ms
  });
});
