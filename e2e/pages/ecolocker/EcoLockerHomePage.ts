import { By } from 'selenium-webdriver';
import { BasePage } from '../BasePage';

export class EcoLockerHomePage extends BasePage {
  private networkTitle = By.xpath("//h1[contains(text(), 'EcoLocker Network')]");
  private lockerCountText = By.xpath("//*[contains(text(), 'locker station')]");
  private mapContainer = By.css('.w-full.h-full');
  private howToUseCard = By.xpath("//*[contains(text(), 'How to use EcoLocker')]");
  private ecoPlateButton = By.xpath("//button[contains(text(), 'EcoPlate')]");

  async goto(): Promise<void> {
    await this.navigate('/ecolocker/');
  }

  async isNetworkTitleVisible(): Promise<boolean> {
    return this.isVisible(this.networkTitle);
  }

  async getNetworkTitleText(): Promise<string> {
    return this.getText(this.networkTitle);
  }

  async isLockerCountVisible(): Promise<boolean> {
    return this.isVisible(this.lockerCountText);
  }

  async getLockerCountText(): Promise<string> {
    return this.getText(this.lockerCountText);
  }

  async isMapContainerVisible(): Promise<boolean> {
    return this.isVisible(this.mapContainer);
  }

  async isHowToUseCardVisible(): Promise<boolean> {
    return this.isVisible(this.howToUseCard);
  }

  async clickEcoPlateButton(): Promise<void> {
    await this.click(this.ecoPlateButton);
  }

  async isEcoPlateButtonVisible(): Promise<boolean> {
    return this.isVisible(this.ecoPlateButton);
  }
}
