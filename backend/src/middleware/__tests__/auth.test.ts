import { describe, expect, test, beforeAll, afterAll } from "bun:test";

// Set JWT_SECRET before importing auth module
process.env.JWT_SECRET = "test-secret-key-for-testing-purposes-only";

// Import actual auth functions (no mocking)
import {
  generateToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  authMiddleware,
  getUser,
  extractBearerToken,
  verifyRequestAuth,
  type JWTPayload,
} from "../auth";

describe("generateToken", () => {
  test("generates a valid JWT token", async () => {
    const payload: JWTPayload = {
      sub: "123",
      email: "test@example.com",
      name: "Test User",
    };

    const token = await generateToken(payload);

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // JWT has 3 parts
  });

  test("token contains correct payload", async () => {
    const payload: JWTPayload = {
      sub: "456",
      email: "user@test.com",
      name: "Another User",
    };

    const token = await generateToken(payload);
    const verified = await verifyToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe("456");
    expect(verified?.email).toBe("user@test.com");
    expect(verified?.name).toBe("Another User");
  });

  test("generates tokens with consistent structure", async () => {
    const payload: JWTPayload = {
      sub: "789",
      email: "test@example.com",
      name: "Test User",
    };

    const token1 = await generateToken(payload);
    const token2 = await generateToken(payload);

    // Both tokens should have valid JWT structure
    expect(token1.split(".").length).toBe(3);
    expect(token2.split(".").length).toBe(3);

    // Both should verify correctly
    const verified1 = await verifyToken(token1);
    const verified2 = await verifyToken(token2);
    expect(verified1?.sub).toBe("789");
    expect(verified2?.sub).toBe("789");
  });
});

describe("verifyToken", () => {
  test("verifies a valid token", async () => {
    const payload: JWTPayload = {
      sub: "123",
      email: "test@example.com",
      name: "Test User",
    };

    const token = await generateToken(payload);
    const verified = await verifyToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe("123");
  });

  test("returns null for invalid token", async () => {
    const result = await verifyToken("invalid.token.here");
    expect(result).toBeNull();
  });

  test("returns null for tampered token", async () => {
    const payload: JWTPayload = {
      sub: "123",
      email: "test@example.com",
      name: "Test User",
    };

    const token = await generateToken(payload);
    // Tamper with the token
    const tampered = token.slice(0, -5) + "xxxxx";

    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });

  test("returns null for empty token", async () => {
    const result = await verifyToken("");
    expect(result).toBeNull();
  });

  test("returns null for malformed token", async () => {
    const result = await verifyToken("not-a-jwt");
    expect(result).toBeNull();
  });
});

describe("hashPassword", () => {
  test("hashes a password", async () => {
    const password = "mySecurePassword123";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are long
  });

  test("generates different hashes for same password", async () => {
    const password = "samePassword";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Bcrypt generates unique salts
    expect(hash1).not.toBe(hash2);
  });

  test("hashes short password", async () => {
    const hash = await hashPassword("abc");
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
  });
});

describe("verifyPassword", () => {
  test("verifies correct password", async () => {
    const password = "correctPassword123";
    const hash = await hashPassword(password);

    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  test("rejects incorrect password", async () => {
    const password = "correctPassword123";
    const hash = await hashPassword(password);

    const result = await verifyPassword("wrongPassword", hash);
    expect(result).toBe(false);
  });

  test("handles special characters in password", async () => {
    const password = "p@$$w0rd!#$%^&*()";
    const hash = await hashPassword(password);

    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  test("handles unicode in password", async () => {
    const password = "パスワード123";
    const hash = await hashPassword(password);

    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });
});

describe("extractBearerToken", () => {
  test("extracts token from valid Bearer header", () => {
    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer mytoken123" },
    });

    const token = extractBearerToken(req);
    expect(token).toBe("mytoken123");
  });

  test("returns null for missing Authorization header", () => {
    const req = new Request("http://localhost/test");

    const token = extractBearerToken(req);
    expect(token).toBeNull();
  });

  test("returns null for non-Bearer Authorization", () => {
    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });

    const token = extractBearerToken(req);
    expect(token).toBeNull();
  });

  test("extracts long token correctly", () => {
    // Use a fake long token that doesn't look like a real JWT to avoid security scanner false positives
    const longToken = "test-long-token-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz";
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${longToken}` },
    });

    const token = extractBearerToken(req);
    expect(token).toBe(longToken);
  });

  test("handles Bearer with extra spaces", () => {
    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer   token-with-spaces" },
    });

    const token = extractBearerToken(req);
    expect(token).toBe("  token-with-spaces");
  });
});

describe("verifyRequestAuth", () => {
  test("returns payload for valid token", async () => {
    const payload: JWTPayload = {
      sub: "123",
      email: "test@example.com",
      name: "Test User",
    };

    const token = await generateToken(payload);
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await verifyRequestAuth(req);
    expect(result).not.toBeNull();
    expect(result?.sub).toBe("123");
    expect(result?.email).toBe("test@example.com");
  });

  test("returns null for missing token", async () => {
    const req = new Request("http://localhost/test");

    const result = await verifyRequestAuth(req);
    expect(result).toBeNull();
  });

  test("returns null for invalid token", async () => {
    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer invalid-token" },
    });

    const result = await verifyRequestAuth(req);
    expect(result).toBeNull();
  });
});

describe("authMiddleware", () => {
  test("allows request with valid token", async () => {
    const payload: JWTPayload = {
      sub: "123",
      email: "test@example.com",
      name: "Test User",
    };

    const token = await generateToken(payload);
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${token}` },
    });

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      return new Response("OK");
    };

    const response = await authMiddleware(req, next);

    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
  });

  test("attaches user to request", async () => {
    const payload: JWTPayload = {
      sub: "456",
      email: "user@example.com",
      name: "User Name",
    };

    const token = await generateToken(payload);
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${token}` },
    });

    let capturedReq: Request | null = null;
    const next = async () => {
      capturedReq = req;
      return new Response("OK");
    };

    await authMiddleware(req, next);

    const user = getUser(capturedReq!);
    expect(user.id).toBe(456);
    expect(user.email).toBe("user@example.com");
    expect(user.name).toBe("User Name");
  });

  test("returns 401 for missing token", async () => {
    const req = new Request("http://localhost/test");

    const next = async () => new Response("OK");
    const response = await authMiddleware(req, next);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized");
  });

  test("returns 401 for invalid token", async () => {
    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer invalid-token" },
    });

    const next = async () => new Response("OK");
    const response = await authMiddleware(req, next);

    expect(response.status).toBe(401);
  });

  test("returns 401 for non-Bearer auth", async () => {
    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });

    const next = async () => new Response("OK");
    const response = await authMiddleware(req, next);

    expect(response.status).toBe(401);
  });
});

describe("getUser", () => {
  test("throws error when user not authenticated", () => {
    const req = new Request("http://localhost/test");

    expect(() => getUser(req)).toThrow("User not authenticated");
  });

  test("returns user from authenticated request", async () => {
    const payload: JWTPayload = {
      sub: "789",
      email: "test@example.com",
      name: "Test User",
    };

    const token = await generateToken(payload);
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Run through middleware to attach user
    await authMiddleware(req, async () => new Response("OK"));

    const user = getUser(req);
    expect(user.id).toBe(789);
    expect(user.email).toBe("test@example.com");
    expect(user.name).toBe("Test User");
  });
});
