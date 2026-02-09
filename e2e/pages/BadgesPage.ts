/**
 * Badges Page Object
 */

import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage';
import { sleep } from '../helpers/wait';

export class BadgesPage extends BasePage {
  protected path = '/badges';

  // Element locators
  private locators = {
    // Page elements
    pageTitle: By.css('h1, h2'),

    // Badges grid
    badgesGrid: By.css('.badges-grid, .badges-list, [data-testid="badges-grid"]'),
    badgeCard: By.css('.badge-card, .badge-item, [data-testid="badge-card"]'),

    // Badge details
    badgeName: By.css('.badge-name, h3, h4'),
    badgeDescription: By.css('.badge-description, .description'),
    badgeIcon: By.css('.badge-icon, img, svg'),
    badgeProgress: By.css('.badge-progress, .progress-bar'),

    // Earned vs locked
    earnedBadge: By.css('.badge-earned, .unlocked, [data-earned="true"]'),
    lockedBadge: By.css('.badge-locked, .locked, [data-earned="false"]'),

    // Categories
    categoryFilter: By.css('.category-filter, [data-testid="category-filter"]'),
    categoryTab: By.css('.category-tab, [role="tab"]'),

    // Stats
    earnedCount: By.css('.earned-count, [data-testid="earned-count"]'),
    totalCount: By.css('.total-count, [data-testid="total-count"]'),

    // Badge modal/detail view
    badgeModal: By.css('.badge-modal, [role="dialog"]'),
    closeModalButton: By.css('button:contains("Close"), button[aria-label="Close"]'),
  };

  /**
   * Check if page is loaded
   */
  async isPageLoaded(): Promise<boolean> {
    const hasBadges = await this.exists(this.locators.badgesGrid);
    const hasTitle = await this.exists(this.locators.pageTitle);
    return hasBadges || hasTitle;
  }

  /**
   * Get total badge count
   */
  async getTotalBadgeCount(): Promise<number> {
    return this.getElementCount(this.locators.badgeCard);
  }

  /**
   * Get earned badge count
   */
  async getEarnedBadgeCount(): Promise<number> {
    return this.getElementCount(this.locators.earnedBadge);
  }

  /**
   * Get locked badge count
   */
  async getLockedBadgeCount(): Promise<number> {
    return this.getElementCount(this.locators.lockedBadge);
  }

  /**
   * Get all badge names
   */
  async getBadgeNames(): Promise<string[]> {
    const badges = await this.findElements(this.locators.badgeCard);
    const names: string[] = [];

    for (const badge of badges) {
      try {
        const nameElement = await badge.findElement(this.locators.badgeName);
        const name = await nameElement.getText();
        names.push(name);
      } catch {
        // Skip if name not found
      }
    }

    return names;
  }

  /**
   * Click on a badge by index
   */
  async clickBadge(index: number = 0): Promise<void> {
    const badges = await this.findElements(this.locators.badgeCard);
    if (index < badges.length) {
      await badges[index].click();
      await sleep(500);
    } else {
      throw new Error(`Badge at index ${index} not found`);
    }
  }

  /**
   * Check if badge modal is open
   */
  async isBadgeModalOpen(): Promise<boolean> {
    return this.isDisplayed(this.locators.badgeModal);
  }

  /**
   * Close badge modal
   */
  async closeBadgeModal(): Promise<void> {
    await this.click(this.locators.closeModalButton);
    await sleep(300);
  }

  /**
   * Filter by category
   */
  async filterByCategory(category: string): Promise<void> {
    // Try clicking category tab
    const categoryTab = By.css(`[data-category="${category}"], button:contains("${category}")`);
    await this.click(categoryTab);
    await this.waitForLoading();
  }

  /**
   * Get badge details at index
   */
  async getBadgeDetails(index: number = 0): Promise<{
    name: string;
    description?: string;
    isEarned: boolean;
  }> {
    const badges = await this.findElements(this.locators.badgeCard);
    if (index >= badges.length) {
      throw new Error(`Badge at index ${index} not found`);
    }

    const badge = badges[index];
    const name = await badge.findElement(this.locators.badgeName).getText().catch(() => '');
    const description = await badge.findElement(this.locators.badgeDescription).getText().catch(() => undefined);

    // Check if earned
    const classes = await badge.getAttribute('class') || '';
    const dataEarned = await badge.getAttribute('data-earned');
    const isEarned = classes.includes('earned') || classes.includes('unlocked') || dataEarned === 'true';

    return { name, description, isEarned };
  }

  /**
   * Check if specific badge is earned
   */
  async isBadgeEarned(badgeName: string): Promise<boolean> {
    const badges = await this.findElements(this.locators.badgeCard);

    for (const badge of badges) {
      try {
        const nameElement = await badge.findElement(this.locators.badgeName);
        const name = await nameElement.getText();

        if (name.toLowerCase().includes(badgeName.toLowerCase())) {
          const classes = await badge.getAttribute('class') || '';
          const dataEarned = await badge.getAttribute('data-earned');
          return classes.includes('earned') || classes.includes('unlocked') || dataEarned === 'true';
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Get earned/total stats text
   */
  async getStatsText(): Promise<string> {
    try {
      const earnedText = await this.getText(this.locators.earnedCount);
      const totalText = await this.getText(this.locators.totalCount);
      return `${earnedText}/${totalText}`;
    } catch {
      return '';
    }
  }
}

export const badgesPage = new BadgesPage();
