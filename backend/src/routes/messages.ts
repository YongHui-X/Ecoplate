import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../db/connection";
import { messages, conversations } from "../db/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import {
  getOrCreateConversation,
  getConversationById,
  getUnreadCountForUser,
  markConversationAsRead,
  touchConversation,
  isUserParticipant,
  getListingForConversation,
} from "../services/conversation-service";
import { wsManager } from "../services/websocket-manager";
import type { NewMessagePayload } from "../types/websocket";

const sendMessageSchema = z.object({
  conversationId: z.number().optional(),
  listingId: z.number().optional(),
  messageText: z.string().min(1).max(2000),
});

const markReadSchema = z.object({
  conversationId: z.number(),
});

export function registerMessageRoutes(router: Router) {
  // Get all conversations for the current user
  router.get("/api/v1/marketplace/conversations", async (req) => {
    try {
      const user = getUser(req);

      // Get all conversations where user is seller or buyer
      const userConversations = await db.query.conversations.findMany({
        where: or(
          eq(conversations.sellerId, user.id),
          eq(conversations.buyerId, user.id)
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
            orderBy: [desc(messages.createdAt)],
            limit: 1,
            with: {
              user: {
                columns: { id: true, name: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy: [desc(conversations.updatedAt)],
      });

      // Get all conversation IDs for non-archived listings
      const activeConversationIds = userConversations
        .filter((conv) => conv.listing?.status !== "sold")
        .map((conv) => conv.id);

      // Batch query: Get all unread counts in a single query (fixes N+1 problem)
      const unreadCountsMap = new Map<number, number>();
      if (activeConversationIds.length > 0) {
        const unreadCounts = await db
          .select({
            conversationId: messages.conversationId,
            count: sql<number>`count(*)`,
          })
          .from(messages)
          .where(
            and(
              sql`${messages.conversationId} IN (${sql.join(
                activeConversationIds.map((id) => sql`${id}`),
                sql`, `
              )})`,
              sql`${messages.userId} != ${user.id}`,
              eq(messages.isRead, false)
            )
          )
          .groupBy(messages.conversationId);

        for (const row of unreadCounts) {
          unreadCountsMap.set(row.conversationId, row.count);
        }
      }

      // Build response using the pre-fetched unread counts
      const response = userConversations.map((conv) => {
        const isArchived = conv.listing?.status === "sold";
        const unreadCount = isArchived ? 0 : (unreadCountsMap.get(conv.id) ?? 0);
        const lastMessage = conv.messages[0] ?? null;
        const isSeller = conv.sellerId === user.id;

        // Map "sold" to "completed" for frontend compatibility
        const listingWithStatus = conv.listing
          ? {
              ...conv.listing,
              status: conv.listing.status === "sold" ? "completed" : conv.listing.status,
            }
          : null;

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
      });

      return json(response);
    } catch (e) {
      console.error("Get conversations error:", e);
      return error("Failed to fetch conversations", 500);
    }
  });

  // Get unread message count (must be before :id route)
  router.get("/api/v1/marketplace/messages/unread-count", async (req) => {
    try {
      const user = getUser(req);
      const count = await getUnreadCountForUser(user.id);
      return json({ count });
    } catch (e) {
      console.error("Get unread count error:", e);
      return error("Failed to get unread count", 500);
    }
  });

  // Start or get conversation for a listing (must be before :id route)
  router.get(
    "/api/v1/marketplace/conversations/listing/:listingId",
    async (req, params) => {
      try {
        const user = getUser(req);
        const listingId = parseInt(params.listingId, 10);

        if (isNaN(listingId)) {
          return error("Invalid listing ID", 400);
        }

        const listing = await getListingForConversation(listingId);

        if (!listing) {
          return error("Listing not found", 404);
        }

        // Prevent seller from starting conversation with themselves
        if (listing.sellerId === user.id) {
          return error("Cannot start conversation with yourself", 400);
        }

        const conversation = await getOrCreateConversation(
          listingId,
          user.id,
          listing.sellerId
        );

        return json({
          id: conversation.id,
          listingId: conversation.listingId,
          listing: conversation.listing,
          seller: conversation.seller,
          buyer: conversation.buyer,
        });
      } catch (e) {
        console.error("Get/create conversation error:", e);
        return error("Failed to get conversation", 500);
      }
    }
  );

  // Get a specific conversation with messages
  router.get("/api/v1/marketplace/conversations/:id", async (req, params) => {
    try {
      const user = getUser(req);
      const conversationId = parseInt(params.id, 10);

      if (isNaN(conversationId)) {
        return error("Invalid conversation ID", 400);
      }

      const conversation = await getConversationById(conversationId, user.id);

      if (!conversation) {
        return error("Conversation not found", 404);
      }

      // Get all messages for this conversation
      const conversationMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        with: {
          user: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: [desc(messages.createdAt)],
      });

      // Mark messages as read
      await markConversationAsRead(conversationId, user.id);

      const isSeller = conversation.sellerId === user.id;

      // Map "sold" to "completed" for frontend compatibility
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
      console.error("Get conversation error:", e);
      return error("Failed to fetch conversation", 500);
    }
  });

  // Send a message
  router.post("/api/v1/marketplace/messages", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const result = sendMessageSchema.safeParse(body);
      if (!result.success) {
        const firstError = result.error.errors[0];
        return error(
          `${firstError.path.join(".")}: ${firstError.message}`,
          400
        );
      }

      const { conversationId, listingId, messageText } = result.data;

      // Must provide either conversationId or listingId
      if (!conversationId && !listingId) {
        return error("Either conversationId or listingId is required", 400);
      }

      let targetConversationId: number;

      if (conversationId) {
        // Verify user is participant
        const isParticipant = await isUserParticipant(conversationId, user.id);
        if (!isParticipant) {
          return error("You are not a participant in this conversation", 403);
        }
        targetConversationId = conversationId;
      } else {
        // Create or get conversation from listing
        const listing = await getListingForConversation(listingId!);
        if (!listing) {
          return error("Listing not found", 404);
        }

        // Determine if user is buyer or seller
        let sellerId: number;
        let buyerId: number;

        if (listing.sellerId === user.id) {
          // User is seller - find existing conversation
          const existingConv = await db.query.conversations.findFirst({
            where: and(
              eq(conversations.listingId, listingId!),
              eq(conversations.sellerId, user.id)
            ),
            orderBy: [desc(conversations.updatedAt)],
          });

          if (!existingConv) {
            return error("No conversation exists to reply to", 400);
          }
          targetConversationId = existingConv.id;
        } else {
          // User is buyer
          sellerId = listing.sellerId;
          buyerId = user.id;
          const conversation = await getOrCreateConversation(
            listingId!,
            buyerId,
            sellerId
          );
          targetConversationId = conversation.id;
        }
      }

      // Insert message
      const [message] = await db
        .insert(messages)
        .values({
          conversationId: targetConversationId,
          userId: user.id,
          messageText,
        })
        .returning();

      // Update conversation timestamp
      await touchConversation(targetConversationId);

      // Fetch message with user info
      const messageWithUser = await db.query.messages.findFirst({
        where: eq(messages.id, message.id),
        with: {
          user: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      // Get conversation details for WebSocket notification
      const conversationForWS = await db.query.conversations.findFirst({
        where: eq(conversations.id, targetConversationId),
        with: {
          listing: {
            columns: { title: true },
          },
          seller: {
            columns: { id: true },
          },
          buyer: {
            columns: { id: true },
          },
        },
      });

      // Broadcast to the recipient via WebSocket
      if (conversationForWS && messageWithUser) {
        const recipientId =
          conversationForWS.seller.id === user.id
            ? conversationForWS.buyer.id
            : conversationForWS.seller.id;

        const wsPayload: NewMessagePayload = {
          conversationId: targetConversationId,
          message: {
            id: messageWithUser.id,
            conversationId: messageWithUser.conversationId,
            userId: messageWithUser.userId,
            messageText: messageWithUser.messageText,
            isRead: messageWithUser.isRead,
            createdAt: messageWithUser.createdAt.toISOString(),
            user: messageWithUser.user!,
          },
          senderId: user.id,
          senderName: user.name,
          listingTitle: conversationForWS.listing?.title ?? "Unknown",
        };

        // Send new message event
        wsManager.sendNewMessage(recipientId, wsPayload);

        // Send updated unread count to recipient
        const newUnreadCount = await getUnreadCountForUser(recipientId);
        wsManager.sendUnreadCountUpdate(recipientId, newUnreadCount);
      }

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
      console.error("Send message error:", e);
      return error("Failed to send message", 500);
    }
  });

  // Mark messages as read
  router.patch("/api/v1/marketplace/messages/read", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const result = markReadSchema.safeParse(body);
      if (!result.success) {
        const firstError = result.error.errors[0];
        return error(
          `${firstError.path.join(".")}: ${firstError.message}`,
          400
        );
      }

      const { conversationId } = result.data;

      // Verify user is participant
      const isParticipant = await isUserParticipant(conversationId, user.id);
      if (!isParticipant) {
        return error("You are not a participant in this conversation", 403);
      }

      await markConversationAsRead(conversationId, user.id);

      return json({ message: "Messages marked as read" });
    } catch (e) {
      console.error("Mark read error:", e);
      return error("Failed to mark messages as read", 500);
    }
  });
}
