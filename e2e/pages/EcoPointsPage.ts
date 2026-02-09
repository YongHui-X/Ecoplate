import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class EcoPointsPage extends BasePage {
  private totalPoints = By.css('[data-testid="total-points"]');
  private pointsHistory = By.css('[data-testid="points-history"]');
  private rewardsLink = By.xpath("//a[contains(@href, '/rewards')]");
  private streakCount = By.css('[data-testid="streak-count"]');

  async goto(): Promise<void> {
    await this.navigate('/ecopoints');
  }

  async getTotalPoints(): Promise<string> {
    return this.getText(this.totalPoints);
  }

  async isPointsHistoryVisible(): Promise<boolean> {
    return this.isVisible(this.pointsHistory);
  }

  async clickRewards(): Promise<void> {
    await this.click(this.rewardsLink);
  }
}
