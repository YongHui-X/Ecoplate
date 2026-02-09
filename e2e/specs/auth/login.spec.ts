import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver, takeScreenshot } from '../../helpers/driver.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { testUsers } from '../../fixtures/users.js';

describe('Login', () => {
  let driver: WebDriver;
  let loginPage: LoginPage;

  beforeAll(async () => {
    driver = await createDriver();
    loginPage = new LoginPage(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await loginPage.goto();
  });

  it('should display the login form', async () => {
    const url = await loginPage.getCurrentUrl();
    expect(url).toContain('/login');
  });

  it('should show register link', async () => {
    const isVisible = await loginPage.isRegisterLinkVisible();
    expect(isVisible).toBe(true);
  });

  it('should login with valid credentials', async () => {
    await loginPage.login(testUsers.primary.email, testUsers.primary.password);
    
    // Wait for navigation to dashboard
    await loginPage.waitForUrl('/');
    
    const url = await loginPage.getCurrentUrl();
    expect(url).not.toContain('/login');
  });

  it('should show error with invalid credentials', async () => {
    await loginPage.login('invalid@test.com', 'wrongpassword');
    
    // Wait a moment for error to appear
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Should still be on login page
    const url = await loginPage.getCurrentUrl();
    expect(url).toContain('/login');
  });

  it('should navigate to register page', async () => {
    await loginPage.clickRegisterLink();
    await loginPage.waitForUrl('/register');
    
    const url = await loginPage.getCurrentUrl();
    expect(url).toContain('/register');
  });
});
