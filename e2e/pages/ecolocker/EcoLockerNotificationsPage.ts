import { By } from 'selenium-webdriver';
import { BasePage } from '../BasePage';

export class EcoLockerNotificationsPage extends BasePage {
  private pageTitle = By.xpath("//h1[contains(text(), 'Notifications')]");
  private markAllReadButton = By.xpath("//button[contains(text(), 'Mark all read')]");
  private notificationCards = By.css('a[href*="/orders/"]');
  private unreadDot = By.css('.rounded-full.bg-primary');
  private emptyState = By.xpath("//*[contains(text(), 'No notifications yet')]");
  private emptyStateSubtext = By.xpath("//*[contains(text(), 'receive updates about your orders')]");

  async goto(): Promise<void> {
    await this.navigate('/ecolocker/notifications');
  }

  async isPageTitleVisible(): Promise<boolean> {
    return this.isVisible(this.pageTitle);
  }

  async getPageTitleText(): Promise<string> {
    return this.getText(this.pageTitle);
  }

  async isMarkAllReadButtonVisible(): Promise<boolean> {
    return this.isVisible(this.markAllReadButton);
  }

  async clickMarkAllRead(): Promise<void> {
    await this.click(this.markAllReadButton);
  }

  async getNotificationCardCount(): Promise<number> {
    try {
      const cards = await this.driver.findElements(this.notificationCards);
      return cards.length;
    } catch {
      return 0;
    }
  }

  async clickFirstNotification(): Promise<void> {
    const cards = await this.driver.findElements(this.notificationCards);
    if (cards.length > 0) {
      await cards[0].click();
    }
  }

  async hasUnreadIndicators(): Promise<boolean> {
    return this.isVisible(this.unreadDot);
  }

  async isEmptyState(): Promise<boolean> {
    return this.isVisible(this.emptyState);
  }

  async hasNotificationsOrEmptyState(): Promise<boolean> {
    const count = await this.getNotificationCardCount();
    const isEmpty = await this.isEmptyState();
    return count > 0 || isEmpty;
  }
}
