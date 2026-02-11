import { By } from 'selenium-webdriver';
import { BasePage } from '../BasePage';

export class EcoLockerPaymentPage extends BasePage {
  private pageTitle = By.xpath("//h1[contains(text(), 'Complete Payment')]");
  private countdownBadge = By.css('.border-warning');
  private payButton = By.xpath("//button[contains(text(), 'Pay')]");
  private cancelButton = By.xpath("//button[contains(text(), 'Cancel Order')]");
  private itemPriceLabel = By.xpath("//*[contains(text(), 'Item Price')]");
  private deliveryFeeLabel = By.xpath("//*[contains(text(), 'Delivery Fee')]");
  private totalLabel = By.xpath("//*[contains(text(), 'Total')]");

  async goto(orderId: number): Promise<void> {
    await this.navigate(`/ecolocker/payment/${orderId}`);
  }

  async isPageTitleVisible(): Promise<boolean> {
    return this.isVisible(this.pageTitle);
  }

  async isCountdownVisible(): Promise<boolean> {
    return this.isVisible(this.countdownBadge);
  }

  async isPayButtonVisible(): Promise<boolean> {
    return this.isVisible(this.payButton);
  }

  async clickPayButton(): Promise<void> {
    await this.click(this.payButton);
  }

  async isCancelButtonVisible(): Promise<boolean> {
    return this.isVisible(this.cancelButton);
  }

  async clickCancelButton(): Promise<void> {
    await this.click(this.cancelButton);
  }

  async isItemPriceVisible(): Promise<boolean> {
    return this.isVisible(this.itemPriceLabel);
  }

  async isDeliveryFeeVisible(): Promise<boolean> {
    return this.isVisible(this.deliveryFeeLabel);
  }

  async isTotalVisible(): Promise<boolean> {
    return this.isVisible(this.totalLabel);
  }
}
