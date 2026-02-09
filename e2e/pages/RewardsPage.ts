import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage';

export class RewardsPage extends BasePage {
  // Header elements
  private pageTitle = By.xpath("//h1[contains(text(), 'Rewards')]");
  private myRedemptionsButton = By.xpath("//button[contains(text(), 'My Redemptions')]");

  // Balance card
  private balanceCard = By.css('.bg-gradient-to-r');
  private balanceAmount = By.xpath("//span[contains(@class, 'text-3xl')]");

  // Filter tabs
  private allFilterButton = By.xpath("//button[contains(text(), 'All')]");
  private physicalFilterButton = By.xpath("//button[contains(text(), 'Physical')]");
  private voucherFilterButton = By.xpath("//button[contains(text(), 'Vouchers')]");

  // Rewards grid
  private rewardCards = By.css('.grid > div');
  private redeemButton = By.xpath("//button[contains(text(), 'Redeem')]");
  private outOfStockButton = By.xpath("//button[contains(text(), 'Out of Stock')]");
  private notEnoughPointsButton = By.xpath("//button[contains(text(), 'Not Enough Points')]");

  // Empty state
  private emptyState = By.xpath("//p[contains(text(), 'No rewards available')]");

  // Confirmation dialog
  private confirmDialog = By.xpath("//h2[contains(text(), 'Confirm Redemption')]");
  private confirmRedemptionButton = By.xpath("//button[contains(text(), 'Confirm Redemption')]");
  private cancelButton = By.xpath("//button[contains(text(), 'Cancel')]");

  // Success dialog
  private successDialog = By.xpath("//h2[contains(text(), 'Redemption Successful')]");
  private redemptionCode = By.css('.font-mono');
  private doneButton = By.xpath("//button[contains(text(), 'Done')]");

  // Loading state
  private loadingSpinner = By.css('.animate-spin');

  async goto(): Promise<void> {
    await this.navigate('/rewards');
  }

  async isPageTitleVisible(): Promise<boolean> {
    return this.isVisible(this.pageTitle);
  }

  async isBalanceCardVisible(): Promise<boolean> {
    return this.isVisible(this.balanceCard);
  }

  async getBalanceAmount(): Promise<string> {
    return this.getText(this.balanceAmount);
  }

  async isMyRedemptionsButtonVisible(): Promise<boolean> {
    return this.isVisible(this.myRedemptionsButton);
  }

  async clickMyRedemptions(): Promise<void> {
    await this.click(this.myRedemptionsButton);
  }

  // Filter actions
  async clickAllFilter(): Promise<void> {
    await this.click(this.allFilterButton);
  }

  async clickPhysicalFilter(): Promise<void> {
    await this.click(this.physicalFilterButton);
  }

  async clickVoucherFilter(): Promise<void> {
    await this.click(this.voucherFilterButton);
  }

  async isAllFilterVisible(): Promise<boolean> {
    return this.isVisible(this.allFilterButton);
  }

  async isPhysicalFilterVisible(): Promise<boolean> {
    return this.isVisible(this.physicalFilterButton);
  }

  async isVoucherFilterVisible(): Promise<boolean> {
    return this.isVisible(this.voucherFilterButton);
  }

  // Rewards grid
  async getRewardCardCount(): Promise<number> {
    try {
      const cards = await this.driver.findElements(this.rewardCards);
      return cards.length;
    } catch {
      return 0;
    }
  }

  async isRedeemButtonVisible(): Promise<boolean> {
    return this.isVisible(this.redeemButton);
  }

  async clickFirstRedeemButton(): Promise<void> {
    await this.click(this.redeemButton);
  }

  async isEmptyState(): Promise<boolean> {
    return this.isVisible(this.emptyState);
  }

  // Dialog interactions
  async isConfirmDialogVisible(): Promise<boolean> {
    return this.isVisible(this.confirmDialog);
  }

  async clickConfirmRedemption(): Promise<void> {
    await this.click(this.confirmRedemptionButton);
  }

  async clickCancel(): Promise<void> {
    await this.click(this.cancelButton);
  }

  async isSuccessDialogVisible(): Promise<boolean> {
    return this.isVisible(this.successDialog);
  }

  async getRedemptionCode(): Promise<string> {
    return this.getText(this.redemptionCode);
  }

  async clickDone(): Promise<void> {
    await this.click(this.doneButton);
  }

  async isLoading(): Promise<boolean> {
    return this.isVisible(this.loadingSpinner);
  }
}
