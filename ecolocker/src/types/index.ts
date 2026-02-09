export interface User {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string | null;
  userLocation?: string | null;
}

export interface Locker {
  id: number;
  name: string;
  address: string;
  coordinates: string;
  totalCompartments: number;
  availableCompartments: number;
  operatingHours?: string | null;
  status: string;
  distance?: number;
}

export interface Listing {
  id: number;
  sellerId: number;
  buyerId?: number | null;
  title: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  unit?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  expiryDate?: string | null;
  pickupLocation?: string | null;
  images?: string | null;
  status: string;
  createdAt: string;
  co2Saved?: number | null;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "pickup_scheduled"
  | "in_transit"
  | "ready_for_pickup"
  | "collected"
  | "cancelled"
  | "expired";

export interface LockerOrder {
  id: number;
  listingId: number;
  lockerId: number;
  buyerId: number;
  sellerId: number;
  itemPrice: number;
  deliveryFee: number;
  totalPrice: number;
  status: OrderStatus;
  reservedAt: string;
  paymentDeadline?: string | null;
  paidAt?: string | null;
  pickupScheduledAt?: string | null;
  riderPickedUpAt?: string | null;
  deliveredAt?: string | null;
  pickedUpAt?: string | null;
  expiresAt?: string | null;
  pickupPin?: string | null;
  compartmentNumber?: number | null;
  cancelReason?: string | null;
  locker?: Locker;
  listing?: Listing;
  buyer?: Pick<User, "id" | "name" | "avatarUrl">;
  seller?: Pick<User, "id" | "name" | "avatarUrl">;
}

export interface LockerNotification {
  id: number;
  userId: number;
  orderId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  order?: LockerOrder;
}
