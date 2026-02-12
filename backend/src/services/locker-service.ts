import { db } from "../index";
import * as schema from "../db/schema";
import { eq, and, lt, or, inArray, desc } from "drizzle-orm";
import { calculateDistance, parseCoordinates, type Coordinates } from "../utils/distance";
import { awardPoints, POINT_VALUES } from "./gamification-service";
import { createNotification as createMainNotification } from "./notification-service";

// Constants
const RESERVATION_TIMEOUT_MINUTES = 30;
const PIN_VALIDITY_HOURS = 24;
const BASE_DELIVERY_FEE = 2.0;
const EXTRA_FEE_PER_KM = 0.5;
const FREE_KM_THRESHOLD = 5;
const DELIVERY_MIN_HOURS = 1;
const DELIVERY_MAX_HOURS = 3;

// Delivery simulation timers stored in memory
const deliveryTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

/**
 * Generate a 6-digit PIN code
 */
export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Calculate delivery fee based on distance
 * Base $2 + $0.50/km after 5km
 */
export function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= FREE_KM_THRESHOLD) {
    return BASE_DELIVERY_FEE;
  }
  const extraKm = distanceKm - FREE_KM_THRESHOLD;
  return BASE_DELIVERY_FEE + extraKm * EXTRA_FEE_PER_KM;
}

/**
 * Get all active lockers
 */
export async function getAllLockers() {
  return db.query.lockers.findMany({
    where: eq(schema.lockers.status, "active"),
  });
}

/**
 * Get a single locker by ID
 */
export async function getLockerById(lockerId: number) {
  return db.query.lockers.findFirst({
    where: eq(schema.lockers.id, lockerId),
  });
}

/**
 * Get nearby lockers within a given radius
 */
export async function getNearbyLockers(
  lat: number,
  lng: number,
  radiusKm: number = 10
) {
  const userLocation: Coordinates = { latitude: lat, longitude: lng };

  const allLockers = await db.query.lockers.findMany({
    where: eq(schema.lockers.status, "active"),
  });

  const nearbyLockers = allLockers
    .map((locker) => {
      const coords = parseCoordinates(locker.coordinates);
      if (!coords) return null;

      const distance = calculateDistance(userLocation, coords);
      return {
        ...locker,
        distance,
        coordinates: coords,
      };
    })
    .filter((locker) => locker !== null && locker.distance <= radiusKm)
    .sort((a, b) => (a?.distance || 0) - (b?.distance || 0));

  return nearbyLockers;
}

/**
 * Create a new locker order
 * Sets a 30-minute payment deadline
 */
export async function createOrder(
  listingId: number,
  lockerId: number,
  buyerId: number
): Promise<{ success: boolean; order?: typeof schema.lockerOrders.$inferSelect; error?: string }> {
  // Get the listing
  const listing = await db.query.marketplaceListings.findFirst({
    where: eq(schema.marketplaceListings.id, listingId),
  });

  if (!listing) {
    return { success: false, error: "Listing not found" };
  }

  if (listing.status === "reserved") {
    // Only the reserved buyer can create an EcoLocker order
    if (listing.buyerId !== buyerId) {
      return { success: false, error: "This listing is reserved for another buyer" };
    }
  } else if (listing.status !== "active") {
    return { success: false, error: "Listing is not available" };
  }

  if (listing.sellerId === buyerId) {
    return { success: false, error: "Cannot purchase your own listing" };
  }

  // Get the locker
  const locker = await db.query.lockers.findFirst({
    where: eq(schema.lockers.id, lockerId),
  });

  if (!locker) {
    return { success: false, error: "Locker not found" };
  }

  if (locker.status !== "active") {
    return { success: false, error: "Locker is not available" };
  }

  if (locker.availableCompartments < 1) {
    return { success: false, error: "No available compartments at this locker" };
  }

  // Calculate prices
  const itemPrice = listing.price || 0;
  const deliveryFee = BASE_DELIVERY_FEE;
  const totalPrice = itemPrice + deliveryFee;

  // Set payment deadline (30 minutes from now)
  const now = new Date();
  const paymentDeadline = new Date(now.getTime() + RESERVATION_TIMEOUT_MINUTES * 60 * 1000);

  // Create the order
  const [order] = await db
    .insert(schema.lockerOrders)
    .values({
      listingId,
      lockerId,
      buyerId,
      sellerId: listing.sellerId,
      itemPrice,
      deliveryFee,
      totalPrice,
      status: "pending_payment",
      reservedAt: now,
      paymentDeadline,
    })
    .returning();

  // Reserve the listing
  await db
    .update(schema.marketplaceListings)
    .set({
      status: "reserved",
      buyerId,
    })
    .where(eq(schema.marketplaceListings.id, listingId));

  // Decrement available compartments
  await db
    .update(schema.lockers)
    .set({
      availableCompartments: locker.availableCompartments - 1,
    })
    .where(eq(schema.lockers.id, lockerId));

  // Create notification for buyer
  await createNotification(
    buyerId,
    order.id,
    "payment_reminder",
    "Complete Your Payment",
    `Please complete payment within 30 minutes to secure your order.`
  );

  return { success: true, order };
}

/**
 * Process payment for an order
 */
export async function processPayment(
  orderId: number,
  buyerId: number
): Promise<{ success: boolean; order?: typeof schema.lockerOrders.$inferSelect; error?: string }> {
  const order = await db.query.lockerOrders.findFirst({
    where: and(
      eq(schema.lockerOrders.id, orderId),
      eq(schema.lockerOrders.buyerId, buyerId)
    ),
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "pending_payment") {
    return { success: false, error: `Cannot pay for order with status: ${order.status}` };
  }

  // Check if payment deadline has passed
  if (order.paymentDeadline && new Date() > order.paymentDeadline) {
    return { success: false, error: "Payment deadline has passed. Order has been cancelled." };
  }

  // Update order status
  const [updatedOrder] = await db
    .update(schema.lockerOrders)
    .set({
      status: "paid",
      paidAt: new Date(),
    })
    .where(eq(schema.lockerOrders.id, orderId))
    .returning();

  // Notify seller (locker notifications)
  await createNotification(
    order.sellerId,
    orderId,
    "payment_received",
    "Payment Received",
    `Buyer has paid for the order. Please schedule a pickup time.`
  );

  // Dual-write to main notifications for bell
  await createMainNotification(
    order.sellerId,
    "locker_payment_received",
    "EcoLocker: Payment Received",
    `Buyer has paid for the order. Please schedule a pickup time.`,
    orderId
  );

  return { success: true, order: updatedOrder };
}

/**
 * Set pickup time (seller schedules when they'll drop off)
 */
export async function setPickupTime(
  orderId: number,
  sellerId: number,
  pickupTime: Date
): Promise<{ success: boolean; order?: typeof schema.lockerOrders.$inferSelect; error?: string }> {
  const order = await db.query.lockerOrders.findFirst({
    where: and(
      eq(schema.lockerOrders.id, orderId),
      eq(schema.lockerOrders.sellerId, sellerId)
    ),
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "paid") {
    return { success: false, error: `Cannot schedule pickup for order with status: ${order.status}` };
  }

  const [updatedOrder] = await db
    .update(schema.lockerOrders)
    .set({
      status: "pickup_scheduled",
      pickupScheduledAt: pickupTime,
    })
    .where(eq(schema.lockerOrders.id, orderId))
    .returning();

  // Notify buyer
  await createNotification(
    order.buyerId,
    orderId,
    "pickup_scheduled",
    "Pickup Scheduled",
    `The delivery rider will pick up your item from the seller on ${pickupTime.toLocaleDateString()}.`
  );

  return { success: true, order: updatedOrder };
}

/**
 * Confirm rider pickup from seller (starts delivery simulation)
 */
export async function confirmRiderPickup(
  orderId: number,
  sellerId: number
): Promise<{ success: boolean; order?: typeof schema.lockerOrders.$inferSelect; error?: string }> {
  const order = await db.query.lockerOrders.findFirst({
    where: and(
      eq(schema.lockerOrders.id, orderId),
      eq(schema.lockerOrders.sellerId, sellerId)
    ),
    with: {
      locker: true,
    },
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "paid" && order.status !== "pickup_scheduled") {
    return { success: false, error: `Cannot confirm pickup for order with status: ${order.status}` };
  }

  // Assign a compartment number
  const compartmentNumber = Math.floor(Math.random() * (order.locker?.totalCompartments || 12)) + 1;

  const [updatedOrder] = await db
    .update(schema.lockerOrders)
    .set({
      status: "in_transit",
      riderPickedUpAt: new Date(),
      compartmentNumber,
    })
    .where(eq(schema.lockerOrders.id, orderId))
    .returning();

  // Notify buyer
  await createNotification(
    order.buyerId,
    orderId,
    "item_in_transit",
    "Item In Transit",
    `Your item has been picked up by the delivery rider and is on its way to the locker. You'll receive a PIN when it's ready for pickup.`
  );

  // Start delivery simulation
  simulateDelivery(orderId);

  return { success: true, order: updatedOrder };
}

/**
 * Simulate delivery process (background timer)
 * After 1-3 hours, generates PIN and marks as ready
 */
export async function simulateDelivery(orderId: number) {
  // Fixed 20-second delay to simulate delivery
  const actualDelay = 20 * 1000;

  // Clear any existing timer for this order
  const existingTimer = deliveryTimers.get(orderId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    try {
      await completeDelivery(orderId);
      deliveryTimers.delete(orderId);
    } catch (err) {
      console.error(`Error completing delivery for order ${orderId}:`, err);
    }
  }, actualDelay);

  deliveryTimers.set(orderId, timer);
}

/**
 * Complete delivery (internal function called by timer)
 */
async function completeDelivery(orderId: number) {
  const order = await db.query.lockerOrders.findFirst({
    where: eq(schema.lockerOrders.id, orderId),
    with: {
      locker: true,
    },
  });

  if (!order) {
    console.error(`Order ${orderId} not found for delivery completion`);
    return;
  }

  if (order.status !== "in_transit") {
    console.log(`Order ${orderId} is not in transit, skipping delivery completion`);
    return;
  }

  // Generate PIN and set expiry (24 hours from now)
  const pickupPin = generatePin();
  const expiresAt = new Date(Date.now() + PIN_VALIDITY_HOURS * 60 * 60 * 1000);

  await db
    .update(schema.lockerOrders)
    .set({
      status: "ready_for_pickup",
      pickupPin,
      deliveredAt: new Date(),
      expiresAt,
    })
    .where(eq(schema.lockerOrders.id, orderId));

  // Notify buyer with PIN (locker notifications)
  await createNotification(
    order.buyerId,
    orderId,
    "item_delivered",
    "Item Ready for Pickup!",
    `Your item is ready at ${order.locker?.name}. Your pickup PIN is: ${pickupPin}. Valid for 24 hours.`
  );

  // Dual-write to main notifications for bell
  await createMainNotification(
    order.buyerId,
    "locker_item_delivered",
    "EcoLocker: Item Ready for Pickup!",
    `Your item is ready at ${order.locker?.name}. Check EcoLocker for your pickup PIN.`,
    orderId
  );
}

/**
 * Verify PIN and complete pickup
 */
export async function verifyPin(
  orderId: number,
  buyerId: number,
  pin: string
): Promise<{ success: boolean; order?: typeof schema.lockerOrders.$inferSelect; pointsAwarded?: number; error?: string }> {
  const order = await db.query.lockerOrders.findFirst({
    where: and(
      eq(schema.lockerOrders.id, orderId),
      eq(schema.lockerOrders.buyerId, buyerId)
    ),
    with: {
      locker: true,
      listing: true,
    },
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "ready_for_pickup") {
    return { success: false, error: `Cannot verify PIN for order with status: ${order.status}` };
  }

  // Check if PIN has expired
  if (order.expiresAt && new Date() > order.expiresAt) {
    return { success: false, error: "PIN has expired. Please contact support." };
  }

  // Verify PIN
  if (order.pickupPin !== pin) {
    return { success: false, error: "Invalid PIN" };
  }

  // Complete the pickup
  const [updatedOrder] = await db
    .update(schema.lockerOrders)
    .set({
      status: "collected",
      pickedUpAt: new Date(),
    })
    .where(eq(schema.lockerOrders.id, orderId))
    .returning();

  // Mark the marketplace listing as sold
  await db
    .update(schema.marketplaceListings)
    .set({
      status: "sold",
      completedAt: new Date(),
    })
    .where(eq(schema.marketplaceListings.id, order.listingId));

  // Release compartment
  if (order.locker) {
    await db
      .update(schema.lockers)
      .set({
        availableCompartments: order.locker.availableCompartments + 1,
      })
      .where(eq(schema.lockers.id, order.locker.id));
  }

  // Award points to seller
  const pointsResult = await awardPoints(order.sellerId, "sold", null, 1, undefined, {
    co2Saved: order.listing?.co2Saved || null,
    buyerId: order.buyerId,
  });

  // Notify both parties (locker notifications)
  await createNotification(
    order.buyerId,
    orderId,
    "pickup_complete",
    "Pickup Complete!",
    `Thank you for using EcoLocker! You've helped save food from going to waste.`
  );

  await createNotification(
    order.sellerId,
    orderId,
    "order_complete",
    "Order Complete!",
    `Your item has been picked up. You earned ${pointsResult.amount} EcoPoints!`
  );

  // Dual-write to main notifications for bell
  await createMainNotification(
    order.buyerId,
    "locker_pickup_complete",
    "EcoLocker: Pickup Complete!",
    `Thank you for using EcoLocker! You've helped save food from going to waste.`,
    orderId
  );

  await createMainNotification(
    order.sellerId,
    "locker_pickup_complete",
    "EcoLocker: Order Complete!",
    `Your item has been picked up. You earned ${pointsResult.amount} EcoPoints!`,
    orderId
  );

  return { success: true, order: updatedOrder, pointsAwarded: pointsResult.amount };
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  orderId: number,
  userId: number,
  reason: string
): Promise<{ success: boolean; order?: typeof schema.lockerOrders.$inferSelect; error?: string }> {
  const order = await db.query.lockerOrders.findFirst({
    where: eq(schema.lockerOrders.id, orderId),
    with: {
      locker: true,
    },
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  // Only buyer or seller can cancel
  if (order.buyerId !== userId && order.sellerId !== userId) {
    return { success: false, error: "You are not authorized to cancel this order" };
  }

  // Can only cancel if not yet picked up
  const cancellableStatuses = ["pending_payment", "paid", "pickup_scheduled", "in_transit", "ready_for_pickup"];
  if (!cancellableStatuses.includes(order.status)) {
    return { success: false, error: `Cannot cancel order with status: ${order.status}` };
  }

  // Update order
  const [updatedOrder] = await db
    .update(schema.lockerOrders)
    .set({
      status: "cancelled",
      cancelReason: reason,
    })
    .where(eq(schema.lockerOrders.id, orderId))
    .returning();

  // Release the listing back to active
  await db
    .update(schema.marketplaceListings)
    .set({
      status: "active",
      buyerId: null,
    })
    .where(eq(schema.marketplaceListings.id, order.listingId));

  // Release compartment if it was reserved
  if (order.locker && order.status !== "pending_payment") {
    await db
      .update(schema.lockers)
      .set({
        availableCompartments: order.locker.availableCompartments + 1,
      })
      .where(eq(schema.lockers.id, order.locker.id));
  }

  // Clear delivery timer if exists
  const timer = deliveryTimers.get(orderId);
  if (timer) {
    clearTimeout(timer);
    deliveryTimers.delete(orderId);
  }

  // Notify other party (locker notifications)
  const cancelledBy = userId === order.buyerId ? "buyer" : "seller";
  const otherParty = userId === order.buyerId ? order.sellerId : order.buyerId;

  await createNotification(
    otherParty,
    orderId,
    "order_cancelled",
    "Order Cancelled",
    `The order has been cancelled by the ${cancelledBy}. Reason: ${reason}`
  );

  // Dual-write to main notifications for bell
  await createMainNotification(
    otherParty,
    "locker_order_cancelled",
    "EcoLocker: Order Cancelled",
    `The order has been cancelled by the ${cancelledBy}. Reason: ${reason}`,
    orderId
  );

  return { success: true, order: updatedOrder };
}

/**
 * Check for reservation timeouts (called by background job)
 */
export async function checkReservationTimeouts() {
  const now = new Date();

  // Find orders that are pending_payment and past deadline
  const expiredOrders = await db.query.lockerOrders.findMany({
    where: and(
      eq(schema.lockerOrders.status, "pending_payment"),
      lt(schema.lockerOrders.paymentDeadline, now)
    ),
    with: {
      locker: true,
    },
  });

  for (const order of expiredOrders) {
    // Cancel the order
    await db
      .update(schema.lockerOrders)
      .set({
        status: "cancelled",
        cancelReason: "Payment deadline expired",
      })
      .where(eq(schema.lockerOrders.id, order.id));

    // Release the listing
    await db
      .update(schema.marketplaceListings)
      .set({
        status: "active",
        buyerId: null,
      })
      .where(eq(schema.marketplaceListings.id, order.listingId));

    // Release compartment
    if (order.locker) {
      await db
        .update(schema.lockers)
        .set({
          availableCompartments: order.locker.availableCompartments + 1,
        })
        .where(eq(schema.lockers.id, order.locker.id));
    }

    // Notify buyer
    await createNotification(
      order.buyerId,
      order.id,
      "order_cancelled",
      "Order Cancelled",
      `Your order was cancelled because payment was not completed within 30 minutes.`
    );

    // Notify seller
    await createNotification(
      order.sellerId,
      order.id,
      "order_cancelled",
      "Reservation Expired",
      `A buyer's reservation for your listing expired due to non-payment.`
    );

    console.log(`Cancelled order ${order.id} due to payment timeout`);
  }

  return expiredOrders.length;
}

/**
 * Check for PIN expiry (called by background job)
 */
export async function checkPinExpiry() {
  const now = new Date();

  // Find orders that are ready_for_pickup and past expiry
  const expiredOrders = await db.query.lockerOrders.findMany({
    where: and(
      eq(schema.lockerOrders.status, "ready_for_pickup"),
      lt(schema.lockerOrders.expiresAt, now)
    ),
    with: {
      locker: true,
    },
  });

  for (const order of expiredOrders) {
    // Mark as expired
    await db
      .update(schema.lockerOrders)
      .set({
        status: "expired",
      })
      .where(eq(schema.lockerOrders.id, order.id));

    // Note: We don't release the listing back because the item is in the locker
    // This would require manual intervention in a real system

    // Release compartment
    if (order.locker) {
      await db
        .update(schema.lockers)
        .set({
          availableCompartments: order.locker.availableCompartments + 1,
        })
        .where(eq(schema.lockers.id, order.locker.id));
    }

    // Notify both parties
    await createNotification(
      order.buyerId,
      order.id,
      "order_expired",
      "Pickup Expired",
      `Your pickup window has expired. Please contact support for assistance.`
    );

    await createNotification(
      order.sellerId,
      order.id,
      "order_expired",
      "Pickup Window Expired",
      `The buyer did not pick up the item within 24 hours. Please contact support.`
    );

    console.log(`Expired order ${order.id} due to PIN expiry`);
  }

  return expiredOrders.length;
}

/**
 * Re-queue pending deliveries on server restart
 */
export async function requeuePendingDeliveries() {
  const inTransitOrders = await db.query.lockerOrders.findMany({
    where: eq(schema.lockerOrders.status, "in_transit"),
  });

  for (const order of inTransitOrders) {
    // Resume delivery simulation
    simulateDelivery(order.id);
    console.log(`Re-queued delivery simulation for order ${order.id}`);
  }

  return inTransitOrders.length;
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: number,
  orderId: number,
  type: string,
  title: string,
  message: string
) {
  await db.insert(schema.lockerNotifications).values({
    userId,
    orderId,
    type,
    title,
    message,
  });
}

/**
 * Get notifications for a user
 */
export async function getNotifications(userId: number) {
  return db.query.lockerNotifications.findMany({
    where: eq(schema.lockerNotifications.userId, userId),
    orderBy: [desc(schema.lockerNotifications.createdAt)],
    with: {
      order: {
        with: {
          locker: true,
          listing: true,
        },
      },
    },
  });
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: number) {
  const notifications = await db.query.lockerNotifications.findMany({
    where: and(
      eq(schema.lockerNotifications.userId, userId),
      eq(schema.lockerNotifications.isRead, false)
    ),
  });
  return notifications.length;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: number, userId: number) {
  await db
    .update(schema.lockerNotifications)
    .set({ isRead: true })
    .where(
      and(
        eq(schema.lockerNotifications.id, notificationId),
        eq(schema.lockerNotifications.userId, userId)
      )
    );
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: number) {
  await db
    .update(schema.lockerNotifications)
    .set({ isRead: true })
    .where(eq(schema.lockerNotifications.userId, userId));
}

/**
 * Get buyer's orders
 */
export async function getBuyerOrders(buyerId: number) {
  return db.query.lockerOrders.findMany({
    where: eq(schema.lockerOrders.buyerId, buyerId),
    orderBy: [desc(schema.lockerOrders.reservedAt)],
    with: {
      locker: true,
      listing: true,
      seller: {
        columns: { id: true, name: true, avatarUrl: true },
      },
    },
  });
}

/**
 * Get seller's orders
 */
export async function getSellerOrders(sellerId: number) {
  return db.query.lockerOrders.findMany({
    where: eq(schema.lockerOrders.sellerId, sellerId),
    orderBy: [desc(schema.lockerOrders.reservedAt)],
    with: {
      locker: true,
      listing: true,
      buyer: {
        columns: { id: true, name: true, avatarUrl: true },
      },
    },
  });
}

/**
 * Get a single order by ID
 */
export async function getOrderById(orderId: number, userId: number) {
  const order = await db.query.lockerOrders.findFirst({
    where: eq(schema.lockerOrders.id, orderId),
    with: {
      locker: true,
      listing: true,
      buyer: {
        columns: { id: true, name: true, avatarUrl: true },
      },
      seller: {
        columns: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  // Only return if user is buyer or seller
  if (order && (order.buyerId === userId || order.sellerId === userId)) {
    return order;
  }

  return null;
}
