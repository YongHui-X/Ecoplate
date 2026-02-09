import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';

// Mock the api module
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { api } from '../services/api';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Test component that uses useAuth
function TestComponent() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {user ? (
        <>
          <div data-testid="user-name">{user.name}</div>
          <div data-testid="user-email">{user.email}</div>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <>
          <div>Not logged in</div>
          <button onClick={() => login('test@example.com', 'password')}>
            Login
          </button>
        </>
      )}
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.store = {};
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('AuthProvider', () => {
    it('should show not logged in initially', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Not logged in')).toBeInTheDocument();
      });
    });

    it('should restore user from localStorage', async () => {
      const storedUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      localStorageMock.store.token = 'test-token';
      localStorageMock.store.user = JSON.stringify(storedUser);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      });
    });

    it('should handle corrupted localStorage data', async () => {
      localStorageMock.store.token = 'test-token';
      localStorageMock.store.user = 'invalid-json';

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Not logged in')).toBeInTheDocument();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    });

    it('should login successfully', async () => {
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      const mockResponse = { user: mockUser, token: 'new-token' };
      vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Not logged in')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
    });

    it('should logout successfully', async () => {
      const storedUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      localStorageMock.store.token = 'test-token';
      localStorageMock.store.user = JSON.stringify(storedUser);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Logout'));

      await waitFor(() => {
        expect(screen.getByText('Not logged in')).toBeInTheDocument();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    });
  });
});
