import { db } from "../index";
import { conversations, messages, marketplaceListings } from "../db/schema";
import { eq, and, or, sql } from "drizzle-orm";

export interface ConversationWithDetails {
  id: number;
  listingId: number;
  sellerId: number;
  buyerId: number;
  createdAt: Date;
  updatedAt: Date;
  listing: {
    id: number;
    title: string;
    price: number | null;
    images: string | null;
    status: string;
  };
  seller: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  buyer: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
}

/**
 * Get or create a conversation for a listing between buyer and seller
 */
export async function getOrCreateConversation(
  listingId: number,
  buyerId: number,
  sellerId: number
): Promise<ConversationWithDetails> {
  // Try to find existing conversation
  const existing = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.listingId, listingId),
      eq(conversations.buyerId, buyerId),
      eq(conversations.sellerId, sellerId)
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

  if (existing) {
    return existing as ConversationWithDetails;
  }

  // Create new conversation
  const [created] = await db
    .insert(conversations)
    .values({
      listingId,
      sellerId,
      buyerId,
    })
    .returning();

  // Fetch with relations
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, created.id),
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

  return conversation as ConversationWithDetails;
}

/**
 * Get conversation by ID with full details
 */
export async function getConversationById(
  conversationId: number,
  userId: number
): Promise<ConversationWithDetails | null> {
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      or(eq(conversations.sellerId, userId), eq(conversations.buyerId, userId))
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

  return conversation as ConversationWithDetails | null;
}

/**
 * Get unread message count for a user
 */
export async function getUnreadCountForUser(userId: number): Promise<number> {
  // Get all conversations where user is a participant
  const userConversations = await db.query.conversations.findMany({
    where: or(
      eq(conversations.sellerId, userId),
      eq(conversations.buyerId, userId)
    ),
    columns: { id: true },
  });

  if (userConversations.length === 0) {
    return 0;
  }

  const conversationIds = userConversations.map((c) => c.id);

  // Count unread messages in those conversations that were NOT sent by the user
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        sql`${messages.conversationId} IN (${sql.join(
          conversationIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        sql`${messages.userId} != ${userId}`,
        eq(messages.isRead, false)
      )
    );

  return result[0]?.count ?? 0;
}

/**
 * Mark all messages in a conversation as read for a user
 */
export async function markConversationAsRead(
  conversationId: number,
  userId: number
): Promise<void> {
  // Only mark messages as read if they weren't sent by this user
  await db
    .update(messages)
    .set({ isRead: true })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sql`${messages.userId} != ${userId}`,
        eq(messages.isRead, false)
      )
    );
}

/**
 * Update conversation's updatedAt timestamp
 */
export async function touchConversation(conversationId: number): Promise<void> {
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

/**
 * Check if user is a participant in the conversation
 */
export async function isUserParticipant(
  conversationId: number,
  userId: number
): Promise<boolean> {
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      or(eq(conversations.sellerId, userId), eq(conversations.buyerId, userId))
    ),
    columns: { id: true },
  });

  return conversation !== undefined;
}

/**
 * Get listing info for starting a new conversation
 */
export async function getListingForConversation(
  listingId: number
): Promise<{ id: number; sellerId: number; title: string } | null> {
  const listing = await db.query.marketplaceListings.findFirst({
    where: eq(marketplaceListings.id, listingId),
    columns: { id: true, sellerId: true, title: true },
  });

  return listing ?? null;
}
