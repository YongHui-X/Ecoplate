import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver';
import { EcoLockerOrdersPage } from '../../pages/ecolocker';
import { loginToEcoLocker } from '../../helpers/ecolocker-auth';

describe('EcoLocker Orders', () => {
  let driver: WebDriver;
  let ordersPage: EcoLockerOrdersPage;

  beforeAll(async () => {
    driver = await createDriver();
    ordersPage = new EcoLockerOrdersPage(driver);
    await loginToEcoLocker(driver, 'primary');
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await ordersPage.goto();
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it('should display "My Orders" page title', async () => {
    const isVisible = await ordersPage.isPageTitleVisible();
    expect(isVisible).toBe(true);

    const text = await ordersPage.getPageTitleText();
    expect(text).toContain('My Orders');
  });

  it('should show Buying and Selling tabs', async () => {
    const buyingVisible = await ordersPage.isBuyingTabVisible();
    const sellingVisible = await ordersPage.isSellingTabVisible();

    expect(buyingVisible).toBe(true);
    expect(sellingVisible).toBe(true);
  });

  it('should switch between tabs', async () => {
    await ordersPage.clickSellingTab();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Switch back to buying
    await ordersPage.clickBuyingTab();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Page should still be functional
    const isVisible = await ordersPage.isPageTitleVisible();
    expect(isVisible).toBe(true);
  });

  it('should show orders or empty state', async () => {
    const hasContent = await ordersPage.hasOrdersOrEmptyState();
    expect(hasContent).toBe(true);
  });
});
