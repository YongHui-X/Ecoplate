import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marketplaceService } from './marketplace';

// Mock the api module
vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from './api';

describe('marketplaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getListings', () => {
    it('should fetch listings without params', async () => {
      const mockListings = [{ id: 1, title: 'Test' }];
      vi.mocked(api.get).mockResolvedValueOnce(mockListings);

      const result = await marketplaceService.getListings();

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings');
      expect(result).toEqual(mockListings);
    });

    it('should fetch listings with search params', async () => {
      const mockListings = [{ id: 1, title: 'Apple' }];
      vi.mocked(api.get).mockResolvedValueOnce(mockListings);

      const result = await marketplaceService.getListings({ search: 'apple', category: 'produce' });

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings?search=apple&category=produce');
      expect(result).toEqual(mockListings);
    });

    it('should handle only search param', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([]);

      await marketplaceService.getListings({ search: 'test' });

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings?search=test');
    });

    it('should handle only category param', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([]);

      await marketplaceService.getListings({ category: 'dairy' });

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings?category=dairy');
    });
  });

  describe('getNearbyListings', () => {
    it('should fetch nearby listings with default radius', async () => {
      const mockListings = [{ id: 1, distance: 5 }];
      vi.mocked(api.get).mockResolvedValueOnce(mockListings);

      const result = await marketplaceService.getNearbyListings(1.3521, 103.8198);

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings/nearby?lat=1.3521&lng=103.8198&radius=10');
      expect(result).toEqual(mockListings);
    });

    it('should fetch nearby listings with custom radius', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([]);

      await marketplaceService.getNearbyListings(1.3521, 103.8198, 5);

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings/nearby?lat=1.3521&lng=103.8198&radius=5');
    });
  });

  describe('getMyListings', () => {
    it('should fetch user listings', async () => {
      const mockListings = [{ id: 1, sellerId: 1 }];
      vi.mocked(api.get).mockResolvedValueOnce(mockListings);

      const result = await marketplaceService.getMyListings();

      expect(api.get).toHaveBeenCalledWith('/marketplace/my-listings');
      expect(result).toEqual(mockListings);
    });
  });

  describe('getMyPurchases', () => {
    it('should fetch user purchases', async () => {
      const mockPurchases = [{ id: 1, buyerId: 1 }];
      vi.mocked(api.get).mockResolvedValueOnce(mockPurchases);

      const result = await marketplaceService.getMyPurchases();

      expect(api.get).toHaveBeenCalledWith('/marketplace/my-purchases');
      expect(result).toEqual(mockPurchases);
    });
  });

  describe('getListing', () => {
    it('should fetch a single listing', async () => {
      const mockListing = { id: 1, title: 'Test' };
      vi.mocked(api.get).mockResolvedValueOnce(mockListing);

      const result = await marketplaceService.getListing(1);

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings/1');
      expect(result).toEqual(mockListing);
    });
  });

  describe('getSimilarListings', () => {
    it('should fetch similar listings with default limit', async () => {
      const mockResponse = { listings: [], targetListing: { id: 1, title: 'Test' }, fallback: false };
      vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

      const result = await marketplaceService.getSimilarListings(1);

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings/1/similar?limit=6');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch similar listings with custom limit', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ listings: [], targetListing: { id: 1, title: 'Test' }, fallback: false });

      await marketplaceService.getSimilarListings(1, 10);

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings/1/similar?limit=10');
    });
  });

  describe('createListing', () => {
    it('should create a new listing', async () => {
      const mockListing = { id: 1, title: 'New Listing' };
      const createData = { title: 'New Listing', price: 10, category: 'produce' };
      vi.mocked(api.post).mockResolvedValueOnce(mockListing);

      const result = await marketplaceService.createListing(createData as any);

      expect(api.post).toHaveBeenCalledWith('/marketplace/listings', createData);
      expect(result).toEqual(mockListing);
    });
  });

  describe('updateListing', () => {
    it('should update an existing listing', async () => {
      const mockListing = { id: 1, title: 'Updated' };
      vi.mocked(api.patch).mockResolvedValueOnce(mockListing);

      const result = await marketplaceService.updateListing(1, { title: 'Updated' });

      expect(api.patch).toHaveBeenCalledWith('/marketplace/listings/1', { title: 'Updated' });
      expect(result).toEqual(mockListing);
    });
  });

  describe('deleteListing', () => {
    it('should delete a listing', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ message: 'Deleted' });

      const result = await marketplaceService.deleteListing(1);

      expect(api.delete).toHaveBeenCalledWith('/marketplace/listings/1');
      expect(result).toEqual({ message: 'Deleted' });
    });
  });

  describe('completeListing', () => {
    it('should mark listing as sold without buyer', async () => {
      const mockResponse = { message: 'Sold', points: { earned: 10, action: 'sold', newTotal: 100 } };
      vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

      const result = await marketplaceService.completeListing(1);

      expect(api.post).toHaveBeenCalledWith('/marketplace/listings/1/sold', { buyerId: undefined });
      expect(result).toEqual(mockResponse);
    });

    it('should mark listing as sold with buyer', async () => {
      const mockResponse = { message: 'Sold', points: { earned: 10, action: 'sold', newTotal: 100 } };
      vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

      const result = await marketplaceService.completeListing(1, 2);

      expect(api.post).toHaveBeenCalledWith('/marketplace/listings/1/sold', { buyerId: 2 });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('reserveListingForBuyer', () => {
    it('should reserve listing for a buyer', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ message: 'Reserved' });

      const result = await marketplaceService.reserveListingForBuyer(1, 2);

      expect(api.post).toHaveBeenCalledWith('/marketplace/listings/1/reserve', { buyerId: 2 });
      expect(result).toEqual({ message: 'Reserved' });
    });
  });

  describe('getInterestedBuyers', () => {
    it('should get interested buyers', async () => {
      const mockBuyers = [{ id: 1, name: 'Buyer', conversationId: 1 }];
      vi.mocked(api.get).mockResolvedValueOnce(mockBuyers);

      const result = await marketplaceService.getInterestedBuyers(1);

      expect(api.get).toHaveBeenCalledWith('/marketplace/listings/1/interested-buyers');
      expect(result).toEqual(mockBuyers);
    });
  });

  describe('unreserveListing', () => {
    it('should unreserve a listing', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ message: 'Unreserved' });

      const result = await marketplaceService.unreserveListing(1);

      expect(api.post).toHaveBeenCalledWith('/marketplace/listings/1/unreserve');
      expect(result).toEqual({ message: 'Unreserved' });
    });
  });

  describe('buyListing', () => {
    it('should buy a listing', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ message: 'Purchased' });

      const result = await marketplaceService.buyListing(1);

      expect(api.post).toHaveBeenCalledWith('/marketplace/listings/1/buy');
      expect(result).toEqual({ message: 'Purchased' });
    });
  });

  describe('getPriceRecommendation', () => {
    it('should get price recommendation', async () => {
      const mockRecommendation = {
        recommended_price: 8,
        min_price: 6,
        max_price: 10,
        original_price: 12,
        discount_percentage: 33,
        days_until_expiry: 5,
        category: 'produce',
        urgency_label: 'moderate',
        reasoning: 'Based on expiry',
      };
      vi.mocked(api.post).mockResolvedValueOnce(mockRecommendation);

      const result = await marketplaceService.getPriceRecommendation({
        originalPrice: 12,
        expiryDate: '2024-01-20',
        category: 'produce',
      });

      expect(api.post).toHaveBeenCalledWith('/marketplace/price-recommendation', {
        originalPrice: 12,
        expiryDate: '2024-01-20',
        category: 'produce',
      });
      expect(result).toEqual(mockRecommendation);
    });
  });
});
