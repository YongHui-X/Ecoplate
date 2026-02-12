import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isNetworkError, getErrorMessage, useOnlineStatus } from './network';

describe('network utilities', () => {
  describe('isNetworkError', () => {
    it('should return true for "Failed to fetch" TypeError', () => {
      const error = new TypeError('Failed to fetch');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return true for "Network request failed" TypeError', () => {
      const error = new TypeError('Network request failed');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return true for "NetworkError" TypeError', () => {
      const error = new TypeError('NetworkError when attempting to fetch resource');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return true for "net::ERR_" TypeError', () => {
      const error = new TypeError('net::ERR_CONNECTION_REFUSED');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for regular TypeError', () => {
      const error = new TypeError('Cannot read property of undefined');
      expect(isNetworkError(error)).toBe(false);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Some error');
      expect(isNetworkError(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isNetworkError('string error')).toBe(false);
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
      expect(isNetworkError(123)).toBe(false);
      expect(isNetworkError({ message: 'Failed to fetch' })).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    describe('network errors', () => {
      it('should return network error message for fetch failures', () => {
        const error = new TypeError('Failed to fetch');
        expect(getErrorMessage(error)).toBe(
          'Unable to connect. Please check your internet connection.'
        );
      });
    });

    describe('HTTP status errors', () => {
      it('should return session expired message for 401 errors', () => {
        const error = new Error('401 Unauthorized');
        expect(getErrorMessage(error)).toBe('Session expired. Please log in again.');
      });

      it('should return session expired message for "Unauthorized" errors', () => {
        const error = new Error('Unauthorized access');
        expect(getErrorMessage(error)).toBe('Session expired. Please log in again.');
      });

      it('should return permission denied message for 403 errors', () => {
        const error = new Error('403 Forbidden');
        expect(getErrorMessage(error)).toBe(
          "You don't have permission to perform this action."
        );
      });

      it('should return permission denied message for "Forbidden" errors', () => {
        const error = new Error('Forbidden resource');
        expect(getErrorMessage(error)).toBe(
          "You don't have permission to perform this action."
        );
      });

      it('should return not found message for 404 errors', () => {
        const error = new Error('404 Not Found');
        expect(getErrorMessage(error)).toBe('The requested item could not be found.');
      });

      it('should return not found message for "Not found" errors', () => {
        const error = new Error('Not found');
        expect(getErrorMessage(error)).toBe('The requested item could not be found.');
      });

      it('should return server error message for 500 errors', () => {
        const error = new Error('500 Internal Server Error');
        expect(getErrorMessage(error)).toBe(
          'Something went wrong on our end. Please try again.'
        );
      });

      it('should return server error message for "Internal" errors', () => {
        const error = new Error('Internal server error occurred');
        expect(getErrorMessage(error)).toBe(
          'Something went wrong on our end. Please try again.'
        );
      });
    });

    describe('generic errors', () => {
      it('should return error message for unrecognized Error', () => {
        const error = new Error('Custom error message');
        expect(getErrorMessage(error)).toBe('Custom error message');
      });

      it('should return generic message for non-Error values', () => {
        expect(getErrorMessage('string')).toBe(
          'An unexpected error occurred. Please try again.'
        );
        expect(getErrorMessage(null)).toBe(
          'An unexpected error occurred. Please try again.'
        );
        expect(getErrorMessage(undefined)).toBe(
          'An unexpected error occurred. Please try again.'
        );
        expect(getErrorMessage(123)).toBe(
          'An unexpected error occurred. Please try again.'
        );
      });
    });
  });

  describe('useOnlineStatus', () => {
    const originalNavigator = global.navigator;

    beforeEach(() => {
      // Reset navigator.onLine mock
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('should return true when navigator.onLine is true', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current).toBe(true);
    });

    it('should return false when navigator.onLine is false', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current).toBe(false);
    });

    it('should update to true when online event fires', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current).toBe(false);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(result.current).toBe(true);
    });

    it('should update to false when offline event fires', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current).toBe(true);

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current).toBe(false);
    });

    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useOnlineStatus());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should handle multiple state changes', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current).toBe(true);

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(result.current).toBe(false);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(result.current).toBe(true);

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(result.current).toBe(false);
    });
  });
});
