import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Marketplace Page
 */
export class MarketplacePage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly searchInput: Locator;
  readonly createButton: Locator;
  readonly myListingsButton: Locator;
  readonly myPurchasesButton: Locator;
  readonly listViewButton: Locator;
  readonly mapViewButton: Locator;
  readonly categoryButtons: Locator;
  readonly listingCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: /marketplace/i });
    this.searchInput = page.getByPlaceholder(/search listings/i);
    this.createButton = page.getByRole('button', { name: /create/i });
    this.myListingsButton = page.getByRole('button', { name: /my listings/i });
    this.myPurchasesButton = page.getByRole('button', { name: /my purchases/i });
    this.listViewButton = page.getByRole('button', { name: /list/i });
    this.mapViewButton = page.getByRole('button', { name: /map/i });
    this.categoryButtons = page.locator('[data-testid="category-filter"] button');
    this.listingCards = page.locator('[data-testid="listing-card"]');
    this.emptyState = page.getByText(/no listings found/i);
  }

  /**
   * Navigate to marketplace page
   */
  async goto() {
    await this.page.goto('/marketplace');
  }

  /**
   * Search for listings
   */
  async searchListings(query: string) {
    await this.searchInput.fill(query);
  }

  /**
   * Filter by category
   */
  async filterByCategory(category: string) {
    await this.page.getByRole('button', { name: new RegExp(category, 'i') }).click();
  }

  /**
   * Switch to map view
   */
  async switchToMapView() {
    await this.mapViewButton.click();
  }

  /**
   * Switch to list view
   */
  async switchToListView() {
    await this.listViewButton.click();
  }

  /**
   * Click on a listing by title
   */
  async clickListing(title: string) {
    await this.page.getByText(title).click();
  }

  /**
   * Get listing card by title
   */
  getListingCard(title: string): Locator {
    return this.page.locator(`[data-testid="listing-card"]:has-text("${title}")`);
  }

  /**
   * Navigate to create listing page
   */
  async goToCreateListing() {
    await this.createButton.click();
    await expect(this.page).toHaveURL(/\/marketplace\/create/);
  }

  /**
   * Navigate to my listings page
   */
  async goToMyListings() {
    await this.myListingsButton.click();
    await expect(this.page).toHaveURL(/\/marketplace\/my-listings/);
  }

  /**
   * Navigate to my purchases page
   */
  async goToMyPurchases() {
    await this.myPurchasesButton.click();
    await expect(this.page).toHaveURL(/\/marketplace\/my-purchases/);
  }

  /**
   * Verify page is loaded
   */
  async expectToBeVisible() {
    await expect(this.searchInput).toBeVisible();
    await expect(this.createButton).toBeVisible();
  }

  /**
   * Verify empty state is shown
   */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Verify listings are displayed
   */
  async expectListingsVisible() {
    await expect(this.listingCards.first()).toBeVisible();
  }
}
