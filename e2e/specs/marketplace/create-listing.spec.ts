import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver.js';
import { MarketplacePage } from '../../pages/MarketplacePage.js';
import { CreateListingPage } from '../../pages/CreateListingPage.js';
import { loginAsTestUser } from '../../helpers/auth.js';

describe('Marketplace - Create Listing', () => {
  let driver: WebDriver;
  let marketplacePage: MarketplacePage;
  let createListingPage: CreateListingPage;

  beforeAll(async () => {
    driver = await createDriver();
    marketplacePage = new MarketplacePage(driver);
    createListingPage = new CreateListingPage(driver);
    await loginAsTestUser(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  it('should navigate to create listing page from marketplace', async () => {
    await marketplacePage.goto();
    await marketplacePage.clickCreateListing();
    
    await createListingPage.waitForUrl('/marketplace/create');
    const url = await createListingPage.getCurrentUrl();
    expect(url).toContain('/create');
  });

  it('should display listing form', async () => {
    await createListingPage.goto();
    
    const isVisible = await createListingPage.isTitleInputVisible();
    expect(isVisible).toBe(true);
  });
});
