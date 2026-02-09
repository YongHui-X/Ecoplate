import { WebDriver, By, until, WebElement } from 'selenium-webdriver';
import { config } from '../selenium.config.js';

export abstract class BasePage {
  protected driver: WebDriver;
  protected baseUrl: string;

  constructor(driver: WebDriver) {
    this.driver = driver;
    this.baseUrl = config.baseUrl;
  }

  async navigate(path: string): Promise<void> {
    await this.driver.get(`${this.baseUrl}${path}`);
  }

  async waitForElement(locator: By, timeout = 10000): Promise<WebElement> {
    return this.driver.wait(until.elementLocated(locator), timeout);
  }

  async waitForVisible(locator: By, timeout = 10000): Promise<WebElement> {
    const element = await this.waitForElement(locator, timeout);
    await this.driver.wait(until.elementIsVisible(element), timeout);
    return element;
  }

  async click(locator: By): Promise<void> {
    const element = await this.waitForVisible(locator);
    await element.click();
  }

  async type(locator: By, text: string): Promise<void> {
    const element = await this.waitForVisible(locator);
    await element.clear();
    await element.sendKeys(text);
  }

  async getText(locator: By): Promise<string> {
    const element = await this.waitForVisible(locator);
    return element.getText();
  }

  async isVisible(locator: By): Promise<boolean> {
    try {
      const element = await this.driver.findElement(locator);
      return element.isDisplayed();
    } catch {
      return false;
    }
  }

  async getCurrentUrl(): Promise<string> {
    return this.driver.getCurrentUrl();
  }

  async getTitle(): Promise<string> {
    return this.driver.getTitle();
  }

  async waitForUrl(urlPattern: string, timeout = 10000): Promise<void> {
    await this.driver.wait(until.urlContains(urlPattern), timeout);
  }
}
