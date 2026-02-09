/**
 * Direct API Helpers for Test Data Setup
 */

import config from '../selenium.config';
import { primaryUser, secondaryUser } from '../fixtures/users';

const API_BASE = `${config.baseUrl}/api`;

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Make an API request
 */
async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json().catch(() => null) as Record<string, unknown> | null;

    return {
      ok: response.ok,
      status: response.status,
      data: data as T,
      error: response.ok ? undefined : ((data?.message as string) || (data?.error as string) || 'Request failed'),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Login and get auth token
 */
export async function getAuthToken(email: string = primaryUser.email, password: string = primaryUser.password): Promise<string | null> {
  const response = await apiRequest<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (response.ok && response.data?.token) {
    return response.data.token;
  }
  return null;
}

/**
 * Make an authenticated API request
 */
async function authenticatedRequest<T = unknown>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

/**
 * Get user's products (MyFridge items)
 */
export async function getUserProducts(token: string): Promise<ApiResponse<unknown[]>> {
  return authenticatedRequest<unknown[]>('/products', token);
}

/**
 * Get marketplace listings
 */
export async function getMarketplaceListings(token: string): Promise<ApiResponse<unknown[]>> {
  return authenticatedRequest<unknown[]>('/marketplace/listings', token);
}

/**
 * Create a test product
 */
export async function createTestProduct(
  token: string,
  product: {
    productName: string;
    category: string;
    quantity: number;
    unit: string;
    purchaseDate?: string;
  }
): Promise<ApiResponse<unknown>> {
  return authenticatedRequest('/products', token, {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

/**
 * Create a test listing
 */
export async function createTestListing(
  token: string,
  listing: {
    title: string;
    description: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
    originalPrice: number;
    expiryDate: string;
    pickupLocation: string;
  }
): Promise<ApiResponse<unknown>> {
  return authenticatedRequest('/marketplace/listings', token, {
    method: 'POST',
    body: JSON.stringify(listing),
  });
}

/**
 * Get user's EcoPoints
 */
export async function getUserPoints(token: string): Promise<ApiResponse<{ totalPoints: number; currentStreak: number }>> {
  return authenticatedRequest('/gamification/points', token);
}

/**
 * Get user's badges
 */
export async function getUserBadges(token: string): Promise<ApiResponse<unknown[]>> {
  return authenticatedRequest('/gamification/badges', token);
}

/**
 * Get user's conversations
 */
export async function getUserConversations(token: string): Promise<ApiResponse<unknown[]>> {
  return authenticatedRequest('/messages/conversations', token);
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  const response = await apiRequest('/health');
  return response.ok;
}

/**
 * Setup test data via API
 */
export async function setupTestData(): Promise<{ primaryToken: string; secondaryToken: string } | null> {
  const primaryToken = await getAuthToken(primaryUser.email, primaryUser.password);
  const secondaryToken = await getAuthToken(secondaryUser.email, secondaryUser.password);

  if (!primaryToken || !secondaryToken) {
    console.error('Failed to get auth tokens for test setup');
    return null;
  }

  return { primaryToken, secondaryToken };
}
