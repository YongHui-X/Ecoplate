import { api } from "./api";
import type {
  MarketplaceListing,
  MarketplaceListingWithDistance,
  CreateListingRequest,
  UpdateListingRequest,
} from "../types/marketplace";

export const marketplaceService = {
  /**
   * Get all marketplace listings (excludes user's own listings)
   */
  async getListings(params?: {
    search?: string;
    category?: string;
  }): Promise<MarketplaceListing[]> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.category) searchParams.set("category", params.category);

    const query = searchParams.toString();
    return api.get<MarketplaceListing[]>(
      `/marketplace/listings${query ? `?${query}` : ""}`
    );
  },

  /**
   * Get nearby listings within a radius
   */
  async getNearbyListings(
    latitude: number,
    longitude: number,
    radius: number = 10
  ): Promise<MarketplaceListingWithDistance[]> {
    return api.get<MarketplaceListingWithDistance[]>(
      `/marketplace/listings/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}`
    );
  },

  /**
   * Get user's own marketplace listings (as seller)
   */
  async getMyListings(): Promise<MarketplaceListing[]> {
    return api.get<MarketplaceListing[]>("/marketplace/my-listings");
  },

  /**
   * Get user's purchase history (as buyer)
   */
  async getMyPurchases(): Promise<MarketplaceListing[]> {
    return api.get<MarketplaceListing[]>("/marketplace/my-purchases");
  },

  /**
   * Get a single listing by ID
   */
  async getListing(id: number): Promise<MarketplaceListing> {
    return api.get<MarketplaceListing>(`/marketplace/listings/${id}`);
  },

  /**
   * Get similar listings for a given listing ID
   */
  async getSimilarListings(
    listingId: number,
    limit: number = 6
  ): Promise<{
    listings: MarketplaceListing[];
    targetListing: { id: number; title: string };
    fallback: boolean;
  }> {
    return api.get(`/marketplace/listings/${listingId}/similar?limit=${limit}`);
  },

  /**
   * Create a new marketplace listing
   */
  async createListing(
    data: CreateListingRequest
  ): Promise<MarketplaceListing> {
    return api.post<MarketplaceListing>("/marketplace/listings", data);
  },

  /**
   * Update an existing listing
   */
  async updateListing(
    id: number,
    data: UpdateListingRequest
  ): Promise<MarketplaceListing> {
    return api.patch<MarketplaceListing>(`/marketplace/listings/${id}`, data);
  },

  /**
   * Delete a listing
   */
  async deleteListing(id: number): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/marketplace/listings/${id}`);
  },

  /**
   * Mark a listing as sold
   */
  async completeListing(
    id: number,
    buyerId?: number
  ): Promise<{ message: string; points: { earned: number; action: string; newTotal: number }; newBadges?: Array<{ code: string; name: string; pointsAwarded: number }> }> {
    return api.post<{ message: string; points: { earned: number; action: string; newTotal: number }; newBadges?: Array<{ code: string; name: string; pointsAwarded: number }> }>(
      `/marketplace/listings/${id}/sold`,
      { buyerId }
    );
  },

  /**
   * Reserve a listing for a specific buyer (seller only)
   */
  async reserveListingForBuyer(id: number, buyerId: number): Promise<{ message: string }> {
    return api.post<{ message: string }>(`/marketplace/listings/${id}/reserve`, { buyerId });
  },

  /**
   * Get interested buyers for a listing (users who messaged about it)
   */
  async getInterestedBuyers(listingId: number): Promise<Array<{
    id: number;
    name: string;
    avatarUrl: string | null;
    conversationId: number;
  }>> {
    return api.get(`/marketplace/listings/${listingId}/interested-buyers`);
  },

  /**
   * Unreserve a listing (seller only)
   */
  async unreserveListing(id: number): Promise<{ message: string }> {
    return api.post<{ message: string }>(`/marketplace/listings/${id}/unreserve`);
  },

  /**
   * Buy a listing directly (as buyer)
   */
  async buyListing(id: number): Promise<{ message: string }> {
    return api.post<{ message: string }>(`/marketplace/listings/${id}/buy`);
  },

  /**
   * Get price recommendation based on original price, expiry date, and category
   */
  async getPriceRecommendation(params: {
    originalPrice: number;
    expiryDate?: string;
    category?: string;
  }): Promise<{
    recommended_price: number;
    min_price: number;
    max_price: number;
    original_price: number;
    discount_percentage: number;
    days_until_expiry: number;
    category: string;
    urgency_label: string;
    reasoning: string;
    fallback?: boolean;
  }> {
    return api.post("/marketplace/price-recommendation", params);
  },
};
