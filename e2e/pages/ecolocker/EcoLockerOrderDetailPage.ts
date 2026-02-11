import { By } from 'selenium-webdriver';
import { BasePage } from '../BasePage';

export class EcoLockerOrderDetailPage extends BasePage {
  private statusBadge = By.css('[class*="badge"]');
  private schedulePickupCard = By.xpath("//*[contains(text(), 'Schedule Pickup')]");
  private pickupTimeInput = By.css('input[type="datetime-local"]');
  private schedulePickupButton = By.xpath("//button[contains(text(), 'Schedule Pickup')]");
  private riderPickedUpButton = By.xpath("//button[contains(text(), 'Rider Has Picked Up')]");
  private confirmRiderPickupSection = By.xpath("//*[contains(text(), 'Confirm Rider Pickup')]");
  private pinDisplay = By.css('.font-mono');
  private cancelButton = By.xpath("//button[contains(text(), 'Cancel Order')]");
  private backToOrders = By.xpath("//*[contains(text(), 'Back to Orders')]");
  private paymentSuccessBanner = By.xpath("//*[contains(text(), 'Payment Successful')]");
  private orderDetailsTitle = By.xpath("//*[contains(text(), 'Order Details')]");
  private itemPriceLabel = By.xpath("//*[contains(text(), 'Item Price')]");
  private deliveryFeeLabel = By.xpath("//*[contains(text(), 'Delivery Fee')]");

  async goto(orderId: number): Promise<void> {
    await this.navigate(`/ecolocker/orders/${orderId}`);
  }

  async gotoWithPaidFlag(orderId: number): Promise<void> {
    await this.navigate(`/ecolocker/orders/${orderId}?paid=true`);
  }

  async isStatusBadgeVisible(): Promise<boolean> {
    return this.isVisible(this.statusBadge);
  }

  async getStatusBadgeText(): Promise<string> {
    return this.getText(this.statusBadge);
  }

  async isSchedulePickupVisible(): Promise<boolean> {
    return this.isVisible(this.schedulePickupCard);
  }

  async isConfirmRiderPickupVisible(): Promise<boolean> {
    return this.isVisible(this.confirmRiderPickupSection);
  }

  async setPickupTime(datetime: string): Promise<void> {
    await this.type(this.pickupTimeInput, datetime);
  }

  async clickSchedulePickup(): Promise<void> {
    await this.click(this.schedulePickupButton);
  }

  async clickRiderPickedUp(): Promise<void> {
    await this.click(this.riderPickedUpButton);
  }

  async isPinDisplayVisible(): Promise<boolean> {
    return this.isVisible(this.pinDisplay);
  }

  async getPinText(): Promise<string> {
    return this.getText(this.pinDisplay);
  }

  async isCancelButtonVisible(): Promise<boolean> {
    return this.isVisible(this.cancelButton);
  }

  async clickCancelButton(): Promise<void> {
    await this.click(this.cancelButton);
  }

  async clickBackToOrders(): Promise<void> {
    await this.click(this.backToOrders);
  }

  async isPaymentSuccessBannerVisible(): Promise<boolean> {
    return this.isVisible(this.paymentSuccessBanner);
  }

  async isOrderDetailsVisible(): Promise<boolean> {
    return this.isVisible(this.orderDetailsTitle);
  }

  async isItemPriceVisible(): Promise<boolean> {
    return this.isVisible(this.itemPriceLabel);
  }

  async isDeliveryFeeVisible(): Promise<boolean> {
    return this.isVisible(this.deliveryFeeLabel);
  }
}
