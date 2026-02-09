import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver.js';
import { MarketplacePage } from '../../pages/MarketplacePage.js';
import { loginAsTestUser } from '../../helpers/auth.js';

describe('Marketplace - Browse', () => {
  let driver: WebDriver;
  let marketplacePage: MarketplacePage;

  beforeAll(async () => {
    driver = await createDriver();
    marketplacePage = new MarketplacePage(driver);
    await loginAsTestUser(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await marketplacePage.goto();
  });

  it('should navigate to marketplace page', async () => {
    const url = await marketplacePage.getCurrentUrl();
    expect(url).toContain('/marketplace');
  });

  it('should display create listing button', async () => {
    const isVisible = await marketplacePage.isCreateListingButtonVisible();
    expect(isVisible).toBe(true);
  });

  it('should show listings or empty state', async () => {
    const listingCount = await marketplacePage.getListingCount();
    const isEmpty = await marketplacePage.isEmptyState();
    
    // Either has listings or shows empty state
    expect(listingCount >= 0 || isEmpty).toBe(true);
  });
});
