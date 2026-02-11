import { test as base, Page } from '@playwright/test';

/**
 * Test user credentials for E2E testing
 */
export const testUser = {
  email: 'e2e-test@example.com',
  password: 'TestPassword123!',
  name: 'E2E Test User',
};

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  /**
   * Provides a page that's already logged in
   */
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in credentials
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/password/i).fill(testUser.password);

    // Submit login form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation to complete (dashboard or home)
    await page.waitForURL(/\/(dashboard|myfridge|marketplace)?$/);

    // Use the authenticated page
    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper function to login programmatically via API
 */
export async function loginViaApi(page: Page, email: string, password: string): Promise<string> {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  const data = await response.json();
  const token = data.token;

  // Store token in localStorage
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
  }, token);

  return token;
}

/**
 * Helper function to logout
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('token');
  });
  await page.reload();
}

/**
 * Helper function to check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  return !!token;
}
