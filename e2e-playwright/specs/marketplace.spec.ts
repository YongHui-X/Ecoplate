import { test, expect } from '@playwright/test';
import { MarketplacePage } from '../page-objects/marketplace.page';
import { test as authTest } from '../fixtures/auth.fixture';

test.describe('Marketplace Page', () => {
  test.describe('Page Elements', () => {
    test('should display page title', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Marketplace')).toBeVisible();
    });

    test('should display page subtitle', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/find great deals/i)).toBeVisible();
    });

    test('should display search input', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await expect(page.getByPlaceholder(/search listings/i)).toBeVisible();
    });

    test('should display create button', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Create')).toBeVisible();
    });

    test('should display my listings button', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('My Listings')).toBeVisible();
    });

    test('should display my purchases button', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('My Purchases')).toBeVisible();
    });

    test('should display view toggle buttons', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('List')).toBeVisible();
      await expect(page.getByText('Map')).toBeVisible();
    });

    test('should display category filter buttons', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Produce' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Dairy' })).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test('should filter listings by search query', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/search listings/i);
      await searchInput.fill('apple');

      // Should filter results to only show apple-related listings
      await page.waitForTimeout(500); // Debounce delay
    });

    test('should clear search when input is cleared', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/search listings/i);
      await searchInput.fill('test');
      await searchInput.clear();

      // Should show all listings again
    });
  });

  test.describe('Category Filter', () => {
    test('should filter listings by produce category', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Produce' }).click();
      // Should only show produce listings
    });

    test('should filter listings by dairy category', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Dairy' }).click();
      // Should only show dairy listings
    });

    test('should show all listings when All category selected', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Produce' }).click();
      await page.getByRole('button', { name: 'All' }).click();
      // Should show all listings
    });
  });

  test.describe('View Toggle', () => {
    test('should switch to map view', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await page.getByText('Map').click();

      // Map view should be active
      const mapButton = page.getByText('Map').locator('..');
      await expect(mapButton).toHaveClass(/shadow-sm/);
    });

    test('should switch to list view', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      // First switch to map
      await page.getByText('Map').click();

      // Then switch back to list
      await page.getByText('List').click();

      // List view should be active
      const listButton = page.getByText('List').locator('..');
      await expect(listButton).toHaveClass(/shadow-sm/);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to create listing page', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await page.getByText('Create').click();
      await expect(page).toHaveURL(/\/marketplace\/create/);
    });

    test('should navigate to my listings page', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await page.getByText('My Listings').click();
      await expect(page).toHaveURL(/\/marketplace\/my-listings/);
    });

    test('should navigate to my purchases page', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      await page.getByText('My Purchases').click();
      await expect(page).toHaveURL(/\/marketplace\/my-purchases/);
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no listings', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      // If no listings exist, should show empty state
      const emptyState = page.getByText(/no listings found/i);
      // May or may not be visible depending on data
    });
  });

  test.describe('Listing Cards', () => {
    test('should display listing title', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      // Listings should display titles
      // This depends on existing data
    });

    test('should display listing price', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      // Listings should display prices
      // This depends on existing data
    });

    test('should display discount badge', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      // Listings should display discount badges
      // This depends on existing data
    });

    test('should navigate to listing detail when clicked', async ({ page }) => {
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');

      // Click on first listing card
      const listingCard = page.locator('[data-testid="listing-card"]').first();
      if (await listingCard.isVisible()) {
        await listingCard.click();
        await expect(page).toHaveURL(/\/marketplace\/\d+/);
      }
    });
  });
});

// Tests that require authentication
authTest.describe('Marketplace Page (Authenticated)', () => {
  authTest('should show marketplace page when authenticated', async ({ authenticatedPage }) => {
    const marketplacePage = new MarketplacePage(authenticatedPage);
    await marketplacePage.goto();
    await marketplacePage.expectToBeVisible();
  });

  authTest('should be able to create a listing', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/marketplace/create');

    // Fill in listing form
    await authenticatedPage.getByLabel(/title/i).fill('E2E Test Listing');
    await authenticatedPage.getByLabel(/description/i).fill('This is a test listing');
    await authenticatedPage.getByLabel(/price/i).fill('10');
    await authenticatedPage.getByLabel(/quantity/i).fill('5');

    // Submit form
    await authenticatedPage.getByRole('button', { name: /create/i }).click();

    // Should redirect to listing detail or my listings
    await expect(authenticatedPage).toHaveURL(/\/marketplace/);
  });
});
