import * as jose from "jose";
import { error } from "../utils/router";

const TOKEN_EXPIRY = "7d"; // 7 days

// Lazy-load JWT_SECRET so importing this module doesn't throw during tests
let _jwtSecret: Uint8Array | null = null;
function getJwtSecret(): Uint8Array {
  if (!_jwtSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is required. Set it in your .env file.");
    }
    _jwtSecret = new TextEncoder().encode(secret);
  }
  return _jwtSecret;
}

export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
  };
}

export async function generateToken(payload: JWTPayload): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export async function authMiddleware(
  req: Request,
  next: () => Promise<Response>
): Promise<Response> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return error("Unauthorized: Missing or invalid token", 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return error("Unauthorized: Invalid or expired token", 401);
  }

  (req as AuthenticatedRequest).user = {
    id: parseInt(payload.sub, 10),
    email: payload.email,
    name: payload.name,
  };

  return next();
}

export function getUser(req: Request): { id: number; email: string; name: string } {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user;
}

/**
 * Extract Bearer token from Authorization header
 * @returns token string or null if invalid/missing
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Verify request authorization and return user payload
 * @returns JWTPayload or null if unauthorized
 */
export async function verifyRequestAuth(req: Request): Promise<JWTPayload | null> {
  const token = extractBearerToken(req);
  if (!token) {
    return null;
  }
  return verifyToken(token);
}
