import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Router, json, error, parseBody } from "../../utils/router";
import * as schema from "../../db/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { z } from "zod";

// Set up in-memory test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

// Test user tokens
const mockTokens = new Map<number, string>();

// Mock auth
const mockVerifyRequestAuth = async (req: Request): Promise<{ sub: string; email: string; name: string } | null> => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const match = token.match(/^token_(\d+)_(.+)$/);
  if (!match) return null;
  return { sub: match[1], email: match[2], name: "Test User" };
};

const getUser = async (req: Request): Promise<{ id: number; email: string; name: string }> => {
  const payload = await mockVerifyRequestAuth(req);
  if (!payload) throw new Error("Unauthorized");
  return { id: parseInt(payload.sub, 10), email: payload.email, name: payload.name };
};

// Schemas
const sendMessageSchema = z.object({
  conversationId: z.number().optional(),
  listingId: z.number().optional(),
  messageText: z.string().min(1).max(2000),
});

const markReadSchema = z.object({
  conversationId: z.number(),
});

// Register routes with test database
function registerTestMessageRoutes(router: Router, db: ReturnType<typeof drizzle<typeof schema>>) {
  // Get all conversations for the current user
  router.get("/api/v1/marketplace/conversations", async (req) => {
    try {
      const user = await getUser(req);

      const userConversations = await db.query.conversations.findMany({
        where: or(
          eq(schema.conversations.sellerId, user.id),
          eq(schema.conversations.buyerId, user.id)
        ),
        with: {
          listing: {
            columns: { id: true, title: true, price: true, images: true, status: true },
          },
          seller: {
            columns: { id: true, name: true, avatarUrl: true },
          },
          buyer: {
            columns: { id: true, name: true, avatarUrl: true },
          },
          messages: {
            orderBy: [desc(schema.messages.createdAt)],
            limit: 1,
            with: {
              user: {
                columns: { id: true, name: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy: [desc(schema.conversations.updatedAt)],
      });

      const response = await Promise.all(
        userConversations.map(async (conv) => {
          const isArchived = conv.listing?.status === "sold";

          let unreadCount = 0;
          if (!isArchived) {
            const unreadResult = await db
              .select({ count: sql<number>`count(*)` })
              .from(schema.messages)
              .where(
                and(
                  eq(schema.messages.conversationId, conv.id),
                  sql`${schema.messages.userId} != ${user.id}`,
                  eq(schema.messages.isRead, false)
                )
              );
            unreadCount = unreadResult[0]?.count ?? 0;
          }

          const lastMessage = conv.messages[0] ?? null;
          const isSeller = conv.sellerId === user.id;

          const listingWithStatus = conv.listing ? {
            ...conv.listing,
            status: conv.listing.status === "sold" ? "completed" : conv.listing.status,
          } : null;

          return {
            id: conv.id,
            listingId: conv.listingId,
            listing: listingWithStatus,
            seller: conv.seller,
            buyer: conv.buyer,
            role: isSeller ? "selling" : "buying",
            lastMessage: lastMessage
              ? {
                  id: lastMessage.id,
                  conversationId: lastMessage.conversationId,
                  userId: lastMessage.userId,
                  messageText: lastMessage.messageText,
                  isRead: lastMessage.isRead,
                  createdAt: lastMessage.createdAt.toISOString(),
                  user: lastMessage.user,
                }
              : null,
            unreadCount,
            updatedAt: conv.updatedAt.toISOString(),
          };
        })
      );

      return json(response);
    } catch (e) {
      if (e instanceof Error && e.message === "Unauthorized") {
        return error("Unauthorized", 401);
      }
      console.error("Get conversations error:", e);
      return error("Failed to fetch conversations", 500);
    }
  });

  // Get unread message count
  router.get("/api/v1/marketplace/messages/unread-count", async (req) => {
    try {
      const user = await getUser(req);

      const userConversations = await db.query.conversations.findMany({
        where: or(
          eq(schema.conversations.sellerId, user.id),
          eq(schema.conversations.buyerId, user.id)
        ),
        columns: { id: true },
        with: {
          listing: {
            columns: { status: true },
          },
        },
      });

      const activeConversations = userConversations.filter(
        (c) => c.listing?.status !== "sold"
      );

      if (activeConversations.length === 0) {
        return json({ count: 0 });
      }

      const conversationIds = activeConversations.map((c) => c.id);

      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.messages)
        .where(
          and(
            sql`${schema.messages.conversationId} IN (${sql.join(
              conversationIds.map((id) => sql`${id}`),
              sql`, `
            )})`,
            sql`${schema.messages.userId} != ${user.id}`,
            eq(schema.messages.isRead, false)
          )
        );

      return json({ count: result[0]?.count ?? 0 });
    } catch (e) {
      if (e instanceof Error && e.message === "Unauthorized") {
        return error("Unauthorized", 401);
      }
      console.error("Get unread count error:", e);
      return error("Failed to get unread count", 500);
    }
  });

  // Start or get conversation for a listing
  router.get("/api/v1/marketplace/conversations/listing/:listingId", async (req, params) => {
    try {
      const user = await getUser(req);
      const listingId = parseInt(params.listingId, 10);

      if (isNaN(listingId)) {
        return error("Invalid listing ID", 400);
      }

      const listing = await db.query.marketplaceListings.findFirst({
        where: eq(schema.marketplaceListings.id, listingId),
        columns: { id: true, sellerId: true, title: true },
      });

      if (!listing) {
        return error("Listing not found", 404);
      }

      if (listing.sellerId === user.id) {
        return error("Cannot start conversation with yourself", 400);
      }

      // Check for existing conversation
      let conversation = await db.query.conversations.findFirst({
        where: and(
          eq(schema.conversations.listingId, listingId),
          eq(schema.conversations.buyerId, user.id),
          eq(schema.conversations.sellerId, listing.sellerId)
        ),
        with: {
          listing: {
            columns: { id: true, title: true, price: true, images: true, status: true },
          },
          seller: {
            columns: { id: true, name: true, avatarUrl: true },
          },
          buyer: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      if (!conversation) {
        const [created] = await db
          .insert(schema.conversations)
          .values({
            listingId,
            sellerId: listing.sellerId,
            buyerId: user.id,
          })
          .returning();

        conversation = await db.query.conversations.findFirst({
          where: eq(schema.conversations.id, created.id),
          with: {
            listing: {
              columns: { id: true, title: true, price: true, images: true, status: true },
            },
            seller: {
              columns: { id: true, name: true, avatarUrl: true },
            },
            buyer: {
              columns: { id: true, name: true, avatarUrl: true },
            },
          },
        });
      }

      return json({
        id: conversation!.id,
        listingId: conversation!.listingId,
        listing: conversation!.listing,
        seller: conversation!.seller,
        buyer: conversation!.buyer,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "Unauthorized") {
        return error("Unauthorized", 401);
      }
      console.error("Get/create conversation error:", e);
      return error("Failed to get conversation", 500);
    }
  });

  // Get a specific conversation with messages
  router.get("/api/v1/marketplace/conversations/:id", async (req, params) => {
    try {
      const user = await getUser(req);
      const conversationId = parseInt(params.id, 10);

      if (isNaN(conversationId)) {
        return error("Invalid conversation ID", 400);
      }

      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(schema.conversations.id, conversationId),
          or(
            eq(schema.conversations.sellerId, user.id),
            eq(schema.conversations.buyerId, user.id)
          )
        ),
        with: {
          listing: {
            columns: { id: true, title: true, price: true, images: true, status: true },
          },
          seller: {
            columns: { id: true, name: true, avatarUrl: true },
          },
          buyer: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      if (!conversation) {
        return error("Conversation not found", 404);
      }

      const conversationMessages = await db.query.messages.findMany({
        where: eq(schema.messages.conversationId, conversationId),
        with: {
          user: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: [desc(schema.messages.createdAt)],
      });

      // Mark messages as read
      await db
        .update(schema.messages)
        .set({ isRead: true })
        .where(
          and(
            eq(schema.messages.conversationId, conversationId),
            sql`${schema.messages.userId} != ${user.id}`,
            eq(schema.messages.isRead, false)
          )
        );

      const isSeller = conversation.sellerId === user.id;

      const listingWithStatus = conversation.listing ? {
        ...conversation.listing,
        status: conversation.listing.status === "sold" ? "completed" : conversation.listing.status,
      } : null;

      return json({
        id: conversation.id,
        listingId: conversation.listingId,
        listing: listingWithStatus,
        seller: conversation.seller,
        buyer: conversation.buyer,
        role: isSeller ? "selling" : "buying",
        messages: conversationMessages.map((msg) => ({
          id: msg.id,
          conversationId: msg.conversationId,
          userId: msg.userId,
          messageText: msg.messageText,
          isRead: msg.isRead,
          createdAt: msg.createdAt.toISOString(),
          user: msg.user,
        })),
      });
    } catch (e) {
      if (e instanceof Error && e.message === "Unauthorized") {
        return error("Unauthorized", 401);
      }
      console.error("Get conversation error:", e);
      return error("Failed to fetch conversation", 500);
    }
  });

  // Send a message
  router.post("/api/v1/marketplace/messages", async (req) => {
    try {
      const user = await getUser(req);
      const body = await req.json();

      const result = sendMessageSchema.safeParse(body);
      if (!result.success) {
        const firstError = result.error.errors[0];
        return error(`${firstError.path.join(".")}: ${firstError.message}`, 400);
      }

      const { conversationId, listingId, messageText } = result.data;

      if (!conversationId && !listingId) {
        return error("Either conversationId or listingId is required", 400);
      }

      let targetConversationId: number;

      if (conversationId) {
        const conversation = await db.query.conversations.findFirst({
          where: and(
            eq(schema.conversations.id, conversationId),
            or(
              eq(schema.conversations.sellerId, user.id),
              eq(schema.conversations.buyerId, user.id)
            )
          ),
          columns: { id: true },
        });

        if (!conversation) {
          return error("You are not a participant in this conversation", 403);
        }
        targetConversationId = conversationId;
      } else {
        const listing = await db.query.marketplaceListings.findFirst({
          where: eq(schema.marketplaceListings.id, listingId!),
          columns: { id: true, sellerId: true },
        });

        if (!listing) {
          return error("Listing not found", 404);
        }

        if (listing.sellerId === user.id) {
          const existingConv = await db.query.conversations.findFirst({
            where: and(
              eq(schema.conversations.listingId, listingId!),
              eq(schema.conversations.sellerId, user.id)
            ),
            orderBy: [desc(schema.conversations.updatedAt)],
          });

          if (!existingConv) {
            return error("No conversation exists to reply to", 400);
          }
          targetConversationId = existingConv.id;
        } else {
          let conversation = await db.query.conversations.findFirst({
            where: and(
              eq(schema.conversations.listingId, listingId!),
              eq(schema.conversations.buyerId, user.id),
              eq(schema.conversations.sellerId, listing.sellerId)
            ),
          });

          if (!conversation) {
            const [created] = await db
              .insert(schema.conversations)
              .values({
                listingId: listingId!,
                sellerId: listing.sellerId,
                buyerId: user.id,
              })
              .returning();
            targetConversationId = created.id;
          } else {
            targetConversationId = conversation.id;
          }
        }
      }

      const [message] = await db
        .insert(schema.messages)
        .values({
          conversationId: targetConversationId,
          userId: user.id,
          messageText,
        })
        .returning();

      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, targetConversationId));

      const messageWithUser = await db.query.messages.findFirst({
        where: eq(schema.messages.id, message.id),
        with: {
          user: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      return json({
        id: messageWithUser!.id,
        conversationId: messageWithUser!.conversationId,
        userId: messageWithUser!.userId,
        messageText: messageWithUser!.messageText,
        isRead: messageWithUser!.isRead,
        createdAt: messageWithUser!.createdAt.toISOString(),
        user: messageWithUser!.user,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "Unauthorized") {
        return error("Unauthorized", 401);
      }
      console.error("Send message error:", e);
      return error("Failed to send message", 500);
    }
  });

  // Mark messages as read
  router.patch("/api/v1/marketplace/messages/read", async (req) => {
    try {
      const user = await getUser(req);
      const body = await req.json();

      const result = markReadSchema.safeParse(body);
      if (!result.success) {
        const firstError = result.error.errors[0];
        return error(`${firstError.path.join(".")}: ${firstError.message}`, 400);
      }

      const { conversationId } = result.data;

      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(schema.conversations.id, conversationId),
          or(
            eq(schema.conversations.sellerId, user.id),
            eq(schema.conversations.buyerId, user.id)
          )
        ),
        columns: { id: true },
      });

      if (!conversation) {
        return error("You are not a participant in this conversation", 403);
      }

      await db
        .update(schema.messages)
        .set({ isRead: true })
        .where(
          and(
            eq(schema.messages.conversationId, conversationId),
            sql`${schema.messages.userId} != ${user.id}`,
            eq(schema.messages.isRead, false)
          )
        );

      return json({ message: "Messages marked as read" });
    } catch (e) {
      if (e instanceof Error && e.message === "Unauthorized") {
        return error("Unauthorized", 401);
      }
      console.error("Mark read error:", e);
      return error("Failed to mark messages as read", 500);
    }
  });
}

beforeAll(async () => {
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

    CREATE INDEX idx_conversations_seller ON conversations(seller_id);
    CREATE INDEX idx_conversations_buyer ON conversations(buyer_id);
    CREATE INDEX idx_conversations_listing ON conversations(listing_id);
    CREATE INDEX idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX idx_messages_user ON messages(user_id);
  `);

  testDb = drizzle(sqlite, { schema });
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  // Clear tables in order to respect foreign keys
  await testDb.delete(schema.messages);
  await testDb.delete(schema.conversations);
  await testDb.delete(schema.marketplaceListings);
  await testDb.delete(schema.users);
  mockTokens.clear();
});

function createRouter() {
  const router = new Router();
  registerTestMessageRoutes(router, testDb);
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

function generateToken(userId: number, email: string): string {
  return `token_${userId}_${email}`;
}

async function createTestUser(name: string, email: string): Promise<{ id: number; token: string }> {
  const [user] = await testDb
    .insert(schema.users)
    .values({
      email,
      passwordHash: "hashed_password",
      name,
    })
    .returning();

  const token = generateToken(user.id, email);
  mockTokens.set(user.id, token);
  return { id: user.id, token };
}

async function createTestListing(sellerId: number, title: string, status = "active"): Promise<number> {
  const [listing] = await testDb
    .insert(schema.marketplaceListings)
    .values({
      sellerId,
      title,
      quantity: 1,
      price: 10.0,
      status,
    })
    .returning();
  return listing.id;
}

async function createTestConversation(listingId: number, sellerId: number, buyerId: number): Promise<number> {
  const [conv] = await testDb
    .insert(schema.conversations)
    .values({
      listingId,
      sellerId,
      buyerId,
    })
    .returning();
  return conv.id;
}

async function createTestMessage(conversationId: number, userId: number, text: string, isRead = false): Promise<number> {
  const [msg] = await testDb
    .insert(schema.messages)
    .values({
      conversationId,
      userId,
      messageText: text,
      isRead,
    })
    .returning();
  return msg.id;
}

// ==========================================
// GET /conversations TESTS
// ==========================================

describe("GET /api/v1/marketplace/conversations", () => {
  test("returns empty list when user has no conversations", async () => {
    const router = createRouter();
    const { token } = await createTestUser("Test User", "test@test.com");

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations",
      undefined,
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(200);
    expect(res.data).toEqual([]);
  });

  test("returns conversations for seller", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Fresh Apples");
    await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations",
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as Array<{ role: string; listing: { title: string } }>;
    expect(data.length).toBe(1);
    expect(data[0].role).toBe("selling");
    expect(data[0].listing.title).toBe("Fresh Apples");
  });

  test("returns conversations for buyer", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Fresh Oranges");
    await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations",
      undefined,
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as Array<{ role: string }>;
    expect(data.length).toBe(1);
    expect(data[0].role).toBe("buying");
  });

  test("orders conversations by updatedAt descending", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");

    const listing1 = await createTestListing(seller.id, "First Listing");
    const listing2 = await createTestListing(seller.id, "Second Listing");

    const conv1 = await createTestConversation(listing1, seller.id, buyer.id);
    const conv2 = await createTestConversation(listing2, seller.id, buyer.id);

    // Manually update conv2's updatedAt to be later than conv1's
    const futureDate = new Date(Date.now() + 60000);
    await testDb
      .update(schema.conversations)
      .set({ updatedAt: futureDate })
      .where(eq(schema.conversations.id, conv2));

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations",
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as Array<{ id: number }>;
    expect(data.length).toBe(2);
    expect(data[0].id).toBe(conv2); // Most recent first
    expect(data[1].id).toBe(conv1);
  });

  test("includes unread count for active conversations", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    // Buyer sends 2 unread messages to seller
    await createTestMessage(convId, buyer.id, "Message 1", false);
    await createTestMessage(convId, buyer.id, "Message 2", false);

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations",
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as Array<{ unreadCount: number }>;
    expect(data[0].unreadCount).toBe(2);
  });

  test("excludes unread count from archived (sold) conversations", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Sold Item", "sold");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    // Add unread message
    await createTestMessage(convId, buyer.id, "Old message", false);

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations",
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as Array<{ unreadCount: number; listing: { status: string } }>;
    expect(data[0].unreadCount).toBe(0);
    expect(data[0].listing.status).toBe("completed");
  });

  test("returns 401 without authentication", async () => {
    const router = createRouter();

    const res = await makeRequest(router, "GET", "/api/v1/marketplace/conversations");

    expect(res.status).toBe(401);
  });

  test("includes last message in response", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    // Create messages with explicit timestamps to ensure ordering
    const oldDate = new Date(Date.now() - 60000);
    const newDate = new Date(Date.now());

    await testDb.insert(schema.messages).values({
      conversationId: convId,
      userId: buyer.id,
      messageText: "First message",
      isRead: true,
      createdAt: oldDate,
    });
    await testDb.insert(schema.messages).values({
      conversationId: convId,
      userId: buyer.id,
      messageText: "Last message",
      isRead: false,
      createdAt: newDate,
    });

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations",
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as Array<{ lastMessage: { messageText: string } }>;
    expect(data[0].lastMessage.messageText).toBe("Last message");
  });
});

// ==========================================
// GET /messages/unread-count TESTS
// ==========================================

describe("GET /api/v1/marketplace/messages/unread-count", () => {
  test("returns zero when no unread messages", async () => {
    const router = createRouter();
    const { token } = await createTestUser("Test User", "test@test.com");

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/messages/unread-count",
      undefined,
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(200);
    expect((res.data as { count: number }).count).toBe(0);
  });

  test("returns correct unread count", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    // Buyer sends messages
    await createTestMessage(convId, buyer.id, "Unread 1", false);
    await createTestMessage(convId, buyer.id, "Unread 2", false);
    await createTestMessage(convId, buyer.id, "Read", true);

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/messages/unread-count",
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    expect((res.data as { count: number }).count).toBe(2);
  });

  test("excludes messages from archived conversations", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");

    // Active listing
    const activeListing = await createTestListing(seller.id, "Active Listing");
    const activeConv = await createTestConversation(activeListing, seller.id, buyer.id);
    await createTestMessage(activeConv, buyer.id, "Active message", false);

    // Sold listing
    const soldListing = await createTestListing(seller.id, "Sold Listing", "sold");
    const soldConv = await createTestConversation(soldListing, seller.id, buyer.id);
    await createTestMessage(soldConv, buyer.id, "Archived message", false);

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/messages/unread-count",
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    expect((res.data as { count: number }).count).toBe(1);
  });

  test("does not count own messages", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    // Seller's own messages should not count
    await createTestMessage(convId, seller.id, "My own message", false);
    // Buyer's message should count
    await createTestMessage(convId, buyer.id, "Buyer message", false);

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/messages/unread-count",
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    expect((res.data as { count: number }).count).toBe(1);
  });

  test("returns 401 without authentication", async () => {
    const router = createRouter();

    const res = await makeRequest(router, "GET", "/api/v1/marketplace/messages/unread-count");

    expect(res.status).toBe(401);
  });
});

// ==========================================
// GET /conversations/listing/:id TESTS
// ==========================================

describe("GET /api/v1/marketplace/conversations/listing/:listingId", () => {
  test("creates new conversation for buyer", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");

    const res = await makeRequest(
      router,
      "GET",
      `/api/v1/marketplace/conversations/listing/${listingId}`,
      undefined,
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { id: number; listingId: number };
    expect(data.id).toBeDefined();
    expect(data.listingId).toBe(listingId);
  });

  test("returns existing conversation", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const existingConvId = await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "GET",
      `/api/v1/marketplace/conversations/listing/${listingId}`,
      undefined,
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { id: number };
    expect(data.id).toBe(existingConvId);
  });

  test("prevents seller from starting conversation with themselves", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const listingId = await createTestListing(seller.id, "My Own Listing");

    const res = await makeRequest(
      router,
      "GET",
      `/api/v1/marketplace/conversations/listing/${listingId}`,
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toBe("Cannot start conversation with yourself");
  });

  test("returns 404 for non-existent listing", async () => {
    const router = createRouter();
    const buyer = await createTestUser("Buyer", "buyer@test.com");

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations/listing/99999",
      undefined,
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(404);
    expect((res.data as { error: string }).error).toBe("Listing not found");
  });

  test("returns 400 for invalid listing ID", async () => {
    const router = createRouter();
    const buyer = await createTestUser("Buyer", "buyer@test.com");

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations/listing/invalid",
      undefined,
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toBe("Invalid listing ID");
  });

  test("returns 401 without authentication", async () => {
    const router = createRouter();

    const res = await makeRequest(router, "GET", "/api/v1/marketplace/conversations/listing/1");

    expect(res.status).toBe(401);
  });
});

// ==========================================
// GET /conversations/:id TESTS
// ==========================================

describe("GET /api/v1/marketplace/conversations/:id", () => {
  test("returns conversation with all messages", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    await createTestMessage(convId, buyer.id, "Hello!", false);
    await createTestMessage(convId, seller.id, "Hi there!", false);

    const res = await makeRequest(
      router,
      "GET",
      `/api/v1/marketplace/conversations/${convId}`,
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { id: number; messages: Array<{ messageText: string }> };
    expect(data.id).toBe(convId);
    expect(data.messages.length).toBe(2);
  });

  test("auto-marks messages as read when fetching", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    // Buyer sends unread message
    const msgId = await createTestMessage(convId, buyer.id, "Unread message", false);

    // Seller fetches conversation
    await makeRequest(
      router,
      "GET",
      `/api/v1/marketplace/conversations/${convId}`,
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    // Verify message is now read
    const msg = await testDb.query.messages.findFirst({
      where: eq(schema.messages.id, msgId),
    });
    expect(msg?.isRead).toBe(true);
  });

  test("returns 404 for conversation user is not part of", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const stranger = await createTestUser("Stranger", "stranger@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "GET",
      `/api/v1/marketplace/conversations/${convId}`,
      undefined,
      { Authorization: `Bearer ${stranger.token}` }
    );

    expect(res.status).toBe(404);
  });

  test("returns 400 for invalid conversation ID", async () => {
    const router = createRouter();
    const user = await createTestUser("User", "user@test.com");

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations/invalid",
      undefined,
      { Authorization: `Bearer ${user.token}` }
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for non-existent conversation", async () => {
    const router = createRouter();
    const user = await createTestUser("User", "user@test.com");

    const res = await makeRequest(
      router,
      "GET",
      "/api/v1/marketplace/conversations/99999",
      undefined,
      { Authorization: `Bearer ${user.token}` }
    );

    expect(res.status).toBe(404);
  });

  test("includes correct role for seller", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "GET",
      `/api/v1/marketplace/conversations/${convId}`,
      undefined,
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    expect((res.data as { role: string }).role).toBe("selling");
  });

  test("includes correct role for buyer", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "GET",
      `/api/v1/marketplace/conversations/${convId}`,
      undefined,
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(200);
    expect((res.data as { role: string }).role).toBe("buying");
  });
});

// ==========================================
// POST /messages TESTS
// ==========================================

describe("POST /api/v1/marketplace/messages", () => {
  test("sends message via conversationId", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { conversationId: convId, messageText: "Hello seller!" },
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { messageText: string; conversationId: number };
    expect(data.messageText).toBe("Hello seller!");
    expect(data.conversationId).toBe(convId);
  });

  test("sends message via listingId as buyer", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { listingId, messageText: "Is this available?" },
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { messageText: string };
    expect(data.messageText).toBe("Is this available?");
  });

  test("seller can reply via listingId when conversation exists", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { listingId, messageText: "Yes, still available!" },
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);
    const data = res.data as { messageText: string };
    expect(data.messageText).toBe("Yes, still available!");
  });

  test("seller cannot message via listingId without existing conversation", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { listingId, messageText: "Hello?" },
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toBe("No conversation exists to reply to");
  });

  test("returns 400 when neither conversationId nor listingId provided", async () => {
    const router = createRouter();
    const user = await createTestUser("User", "user@test.com");

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { messageText: "Hello" },
      { Authorization: `Bearer ${user.token}` }
    );

    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toBe("Either conversationId or listingId is required");
  });

  test("returns 400 for empty message", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { conversationId: convId, messageText: "" },
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(400);
  });

  test("returns 400 for message exceeding max length", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { conversationId: convId, messageText: "a".repeat(2001) },
      { Authorization: `Bearer ${buyer.token}` }
    );

    expect(res.status).toBe(400);
  });

  test("returns 403 when not participant in conversation", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const stranger = await createTestUser("Stranger", "stranger@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { conversationId: convId, messageText: "I'm not part of this!" },
      { Authorization: `Bearer ${stranger.token}` }
    );

    expect(res.status).toBe(403);
  });

  test("returns 404 for non-existent listing", async () => {
    const router = createRouter();
    const user = await createTestUser("User", "user@test.com");

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { listingId: 99999, messageText: "Hello" },
      { Authorization: `Bearer ${user.token}` }
    );

    expect(res.status).toBe(404);
  });

  test("returns 401 without authentication", async () => {
    const router = createRouter();

    const res = await makeRequest(
      router,
      "POST",
      "/api/v1/marketplace/messages",
      { conversationId: 1, messageText: "Hello" }
    );

    expect(res.status).toBe(401);
  });
});

// ==========================================
// PATCH /messages/read TESTS
// ==========================================

describe("PATCH /api/v1/marketplace/messages/read", () => {
  test("marks messages as read", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    const msgId = await createTestMessage(convId, buyer.id, "Unread message", false);

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/marketplace/messages/read",
      { conversationId: convId },
      { Authorization: `Bearer ${seller.token}` }
    );

    expect(res.status).toBe(200);

    // Verify message is now read
    const msg = await testDb.query.messages.findFirst({
      where: eq(schema.messages.id, msgId),
    });
    expect(msg?.isRead).toBe(true);
  });

  test("returns 403 when not participant", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const stranger = await createTestUser("Stranger", "stranger@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/marketplace/messages/read",
      { conversationId: convId },
      { Authorization: `Bearer ${stranger.token}` }
    );

    expect(res.status).toBe(403);
  });

  test("returns 400 for missing conversationId", async () => {
    const router = createRouter();
    const user = await createTestUser("User", "user@test.com");

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/marketplace/messages/read",
      {},
      { Authorization: `Bearer ${user.token}` }
    );

    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid conversationId type", async () => {
    const router = createRouter();
    const user = await createTestUser("User", "user@test.com");

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/marketplace/messages/read",
      { conversationId: "invalid" },
      { Authorization: `Bearer ${user.token}` }
    );

    expect(res.status).toBe(400);
  });

  test("returns 401 without authentication", async () => {
    const router = createRouter();

    const res = await makeRequest(
      router,
      "PATCH",
      "/api/v1/marketplace/messages/read",
      { conversationId: 1 }
    );

    expect(res.status).toBe(401);
  });

  test("does not mark own messages as read", async () => {
    const router = createRouter();
    const seller = await createTestUser("Seller", "seller@test.com");
    const buyer = await createTestUser("Buyer", "buyer@test.com");
    const listingId = await createTestListing(seller.id, "Test Listing");
    const convId = await createTestConversation(listingId, seller.id, buyer.id);

    // Seller sends unread message
    const sellerMsgId = await createTestMessage(convId, seller.id, "Seller message", false);
    // Buyer sends unread message
    const buyerMsgId = await createTestMessage(convId, buyer.id, "Buyer message", false);

    // Seller marks messages as read
    await makeRequest(
      router,
      "PATCH",
      "/api/v1/marketplace/messages/read",
      { conversationId: convId },
      { Authorization: `Bearer ${seller.token}` }
    );

    // Seller's own message should still be unread (from their perspective, it wasn't to them)
    const sellerMsg = await testDb.query.messages.findFirst({
      where: eq(schema.messages.id, sellerMsgId),
    });
    expect(sellerMsg?.isRead).toBe(false);

    // Buyer's message should be read
    const buyerMsg = await testDb.query.messages.findFirst({
      where: eq(schema.messages.id, buyerMsgId),
    });
    expect(buyerMsg?.isRead).toBe(true);
  });
});
