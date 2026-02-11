import { By } from 'selenium-webdriver';
import { BasePage } from '../BasePage';

export class EcoLockerOrdersPage extends BasePage {
  private pageTitle = By.xpath("//h1[contains(text(), 'My Orders')]");
  private buyingTab = By.xpath("//button[contains(text(), 'Buying')]");
  private sellingTab = By.xpath("//button[contains(text(), 'Selling')]");
  private orderCards = By.css('a[href*="/orders/"]');
  private emptyState = By.xpath("//*[contains(text(), 'No orders yet')]");

  async goto(): Promise<void> {
    await this.navigate('/ecolocker/orders');
  }

  async isPageTitleVisible(): Promise<boolean> {
    return this.isVisible(this.pageTitle);
  }

  async getPageTitleText(): Promise<string> {
    return this.getText(this.pageTitle);
  }

  async isBuyingTabVisible(): Promise<boolean> {
    return this.isVisible(this.buyingTab);
  }

  async isSellingTabVisible(): Promise<boolean> {
    return this.isVisible(this.sellingTab);
  }

  async clickBuyingTab(): Promise<void> {
    await this.click(this.buyingTab);
  }

  async clickSellingTab(): Promise<void> {
    await this.click(this.sellingTab);
  }

  async getOrderCardCount(): Promise<number> {
    try {
      const cards = await this.driver.findElements(this.orderCards);
      return cards.length;
    } catch {
      return 0;
    }
  }

  async clickFirstOrderCard(): Promise<void> {
    const cards = await this.driver.findElements(this.orderCards);
    if (cards.length > 0) {
      await cards[0].click();
    }
  }

  async isEmptyState(): Promise<boolean> {
    return this.isVisible(this.emptyState);
  }

  async hasOrdersOrEmptyState(): Promise<boolean> {
    const orderCount = await this.getOrderCardCount();
    const isEmpty = await this.isEmptyState();
    return orderCount > 0 || isEmpty;
  }
}
