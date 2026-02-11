/**
 * Direct API helpers for EcoLocker test data setup.
 * Uses the same base URL as the e2e config.
 */

import config from '../selenium.config';

const API_BASE = `${config.baseUrl}/api/v1`;

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function ecolockerRequest<T = unknown>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      ...options,
    });

    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    return {
      ok: response.ok,
      status: response.status,
      data: data as T,
      error: response.ok
        ? undefined
        : (data?.message as string) || (data?.error as string) || 'Request failed',
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
 * GET /api/v1/ecolocker/lockers
 */
export async function getEcoLockers(token: string) {
  return ecolockerRequest('/ecolocker/lockers', token);
}

/**
 * POST /api/v1/ecolocker/orders — create an order (reserve locker)
 */
export async function createEcoLockerOrder(
  token: string,
  listingId: number,
  lockerId: number
) {
  return ecolockerRequest('/ecolocker/orders', token, {
    method: 'POST',
    body: JSON.stringify({ listingId, lockerId }),
  });
}

/**
 * POST /api/v1/ecolocker/orders/:id/pay
 */
export async function payEcoLockerOrder(token: string, orderId: number) {
  return ecolockerRequest(`/ecolocker/orders/${orderId}/pay`, token, {
    method: 'POST',
  });
}

/**
 * GET /api/v1/ecolocker/orders — buyer orders
 */
export async function getEcoLockerOrders(token: string) {
  return ecolockerRequest('/ecolocker/orders', token);
}
