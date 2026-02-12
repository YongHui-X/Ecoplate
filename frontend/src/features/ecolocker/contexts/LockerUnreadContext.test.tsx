import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { LockerUnreadProvider, useLockerUnread } from './LockerUnreadContext';

// Mock the locker-api
vi.mock('../services/locker-api', () => ({
  notificationApi: {
    getUnreadCount: vi.fn(),
  },
}));

import { notificationApi } from '../services/locker-api';

const mockGetUnreadCount = vi.mocked(notificationApi.getUnreadCount);

// Test component that uses the context
function TestConsumer() {
  const { lockerUnreadCount, refreshLockerUnreadCount } = useLockerUnread();
  return (
    <div>
      <span data-testid="count">{lockerUnreadCount}</span>
      <button onClick={refreshLockerUnreadCount}>Refresh</button>
    </div>
  );
}

describe('LockerUnreadContext', () => {
  let localStorageStore: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    localStorageStore = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return localStorageStore[key] || null;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageStore[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete localStorageStore[key];
    });

    // Default: not resolving (to avoid interval issues)
    mockGetUnreadCount.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LockerUnreadProvider', () => {
    it('should provide initial count of 0 when not logged in', () => {
      render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });

    it('should load cached count on mount', () => {
      localStorageStore['ecoplate_locker_unread_count'] = '5';

      render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      expect(screen.getByTestId('count')).toHaveTextContent('5');
    });

    it('should fetch unread count when logged in', async () => {
      localStorageStore['token'] = 'test-token';
      mockGetUnreadCount.mockResolvedValueOnce({ count: 3 });

      render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      await waitFor(() => {
        expect(mockGetUnreadCount).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('3');
      });
    });

    it('should cache the count after fetching', async () => {
      localStorageStore['token'] = 'test-token';
      mockGetUnreadCount.mockResolvedValueOnce({ count: 7 });

      render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      await waitFor(() => {
        expect(localStorageStore['ecoplate_locker_unread_count']).toBe('7');
      });
    });

    it('should set count to 0 when not logged in during refresh', async () => {
      // No token = not logged in

      render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      await act(async () => {
        screen.getByText('Refresh').click();
      });

      expect(screen.getByTestId('count')).toHaveTextContent('0');
      expect(mockGetUnreadCount).not.toHaveBeenCalled();
    });

    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('auth:login', expect.any(Function));
    });

    it('should keep showing cached value on API error', async () => {
      localStorageStore['token'] = 'test-token';
      localStorageStore['ecoplate_locker_unread_count'] = '5';
      mockGetUnreadCount.mockRejectedValueOnce(new Error('API error'));

      render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      await waitFor(() => {
        expect(mockGetUnreadCount).toHaveBeenCalled();
      });

      // Should still show cached value
      expect(screen.getByTestId('count')).toHaveTextContent('5');
    });
  });

  describe('useLockerUnread', () => {
    it('should throw error when used outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useLockerUnread must be used within LockerUnreadProvider');

      consoleError.mockRestore();
    });

    it('should allow manual refresh', async () => {
      localStorageStore['token'] = 'test-token';
      mockGetUnreadCount
        .mockResolvedValueOnce({ count: 4 })
        .mockResolvedValueOnce({ count: 8 });

      render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('4');
      });

      // Test refresh function
      await act(async () => {
        screen.getByText('Refresh').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('8');
      });
    });
  });

  describe('localStorage edge cases', () => {
    it('should handle invalid cached count gracefully', () => {
      localStorageStore['ecoplate_locker_unread_count'] = 'invalid';

      render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      // NaN becomes 0
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });

    it('should handle empty string cached count', () => {
      localStorageStore['ecoplate_locker_unread_count'] = '';

      render(
        <LockerUnreadProvider>
          <TestConsumer />
        </LockerUnreadProvider>
      );

      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });
});
