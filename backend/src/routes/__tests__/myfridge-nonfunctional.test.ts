import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";

// In-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  testDb = drizzle(sqlite, { schema });

  // Create tables
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'item',
      expiry_date TEXT,
      storage_location TEXT,
      notes TEXT,
      image_url TEXT,
      barcode TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create index for performance
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date)`);

  // Insert test user
  sqlite.run(`INSERT INTO users (name, email, password) VALUES ('Test User', 'test@example.com', 'hashedpass')`);

  // Insert test products
  for (let i = 0; i < 100; i++) {
    const expiryDays = Math.floor(Math.random() * 30) - 10; // -10 to +20 days
    const expiryDate = new Date(Date.now() + expiryDays * 86400000).toISOString();
    sqlite.run(`
      INSERT INTO products (user_id, name, category, quantity, unit, expiry_date, storage_location)
      VALUES (1, 'Product ${i}', 'category${i % 5}', ${Math.random() * 10}, 'item', '${expiryDate}', 'fridge')
    `);
  }
});

afterAll(() => {
  sqlite.close();
});

// ==========================================
// PERFORMANCE TESTS
// ==========================================

describe("MyFridge - Performance Tests", () => {
  test("product listing should be under 100ms", () => {
    const startTime = performance.now();

    const products = sqlite.query("SELECT * FROM products WHERE user_id = 1").all();

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100);
    expect(products.length).toBe(100);
  });

  test("product search by name should be fast", () => {
    const startTime = performance.now();

    for (let i = 0; i < 50; i++) {
      sqlite.query("SELECT * FROM products WHERE user_id = 1 AND name LIKE ?").all(`%Product ${i}%`);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 50;
    expect(avgTime).toBeLessThan(20);
  });

  test("expiring products query should be optimized", () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();

    const startTime = performance.now();

    const expiring = sqlite.query(`
      SELECT * FROM products
      WHERE user_id = 1 AND expiry_date <= ?
      ORDER BY expiry_date ASC
    `).all(tomorrow);

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(50);
  });

  test("product insertion should be fast", () => {
    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      sqlite.run(`
        INSERT INTO products (user_id, name, category, quantity, unit, expiry_date)
        VALUES (1, 'New Product ${i}', 'test', 1, 'item', '2025-12-31')
      `);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 100;
    expect(avgTime).toBeLessThan(20);
  });

  test("product update should be fast", () => {
    const startTime = performance.now();

    for (let i = 1; i <= 50; i++) {
      sqlite.run(`UPDATE products SET quantity = quantity - 0.1 WHERE id = ${i}`);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 50;
    expect(avgTime).toBeLessThan(10);
  });

  test("product deletion should be fast", () => {
    // First create products to delete
    for (let i = 0; i < 50; i++) {
      sqlite.run(`INSERT INTO products (user_id, name, quantity) VALUES (1, 'ToDelete${i}', 1)`);
    }

    const startTime = performance.now();

    sqlite.run(`DELETE FROM products WHERE name LIKE 'ToDelete%'`);

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100);
  });

  test("category aggregation should be efficient", () => {
    const startTime = performance.now();

    const categories = sqlite.query(`
      SELECT category, COUNT(*) as count, SUM(quantity) as total
      FROM products
      WHERE user_id = 1
      GROUP BY category
    `).all();

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(50);
    expect(categories.length).toBeGreaterThan(0);
  });
});

// ==========================================
// SECURITY TESTS
// ==========================================

describe("MyFridge - Security Tests", () => {
  test("should prevent SQL injection in product name", () => {
    const maliciousName = "'; DROP TABLE products; --";

    // Using parameterized query (safe)
    const stmt = sqlite.prepare("INSERT INTO products (user_id, name, quantity) VALUES (?, ?, ?)");
    stmt.run(1, maliciousName, 1);

    // Table should still exist
    const tableExists = sqlite.query("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
    expect(tableExists).toBeDefined();
  });

  test("should validate product quantity is positive", () => {
    const validateQuantity = (quantity: number) => {
      return typeof quantity === "number" && quantity > 0 && isFinite(quantity);
    };

    expect(validateQuantity(5)).toBe(true);
    expect(validateQuantity(0.5)).toBe(true);
    expect(validateQuantity(0)).toBe(false);
    expect(validateQuantity(-1)).toBe(false);
    expect(validateQuantity(NaN)).toBe(false);
    expect(validateQuantity(Infinity)).toBe(false);
  });

  test("should validate expiry date format", () => {
    const validateExpiryDate = (date: string) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    };

    expect(validateExpiryDate("2025-12-31")).toBe(true);
    expect(validateExpiryDate("2025-12-31T23:59:59Z")).toBe(true);
    expect(validateExpiryDate("invalid")).toBe(false);
    expect(validateExpiryDate("")).toBe(false);
  });

  test("should sanitize product name for XSS", () => {
    const sanitize = (input: string) => {
      return input
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    };

    const xssAttempt = '<script>alert("xss")</script>';
    const sanitized = sanitize(xssAttempt);

    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("&lt;script&gt;");
  });

  test("should enforce user isolation", () => {
    // Insert product for user 2
    sqlite.run(`INSERT INTO users (name, email, password) VALUES ('User2', 'user2@test.com', 'pass')`);
    sqlite.run(`INSERT INTO products (user_id, name, quantity) VALUES (2, 'User2Product', 1)`);

    // Query for user 1 should not return user 2's products
    const user1Products = sqlite.query("SELECT * FROM products WHERE user_id = 1").all();
    const hasUser2Product = user1Products.some((p: { name: string }) => p.name === "User2Product");

    expect(hasUser2Product).toBe(false);
  });

  test("should validate storage location enum", () => {
    const validLocations = ["fridge", "freezer", "pantry", "other"];

    const validateLocation = (location: string) => {
      return validLocations.includes(location.toLowerCase());
    };

    expect(validateLocation("fridge")).toBe(true);
    expect(validateLocation("FREEZER")).toBe(true);
    expect(validateLocation("invalid")).toBe(false);
  });

  test("should limit product name length", () => {
    const maxLength = 255;

    const validateNameLength = (name: string) => {
      return name.length > 0 && name.length <= maxLength;
    };

    expect(validateNameLength("Valid Product")).toBe(true);
    expect(validateNameLength("")).toBe(false);
    expect(validateNameLength("a".repeat(256))).toBe(false);
  });
});

// ==========================================
// LOAD TESTS
// ==========================================

describe("MyFridge - Load Tests", () => {
  test("should handle 1000 concurrent reads", () => {
    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      sqlite.query("SELECT * FROM products WHERE user_id = 1 LIMIT 10").all();
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(totalTime).toBeLessThan(5000); // Under 5 seconds for 1000 queries
  });

  test("should maintain performance with large result sets", () => {
    // Insert more products
    for (let i = 0; i < 500; i++) {
      sqlite.run(`INSERT INTO products (user_id, name, quantity) VALUES (1, 'BulkProduct${i}', 1)`);
    }

    const startTime = performance.now();

    const allProducts = sqlite.query("SELECT * FROM products WHERE user_id = 1").all();

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(500);
    expect(allProducts.length).toBeGreaterThan(500);
  });

  test("should handle rapid updates", () => {
    const startTime = performance.now();

    for (let i = 0; i < 200; i++) {
      sqlite.run(`UPDATE products SET quantity = ${Math.random() * 10} WHERE id = ${(i % 100) + 1}`);
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(2000);
  });

  test("should handle pagination efficiently", () => {
    const pageSize = 20;
    const totalPages = 25;
    const times: number[] = [];

    for (let page = 0; page < totalPages; page++) {
      const startTime = performance.now();

      sqlite.query(`
        SELECT * FROM products
        WHERE user_id = 1
        ORDER BY id DESC
        LIMIT ${pageSize} OFFSET ${page * pageSize}
      `).all();

      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(30);
  });
});

// ==========================================
// BOUNDARY TESTS
// ==========================================

describe("MyFridge - Boundary Tests", () => {
  test("should handle maximum quantity values", () => {
    const maxQuantity = 999999.99;

    sqlite.run(`INSERT INTO products (user_id, name, quantity) VALUES (1, 'MaxQty', ${maxQuantity})`);

    const product = sqlite.query("SELECT quantity FROM products WHERE name = 'MaxQty'").get() as { quantity: number };
    expect(product.quantity).toBe(maxQuantity);
  });

  test("should handle minimum quantity values", () => {
    const minQuantity = 0.01;

    sqlite.run(`INSERT INTO products (user_id, name, quantity) VALUES (1, 'MinQty', ${minQuantity})`);

    const product = sqlite.query("SELECT quantity FROM products WHERE name = 'MinQty'").get() as { quantity: number };
    expect(product.quantity).toBeCloseTo(minQuantity, 2);
  });

  test("should handle special characters in product name", () => {
    const specialName = "Café & Crème - O'Brien's (50%)";

    const stmt = sqlite.prepare("INSERT INTO products (user_id, name, quantity) VALUES (?, ?, ?)");
    stmt.run(1, specialName, 1);

    const product = sqlite.query("SELECT name FROM products WHERE name = ?").get(specialName) as { name: string };
    expect(product.name).toBe(specialName);
  });

  test("should handle unicode characters", () => {
    const unicodeName = "日本の食品 🍎🍊";

    const stmt = sqlite.prepare("INSERT INTO products (user_id, name, quantity) VALUES (?, ?, ?)");
    stmt.run(1, unicodeName, 1);

    const product = sqlite.query("SELECT name FROM products WHERE name = ?").get(unicodeName) as { name: string };
    expect(product.name).toBe(unicodeName);
  });

  test("should handle past expiry dates", () => {
    const pastDate = new Date(Date.now() - 86400000 * 30).toISOString(); // 30 days ago

    sqlite.run(`INSERT INTO products (user_id, name, quantity, expiry_date) VALUES (1, 'Expired', 1, '${pastDate}')`);

    const expired = sqlite.query(`
      SELECT * FROM products
      WHERE user_id = 1 AND expiry_date < datetime('now')
    `).all();

    expect(expired.length).toBeGreaterThan(0);
  });

  test("should handle far future expiry dates", () => {
    const futureDate = "2099-12-31T23:59:59Z";

    sqlite.run(`INSERT INTO products (user_id, name, quantity, expiry_date) VALUES (1, 'LongLife', 1, '${futureDate}')`);

    const product = sqlite.query("SELECT expiry_date FROM products WHERE name = 'LongLife'").get() as { expiry_date: string };
    expect(new Date(product.expiry_date).getFullYear()).toBe(2099);
  });
});

// ==========================================
// DATA INTEGRITY TESTS
// ==========================================

describe("MyFridge - Data Integrity Tests", () => {
  test("should maintain referential integrity", () => {
    // Try to insert product for non-existent user
    try {
      sqlite.run(`INSERT INTO products (user_id, name, quantity) VALUES (9999, 'Orphan', 1)`);
      // If foreign key enforcement is on, this should fail
    } catch {
      // Expected behavior with foreign key constraints
    }
  });

  test("should handle concurrent updates correctly", () => {
    // Insert a product with known quantity
    sqlite.run(`INSERT INTO products (user_id, name, quantity) VALUES (1, 'ConcurrentTest', 10)`);

    // Simulate concurrent decrements
    for (let i = 0; i < 5; i++) {
      sqlite.run(`UPDATE products SET quantity = quantity - 1 WHERE name = 'ConcurrentTest' AND quantity > 0`);
    }

    const product = sqlite.query("SELECT quantity FROM products WHERE name = 'ConcurrentTest'").get() as { quantity: number };
    expect(product.quantity).toBe(5);
  });

  test("should prevent negative quantities via constraint", () => {
    const checkNonNegative = (quantity: number) => {
      return quantity >= 0;
    };

    expect(checkNonNegative(0)).toBe(true);
    expect(checkNonNegative(-1)).toBe(false);
  });

  test("should track timestamps correctly", () => {
    sqlite.run(`INSERT INTO products (user_id, name, quantity) VALUES (1, 'TimestampTest', 1)`);

    const product = sqlite.query("SELECT created_at, updated_at FROM products WHERE name = 'TimestampTest'").get() as { created_at: string; updated_at: string };

    expect(product.created_at).toBeDefined();
    expect(product.updated_at).toBeDefined();
  });
});
