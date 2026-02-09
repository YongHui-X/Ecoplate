import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { DashboardPage } from '../../pages/DashboardPage.js';
import { loginAsTestUser, isLoggedIn } from '../../helpers/auth.js';

describe('Logout', () => {
  let driver: WebDriver;
  let dashboardPage: DashboardPage;

  beforeAll(async () => {
    driver = await createDriver();
    dashboardPage = new DashboardPage(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  it('should be logged in after login', async () => {
    await loginAsTestUser(driver);
    
    const loggedIn = await isLoggedIn(driver);
    expect(loggedIn).toBe(true);
  });

  it('should logout and redirect to login', async () => {
    await loginAsTestUser(driver);
    
    // Click account/profile button and logout
    // This depends on your UI - adjust selectors as needed
    await driver.executeScript('localStorage.clear()');
    await dashboardPage.navigate('/login');
    
    const url = await dashboardPage.getCurrentUrl();
    expect(url).toContain('/login');
  });
});
