import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for MyFridge Page
 */
export class MyFridgePage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly scanReceiptButton: Locator;
  readonly addItemButton: Locator;
  readonly trackConsumptionButton: Locator;
  readonly searchInput: Locator;
  readonly productCards: Locator;
  readonly emptyState: Locator;
  readonly totalCarbonFootprint: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: /my fridge/i });
    this.scanReceiptButton = page.getByRole('button', { name: /scan receipt/i });
    this.addItemButton = page.getByRole('button', { name: /add item/i });
    this.trackConsumptionButton = page.getByRole('button', { name: /track consumption/i });
    this.searchInput = page.getByPlaceholder(/search items/i);
    this.productCards = page.locator('[data-testid="product-card"]');
    this.emptyState = page.getByText(/no items in your fridge/i);
    this.totalCarbonFootprint = page.getByText(/total carbon footprint/i);
  }

  /**
   * Navigate to MyFridge page
   */
  async goto() {
    await this.page.goto('/myfridge');
  }

  /**
   * Open scan receipt modal
   */
  async openScanReceiptModal() {
    await this.scanReceiptButton.click();
    await expect(this.page.getByText(/take photo/i)).toBeVisible();
  }

  /**
   * Open add item modal
   */
  async openAddItemModal() {
    await this.addItemButton.click();
    await expect(this.page.getByText(/add product/i)).toBeVisible();
  }

  /**
   * Search for products
   */
  async searchProducts(query: string) {
    await this.searchInput.fill(query);
  }

  /**
   * Get product card by name
   */
  getProductCard(name: string): Locator {
    return this.page.locator(`[data-testid="product-card"]:has-text("${name}")`);
  }

  /**
   * Delete a product by name
   */
  async deleteProduct(name: string) {
    const card = this.getProductCard(name);
    await card.getByRole('button', { name: /delete/i }).click();
  }

  /**
   * Click sell button on a product
   */
  async sellProduct(name: string) {
    const card = this.getProductCard(name);
    await card.getByRole('button', { name: /sell/i }).click();
  }

  /**
   * Verify page is loaded
   */
  async expectToBeVisible() {
    await expect(this.scanReceiptButton).toBeVisible();
    await expect(this.addItemButton).toBeVisible();
  }

  /**
   * Verify empty state is shown
   */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Verify products are displayed
   */
  async expectProductsVisible() {
    await expect(this.productCards.first()).toBeVisible();
  }

  /**
   * Add a product manually
   */
  async addProduct(product: {
    name: string;
    category: string;
    quantity: number;
    unit?: string;
  }) {
    await this.openAddItemModal();

    await this.page.getByLabel(/product name/i).fill(product.name);
    await this.page.getByLabel(/category/i).selectOption(product.category);
    await this.page.getByLabel(/quantity/i).fill(product.quantity.toString());

    if (product.unit) {
      await this.page.getByLabel(/unit/i).selectOption(product.unit);
    }

    await this.page.getByRole('button', { name: /add/i }).click();
  }
}
