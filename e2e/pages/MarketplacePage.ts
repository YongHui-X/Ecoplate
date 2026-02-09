import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class MarketplacePage extends BasePage {
  private createListingButton = By.xpath("//button[contains(text(), 'Create Listing')] | //a[contains(@href, '/marketplace/create')]");
  private listingCards = By.css('[data-testid="listing-card"]');
  private searchInput = By.css('input[placeholder*="Search"]');
  private categoryFilter = By.css('[data-testid="category-filter"]');
  private mapViewButton = By.xpath("//button[contains(text(), 'Map')]");
  private listViewButton = By.xpath("//button[contains(text(), 'List')]");
  private emptyState = By.xpath("//*[contains(text(), 'No listings found')]");

  async goto(): Promise<void> {
    await this.navigate('/marketplace');
  }

  async isCreateListingButtonVisible(): Promise<boolean> {
    return this.isVisible(this.createListingButton);
  }

  async clickCreateListing(): Promise<void> {
    await this.click(this.createListingButton);
  }

  async getListingCount(): Promise<number> {
    try {
      const listings = await this.driver.findElements(this.listingCards);
      return listings.length;
    } catch {
      return 0;
    }
  }

  async searchListings(query: string): Promise<void> {
    await this.type(this.searchInput, query);
  }

  async clickMapView(): Promise<void> {
    await this.click(this.mapViewButton);
  }

  async clickListView(): Promise<void> {
    await this.click(this.listViewButton);
  }

  async isEmptyState(): Promise<boolean> {
    return this.isVisible(this.emptyState);
  }

  async clickListing(index: number): Promise<void> {
    const listings = await this.driver.findElements(this.listingCards);
    if (listings[index]) {
      await listings[index].click();
    }
  }
}
