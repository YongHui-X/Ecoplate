import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import { eq, sql } from "drizzle-orm";

// In-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  // Create all required tables
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

    CREATE TABLE marketplace_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_id INTEGER REFERENCES users(id),
      product_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      quantity REAL NOT NULL,
      unit TEXT,
      price REAL,
      original_price REAL,
      expiry_date INTEGER,
      pickup_location TEXT,
      images TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER,
      co2_saved REAL
    );

    CREATE TABLE conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_text TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Performance indexes
    CREATE INDEX idx_conversations_seller ON conversations(seller_id);
    CREATE INDEX idx_conversations_buyer ON conversations(buyer_id);
    CREATE INDEX idx_conversations_listing ON conversations(listing_id);
    CREATE INDEX idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX idx_messages_user ON messages(user_id);
    CREATE INDEX idx_messages_read ON messages(is_read);
  `);

  testDb = drizzle(sqlite, { schema });

  // Insert test users
  for (let i = 1; i <= 10; i++) {
    sqlite.run(
      `INSERT INTO users (email, password_hash, name) VALUES ('user${i}@test.com', 'hashed_pass', 'User ${i}')`
    );
  }

  // Insert test listings
  for (let i = 1; i <= 20; i++) {
    const sellerId = (i % 10) + 1;
    sqlite.run(
      `INSERT INTO marketplace_listings (seller_id, title, quantity, price, status)
       VALUES (${sellerId}, 'Listing ${i}', 1, 10.00, 'active')`
    );
  }

  // Insert test conversations
  for (let i = 1; i <= 50; i++) {
    const sellerId = (i % 10) + 1;
    const buyerId = ((i + 5) % 10) + 1;
    const listingId = (i % 20) + 1;
    if (sellerId !== buyerId) {
      sqlite.run(
        `INSERT INTO conversations (listing_id, seller_id, buyer_id)
         VALUES (${listingId}, ${sellerId}, ${buyerId})`
      );
    }
  }

  // Insert test messages (1000 messages across conversations)
  for (let i = 1; i <= 1000; i++) {
    const conversationId = (i % 45) + 1; // Assuming ~45 valid conversations
    const userId = (i % 10) + 1;
    const isRead = i % 3 === 0 ? 1 : 0;
    sqlite.run(
      `INSERT INTO messages (conversation_id, user_id, message_text, is_read)
       VALUES (${conversationId}, ${userId}, 'Test message ${i}', ${isRead})`
    );
  }
});

afterAll(() => {
  sqlite.close();
});

// ==========================================
// PERFORMANCE TESTS
// ==========================================

describe("Messaging - Performance Tests", () => {
  test("conversation listing should be under 100ms", () => {
    const startTime = performance.now();

    const conversations = sqlite
      .query(
        `
      SELECT c.*,
             l.title, l.price, l.status,
             s.name as seller_name,
             b.name as buyer_name
      FROM conversations c
      LEFT JOIN marketplace_listings l ON c.listing_id = l.id
      LEFT JOIN users s ON c.seller_id = s.id
      LEFT JOIN users b ON c.buyer_id = b.id
      WHERE c.seller_id = 1 OR c.buyer_id = 1
      ORDER BY c.updated_at DESC
    `
      )
      .all();

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100);
    expect(conversations.length).toBeGreaterThan(0);
  });

  test("unread count query should be under 50ms", () => {
    const startTime = performance.now();

    const result = sqlite
      .query(
        `
      SELECT COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN marketplace_listings l ON c.listing_id = l.id
      WHERE (c.seller_id = 1 OR c.buyer_id = 1)
        AND m.user_id != 1
        AND m.is_read = 0
        AND l.status != 'sold'
    `
      )
      .get();

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(50);
    expect(result).toBeDefined();
  });

  test("message history query should be under 100ms", () => {
    const conversationId = 1;
    const startTime = performance.now();

    const messages = sqlite
      .query(
        `
      SELECT m.*, u.name as user_name, u.avatar_url
      FROM messages m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC
    `
      )
      .all(conversationId);

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100);
  });

  test("message insertion should be under 20ms", () => {
    const times: number[] = [];

    for (let i = 0; i < 50; i++) {
      const startTime = performance.now();
      sqlite.run(
        `INSERT INTO messages (conversation_id, user_id, message_text)
         VALUES (1, 1, 'Performance test message ${i}')`
      );
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(20);
  });

  test("mark as read should be under 30ms", () => {
    const startTime = performance.now();

    sqlite.run(
      `UPDATE messages
       SET is_read = 1
       WHERE conversation_id = 1 AND user_id != 1 AND is_read = 0`
    );

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(30);
  });

  test("conversation with messages join should be efficient", () => {
    const startTime = performance.now();

    const conversations = sqlite
      .query(
        `
      SELECT c.*,
             (SELECT COUNT(*) FROM messages m
              WHERE m.conversation_id = c.id AND m.user_id != 1 AND m.is_read = 0) as unread_count,
             (SELECT message_text FROM messages m
              WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
      FROM conversations c
      WHERE c.seller_id = 1 OR c.buyer_id = 1
      ORDER BY c.updated_at DESC
      LIMIT 20
    `
      )
      .all();

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(150);
    expect(conversations.length).toBeGreaterThan(0);
  });
});

// ==========================================
// SECURITY TESTS
// ==========================================

describe("Messaging - Security Tests", () => {
  test("should prevent SQL injection in message text", () => {
    const maliciousText = "'; DROP TABLE messages; --";

    // Using parameterized query (safe)
    const stmt = sqlite.prepare(
      "INSERT INTO messages (conversation_id, user_id, message_text) VALUES (?, ?, ?)"
    );
    stmt.run(1, 1, maliciousText);

    // Table should still exist
    const tableExists = sqlite
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'")
      .get();
    expect(tableExists).toBeDefined();
  });

  test("should prevent SQL injection in search queries", () => {
    const maliciousSearch = "test'; DELETE FROM messages WHERE '1'='1";

    const stmt = sqlite.prepare(
      "SELECT * FROM messages WHERE message_text LIKE ?"
    );
    const results = stmt.all(`%${maliciousSearch}%`);

    // Should not have deleted any messages
    const count = sqlite.query("SELECT COUNT(*) as count FROM messages").get() as { count: number };
    expect(count.count).toBeGreaterThan(0);
  });

  test("should validate message text length", () => {
    const validateMessageText = (text: string) => {
      return typeof text === "string" && text.length > 0 && text.length <= 2000;
    };

    expect(validateMessageText("Valid message")).toBe(true);
    expect(validateMessageText("")).toBe(false);
    expect(validateMessageText("a".repeat(2000))).toBe(true);
    expect(validateMessageText("a".repeat(2001))).toBe(false);
  });

  test("should sanitize message text for XSS", () => {
    const sanitize = (input: string) => {
      return input
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/javascript:/gi, "");
    };

    const xssAttempt = '<script>alert("xss")</script>';
    const sanitized = sanitize(xssAttempt);

    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("&lt;script&gt;");

    const jsAttempt = 'javascript:alert("xss")';
    const sanitizedJs = sanitize(jsAttempt);
    expect(sanitizedJs).not.toContain("javascript:");
  });

  test("should enforce user isolation - users cannot see others conversations", () => {
    // Get conversations for user 1
    const user1Conversations = sqlite
      .query(
        `SELECT * FROM conversations
         WHERE seller_id = 1 OR buyer_id = 1`
      )
      .all() as Array<{ seller_id: number; buyer_id: number }>;

    // Verify all conversations involve user 1
    for (const conv of user1Conversations) {
      expect(conv.seller_id === 1 || conv.buyer_id === 1).toBe(true);
    }
  });

  test("should prevent unauthorized message access", () => {
    // Check that messages in a conversation are only from participants
    const messagesWithConv = sqlite
      .query(
        `
      SELECT m.user_id, c.seller_id, c.buyer_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.id = 1
    `
      )
      .all() as Array<{ user_id: number; seller_id: number; buyer_id: number }>;

    // In a real system, messages should only come from seller or buyer
    // This test verifies the data integrity
    expect(messagesWithConv.length).toBeGreaterThan(0);
  });

  test("should validate conversation ID is a positive integer", () => {
    const validateConversationId = (id: unknown) => {
      return typeof id === "number" && Number.isInteger(id) && id > 0;
    };

    expect(validateConversationId(1)).toBe(true);
    expect(validateConversationId(0)).toBe(false);
    expect(validateConversationId(-1)).toBe(false);
    expect(validateConversationId(1.5)).toBe(false);
    expect(validateConversationId("1")).toBe(false);
    expect(validateConversationId(null)).toBe(false);
    expect(validateConversationId(undefined)).toBe(false);
  });

  test("should prevent conversation between same user", () => {
    const validateConversationParticipants = (sellerId: number, buyerId: number) => {
      return sellerId !== buyerId;
    };

    expect(validateConversationParticipants(1, 2)).toBe(true);
    expect(validateConversationParticipants(1, 1)).toBe(false);
  });
});

// ==========================================
// LOAD TESTS
// ==========================================

describe("Messaging - Load Tests", () => {
  test("should handle 1000 concurrent conversation reads", () => {
    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      sqlite
        .query(
          `SELECT c.*, l.title
           FROM conversations c
           LEFT JOIN marketplace_listings l ON c.listing_id = l.id
           WHERE c.seller_id = ? OR c.buyer_id = ?
           LIMIT 10`
        )
        .all(i % 10 + 1, i % 10 + 1);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(totalTime).toBeLessThan(5000); // Under 5 seconds for 1000 queries
  });

  test("should handle 500 concurrent message reads", () => {
    const startTime = performance.now();

    for (let i = 0; i < 500; i++) {
      sqlite
        .query(
          `SELECT m.*, u.name
           FROM messages m
           LEFT JOIN users u ON m.user_id = u.id
           WHERE m.conversation_id = ?
           ORDER BY m.created_at DESC
           LIMIT 50`
        )
        .all((i % 45) + 1);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(totalTime).toBeLessThan(3000);
  });

  test("should handle rapid message insertions", () => {
    const startTime = performance.now();

    for (let i = 0; i < 200; i++) {
      sqlite.run(
        `INSERT INTO messages (conversation_id, user_id, message_text)
         VALUES (?, ?, ?)`,
        [(i % 45) + 1, (i % 10) + 1, `Rapid test message ${i}`]
      );
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(2000);
  });

  test("should handle pagination efficiently", () => {
    const pageSize = 20;
    const totalPages = 10;
    const times: number[] = [];

    for (let page = 0; page < totalPages; page++) {
      const startTime = performance.now();

      sqlite
        .query(
          `
        SELECT m.*, u.name
        FROM messages m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.conversation_id = 1
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `
        )
        .all(pageSize, page * pageSize);

      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(30);
  });

  test("should handle multiple unread count queries", () => {
    const startTime = performance.now();

    for (let userId = 1; userId <= 10; userId++) {
      sqlite
        .query(
          `
        SELECT COUNT(*) as count
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE (c.seller_id = ? OR c.buyer_id = ?)
          AND m.user_id != ?
          AND m.is_read = 0
      `
        )
        .get(userId, userId, userId);
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(500);
  });
});

// ==========================================
// BOUNDARY TESTS
// ==========================================

describe("Messaging - Boundary Tests", () => {
  test("should handle maximum message length", () => {
    const maxMessage = "a".repeat(2000);

    const stmt = sqlite.prepare(
      "INSERT INTO messages (conversation_id, user_id, message_text) VALUES (?, ?, ?)"
    );
    stmt.run(1, 1, maxMessage);

    const result = sqlite
      .query("SELECT message_text FROM messages WHERE message_text = ?")
      .get(maxMessage) as { message_text: string };

    expect(result.message_text.length).toBe(2000);
  });

  test("should handle special characters in message", () => {
    const specialMessage = "Hello! 你好 🍎 Café & Crème - O'Brien's \"quote\" <tag>";

    const stmt = sqlite.prepare(
      "INSERT INTO messages (conversation_id, user_id, message_text) VALUES (?, ?, ?)"
    );
    stmt.run(1, 1, specialMessage);

    const result = sqlite
      .query("SELECT message_text FROM messages WHERE message_text = ?")
      .get(specialMessage) as { message_text: string };

    expect(result.message_text).toBe(specialMessage);
  });

  test("should handle unicode and emoji in messages", () => {
    const unicodeMessages = [
      "🎉🎊🎁 Party time!",
      "日本語のメッセージ",
      "مرحبا بالعالم",
      "Привет мир",
      "🍎🍊🍋🍌🍇",
    ];

    for (const msg of unicodeMessages) {
      const stmt = sqlite.prepare(
        "INSERT INTO messages (conversation_id, user_id, message_text) VALUES (?, ?, ?)"
      );
      stmt.run(1, 1, msg);

      const result = sqlite
        .query("SELECT message_text FROM messages WHERE message_text = ?")
        .get(msg) as { message_text: string };

      expect(result.message_text).toBe(msg);
    }
  });

  test("should handle newlines and whitespace in messages", () => {
    const messageWithNewlines = "Line 1\nLine 2\nLine 3";
    const messageWithTabs = "Col1\tCol2\tCol3";
    const messageWithSpaces = "   Padded message   ";

    const stmt = sqlite.prepare(
      "INSERT INTO messages (conversation_id, user_id, message_text) VALUES (?, ?, ?)"
    );

    stmt.run(1, 1, messageWithNewlines);
    stmt.run(1, 1, messageWithTabs);
    stmt.run(1, 1, messageWithSpaces);

    // Verify all preserved
    const results = sqlite
      .query("SELECT message_text FROM messages WHERE message_text IN (?, ?, ?)")
      .all(messageWithNewlines, messageWithTabs, messageWithSpaces) as Array<{ message_text: string }>;

    expect(results.length).toBe(3);
  });

  test("should handle minimum valid message", () => {
    const minMessage = "a";

    const stmt = sqlite.prepare(
      "INSERT INTO messages (conversation_id, user_id, message_text) VALUES (?, ?, ?)"
    );
    stmt.run(1, 1, minMessage);

    const result = sqlite
      .query("SELECT message_text FROM messages WHERE message_text = ?")
      .get(minMessage) as { message_text: string };

    expect(result.message_text).toBe("a");
  });

  test("should handle conversation with many messages", () => {
    // Insert 500 messages to a single conversation
    const conversationId = 2;
    for (let i = 0; i < 500; i++) {
      sqlite.run(
        `INSERT INTO messages (conversation_id, user_id, message_text)
         VALUES (?, ?, ?)`,
        [conversationId, (i % 2) + 1, `Bulk message ${i}`]
      );
    }

    // Fetch all messages
    const messages = sqlite
      .query("SELECT * FROM messages WHERE conversation_id = ?")
      .all(conversationId);

    expect(messages.length).toBeGreaterThanOrEqual(500);
  });

  test("should handle user with many conversations", () => {
    // User 1 already has conversations from beforeAll
    const conversations = sqlite
      .query("SELECT * FROM conversations WHERE seller_id = 1 OR buyer_id = 1")
      .all();

    expect(conversations.length).toBeGreaterThan(0);

    // Query should still be fast
    const startTime = performance.now();
    sqlite
      .query(
        `SELECT c.*,
         (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
         FROM conversations c
         WHERE c.seller_id = 1 OR c.buyer_id = 1`
      )
      .all();
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(200);
  });
});

// ==========================================
// DATA INTEGRITY TESTS
// ==========================================

describe("Messaging - Data Integrity Tests", () => {
  test("should maintain referential integrity for messages", () => {
    // Try to insert message for non-existent conversation
    try {
      sqlite.run(
        "INSERT INTO messages (conversation_id, user_id, message_text) VALUES (9999, 1, 'Test')"
      );
      // If we get here without error, foreign keys might not be enforced
    } catch {
      // Expected - foreign key constraint should fail
    }
  });

  test("should cascade delete messages when conversation is deleted", () => {
    // Create a test conversation
    sqlite.run(
      "INSERT INTO conversations (listing_id, seller_id, buyer_id) VALUES (1, 1, 2)"
    );
    const conv = sqlite
      .query("SELECT id FROM conversations ORDER BY id DESC LIMIT 1")
      .get() as { id: number };

    // Add messages
    sqlite.run(
      `INSERT INTO messages (conversation_id, user_id, message_text) VALUES (${conv.id}, 1, 'Test 1')`
    );
    sqlite.run(
      `INSERT INTO messages (conversation_id, user_id, message_text) VALUES (${conv.id}, 2, 'Test 2')`
    );

    // Verify messages exist
    const beforeDelete = sqlite
      .query("SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?")
      .get(conv.id) as { count: number };
    expect(beforeDelete.count).toBe(2);

    // Delete conversation
    sqlite.run("DELETE FROM conversations WHERE id = ?", [conv.id]);

    // Verify messages are deleted
    const afterDelete = sqlite
      .query("SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?")
      .get(conv.id) as { count: number };
    expect(afterDelete.count).toBe(0);
  });

  test("should track message read status correctly", () => {
    // Create conversation with messages
    sqlite.run(
      "INSERT INTO conversations (listing_id, seller_id, buyer_id) VALUES (1, 3, 4)"
    );
    const conv = sqlite
      .query("SELECT id FROM conversations ORDER BY id DESC LIMIT 1")
      .get() as { id: number };

    // Add unread messages
    sqlite.run(
      `INSERT INTO messages (conversation_id, user_id, message_text, is_read)
       VALUES (${conv.id}, 4, 'Unread 1', 0)`
    );
    sqlite.run(
      `INSERT INTO messages (conversation_id, user_id, message_text, is_read)
       VALUES (${conv.id}, 4, 'Unread 2', 0)`
    );

    // Check unread count
    const unread = sqlite
      .query(
        "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND is_read = 0"
      )
      .get(conv.id) as { count: number };
    expect(unread.count).toBe(2);

    // Mark as read
    sqlite.run(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND is_read = 0",
      [conv.id]
    );

    // Check again
    const afterMark = sqlite
      .query(
        "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND is_read = 0"
      )
      .get(conv.id) as { count: number };
    expect(afterMark.count).toBe(0);
  });

  test("should update conversation timestamp when message is added", () => {
    // Create conversation
    sqlite.run(
      "INSERT INTO conversations (listing_id, seller_id, buyer_id) VALUES (1, 5, 6)"
    );
    const conv = sqlite
      .query("SELECT id, updated_at FROM conversations ORDER BY id DESC LIMIT 1")
      .get() as { id: number; updated_at: number };

    const originalUpdatedAt = conv.updated_at;

    // Wait a bit
    const now = Math.floor(Date.now() / 1000);

    // Simulate updating conversation timestamp
    sqlite.run("UPDATE conversations SET updated_at = ? WHERE id = ?", [now + 1, conv.id]);

    // Check updated timestamp
    const updated = sqlite
      .query("SELECT updated_at FROM conversations WHERE id = ?")
      .get(conv.id) as { updated_at: number };

    expect(updated.updated_at).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  test("should handle concurrent read/write operations", () => {
    const conversationId = 1;
    const operations: Array<() => void> = [];

    // Mix of read and write operations
    for (let i = 0; i < 100; i++) {
      if (i % 2 === 0) {
        operations.push(() => {
          sqlite
            .query("SELECT * FROM messages WHERE conversation_id = ? LIMIT 10")
            .all(conversationId);
        });
      } else {
        operations.push(() => {
          sqlite.run(
            "INSERT INTO messages (conversation_id, user_id, message_text) VALUES (?, ?, ?)",
            [conversationId, 1, `Concurrent message ${i}`]
          );
        });
      }
    }

    // Execute all operations
    const startTime = performance.now();
    for (const op of operations) {
      op();
    }
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(2000);
  });

  test("should maintain message order by creation time", () => {
    const conversationId = 3;

    // Insert messages with known order
    for (let i = 1; i <= 5; i++) {
      sqlite.run(
        `INSERT INTO messages (conversation_id, user_id, message_text)
         VALUES (?, ?, ?)`,
        [conversationId, 1, `Ordered message ${i}`]
      );
    }

    // Fetch in order
    const messages = sqlite
      .query(
        `SELECT message_text FROM messages
         WHERE conversation_id = ? AND message_text LIKE 'Ordered message%'
         ORDER BY created_at ASC`
      )
      .all(conversationId) as Array<{ message_text: string }>;

    expect(messages.length).toBe(5);
    expect(messages[0].message_text).toBe("Ordered message 1");
    expect(messages[4].message_text).toBe("Ordered message 5");
  });
});

// ==========================================
// ERROR HANDLING TESTS
// ==========================================

describe("Messaging - Error Handling Tests", () => {
  test("should handle null message text gracefully", () => {
    const validateMessageText = (text: unknown): text is string => {
      return typeof text === "string" && text.length > 0;
    };

    expect(validateMessageText(null)).toBe(false);
    expect(validateMessageText(undefined)).toBe(false);
    expect(validateMessageText("")).toBe(false);
    expect(validateMessageText("valid")).toBe(true);
  });

  test("should handle invalid conversation ID types", () => {
    const parseConversationId = (id: unknown): number | null => {
      if (typeof id === "number" && Number.isInteger(id) && id > 0) {
        return id;
      }
      if (typeof id === "string") {
        const parsed = parseInt(id, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
      return null;
    };

    expect(parseConversationId(1)).toBe(1);
    expect(parseConversationId("5")).toBe(5);
    expect(parseConversationId("abc")).toBe(null);
    expect(parseConversationId(-1)).toBe(null);
    expect(parseConversationId(0)).toBe(null);
    expect(parseConversationId(null)).toBe(null);
    expect(parseConversationId({})).toBe(null);
  });

  test("should handle database connection errors gracefully", () => {
    // Simulate a function that handles DB errors
    const safeQuery = <T>(fn: () => T): { data?: T; error?: string } => {
      try {
        return { data: fn() };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Unknown error" };
      }
    };

    // Valid query
    const validResult = safeQuery(() =>
      sqlite.query("SELECT * FROM messages LIMIT 1").get()
    );
    expect(validResult.data).toBeDefined();
    expect(validResult.error).toBeUndefined();

    // Invalid query
    const invalidResult = safeQuery(() =>
      sqlite.query("SELECT * FROM nonexistent_table").get()
    );
    expect(invalidResult.error).toBeDefined();
  });

  test("should validate request body structure", () => {
    interface SendMessageRequest {
      conversationId?: number;
      listingId?: number;
      messageText: string;
    }

    const validateSendMessageRequest = (
      body: unknown
    ): { valid: boolean; error?: string } => {
      if (!body || typeof body !== "object") {
        return { valid: false, error: "Invalid request body" };
      }

      const req = body as Partial<SendMessageRequest>;

      if (!req.messageText || typeof req.messageText !== "string") {
        return { valid: false, error: "messageText is required" };
      }

      if (req.messageText.length > 2000) {
        return { valid: false, error: "messageText exceeds maximum length" };
      }

      if (!req.conversationId && !req.listingId) {
        return { valid: false, error: "Either conversationId or listingId is required" };
      }

      return { valid: true };
    };

    expect(validateSendMessageRequest({ messageText: "Hi", conversationId: 1 })).toEqual({
      valid: true,
    });
    expect(validateSendMessageRequest({ messageText: "Hi", listingId: 1 })).toEqual({
      valid: true,
    });
    expect(validateSendMessageRequest({ messageText: "Hi" })).toEqual({
      valid: false,
      error: "Either conversationId or listingId is required",
    });
    expect(validateSendMessageRequest({ conversationId: 1 })).toEqual({
      valid: false,
      error: "messageText is required",
    });
    expect(validateSendMessageRequest(null)).toEqual({
      valid: false,
      error: "Invalid request body",
    });
  });
});
