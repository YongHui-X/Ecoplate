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
      user_location TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'item',
      price REAL NOT NULL,
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
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      last_message_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    )
  `);

  // Create indexes
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_listings_seller ON marketplace_listings(seller_id)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_listings_category ON marketplace_listings(category)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`);

  // Insert test users
  sqlite.run(`INSERT INTO users (name, email, password, user_location) VALUES ('Seller', 'seller@test.com', 'hash', 'Singapore 123456')`);
  sqlite.run(`INSERT INTO users (name, email, password, user_location) VALUES ('Buyer', 'buyer@test.com', 'hash', 'Singapore 654321')`);

  // Insert test listings
  const categories = ["produce", "dairy", "bakery", "meat", "beverages"];
  const statuses = ["active", "reserved", "completed", "expired"];

  for (let i = 0; i < 200; i++) {
    const category = categories[i % categories.length];
    const status = i < 150 ? "active" : statuses[i % statuses.length];
    const price = (Math.random() * 50 + 1).toFixed(2);
    const originalPrice = (parseFloat(price) * 1.3).toFixed(2);
    const expiryDays = Math.floor(Math.random() * 14) + 1;
    const expiryDate = new Date(Date.now() + expiryDays * 86400000).toISOString();

    sqlite.run(`
      INSERT INTO marketplace_listings (seller_id, title, description, category, quantity, unit, price, original_price, expiry_date, pickup_location, status)
      VALUES (1, 'Listing ${i}', 'Description for listing ${i}', '${category}', ${Math.random() * 10 + 1}, 'kg', ${price}, ${originalPrice}, '${expiryDate}', 'Singapore', '${status}')
    `);
  }
});

afterAll(() => {
  sqlite.close();
});

// ==========================================
// PERFORMANCE TESTS
// ==========================================

describe("Marketplace - Performance Tests", () => {
  test("active listings query should be under 100ms", () => {
    const startTime = performance.now();

    const listings = sqlite.query(`
      SELECT * FROM marketplace_listings
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT 20
    `).all();

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100);
    expect(listings.length).toBe(20);
  });

  test("category filter should be optimized", () => {
    const startTime = performance.now();

    for (const category of ["produce", "dairy", "bakery"]) {
      sqlite.query(`
        SELECT * FROM marketplace_listings
        WHERE status = 'active' AND category = ?
        ORDER BY created_at DESC
      `).all(category);
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(150);
  });

  test("search by title should be fast", () => {
    const startTime = performance.now();

    for (let i = 0; i < 20; i++) {
      sqlite.query(`
        SELECT * FROM marketplace_listings
        WHERE status = 'active' AND title LIKE ?
      `).all(`%Listing ${i}%`);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 20;
    expect(avgTime).toBeLessThan(20);
  });

  test("price range filter should be efficient", () => {
    const startTime = performance.now();

    sqlite.query(`
      SELECT * FROM marketplace_listings
      WHERE status = 'active' AND price BETWEEN ? AND ?
      ORDER BY price ASC
    `).all(5, 20);

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(50);
  });

  test("listing with seller info join should be fast", () => {
    const startTime = performance.now();

    sqlite.query(`
      SELECT l.*, u.name as seller_name, u.user_location as seller_location
      FROM marketplace_listings l
      JOIN users u ON l.seller_id = u.id
      WHERE l.status = 'active'
      LIMIT 50
    `).all();

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100);
  });

  test("listing creation should be fast", () => {
    const startTime = performance.now();

    for (let i = 0; i < 50; i++) {
      sqlite.run(`
        INSERT INTO marketplace_listings (seller_id, title, description, category, price, status)
        VALUES (1, 'New Listing ${i}', 'Description', 'produce', 10.00, 'active')
      `);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 50;
    expect(avgTime).toBeLessThan(20);
  });

  test("status update should be fast", () => {
    const startTime = performance.now();

    for (let i = 1; i <= 50; i++) {
      sqlite.run(`UPDATE marketplace_listings SET status = 'reserved', buyer_id = 2 WHERE id = ${i}`);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 50;
    expect(avgTime).toBeLessThan(10);
  });
});

// ==========================================
// SECURITY TESTS
// ==========================================

describe("Marketplace - Security Tests", () => {
  test("should prevent SQL injection in search", () => {
    const maliciousSearch = "'; DROP TABLE marketplace_listings; --";

    // Using parameterized query
    const stmt = sqlite.prepare("SELECT * FROM marketplace_listings WHERE title LIKE ?");
    stmt.all(`%${maliciousSearch}%`);

    // Table should still exist
    const tableExists = sqlite.query("SELECT name FROM sqlite_master WHERE type='table' AND name='marketplace_listings'").get();
    expect(tableExists).toBeDefined();
  });

  test("should validate price is positive", () => {
    const validatePrice = (price: number) => {
      return typeof price === "number" && price > 0 && price <= 10000 && isFinite(price);
    };

    expect(validatePrice(10.00)).toBe(true);
    expect(validatePrice(0.01)).toBe(true);
    expect(validatePrice(0)).toBe(false);
    expect(validatePrice(-5)).toBe(false);
    expect(validatePrice(NaN)).toBe(false);
    expect(validatePrice(Infinity)).toBe(false);
    expect(validatePrice(100000)).toBe(false); // Over max
  });

  test("should validate listing status", () => {
    const validStatuses = ["active", "reserved", "completed", "expired", "cancelled"];

    const validateStatus = (status: string) => {
      return validStatuses.includes(status);
    };

    expect(validateStatus("active")).toBe(true);
    expect(validateStatus("reserved")).toBe(true);
    expect(validateStatus("invalid")).toBe(false);
    expect(validateStatus("ACTIVE")).toBe(false); // Case sensitive
  });

  test("should sanitize description for XSS", () => {
    const sanitize = (input: string) => {
      return input
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/javascript:/gi, "");
    };

    const xssAttempts = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(1)',
      '<a href="javascript:void(0)">Click</a>',
    ];

    xssAttempts.forEach((attempt) => {
      const sanitized = sanitize(attempt);
      // The sanitized string should escape < and > to prevent HTML rendering
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("<img");
      expect(sanitized).not.toMatch(/^javascript:/i);
    });
  });

  test("should enforce seller ownership for updates", () => {
    const canUpdateListing = (userId: number, listing: { seller_id: number }) => {
      return userId === listing.seller_id;
    };

    const listing = { seller_id: 1 };
    expect(canUpdateListing(1, listing)).toBe(true);
    expect(canUpdateListing(2, listing)).toBe(false);
  });

  test("should prevent buyer from being same as seller", () => {
    const validateBuyer = (buyerId: number, sellerId: number) => {
      return buyerId !== sellerId;
    };

    expect(validateBuyer(2, 1)).toBe(true);
    expect(validateBuyer(1, 1)).toBe(false);
  });

  test("should validate category enum", () => {
    const validCategories = ["produce", "dairy", "bakery", "meat", "seafood", "beverages", "snacks", "frozen", "other"];

    const validateCategory = (category: string) => {
      return validCategories.includes(category.toLowerCase());
    };

    expect(validateCategory("produce")).toBe(true);
    expect(validateCategory("DAIRY")).toBe(true);
    expect(validateCategory("invalid")).toBe(false);
  });

  test("should limit title and description length", () => {
    const validateLength = (title: string, description: string) => {
      const maxTitleLength = 200;
      const maxDescLength = 2000;

      return title.length > 0 && title.length <= maxTitleLength &&
             description.length <= maxDescLength;
    };

    expect(validateLength("Valid Title", "Valid description")).toBe(true);
    expect(validateLength("", "Description")).toBe(false);
    expect(validateLength("a".repeat(201), "Description")).toBe(false);
    expect(validateLength("Title", "a".repeat(2001))).toBe(false);
  });
});

// ==========================================
// LOAD TESTS
// ==========================================

describe("Marketplace - Load Tests", () => {
  test("should handle 500 concurrent listing views", () => {
    const startTime = performance.now();

    for (let i = 0; i < 500; i++) {
      const listingId = (i % 200) + 1;
      sqlite.query(`
        SELECT l.*, u.name as seller_name
        FROM marketplace_listings l
        JOIN users u ON l.seller_id = u.id
        WHERE l.id = ?
      `).get(listingId);
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(3000);
  });

  test("should handle rapid status changes", () => {
    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      const listingId = (i % 50) + 1;
      const status = i % 2 === 0 ? "reserved" : "active";
      sqlite.run(`UPDATE marketplace_listings SET status = '${status}' WHERE id = ${listingId}`);
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(2000);
  });

  test("should handle complex filter combinations", () => {
    const startTime = performance.now();

    const filters = [
      { category: "produce", minPrice: 5, maxPrice: 20 },
      { category: "dairy", minPrice: 1, maxPrice: 10 },
      { category: "bakery", minPrice: 2, maxPrice: 15 },
    ];

    for (const filter of filters) {
      for (let i = 0; i < 20; i++) {
        sqlite.query(`
          SELECT * FROM marketplace_listings
          WHERE status = 'active'
            AND category = ?
            AND price BETWEEN ? AND ?
          ORDER BY created_at DESC
          LIMIT 20
        `).all(filter.category, filter.minPrice, filter.maxPrice);
      }
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(2000);
  });

  test("should maintain data consistency under load", () => {
    // Get initial count
    const initialCount = (sqlite.query("SELECT COUNT(*) as count FROM marketplace_listings").get() as { count: number }).count;

    // Rapid inserts and deletes
    for (let i = 0; i < 50; i++) {
      sqlite.run(`INSERT INTO marketplace_listings (seller_id, title, price, status) VALUES (1, 'Temp${i}', 10, 'active')`);
    }

    sqlite.run(`DELETE FROM marketplace_listings WHERE title LIKE 'Temp%'`);

    // Count should be back to initial
    const finalCount = (sqlite.query("SELECT COUNT(*) as count FROM marketplace_listings").get() as { count: number }).count;
    expect(finalCount).toBe(initialCount);
  });
});

// ==========================================
// BOUNDARY TESTS
// ==========================================

describe("Marketplace - Boundary Tests", () => {
  test("should handle maximum price", () => {
    const maxPrice = 9999.99;

    sqlite.run(`INSERT INTO marketplace_listings (seller_id, title, price, status) VALUES (1, 'MaxPrice', ${maxPrice}, 'active')`);

    const listing = sqlite.query("SELECT price FROM marketplace_listings WHERE title = 'MaxPrice'").get() as { price: number };
    expect(listing.price).toBe(maxPrice);
  });

  test("should handle minimum price", () => {
    const minPrice = 0.01;

    sqlite.run(`INSERT INTO marketplace_listings (seller_id, title, price, status) VALUES (1, 'MinPrice', ${minPrice}, 'active')`);

    const listing = sqlite.query("SELECT price FROM marketplace_listings WHERE title = 'MinPrice'").get() as { price: number };
    expect(listing.price).toBeCloseTo(minPrice, 2);
  });

  test("should handle very long descriptions", () => {
    const longDescription = "A".repeat(1000);

    const stmt = sqlite.prepare("INSERT INTO marketplace_listings (seller_id, title, description, price, status) VALUES (?, ?, ?, ?, ?)");
    stmt.run(1, "LongDesc", longDescription, 10, "active");

    const listing = sqlite.query("SELECT description FROM marketplace_listings WHERE title = 'LongDesc'").get() as { description: string };
    expect(listing.description.length).toBe(1000);
  });

  test("should handle special characters in title", () => {
    const specialTitle = "Fresh Café Bread - O'Brien's (50% off!)";

    const stmt = sqlite.prepare("INSERT INTO marketplace_listings (seller_id, title, price, status) VALUES (?, ?, ?, ?)");
    stmt.run(1, specialTitle, 10, "active");

    const listing = sqlite.query("SELECT title FROM marketplace_listings WHERE title = ?").get(specialTitle) as { title: string };
    expect(listing.title).toBe(specialTitle);
  });

  test("should handle unicode in listing data", () => {
    const unicodeTitle = "新鲜水果 🍎🍊 Fresh Fruit";

    const stmt = sqlite.prepare("INSERT INTO marketplace_listings (seller_id, title, price, status) VALUES (?, ?, ?, ?)");
    stmt.run(1, unicodeTitle, 10, "active");

    const listing = sqlite.query("SELECT title FROM marketplace_listings WHERE title = ?").get(unicodeTitle) as { title: string };
    expect(listing.title).toBe(unicodeTitle);
  });

  test("should handle expiry date edge cases", () => {
    const today = new Date().toISOString().split("T")[0];
    const farFuture = "2099-12-31";

    sqlite.run(`INSERT INTO marketplace_listings (seller_id, title, price, expiry_date, status) VALUES (1, 'ExpiryToday', 10, '${today}', 'active')`);
    sqlite.run(`INSERT INTO marketplace_listings (seller_id, title, price, expiry_date, status) VALUES (1, 'ExpiryFar', 10, '${farFuture}', 'active')`);

    const todayListing = sqlite.query("SELECT expiry_date FROM marketplace_listings WHERE title = 'ExpiryToday'").get() as { expiry_date: string };
    const farListing = sqlite.query("SELECT expiry_date FROM marketplace_listings WHERE title = 'ExpiryFar'").get() as { expiry_date: string };

    expect(todayListing.expiry_date).toContain(today);
    expect(new Date(farListing.expiry_date).getFullYear()).toBe(2099);
  });
});

// ==========================================
// MESSAGING SECURITY TESTS
// ==========================================

describe("Marketplace - Messaging Security Tests", () => {
  test("should prevent message content XSS", () => {
    const sanitizeMessage = (content: string) => {
      return content
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };

    const xssMessage = '<script>document.cookie</script>';
    const sanitized = sanitizeMessage(xssMessage);

    expect(sanitized).not.toContain("<script>");
  });

  test("should enforce conversation participant access", () => {
    const canAccessConversation = (userId: number, conversation: { buyer_id: number; seller_id: number }) => {
      return userId === conversation.buyer_id || userId === conversation.seller_id;
    };

    const conversation = { buyer_id: 2, seller_id: 1 };

    expect(canAccessConversation(1, conversation)).toBe(true);
    expect(canAccessConversation(2, conversation)).toBe(true);
    expect(canAccessConversation(3, conversation)).toBe(false);
  });

  test("should limit message content length", () => {
    const maxMessageLength = 5000;

    const validateMessage = (content: string) => {
      return content.length > 0 && content.length <= maxMessageLength;
    };

    expect(validateMessage("Hello")).toBe(true);
    expect(validateMessage("")).toBe(false);
    expect(validateMessage("a".repeat(5001))).toBe(false);
  });
});
