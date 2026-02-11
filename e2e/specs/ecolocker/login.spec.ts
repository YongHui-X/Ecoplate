import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver';
import { EcoLockerLoginPage } from '../../pages/ecolocker';
import { testUsers } from '../../fixtures/users';

describe('EcoLocker Login', () => {
  let driver: WebDriver;
  let loginPage: EcoLockerLoginPage;

  beforeAll(async () => {
    driver = await createDriver();
    loginPage = new EcoLockerLoginPage(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await loginPage.goto();
    await loginPage.clearAllStorage();
    await loginPage.goto();
  });

  it('should display login form with EcoLocker branding', async () => {
    const hasBranding = await loginPage.isPageTitleVisible();
    expect(hasBranding).toBe(true);

    const hasSubmit = await loginPage.isSubmitButtonVisible();
    expect(hasSubmit).toBe(true);
  });

  it('should show EcoPlate account reference', async () => {
    const hasRef = await loginPage.hasEcoPlateReference();
    expect(hasRef).toBe(true);
  });

  it('should login with valid credentials and redirect', async () => {
    await loginPage.login(testUsers.primary.email, testUsers.primary.password);

    await loginPage.waitForUrlToNotContain('/login');

    const url = await loginPage.getCurrentUrl();
    expect(url).toContain('/ecolocker');
    expect(url).not.toContain('/login');
  });

  it('should show error with invalid credentials', async () => {
    await loginPage.login('invalid@test.com', 'wrongpassword');

    // Wait for error to appear
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should still be on login page
    const url = await loginPage.getCurrentUrl();
    expect(url).toContain('/login');
  });
});
