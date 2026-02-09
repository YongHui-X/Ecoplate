import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver, takeScreenshot } from '../../helpers/driver.js';
import { MyFridgePage } from '../../pages/MyFridgePage.js';
import { loginAsTestUser } from '../../helpers/auth.js';

describe('MyFridge - View Products', () => {
  let driver: WebDriver;
  let fridgePage: MyFridgePage;

  beforeAll(async () => {
    driver = await createDriver();
    fridgePage = new MyFridgePage(driver);
    await loginAsTestUser(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await fridgePage.goto();
  });

  it('should navigate to My Fridge page', async () => {
    const url = await fridgePage.getCurrentUrl();
    expect(url).toContain('/my-fridge');
  });

  it('should display scan receipt button', async () => {
    const isVisible = await fridgePage.isScanReceiptButtonVisible();
    expect(isVisible).toBe(true);
  });

  it('should display add manually button', async () => {
    const isVisible = await fridgePage.isAddManuallyButtonVisible();
    expect(isVisible).toBe(true);
  });

  it('should show products or empty state', async () => {
    const productCount = await fridgePage.getProductCount();
    const isEmpty = await fridgePage.isEmptyState();
    
    // Either has products or shows empty state
    expect(productCount > 0 || isEmpty).toBe(true);
  });
});
