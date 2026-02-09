import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

// Mock Capacitor Geolocation with explicit implementation
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    getCurrentPosition: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
}));

describe('useGeolocation', () => {
  const mockPosition = {
    coords: {
      latitude: 1.3521,
      longitude: 103.8198,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Web Platform', () => {
    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      // Mock navigator.geolocation
      Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: {
          getCurrentPosition: vi.fn(),
          watchPosition: vi.fn(),
          clearWatch: vi.fn(),
        },
        writable: true,
        configurable: true,
      });
    });

    it('should initialize with default state', () => {
      const { result } = renderHook(() => useGeolocation());

      expect(result.current.coordinates).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.permission).toBeNull();
    });

    it('should get current position successfully', async () => {
      const { result } = renderHook(() => useGeolocation());

      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (success) => {
          success(mockPosition as GeolocationPosition);
        }
      );

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.coordinates).toEqual({
        latitude: 1.3521,
        longitude: 103.8198,
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.permission).toBe('granted');
    });

    it('should handle permission denied error', async () => {
      const { result } = renderHook(() => useGeolocation());

      const mockError = {
        code: 1, // PERMISSION_DENIED
        message: 'User denied geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };

      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (_, error) => {
          error!(mockError as GeolocationPositionError);
        }
      );

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.error).toBe('Location permission denied. Please enable location access in your browser settings.');
      expect(result.current.permission).toBe('denied');
      expect(result.current.coordinates).toBeNull();
    });

    it('should handle position unavailable error', async () => {
      const { result } = renderHook(() => useGeolocation());

      const mockError = {
        code: 2, // POSITION_UNAVAILABLE
        message: 'Position unavailable',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };

      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (_, error) => {
          error!(mockError as GeolocationPositionError);
        }
      );

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.error).toBe('Location unavailable. Your device may not have GPS or location services may be disabled.');
    });

    it('should handle timeout error', async () => {
      const { result } = renderHook(() => useGeolocation());

      const mockError = {
        code: 3, // TIMEOUT
        message: 'Timeout',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };

      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (_, error) => {
          error!(mockError as GeolocationPositionError);
        }
      );

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.error).toBe('Location request timed out. Please ensure location services are enabled and try again.');
    });

    it('should clear error', () => {
      const { result } = renderHook(() => useGeolocation());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should request permission', async () => {
      // Mock navigator.permissions to return granted
      const mockQuery = vi.fn().mockResolvedValue({ state: 'granted' });
      Object.defineProperty(navigator, 'permissions', {
        value: { query: mockQuery },
        configurable: true,
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        const granted = await result.current.requestPermission();
        expect(granted).toBe(true);
      });

      expect(result.current.permission).toBe('granted');
    });
  });

  describe('Native Platform', () => {
    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    });

    it('should check permissions on mount', async () => {
      vi.mocked(Geolocation.checkPermissions).mockResolvedValue({
        location: 'granted',
        coarseLocation: 'granted',
      });

      const { result } = renderHook(() => useGeolocation());

      await waitFor(() => {
        expect(result.current.permission).toBe('granted');
      });
    });

    it('should get current position successfully on native', async () => {
      vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue({
        coords: {
          latitude: 1.3521,
          longitude: 103.8198,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.coordinates).toEqual({
        latitude: 1.3521,
        longitude: 103.8198,
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should request permissions on native', async () => {
      vi.mocked(Geolocation.requestPermissions).mockResolvedValue({
        location: 'granted',
        coarseLocation: 'granted',
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        const granted = await result.current.requestPermission();
        expect(granted).toBe(true);
      });

      expect(result.current.permission).toBe('granted');
    });

    it('should handle denied permissions on native', async () => {
      vi.mocked(Geolocation.requestPermissions).mockResolvedValue({
        location: 'denied',
        coarseLocation: 'denied',
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        const granted = await result.current.requestPermission();
        expect(granted).toBe(false);
      });

      expect(result.current.permission).toBe('denied');
    });

    it('should handle geolocation errors on native', async () => {
      vi.mocked(Geolocation.getCurrentPosition).mockRejectedValue(
        new Error('GPS not available')
      );

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.error).toBe('GPS not available');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Options', () => {
    it('should respect enableHighAccuracy option', async () => {
      const { result } = renderHook(() =>
        useGeolocation({ enableHighAccuracy: false })
      );

      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (success, _, options) => {
          expect(options?.enableHighAccuracy).toBe(false);
          success(mockPosition as GeolocationPosition);
        }
      );

      await act(async () => {
        await result.current.getCurrentPosition();
      });
    });

    it('should respect timeout option', async () => {
      const { result } = renderHook(() =>
        useGeolocation({ timeout: 5000 })
      );

      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (success, _, options) => {
          expect(options?.timeout).toBe(5000);
          success(mockPosition as GeolocationPosition);
        }
      );

      await act(async () => {
        await result.current.getCurrentPosition();
      });
    });

    it('should respect maximumAge option', async () => {
      const { result } = renderHook(() =>
        useGeolocation({ maximumAge: 60000 })
      );

      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (success, _, options) => {
          expect(options?.maximumAge).toBe(60000);
          success(mockPosition as GeolocationPosition);
        }
      );

      await act(async () => {
        await result.current.getCurrentPosition();
      });
    });
  });
});
