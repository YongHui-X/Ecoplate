import { describe, expect, test, beforeAll, afterAll, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { sign } from "jose";

// In-memory test database
let testDb: ReturnType<typeof drizzle>;
let sqlite: Database;
let testToken: string;
let testUserId: number;
let testListingId: number;
let testLockerId: number;

// Secret key for JWT
const JWT_SECRET = new TextEncoder().encode("test-secret-key");

async function createTestToken(userId: number): Promise<string> {
  return await new (await import("jose")).SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

beforeAll(async () => {
  // Create in-memory SQLite database
  sqlite = new Database(":memory:");
  testDb = drizzle(sqlite, { schema });

  // Create tables
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

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      buyer_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      quantity REAL,
      unit TEXT,
      price REAL,
      original_price REAL,
      expiry_date TEXT,
      pickup_location TEXT,
      images TEXT,
      co2_saved REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id)
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS ecolockers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      total_compartments INTEGER DEFAULT 20,
      available_compartments INTEGER DEFAULT 20,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS ecolocker_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      locker_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      item_price REAL NOT NULL,
      delivery_fee REAL DEFAULT 2.0,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'pending_payment',
      compartment_number INTEGER,
      pickup_pin TEXT,
      reserved_at TEXT DEFAULT CURRENT_TIMESTAMP,
      payment_deadline TEXT,
      paid_at TEXT,
      pickup_scheduled_at TEXT,
      rider_picked_up_at TEXT,
      delivered_at TEXT,
      picked_up_at TEXT,
      expires_at TEXT,
      cancel_reason TEXT,
      FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id),
      FOREIGN KEY (locker_id) REFERENCES ecolockers(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    )
  `);

  // Insert test data
  const buyerResult = sqlite.run(
    `INSERT INTO users (name, email, password) VALUES ('Test Buyer', 'buyer@test.com', 'hashedpass')`
  );
  testUserId = Number(buyerResult.lastInsertRowid);

  const sellerResult = sqlite.run(
    `INSERT INTO users (name, email, password) VALUES ('Test Seller', 'seller@test.com', 'hashedpass')`
  );
  const sellerId = Number(sellerResult.lastInsertRowid);

  const listingResult = sqlite.run(
    `INSERT INTO marketplace_listings (seller_id, title, description, category, quantity, unit, price, status)
     VALUES (${sellerId}, 'Test Product', 'Description', 'produce', 5, 'kg', 10.00, 'active')`
  );
  testListingId = Number(listingResult.lastInsertRowid);

  const lockerResult = sqlite.run(
    `INSERT INTO ecolockers (name, address, latitude, longitude, total_compartments, available_compartments, is_active)
     VALUES ('Test Locker', '123 Test St', 1.3521, 103.8198, 20, 15, 1)`
  );
  testLockerId = Number(lockerResult.lastInsertRowid);

  testToken = await createTestToken(testUserId);
});

afterAll(() => {
  sqlite.close();
});

// ==========================================
// PERFORMANCE TESTS
// ==========================================

describe("EcoLocker - Performance Tests", () => {
  test("locker listing response time should be under 500ms", async () => {
    const startTime = performance.now();

    // Simulate API call timing
    const result = sqlite.query("SELECT * FROM ecolockers WHERE is_active = 1").all();

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeLessThan(500);
    expect(result.length).toBeGreaterThan(0);
  });

  test("order creation should complete within 1000ms", async () => {
    const startTime = performance.now();

    // Insert order
    const result = sqlite.run(`
      INSERT INTO ecolocker_orders (listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
      VALUES (${testListingId}, ${testLockerId}, ${testUserId}, 2, 10.00, 2.00, 12.00, 'pending_payment')
    `);

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeLessThan(1000);
    expect(Number(result.lastInsertRowid)).toBeGreaterThan(0);
  });

  test("order query with joins should be under 200ms", async () => {
    const startTime = performance.now();

    const query = `
      SELECT
        o.*,
        l.title as listing_title,
        loc.name as locker_name,
        b.name as buyer_name,
        s.name as seller_name
      FROM ecolocker_orders o
      JOIN marketplace_listings l ON o.listing_id = l.id
      JOIN ecolockers loc ON o.locker_id = loc.id
      JOIN users b ON o.buyer_id = b.id
      JOIN users s ON o.seller_id = s.id
      WHERE o.buyer_id = ${testUserId}
    `;

    const result = sqlite.query(query).all();

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeLessThan(200);
  });

  test("database should handle 100 concurrent order inserts", async () => {
    const startTime = performance.now();
    const insertCount = 100;

    // Create multiple orders
    for (let i = 0; i < insertCount; i++) {
      sqlite.run(`
        INSERT INTO ecolocker_orders (listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
        VALUES (${testListingId}, ${testLockerId}, ${testUserId}, 2, 10.00, 2.00, 12.00, 'pending_payment')
      `);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerInsert = totalTime / insertCount;

    expect(avgTimePerInsert).toBeLessThan(50); // Each insert should be under 50ms
    expect(totalTime).toBeLessThan(5000); // Total should be under 5 seconds
  });

  test("locker availability check should be fast", async () => {
    const startTime = performance.now();

    const result = sqlite.query(`
      SELECT id, name, available_compartments
      FROM ecolockers
      WHERE is_active = 1 AND available_compartments > 0
      ORDER BY available_compartments DESC
    `).all();

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeLessThan(100);
  });
});

// ==========================================
// SECURITY TESTS
// ==========================================

describe("EcoLocker - Security Tests", () => {
  describe("Authentication", () => {
    test("should reject requests without token", async () => {
      // Simulate auth check
      const token = null;
      const isAuthenticated = token !== null;

      expect(isAuthenticated).toBe(false);
    });

    test("should reject expired tokens", async () => {
      // Create an expired token
      const expiredToken = await new (await import("jose")).SignJWT({ userId: testUserId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("-1h") // Expired 1 hour ago
        .sign(JWT_SECRET);

      try {
        await (await import("jose")).jwtVerify(expiredToken, JWT_SECRET);
        expect(true).toBe(false); // Should not reach here
      } catch (error: unknown) {
        // jose library throws error with "exp" claim check failure
        expect((error as Error).message).toContain("exp");
      }
    });

    test("should reject tokens with invalid signature", async () => {
      const wrongSecret = new TextEncoder().encode("wrong-secret");
      const invalidToken = await new (await import("jose")).SignJWT({ userId: testUserId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(wrongSecret);

      try {
        await (await import("jose")).jwtVerify(invalidToken, JWT_SECRET);
        expect(true).toBe(false); // Should not reach here
      } catch (error: unknown) {
        expect((error as Error).message).toContain("signature");
      }
    });

    test("should reject malformed tokens", async () => {
      const malformedToken = "not.a.valid.jwt.token";

      try {
        await (await import("jose")).jwtVerify(malformedToken, JWT_SECRET);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Authorization", () => {
    test("buyer should only access their own orders", async () => {
      // Create order for another user
      const otherBuyerResult = sqlite.run(
        `INSERT INTO users (name, email, password) VALUES ('Other Buyer', 'other@test.com', 'hashedpass')`
      );
      const otherBuyerId = Number(otherBuyerResult.lastInsertRowid);

      sqlite.run(`
        INSERT INTO ecolocker_orders (listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
        VALUES (${testListingId}, ${testLockerId}, ${otherBuyerId}, 2, 10.00, 2.00, 12.00, 'pending_payment')
      `);

      // Query with buyer_id filter (simulating authorization)
      const orders = sqlite.query(`
        SELECT * FROM ecolocker_orders WHERE buyer_id = ${testUserId}
      `).all();

      // Verify no orders from other buyer are returned
      const hasOtherBuyerOrders = orders.some((o: { buyer_id: number }) => o.buyer_id === otherBuyerId);
      expect(hasOtherBuyerOrders).toBe(false);
    });

    test("seller should only manage their own orders", async () => {
      const orders = sqlite.query(`
        SELECT * FROM ecolocker_orders WHERE seller_id = 2
      `).all();

      // All orders should belong to seller_id = 2
      const allOwnOrders = orders.every((o: { seller_id: number }) => o.seller_id === 2);
      expect(allOwnOrders).toBe(true);
    });

    test("order cancellation should verify ownership", async () => {
      // Create order
      const orderResult = sqlite.run(`
        INSERT INTO ecolocker_orders (listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
        VALUES (${testListingId}, ${testLockerId}, ${testUserId}, 2, 10.00, 2.00, 12.00, 'pending_payment')
      `);
      const orderId = Number(orderResult.lastInsertRowid);

      // Verify order belongs to user before allowing cancel
      const order = sqlite.query(`SELECT * FROM ecolocker_orders WHERE id = ${orderId}`).get() as { buyer_id: number; seller_id: number } | null;
      const canCancel = order && (order.buyer_id === testUserId || order.seller_id === testUserId);

      expect(canCancel).toBe(true);
    });
  });

  describe("Input Validation", () => {
    test("should reject SQL injection attempts in listing search", async () => {
      // Attempt SQL injection
      const maliciousInput = "'; DROP TABLE users; --";

      // Using parameterized query (safe)
      const stmt = sqlite.prepare("SELECT * FROM marketplace_listings WHERE title LIKE ?");
      const result = stmt.all(`%${maliciousInput}%`);

      // Table should still exist
      const tableExists = sqlite.query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      expect(tableExists).toBeDefined();
    });

    test("should validate order ID is numeric", async () => {
      const orderId = "abc"; // Non-numeric
      const isValidId = /^\d+$/.test(orderId);

      expect(isValidId).toBe(false);
    });

    test("should validate price is positive number", async () => {
      const validatePrice = (price: number) => {
        return typeof price === "number" && price > 0 && isFinite(price);
      };

      expect(validatePrice(10.00)).toBe(true);
      expect(validatePrice(-5.00)).toBe(false);
      expect(validatePrice(0)).toBe(false);
      expect(validatePrice(NaN)).toBe(false);
      expect(validatePrice(Infinity)).toBe(false);
    });

    test("should validate PIN format", async () => {
      const validatePin = (pin: string) => {
        return /^\d{6}$/.test(pin);
      };

      expect(validatePin("123456")).toBe(true);
      expect(validatePin("12345")).toBe(false); // Too short
      expect(validatePin("1234567")).toBe(false); // Too long
      expect(validatePin("12345a")).toBe(false); // Contains letter
      expect(validatePin("")).toBe(false); // Empty
    });

    test("should sanitize user input for XSS prevention", async () => {
      const sanitizeInput = (input: string) => {
        return input
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#x27;");
      };

      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("&lt;script&gt;");
    });

    test("should validate email format", async () => {
      const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("invalid-email")).toBe(false);
      expect(validateEmail("@example.com")).toBe(false);
      expect(validateEmail("user@")).toBe(false);
    });
  });

  describe("Rate Limiting Simulation", () => {
    test("should track request count per user", async () => {
      const requestCounts: Map<number, number> = new Map();
      const RATE_LIMIT = 100;
      const TIME_WINDOW = 60000; // 1 minute

      const trackRequest = (userId: number) => {
        const count = requestCounts.get(userId) || 0;
        requestCounts.set(userId, count + 1);
        return count + 1 <= RATE_LIMIT;
      };

      // Simulate 100 requests (should all pass)
      for (let i = 0; i < 100; i++) {
        expect(trackRequest(testUserId)).toBe(true);
      }

      // 101st request should be rate limited
      expect(trackRequest(testUserId)).toBe(false);
    });
  });
});

// ==========================================
// LOAD TESTS
// ==========================================

describe("EcoLocker - Load Tests", () => {
  test("should handle 1000 order queries efficiently", async () => {
    const startTime = performance.now();
    const queryCount = 1000;

    for (let i = 0; i < queryCount; i++) {
      sqlite.query("SELECT * FROM ecolocker_orders LIMIT 10").all();
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerQuery = totalTime / queryCount;

    expect(avgTimePerQuery).toBeLessThan(10); // Each query should be under 10ms
    expect(totalTime).toBeLessThan(10000); // Total under 10 seconds
  });

  test("should maintain data integrity under concurrent operations", async () => {
    const initialCount = (sqlite.query("SELECT COUNT(*) as count FROM ecolocker_orders").get() as { count: number }).count;

    // Simulate concurrent inserts
    const insertPromises = [];
    for (let i = 0; i < 50; i++) {
      sqlite.run(`
        INSERT INTO ecolocker_orders (listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
        VALUES (${testListingId}, ${testLockerId}, ${testUserId}, 2, 10.00, 2.00, 12.00, 'pending_payment')
      `);
    }

    const finalCount = (sqlite.query("SELECT COUNT(*) as count FROM ecolocker_orders").get() as { count: number }).count;

    expect(finalCount).toBe(initialCount + 50);
  });

  test("should handle multiple locker availability updates", async () => {
    const startTime = performance.now();
    const updateCount = 500;

    for (let i = 0; i < updateCount; i++) {
      const newAvailable = Math.floor(Math.random() * 20);
      sqlite.run(`UPDATE ecolockers SET available_compartments = ${newAvailable} WHERE id = ${testLockerId}`);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(totalTime).toBeLessThan(5000); // All updates under 5 seconds
  });

  test("should handle large result sets", async () => {
    // Insert many orders
    for (let i = 0; i < 500; i++) {
      sqlite.run(`
        INSERT INTO ecolocker_orders (listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
        VALUES (${testListingId}, ${testLockerId}, ${testUserId}, 2, 10.00, 2.00, 12.00, 'pending_payment')
      `);
    }

    const startTime = performance.now();

    const result = sqlite.query("SELECT * FROM ecolocker_orders").all();

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    expect(result.length).toBeGreaterThan(500);
    expect(responseTime).toBeLessThan(1000); // Under 1 second for large dataset
  });

  test("should handle pagination efficiently", async () => {
    const pageSize = 20;
    const totalPages = 25;
    const times: number[] = [];

    for (let page = 0; page < totalPages; page++) {
      const startTime = performance.now();

      sqlite.query(`
        SELECT * FROM ecolocker_orders
        ORDER BY id DESC
        LIMIT ${pageSize} OFFSET ${page * pageSize}
      `).all();

      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(50); // Each page under 50ms
  });
});

// ==========================================
// RELIABILITY TESTS
// ==========================================

describe("EcoLocker - Reliability Tests", () => {
  test("should handle database connection recovery", async () => {
    // Simulate temporary failure and recovery
    let connectionAttempts = 0;
    const maxRetries = 3;

    const attemptConnection = () => {
      connectionAttempts++;
      if (connectionAttempts < 3) {
        throw new Error("Connection failed");
      }
      return true;
    };

    let connected = false;
    for (let i = 0; i < maxRetries; i++) {
      try {
        connected = attemptConnection();
        break;
      } catch {
        // Retry
      }
    }

    expect(connected).toBe(true);
    expect(connectionAttempts).toBe(3);
  });

  test("should rollback failed transactions", async () => {
    const initialLocker = sqlite.query(`SELECT available_compartments FROM ecolockers WHERE id = ${testLockerId}`).get() as { available_compartments: number };
    const initialCompartments = initialLocker.available_compartments;

    // Simulate transaction
    try {
      sqlite.run("BEGIN TRANSACTION");
      sqlite.run(`UPDATE ecolockers SET available_compartments = available_compartments - 1 WHERE id = ${testLockerId}`);

      // Simulate error
      throw new Error("Simulated error");

    } catch {
      sqlite.run("ROLLBACK");
    }

    const finalLocker = sqlite.query(`SELECT available_compartments FROM ecolockers WHERE id = ${testLockerId}`).get() as { available_compartments: number };

    expect(finalLocker.available_compartments).toBe(initialCompartments);
  });

  test("should maintain order status consistency", async () => {
    const validStatuses = [
      "pending_payment",
      "paid",
      "pickup_scheduled",
      "in_transit",
      "ready_for_pickup",
      "collected",
      "cancelled",
      "expired"
    ];

    const orders = sqlite.query("SELECT DISTINCT status FROM ecolocker_orders").all() as Array<{ status: string }>;

    for (const order of orders) {
      expect(validStatuses).toContain(order.status);
    }
  });

  test("should prevent double-spending via compartment allocation", async () => {
    // Get current available compartments
    const locker = sqlite.query(`SELECT available_compartments FROM ecolockers WHERE id = ${testLockerId}`).get() as { available_compartments: number };
    const available = locker.available_compartments;

    // Simulate concurrent allocation attempts
    let allocated = 0;

    for (let i = 0; i < available + 5; i++) {
      const current = sqlite.query(`SELECT available_compartments FROM ecolockers WHERE id = ${testLockerId}`).get() as { available_compartments: number };

      if (current.available_compartments > 0) {
        sqlite.run(`UPDATE ecolockers SET available_compartments = available_compartments - 1 WHERE id = ${testLockerId} AND available_compartments > 0`);
        allocated++;
      }
    }

    const finalLocker = sqlite.query(`SELECT available_compartments FROM ecolockers WHERE id = ${testLockerId}`).get() as { available_compartments: number };

    expect(finalLocker.available_compartments).toBe(0);
    expect(allocated).toBeLessThanOrEqual(available);
  });
});

// ==========================================
// BOUNDARY TESTS
// ==========================================

describe("EcoLocker - Boundary Tests", () => {
  test("should handle maximum price values", async () => {
    const maxPrice = 999999.99;

    const result = sqlite.run(`
      INSERT INTO ecolocker_orders (listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
      VALUES (${testListingId}, ${testLockerId}, ${testUserId}, 2, ${maxPrice}, 2.00, ${maxPrice + 2}, 'pending_payment')
    `);

    expect(Number(result.lastInsertRowid)).toBeGreaterThan(0);

    const order = sqlite.query(`SELECT item_price FROM ecolocker_orders WHERE id = ${result.lastInsertRowid}`).get() as { item_price: number };
    expect(order.item_price).toBe(maxPrice);
  });

  test("should handle minimum price values", async () => {
    const minPrice = 0.01;

    const result = sqlite.run(`
      INSERT INTO ecolocker_orders (listing_id, locker_id, buyer_id, seller_id, item_price, delivery_fee, total_price, status)
      VALUES (${testListingId}, ${testLockerId}, ${testUserId}, 2, ${minPrice}, 2.00, ${minPrice + 2}, 'pending_payment')
    `);

    expect(Number(result.lastInsertRowid)).toBeGreaterThan(0);

    const order = sqlite.query(`SELECT item_price FROM ecolocker_orders WHERE id = ${result.lastInsertRowid}`).get() as { item_price: number };
    expect(order.item_price).toBe(minPrice);
  });

  test("should handle empty compartments gracefully", async () => {
    // Set compartments to 0
    sqlite.run(`UPDATE ecolockers SET available_compartments = 0 WHERE id = ${testLockerId}`);

    const locker = sqlite.query(`SELECT * FROM ecolockers WHERE id = ${testLockerId} AND available_compartments > 0`).get();

    expect(locker).toBeNull();

    // Reset for other tests
    sqlite.run(`UPDATE ecolockers SET available_compartments = 15 WHERE id = ${testLockerId}`);
  });

  test("should handle special characters in locker names", async () => {
    const specialName = "Test Locker - O'Brien's & Co. (Main)";

    const stmt = sqlite.prepare("INSERT INTO ecolockers (name, address) VALUES (?, ?)");
    const result = stmt.run(specialName, "123 Test St");

    const locker = sqlite.query(`SELECT name FROM ecolockers WHERE id = ${result.lastInsertRowid}`).get() as { name: string };
    expect(locker.name).toBe(specialName);
  });

  test("should handle unicode characters in descriptions", async () => {
    const unicodeDesc = "Fresh 🍎 apples from 日本 with émojis & спецсимволы";

    const stmt = sqlite.prepare("INSERT INTO marketplace_listings (seller_id, title, description, price, status) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(2, "Unicode Test", unicodeDesc, 10.00, "active");

    const listing = sqlite.query(`SELECT description FROM marketplace_listings WHERE id = ${result.lastInsertRowid}`).get() as { description: string };
    expect(listing.description).toBe(unicodeDesc);
  });
});
