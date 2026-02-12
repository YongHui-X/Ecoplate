import { db } from "../db/connection";
import * as schema from "../db/schema";
import { eq, and, desc, lt, sql } from "drizzle-orm";

// Notification types
export type NotificationType =
  | "expiring_soon"
  | "badge_unlocked"
  | "streak_milestone"
  | "product_stale"
  | "listing_reserved"
  | "locker_payment_received"
  | "locker_item_delivered"
  | "locker_pickup_complete"
  | "locker_order_cancelled";

// Notification preferences type
export interface NotificationPreferences {
  expiringProducts: boolean;
  badgeUnlocked: boolean;
  streakMilestone: boolean;
  productStale: boolean;
  staleDaysThreshold: number;
  expiryDaysThreshold: number;
}

// ==================== Preferences ====================

/**
 * Get or create notification preferences for a user
 */
export async function getOrCreatePreferences(userId: number): Promise<NotificationPreferences> {
  let prefs = await db.query.notificationPreferences.findFirst({
    where: eq(schema.notificationPreferences.userId, userId),
  });

  if (!prefs) {
    await db
      .insert(schema.notificationPreferences)
      .values({ userId })
      .onConflictDoNothing();
    prefs = await db.query.notificationPreferences.findFirst({
      where: eq(schema.notificationPreferences.userId, userId),
    });
  }

  return {
    expiringProducts: prefs!.expiringProducts,
    badgeUnlocked: prefs!.badgeUnlocked,
    streakMilestone: prefs!.streakMilestone,
    productStale: prefs!.productStale,
    staleDaysThreshold: prefs!.staleDaysThreshold,
    expiryDaysThreshold: prefs!.expiryDaysThreshold,
  };
}

/**
 * Update notification preferences for a user
 */
export async function updatePreferences(
  userId: number,
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  // Ensure preferences exist
  await getOrCreatePreferences(userId);

  await db
    .update(schema.notificationPreferences)
    .set(updates)
    .where(eq(schema.notificationPreferences.userId, userId));

  return getOrCreatePreferences(userId);
}

// ==================== Core Notification Functions ====================

/**
 * Create a new notification
 */
export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: number
) {
  const [notification] = await db
    .insert(schema.notifications)
    .values({
      userId,
      type,
      title,
      message,
      relatedId: relatedId ?? null,
    })
    .returning();

  return notification;
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: number,
  limit = 50,
  unreadOnly = false
) {
  const conditions = [eq(schema.notifications.userId, userId)];

  if (unreadOnly) {
    conditions.push(eq(schema.notifications.isRead, false));
  }

  const notifications = await db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.notifications.createdAt)],
    limit,
  });

  return notifications;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      )
    );

  return result[0]?.count ?? 0;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: number, userId: number): Promise<boolean> {
  const result = await db
    .update(schema.notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, userId)
      )
    );

  return true;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: number): Promise<void> {
  await db
    .update(schema.notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      )
    );
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: number, userId: number): Promise<boolean> {
  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, userId)
      )
    );

  return true;
}

/**
 * Delete old notifications (older than specified days)
 */
export async function deleteOldNotifications(userId: number, olderThanDays: number): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        lt(schema.notifications.createdAt, cutoffDate)
      )
    );
}

// ==================== Notification Generators ====================

/**
 * Check for expiring products and create notifications
 * Call this on login or when visiting MyFridge
 */
export async function checkExpiringProducts(userId: number): Promise<number> {
  const prefs = await getOrCreatePreferences(userId);

  if (!prefs.expiringProducts) {
    return 0;
  }

  const threshold = prefs.expiryDaysThreshold;
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + threshold);

  // Get all marketplace listings by this user that are active and have expiry dates
  const expiringListings = await db.query.marketplaceListings.findMany({
    where: and(
      eq(schema.marketplaceListings.sellerId, userId),
      eq(schema.marketplaceListings.status, "active")
    ),
  });

  // Filter to those expiring within threshold
  const aboutToExpire = expiringListings.filter((listing) => {
    if (!listing.expiryDate) return false;
    const expiry = new Date(listing.expiryDate);
    return expiry >= now && expiry <= futureDate;
  });

  // Get existing notifications to avoid duplicates
  const existingNotifications = await db.query.notifications.findMany({
    where: and(
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.type, "expiring_soon")
    ),
  });

  const existingRelatedIds = new Set(
    existingNotifications
      .filter((n) => n.relatedId !== null)
      .map((n) => n.relatedId)
  );

  let created = 0;
  for (const listing of aboutToExpire) {
    // Skip if we already have a notification for this listing
    if (existingRelatedIds.has(listing.id)) continue;

    const daysUntilExpiry = Math.ceil(
      (new Date(listing.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    await createNotification(
      userId,
      "expiring_soon",
      "Product Expiring Soon",
      `Your listing "${listing.title}" expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}!`,
      listing.id
    );
    created++;
  }

  // Also check products in MyFridge (if they have purchase date as a proxy for tracking)
  // Note: Products don't have expiry dates in the current schema, so we skip this for now
  // This could be enhanced later if expiry dates are added to products

  return created;
}

/**
 * Check for stale products (not used for N days)
 * Note: Current schema doesn't track last used date, so this uses purchase date
 */
export async function checkStaleProducts(userId: number): Promise<number> {
  const prefs = await getOrCreatePreferences(userId);

  if (!prefs.productStale) {
    return 0;
  }

  const threshold = prefs.staleDaysThreshold;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - threshold);

  // Get products that were purchased more than threshold days ago
  const products = await db.query.products.findMany({
    where: eq(schema.products.userId, userId),
  });

  const staleProducts = products.filter((product) => {
    if (!product.purchaseDate) return false;
    const purchaseDate = new Date(product.purchaseDate);
    return purchaseDate < cutoffDate;
  });

  // Get existing notifications to avoid duplicates
  const existingNotifications = await db.query.notifications.findMany({
    where: and(
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.type, "product_stale")
    ),
  });

  const existingRelatedIds = new Set(
    existingNotifications
      .filter((n) => n.relatedId !== null)
      .map((n) => n.relatedId)
  );

  let created = 0;
  for (const product of staleProducts) {
    // Skip if we already have a notification for this product
    if (existingRelatedIds.has(product.id)) continue;

    const daysSincePurchase = Math.ceil(
      (new Date().getTime() - new Date(product.purchaseDate!).getTime()) / (1000 * 60 * 60 * 24)
    );

    await createNotification(
      userId,
      "product_stale",
      "Product Sitting Too Long",
      `"${product.productName}" has been in your fridge for ${daysSincePurchase} days. Consider using it soon!`,
      product.id
    );
    created++;
  }

  return created;
}

/**
 * Notify user when they unlock a badge
 * Call this from badge-service after awarding a badge
 */
export async function notifyBadgeUnlocked(
  userId: number,
  badge: { code: string; name: string; pointsAwarded: number }
): Promise<void> {
  const prefs = await getOrCreatePreferences(userId);

  if (!prefs.badgeUnlocked) {
    return;
  }

  await createNotification(
    userId,
    "badge_unlocked",
    "Badge Unlocked!",
    `Congratulations! You've earned the "${badge.name}" badge and ${badge.pointsAwarded} bonus points!`
  );
}

/**
 * Notify user when they hit a streak milestone
 * Call this from gamification-service when streak reaches milestone
 */
export async function notifyStreakMilestone(userId: number, streakDays: number): Promise<void> {
  const prefs = await getOrCreatePreferences(userId);

  if (!prefs.streakMilestone) {
    return;
  }

  // Only notify for specific milestones
  const milestones = [3, 7, 14, 30, 60, 90, 100, 365];
  if (!milestones.includes(streakDays)) {
    return;
  }

  // Check if we already sent a notification for this milestone
  const existing = await db.query.notifications.findFirst({
    where: and(
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.type, "streak_milestone"),
      eq(schema.notifications.relatedId, streakDays)
    ),
  });

  if (existing) {
    return;
  }

  const messages: Record<number, string> = {
    3: "Great start! You've maintained a 3-day streak!",
    7: "One week strong! Keep up the amazing work!",
    14: "Two weeks of eco-friendly habits! You're on fire!",
    30: "A whole month! You're an EcoPlate champion!",
    60: "60 days of sustainability! Incredible dedication!",
    90: "90 days! You're truly making a difference!",
    100: "100-day milestone! You're a sustainability superstar!",
    365: "ONE YEAR! You've made sustainability a lifestyle!",
  };

  await createNotification(
    userId,
    "streak_milestone",
    `${streakDays}-Day Streak!`,
    messages[streakDays] || `Amazing! You've reached a ${streakDays}-day streak!`,
    streakDays // Store streak days as relatedId to prevent duplicate notifications
  );
}

/**
 * Run all notification checks for a user
 * Call this on login or manually via API
 */
export async function runAllChecks(userId: number): Promise<{
  expiringProducts: number;
  staleProducts: number;
}> {
  const [expiringProducts, staleProducts] = await Promise.all([
    checkExpiringProducts(userId),
    checkStaleProducts(userId),
  ]);

  return { expiringProducts, staleProducts };
}
