import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class DashboardPage extends BasePage {
  private greeting = By.css('h1');
  private summaryTab = By.xpath("//button[contains(text(), 'Summary')]");
  private co2Tab = By.xpath("//button[contains(text(), 'CO')]");

  async goto(): Promise<void> {
    await this.navigate('/');
  }

  async getGreeting(): Promise<string> {
    return this.getText(this.greeting);
  }

  async isSummaryTabVisible(): Promise<boolean> {
    return this.isVisible(this.summaryTab);
  }

  async clickSummaryTab(): Promise<void> {
    await this.click(this.summaryTab);
  }

  async clickCO2Tab(): Promise<void> {
    await this.click(this.co2Tab);
  }
}
