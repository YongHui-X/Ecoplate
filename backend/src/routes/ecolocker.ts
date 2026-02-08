import { Router, json, error, parseBody } from "../utils/router";
import { getUser } from "../middleware/auth";
import { z } from "zod";
import * as lockerService from "../services/locker-service";

// Validation schemas
const createOrderSchema = z.object({
  listingId: z.number().int().positive(),
  lockerId: z.number().int().positive(),
});

const schedulePickupSchema = z.object({
  pickupTime: z.string().datetime(),
});

const verifyPinSchema = z.object({
  pin: z.string().length(6),
});

const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

export function registerEcoLockerRoutes(router: Router) {
  // ==================== Locker Endpoints ====================

  // Get all lockers
  router.get("/api/v1/ecolocker/lockers", async (req) => {
    try {
      const lockers = await lockerService.getAllLockers();
      return json(lockers);
    } catch (e) {
      console.error("Get lockers error:", e);
      return error("Failed to get lockers", 500);
    }
  });

  // Get nearby lockers
  router.get("/api/v1/ecolocker/lockers/nearby", async (req) => {
    try {
      const url = new URL(req.url);
      const lat = parseFloat(url.searchParams.get("lat") || "");
      const lng = parseFloat(url.searchParams.get("lng") || "");
      const radius = parseFloat(url.searchParams.get("radius") || "10");

      if (isNaN(lat) || isNaN(lng)) {
        return error("Invalid latitude or longitude", 400);
      }

      if (lat < -90 || lat > 90) {
        return error("Latitude must be between -90 and 90", 400);
      }

      if (lng < -180 || lng > 180) {
        return error("Longitude must be between -180 and 180", 400);
      }

      if (isNaN(radius) || radius < 0.1 || radius > 100) {
        return error("Radius must be between 0.1 and 100 km", 400);
      }

      const lockers = await lockerService.getNearbyLockers(lat, lng, radius);
      return json(lockers);
    } catch (e) {
      console.error("Get nearby lockers error:", e);
      return error("Failed to get nearby lockers", 500);
    }
  });

  // Get single locker
  router.get("/api/v1/ecolocker/lockers/:id", async (req, params) => {
    try {
      const lockerId = parseInt(params.id, 10);
      const locker = await lockerService.getLockerById(lockerId);

      if (!locker) {
        return error("Locker not found", 404);
      }

      return json(locker);
    } catch (e) {
      console.error("Get locker error:", e);
      return error("Failed to get locker", 500);
    }
  });

  // ==================== Order Endpoints ====================

  // Create order (buyer)
  router.post("/api/v1/ecolocker/orders", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);
      const data = createOrderSchema.parse(body);

      const result = await lockerService.createOrder(
        data.listingId,
        data.lockerId,
        user.id
      );

      if (!result.success) {
        return error(result.error || "Failed to create order", 400);
      }

      return json(result.order);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Create order error:", e);
      return error("Failed to create order", 500);
    }
  });

  // Get buyer's orders
  router.get("/api/v1/ecolocker/orders", async (req) => {
    try {
      const user = getUser(req);
      const orders = await lockerService.getBuyerOrders(user.id);
      return json(orders);
    } catch (e) {
      console.error("Get buyer orders error:", e);
      return error("Failed to get orders", 500);
    }
  });

  // Get seller's orders
  router.get("/api/v1/ecolocker/orders/seller", async (req) => {
    try {
      const user = getUser(req);
      const orders = await lockerService.getSellerOrders(user.id);
      return json(orders);
    } catch (e) {
      console.error("Get seller orders error:", e);
      return error("Failed to get orders", 500);
    }
  });

  // Get single order
  router.get("/api/v1/ecolocker/orders/:id", async (req, params) => {
    try {
      const user = getUser(req);
      const orderId = parseInt(params.id, 10);
      const order = await lockerService.getOrderById(orderId, user.id);

      if (!order) {
        return error("Order not found", 404);
      }

      return json(order);
    } catch (e) {
      console.error("Get order error:", e);
      return error("Failed to get order", 500);
    }
  });

  // Process payment (buyer)
  router.post("/api/v1/ecolocker/orders/:id/pay", async (req, params) => {
    try {
      const user = getUser(req);
      const orderId = parseInt(params.id, 10);

      const result = await lockerService.processPayment(orderId, user.id);

      if (!result.success) {
        return error(result.error || "Failed to process payment", 400);
      }

      return json(result.order);
    } catch (e) {
      console.error("Process payment error:", e);
      return error("Failed to process payment", 500);
    }
  });

  // Schedule pickup (seller)
  router.post("/api/v1/ecolocker/orders/:id/schedule", async (req, params) => {
    try {
      const user = getUser(req);
      const orderId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = schedulePickupSchema.parse(body);

      const result = await lockerService.setPickupTime(
        orderId,
        user.id,
        new Date(data.pickupTime)
      );

      if (!result.success) {
        return error(result.error || "Failed to schedule pickup", 400);
      }

      return json(result.order);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Schedule pickup error:", e);
      return error("Failed to schedule pickup", 500);
    }
  });

  // Confirm rider pickup (seller)
  router.post("/api/v1/ecolocker/orders/:id/confirm-pickup", async (req, params) => {
    try {
      const user = getUser(req);
      const orderId = parseInt(params.id, 10);

      const result = await lockerService.confirmRiderPickup(orderId, user.id);

      if (!result.success) {
        return error(result.error || "Failed to confirm pickup", 400);
      }

      return json(result.order);
    } catch (e) {
      console.error("Confirm pickup error:", e);
      return error("Failed to confirm pickup", 500);
    }
  });

  // Verify PIN and pickup (buyer)
  router.post("/api/v1/ecolocker/orders/:id/verify-pin", async (req, params) => {
    try {
      const user = getUser(req);
      const orderId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = verifyPinSchema.parse(body);

      const result = await lockerService.verifyPin(orderId, user.id, data.pin);

      if (!result.success) {
        return error(result.error || "Failed to verify PIN", 400);
      }

      return json({
        order: result.order,
        pointsAwarded: result.pointsAwarded,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Verify PIN error:", e);
      return error("Failed to verify PIN", 500);
    }
  });

  // Cancel order
  router.post("/api/v1/ecolocker/orders/:id/cancel", async (req, params) => {
    try {
      const user = getUser(req);
      const orderId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = cancelOrderSchema.parse(body);

      const result = await lockerService.cancelOrder(orderId, user.id, data.reason);

      if (!result.success) {
        return error(result.error || "Failed to cancel order", 400);
      }

      return json(result.order);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Cancel order error:", e);
      return error("Failed to cancel order", 500);
    }
  });

  // ==================== Notification Endpoints ====================

  // Get notifications
  router.get("/api/v1/ecolocker/notifications", async (req) => {
    try {
      const user = getUser(req);
      const notifications = await lockerService.getNotifications(user.id);
      return json(notifications);
    } catch (e) {
      console.error("Get notifications error:", e);
      return error("Failed to get notifications", 500);
    }
  });

  // Get unread count
  router.get("/api/v1/ecolocker/notifications/unread-count", async (req) => {
    try {
      const user = getUser(req);
      const count = await lockerService.getUnreadCount(user.id);
      return json({ count });
    } catch (e) {
      console.error("Get unread count error:", e);
      return error("Failed to get unread count", 500);
    }
  });

  // Mark notification as read
  router.patch("/api/v1/ecolocker/notifications/:id/read", async (req, params) => {
    try {
      const user = getUser(req);
      const notificationId = parseInt(params.id, 10);
      await lockerService.markNotificationAsRead(notificationId, user.id);
      return json({ success: true });
    } catch (e) {
      console.error("Mark notification read error:", e);
      return error("Failed to mark notification as read", 500);
    }
  });

  // Mark all notifications as read
  router.post("/api/v1/ecolocker/notifications/mark-all-read", async (req) => {
    try {
      const user = getUser(req);
      await lockerService.markAllNotificationsAsRead(user.id);
      return json({ success: true });
    } catch (e) {
      console.error("Mark all notifications read error:", e);
      return error("Failed to mark all notifications as read", 500);
    }
  });
}
