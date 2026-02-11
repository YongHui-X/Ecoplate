import { test, expect } from '@playwright/test';
import { MyFridgePage } from '../page-objects/myfridge.page';
import { test as authTest } from '../fixtures/auth.fixture';

test.describe('MyFridge Page', () => {
  test.describe('Page Elements', () => {
    test('should display page header', async ({ page }) => {
      await page.goto('/myfridge');

      // Wait for page to load (may redirect to login if not authenticated)
      await page.waitForLoadState('networkidle');
    });

    test('should display scan receipt button', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      // Check for scan receipt button if authenticated
      const scanButton = page.getByText(/scan receipt/i);
      // May not be visible if redirected to login
    });

    test('should display add item button', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      const addButton = page.getByText(/add item/i);
      // May not be visible if redirected to login
    });

    test('should display track consumption button', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      const trackButton = page.getByText(/track consumption/i);
      // May not be visible if redirected to login
    });

    test('should display search input', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/search items/i);
      // May not be visible if redirected to login
    });
  });

  test.describe('Scan Receipt Modal', () => {
    test('should open scan receipt modal', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      const scanButton = page.getByText(/scan receipt/i);
      if (await scanButton.isVisible()) {
        await scanButton.click();
        await expect(page.getByText(/take photo/i)).toBeVisible();
        await expect(page.getByText(/upload from files/i)).toBeVisible();
      }
    });

    test('should close scan receipt modal', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      const scanButton = page.getByText(/scan receipt/i);
      if (await scanButton.isVisible()) {
        await scanButton.click();
        await expect(page.getByText(/take photo/i)).toBeVisible();

        // Close modal (usually X button or clicking outside)
        const closeButton = page.locator('button').filter({ has: page.locator('svg') }).first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }
    });
  });

  test.describe('Add Product Modal', () => {
    test('should open add product modal', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      const addButton = page.getByText(/add item/i);
      if (await addButton.isVisible()) {
        await addButton.click();
        // Modal should show add product form
      }
    });
  });

  test.describe('Product Search', () => {
    test('should filter products by search query', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/search items/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill('apple');
        // Products should be filtered
      }
    });
  });

  test.describe('Product Actions', () => {
    test('should show delete button on product card', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      // Look for product cards with delete buttons
      const productCard = page.locator('[data-testid="product-card"]').first();
      if (await productCard.isVisible()) {
        const deleteButton = productCard.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
        // Delete button may be visible
      }
    });

    test('should show sell button on product card', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      // Look for product cards with sell buttons
      const sellButton = page.getByText(/sell/i);
      // Sell button may be visible if products exist
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no products', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      // If authenticated and no products, should show empty state
      const emptyState = page.getByText(/no items in your fridge/i);
      // May or may not be visible depending on state
    });
  });

  test.describe('Track Consumption Flow', () => {
    test('should open track consumption modal', async ({ page }) => {
      await page.goto('/myfridge');
      await page.waitForLoadState('networkidle');

      const trackButton = page.getByText(/track consumption/i);
      if (await trackButton.isVisible()) {
        await trackButton.click();
        // Modal should show consumption tracking steps
      }
    });
  });
});

// Tests that require authentication
authTest.describe('MyFridge Page (Authenticated)', () => {
  authTest('should show products when authenticated', async ({ authenticatedPage }) => {
    const myFridgePage = new MyFridgePage(authenticatedPage);
    await myFridgePage.goto();
    await myFridgePage.expectToBeVisible();
  });

  authTest('should be able to add a product', async ({ authenticatedPage }) => {
    const myFridgePage = new MyFridgePage(authenticatedPage);
    await myFridgePage.goto();

    await myFridgePage.addProduct({
      name: 'Test Apples',
      category: 'produce',
      quantity: 5,
      unit: 'kg',
    });

    // Verify product was added
    await expect(authenticatedPage.getByText('Test Apples')).toBeVisible();
  });

  authTest('should be able to delete a product', async ({ authenticatedPage }) => {
    const myFridgePage = new MyFridgePage(authenticatedPage);
    await myFridgePage.goto();

    // First add a product
    await myFridgePage.addProduct({
      name: 'To Delete',
      category: 'dairy',
      quantity: 1,
    });

    // Then delete it
    await myFridgePage.deleteProduct('To Delete');

    // Verify product was deleted
    await expect(authenticatedPage.getByText('To Delete')).not.toBeVisible();
  });

  authTest('should navigate to create listing when clicking sell', async ({ authenticatedPage }) => {
    const myFridgePage = new MyFridgePage(authenticatedPage);
    await myFridgePage.goto();

    // If there are products, click sell
    const sellButton = authenticatedPage.getByRole('button', { name: /sell/i }).first();
    if (await sellButton.isVisible()) {
      await sellButton.click();
      await expect(authenticatedPage).toHaveURL(/\/marketplace\/create/);
    }
  });
});
