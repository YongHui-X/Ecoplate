import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver';
import { EcoLockerHomePage } from '../../pages/ecolocker';
import { loginToEcoLocker } from '../../helpers/ecolocker-auth';

describe('EcoLocker Home', () => {
  let driver: WebDriver;
  let homePage: EcoLockerHomePage;

  beforeAll(async () => {
    driver = await createDriver();
    homePage = new EcoLockerHomePage(driver);
    await loginToEcoLocker(driver, 'primary');
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await homePage.goto();
    // Wait for page to render
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it('should display "EcoLocker Network" title', async () => {
    const isVisible = await homePage.isNetworkTitleVisible();
    expect(isVisible).toBe(true);
  });

  it('should show locker count text', async () => {
    const isVisible = await homePage.isLockerCountVisible();
    expect(isVisible).toBe(true);

    const text = await homePage.getLockerCountText();
    expect(text).toContain('locker station');
    expect(text).toContain('Singapore');
  });

  it('should display map container', async () => {
    const isVisible = await homePage.isMapContainerVisible();
    expect(isVisible).toBe(true);
  });

  it('should show "How to use EcoLocker" info card', async () => {
    const isVisible = await homePage.isHowToUseCardVisible();
    expect(isVisible).toBe(true);
  });
});
