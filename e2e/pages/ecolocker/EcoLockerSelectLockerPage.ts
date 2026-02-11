import { By } from 'selenium-webdriver';
import { BasePage } from '../BasePage';

export class EcoLockerSelectLockerPage extends BasePage {
  private pageTitle = By.xpath("//h1[contains(text(), 'Select Pickup Locker')]");
  private selectedLockerCard = By.css('.border-primary');
  private reserveButton = By.xpath("//button[contains(text(), 'Reserve This Locker')]");
  private listingForText = By.xpath("//*[contains(text(), 'For:')]");
  private lockerCards = By.css('[class*="cursor-pointer"]');

  async goto(listingId: number): Promise<void> {
    await this.navigate(`/ecolocker/select-locker?listingId=${listingId}`);
  }

  async isPageTitleVisible(): Promise<boolean> {
    return this.isVisible(this.pageTitle);
  }

  async getPageTitleText(): Promise<string> {
    return this.getText(this.pageTitle);
  }

  async isReserveButtonVisible(): Promise<boolean> {
    return this.isVisible(this.reserveButton);
  }

  async clickReserveButton(): Promise<void> {
    await this.click(this.reserveButton);
  }

  async isLockerSelected(): Promise<boolean> {
    return this.isVisible(this.selectedLockerCard);
  }

  async isListingForTextVisible(): Promise<boolean> {
    return this.isVisible(this.listingForText);
  }

  async getLockerCardCount(): Promise<number> {
    try {
      const cards = await this.driver.findElements(this.lockerCards);
      return cards.length;
    } catch {
      return 0;
    }
  }

  async clickFirstLockerCard(): Promise<void> {
    const cards = await this.driver.findElements(this.lockerCards);
    if (cards.length > 0) {
      await cards[0].click();
    }
  }
}
