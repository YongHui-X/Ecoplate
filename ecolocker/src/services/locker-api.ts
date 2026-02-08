import { api } from "./api";
import type {
  Locker,
  LockerOrder,
  LockerNotification,
  Listing,
} from "../types";

// Lockers
export const lockerApi = {
  getAll(): Promise<Locker[]> {
    return api.get("/ecolocker/lockers");
  },

  getNearby(lat: number, lng: number, radius: number = 10): Promise<Locker[]> {
    return api.get(`/ecolocker/lockers/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
  },

  getById(id: number): Promise<Locker> {
    return api.get(`/ecolocker/lockers/${id}`);
  },
};

// Orders
export const orderApi = {
  create(listingId: number, lockerId: number): Promise<LockerOrder> {
    return api.post("/ecolocker/orders", { listingId, lockerId });
  },

  getBuyerOrders(): Promise<LockerOrder[]> {
    return api.get("/ecolocker/orders");
  },

  getSellerOrders(): Promise<LockerOrder[]> {
    return api.get("/ecolocker/orders/seller");
  },

  getById(id: number): Promise<LockerOrder> {
    return api.get(`/ecolocker/orders/${id}`);
  },

  pay(orderId: number): Promise<LockerOrder> {
    return api.post(`/ecolocker/orders/${orderId}/pay`);
  },

  schedule(orderId: number, pickupTime: string): Promise<LockerOrder> {
    return api.post(`/ecolocker/orders/${orderId}/schedule`, { pickupTime });
  },

  confirmRiderPickup(orderId: number): Promise<LockerOrder> {
    return api.post(`/ecolocker/orders/${orderId}/confirm-pickup`);
  },

  verifyPin(
    orderId: number,
    pin: string
  ): Promise<{ order: LockerOrder; pointsAwarded: number }> {
    return api.post(`/ecolocker/orders/${orderId}/verify-pin`, { pin });
  },

  cancel(orderId: number, reason: string): Promise<LockerOrder> {
    return api.post(`/ecolocker/orders/${orderId}/cancel`, { reason });
  },
};

// Notifications
export const notificationApi = {
  getAll(): Promise<LockerNotification[]> {
    return api.get("/ecolocker/notifications");
  },

  getUnreadCount(): Promise<{ count: number }> {
    return api.get("/ecolocker/notifications/unread-count");
  },

  markAsRead(id: number): Promise<{ success: boolean }> {
    return api.patch(`/ecolocker/notifications/${id}/read`);
  },

  markAllAsRead(): Promise<{ success: boolean }> {
    return api.post("/ecolocker/notifications/mark-all-read");
  },
};

// Marketplace (for getting listing details)
export const marketplaceApi = {
  getListing(id: number): Promise<Listing & { seller: { id: number; name: string; avatarUrl?: string } }> {
    return api.get(`/marketplace/listings/${id}`);
  },
};
