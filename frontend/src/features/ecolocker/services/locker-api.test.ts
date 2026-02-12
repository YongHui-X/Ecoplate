import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lockerApi, orderApi, notificationApi, marketplaceApi } from './locker-api';
import { api } from '@/services/api';

// Mock the api module
vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockApi = vi.mocked(api);

describe('locker-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('lockerApi', () => {
    describe('getAll', () => {
      it('should call GET /ecolocker/lockers', async () => {
        const mockLockers = [
          { id: 1, name: 'Locker A', lat: 1.35, lng: 103.82 },
          { id: 2, name: 'Locker B', lat: 1.36, lng: 103.83 },
        ];
        mockApi.get.mockResolvedValue(mockLockers);

        const result = await lockerApi.getAll();

        expect(mockApi.get).toHaveBeenCalledWith('/ecolocker/lockers');
        expect(result).toEqual(mockLockers);
      });
    });

    describe('getNearby', () => {
      it('should call GET /ecolocker/lockers/nearby with coordinates', async () => {
        const mockLockers = [{ id: 1, name: 'Nearby Locker' }];
        mockApi.get.mockResolvedValue(mockLockers);

        const result = await lockerApi.getNearby(1.35, 103.82);

        expect(mockApi.get).toHaveBeenCalledWith(
          '/ecolocker/lockers/nearby?lat=1.35&lng=103.82&radius=10'
        );
        expect(result).toEqual(mockLockers);
      });

      it('should allow custom radius', async () => {
        mockApi.get.mockResolvedValue([]);

        await lockerApi.getNearby(1.35, 103.82, 20);

        expect(mockApi.get).toHaveBeenCalledWith(
          '/ecolocker/lockers/nearby?lat=1.35&lng=103.82&radius=20'
        );
      });
    });

    describe('getById', () => {
      it('should call GET /ecolocker/lockers/:id', async () => {
        const mockLocker = { id: 1, name: 'Locker A' };
        mockApi.get.mockResolvedValue(mockLocker);

        const result = await lockerApi.getById(1);

        expect(mockApi.get).toHaveBeenCalledWith('/ecolocker/lockers/1');
        expect(result).toEqual(mockLocker);
      });
    });
  });

  describe('orderApi', () => {
    describe('create', () => {
      it('should call POST /ecolocker/orders with listingId and lockerId', async () => {
        const mockOrder = { id: 1, status: 'pending' };
        mockApi.post.mockResolvedValue(mockOrder);

        const result = await orderApi.create(10, 5);

        expect(mockApi.post).toHaveBeenCalledWith('/ecolocker/orders', {
          listingId: 10,
          lockerId: 5,
        });
        expect(result).toEqual(mockOrder);
      });
    });

    describe('getBuyerOrders', () => {
      it('should call GET /ecolocker/orders', async () => {
        const mockOrders = [{ id: 1 }, { id: 2 }];
        mockApi.get.mockResolvedValue(mockOrders);

        const result = await orderApi.getBuyerOrders();

        expect(mockApi.get).toHaveBeenCalledWith('/ecolocker/orders');
        expect(result).toEqual(mockOrders);
      });
    });

    describe('getSellerOrders', () => {
      it('should call GET /ecolocker/orders/seller', async () => {
        const mockOrders = [{ id: 1 }];
        mockApi.get.mockResolvedValue(mockOrders);

        const result = await orderApi.getSellerOrders();

        expect(mockApi.get).toHaveBeenCalledWith('/ecolocker/orders/seller');
        expect(result).toEqual(mockOrders);
      });
    });

    describe('getById', () => {
      it('should call GET /ecolocker/orders/:id', async () => {
        const mockOrder = { id: 1, status: 'paid' };
        mockApi.get.mockResolvedValue(mockOrder);

        const result = await orderApi.getById(1);

        expect(mockApi.get).toHaveBeenCalledWith('/ecolocker/orders/1');
        expect(result).toEqual(mockOrder);
      });
    });

    describe('pay', () => {
      it('should call POST /ecolocker/orders/:id/pay', async () => {
        const mockOrder = { id: 1, status: 'paid' };
        mockApi.post.mockResolvedValue(mockOrder);

        const result = await orderApi.pay(1);

        expect(mockApi.post).toHaveBeenCalledWith('/ecolocker/orders/1/pay');
        expect(result).toEqual(mockOrder);
      });
    });

    describe('schedule', () => {
      it('should call POST /ecolocker/orders/:id/schedule with pickupTime', async () => {
        const mockOrder = { id: 1, status: 'scheduled' };
        mockApi.post.mockResolvedValue(mockOrder);

        const result = await orderApi.schedule(1, '2024-01-15T10:00:00Z');

        expect(mockApi.post).toHaveBeenCalledWith('/ecolocker/orders/1/schedule', {
          pickupTime: '2024-01-15T10:00:00Z',
        });
        expect(result).toEqual(mockOrder);
      });
    });

    describe('confirmRiderPickup', () => {
      it('should call POST /ecolocker/orders/:id/confirm-pickup', async () => {
        const mockResponse = { order: { id: 1 }, pointsAwarded: 50 };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await orderApi.confirmRiderPickup(1);

        expect(mockApi.post).toHaveBeenCalledWith('/ecolocker/orders/1/confirm-pickup');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('verifyPin', () => {
      it('should call POST /ecolocker/orders/:id/verify-pin with pin', async () => {
        const mockResponse = { order: { id: 1, status: 'completed' } };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await orderApi.verifyPin(1, '1234');

        expect(mockApi.post).toHaveBeenCalledWith('/ecolocker/orders/1/verify-pin', {
          pin: '1234',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('cancel', () => {
      it('should call POST /ecolocker/orders/:id/cancel with reason', async () => {
        const mockOrder = { id: 1, status: 'cancelled' };
        mockApi.post.mockResolvedValue(mockOrder);

        const result = await orderApi.cancel(1, 'Changed my mind');

        expect(mockApi.post).toHaveBeenCalledWith('/ecolocker/orders/1/cancel', {
          reason: 'Changed my mind',
        });
        expect(result).toEqual(mockOrder);
      });
    });
  });

  describe('notificationApi', () => {
    describe('getAll', () => {
      it('should call GET /ecolocker/notifications', async () => {
        const mockNotifications = [{ id: 1, message: 'Test' }];
        mockApi.get.mockResolvedValue(mockNotifications);

        const result = await notificationApi.getAll();

        expect(mockApi.get).toHaveBeenCalledWith('/ecolocker/notifications');
        expect(result).toEqual(mockNotifications);
      });
    });

    describe('getUnreadCount', () => {
      it('should call GET /ecolocker/notifications/unread-count', async () => {
        const mockResponse = { count: 5 };
        mockApi.get.mockResolvedValue(mockResponse);

        const result = await notificationApi.getUnreadCount();

        expect(mockApi.get).toHaveBeenCalledWith('/ecolocker/notifications/unread-count');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('markAsRead', () => {
      it('should call PATCH /ecolocker/notifications/:id/read', async () => {
        const mockResponse = { success: true };
        mockApi.patch.mockResolvedValue(mockResponse);

        const result = await notificationApi.markAsRead(1);

        expect(mockApi.patch).toHaveBeenCalledWith('/ecolocker/notifications/1/read');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('markAllAsRead', () => {
      it('should call POST /ecolocker/notifications/mark-all-read', async () => {
        const mockResponse = { success: true };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await notificationApi.markAllAsRead();

        expect(mockApi.post).toHaveBeenCalledWith('/ecolocker/notifications/mark-all-read');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('markOrderAsRead', () => {
      it('should call POST /ecolocker/orders/:id/notifications/read', async () => {
        const mockResponse = { success: true };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await notificationApi.markOrderAsRead(1);

        expect(mockApi.post).toHaveBeenCalledWith('/ecolocker/orders/1/notifications/read');
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('marketplaceApi', () => {
    describe('getListing', () => {
      it('should call GET /marketplace/listings/:id', async () => {
        const mockListing = {
          id: 1,
          title: 'Fresh Apples',
          description: 'Organic apples',
          price: 5.99,
          status: 'active',
          seller: { id: 1, name: 'John' },
        };
        mockApi.get.mockResolvedValue(mockListing);

        const result = await marketplaceApi.getListing(1);

        expect(mockApi.get).toHaveBeenCalledWith('/marketplace/listings/1');
        expect(result).toEqual(mockListing);
      });
    });
  });
});
