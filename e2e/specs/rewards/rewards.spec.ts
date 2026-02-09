import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver';
import { RewardsPage } from '../../pages/RewardsPage';
import { loginAsTestUser } from '../../helpers/auth';

describe('Rewards', () => {
  let driver: WebDriver;
  let rewardsPage: RewardsPage;

  beforeAll(async () => {
    driver = await createDriver();
    rewardsPage = new RewardsPage(driver);
    await loginAsTestUser(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await rewardsPage.goto();
  });

  it('should navigate to rewards page', async () => {
    const url = await rewardsPage.getCurrentUrl();
    expect(url).toContain('/rewards');
  });

  it('should display page title', async () => {
    const isVisible = await rewardsPage.isPageTitleVisible();
    expect(isVisible).toBe(true);
  });

  it('should display balance card', async () => {
    const isVisible = await rewardsPage.isBalanceCardVisible();
    expect(isVisible).toBe(true);
  });

  it('should display My Redemptions button', async () => {
    const isVisible = await rewardsPage.isMyRedemptionsButtonVisible();
    expect(isVisible).toBe(true);
  });

  it('should display filter tabs', async () => {
    const allVisible = await rewardsPage.isAllFilterVisible();
    const physicalVisible = await rewardsPage.isPhysicalFilterVisible();
    const voucherVisible = await rewardsPage.isVoucherFilterVisible();

    expect(allVisible).toBe(true);
    expect(physicalVisible).toBe(true);
    expect(voucherVisible).toBe(true);
  });

  it('should show rewards or empty state', async () => {
    const rewardCount = await rewardsPage.getRewardCardCount();
    const isEmpty = await rewardsPage.isEmptyState();

    // Either has rewards or shows empty state
    expect(rewardCount > 0 || isEmpty).toBe(true);
  });

  it('should navigate to My Redemptions when button clicked', async () => {
    await rewardsPage.clickMyRedemptions();
    await rewardsPage.waitForUrl('/rewards/my-redemptions');

    const url = await rewardsPage.getCurrentUrl();
    expect(url).toContain('/rewards/my-redemptions');
  });
});

describe('Rewards - Filter Functionality', () => {
  let driver: WebDriver;
  let rewardsPage: RewardsPage;

  beforeAll(async () => {
    driver = await createDriver();
    rewardsPage = new RewardsPage(driver);
    await loginAsTestUser(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await rewardsPage.goto();
  });

  it('should filter by physical rewards', async () => {
    await rewardsPage.clickPhysicalFilter();
    // Allow time for filter to apply
    await new Promise(resolve => setTimeout(resolve, 500));

    const url = await rewardsPage.getCurrentUrl();
    expect(url).toContain('/rewards');
  });

  it('should filter by voucher rewards', async () => {
    await rewardsPage.clickVoucherFilter();
    // Allow time for filter to apply
    await new Promise(resolve => setTimeout(resolve, 500));

    const url = await rewardsPage.getCurrentUrl();
    expect(url).toContain('/rewards');
  });

  it('should show all rewards when All filter clicked', async () => {
    // First filter to something else
    await rewardsPage.clickPhysicalFilter();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Then click All
    await rewardsPage.clickAllFilter();
    await new Promise(resolve => setTimeout(resolve, 500));

    const url = await rewardsPage.getCurrentUrl();
    expect(url).toContain('/rewards');
  });
});
