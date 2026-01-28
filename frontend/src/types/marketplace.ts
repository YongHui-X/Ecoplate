// Marketplace types matching ERD schema

export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  userLocation: string | null;
}

export interface Product {
  id: number;
  userId: number;
  productName: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  purchaseDate: string | null;
  description: string | null;
  co2Emission: number | null;
}

export interface MarketplaceListing {
  id: number;
  sellerId: number;
  buyerId: number | null;
  productId: number | null;
  title: string;
  description: string | null;
  category: string | null;
  quantity: number;
  unit: string | null;
  price: number | null;
  originalPrice: number | null;
  expiryDate: string | null;
  pickupLocation: string | null;
  images: string | null; // JSON string: '["url1.jpg", "url2.jpg"]'
  status: string;
  createdAt: string;
  completedAt: string | null;
  seller?: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  buyer?: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  product?: Product;
}

export interface MarketplaceListingWithDistance extends MarketplaceListing {
  distance?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface CreateListingRequest {
  productId?: number;
  title: string;
  description?: string;
  category?: string;
  quantity: number;
  unit?: string;
  price?: number | null;
  originalPrice?: number;
  expiryDate?: string;
  pickupLocation?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  images?: string[]; // Array of image URLs
}

export interface UpdateListingRequest {
  productId?: number;
  title?: string;
  description?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  price?: number | null;
  originalPrice?: number;
  expiryDate?: string;
  pickupLocation?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  images?: string[]; // Array of image URLs
}

export interface CompleteListingRequest {
  buyerId?: number;
}

export const MARKETPLACE_CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "bakery",
  "frozen",
  "beverages",
  "pantry",
  "other",
] as const;

export type MarketplaceCategory = typeof MARKETPLACE_CATEGORIES[number];

export const LISTING_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type ListingStatus = typeof LISTING_STATUS[keyof typeof LISTING_STATUS];
