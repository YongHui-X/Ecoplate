import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class MyFridgePage extends BasePage {
  private scanReceiptButton = By.xpath("//button[contains(text(), 'Scan Receipt')]");
  private addManuallyButton = By.xpath("//button[contains(text(), 'Add Manually')]");
  private productCards = By.css('[data-testid="product-card"]');
  private emptyState = By.xpath("//*[contains(text(), 'Your fridge is empty')]");
  private categoryTabs = By.css('[role="tablist"] button');
  private searchInput = By.css('input[placeholder*="Search"]');

  async goto(): Promise<void> {
    await this.navigate('/my-fridge');
  }

  async isScanReceiptButtonVisible(): Promise<boolean> {
    return this.isVisible(this.scanReceiptButton);
  }

  async isAddManuallyButtonVisible(): Promise<boolean> {
    return this.isVisible(this.addManuallyButton);
  }

  async clickScanReceipt(): Promise<void> {
    await this.click(this.scanReceiptButton);
  }

  async clickAddManually(): Promise<void> {
    await this.click(this.addManuallyButton);
  }

  async getProductCount(): Promise<number> {
    try {
      const products = await this.driver.findElements(this.productCards);
      return products.length;
    } catch {
      return 0;
    }
  }

  async isEmptyState(): Promise<boolean> {
    return this.isVisible(this.emptyState);
  }

  async searchProducts(query: string): Promise<void> {
    await this.type(this.searchInput, query);
  }

  async selectCategory(categoryName: string): Promise<void> {
    const categoryButton = By.xpath(`//button[contains(text(), '${categoryName}')]`);
    await this.click(categoryButton);
  }
}
