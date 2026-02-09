import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver.js';
import { RegisterPage } from '../../pages/RegisterPage.js';

describe('Register', () => {
  let driver: WebDriver;
  let registerPage: RegisterPage;

  beforeAll(async () => {
    driver = await createDriver();
    registerPage = new RegisterPage(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await registerPage.goto();
  });

  it('should display the registration form', async () => {
    const url = await registerPage.getCurrentUrl();
    expect(url).toContain('/register');
  });

  it('should show login link', async () => {
    const isVisible = await registerPage.isLoginLinkVisible();
    expect(isVisible).toBe(true);
  });

  it('should navigate to login page', async () => {
    await registerPage.clickLoginLink();
    await registerPage.waitForUrl('/login');
    
    const url = await registerPage.getCurrentUrl();
    expect(url).toContain('/login');
  });
});
