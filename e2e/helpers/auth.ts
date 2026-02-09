import { WebDriver } from 'selenium-webdriver';
import { LoginPage } from '../pages/LoginPage';
import { testUsers } from '../fixtures/users';
import { config } from '../selenium.config';

export async function loginAsTestUser(driver: WebDriver, userType: 'primary' | 'secondary' = 'primary'): Promise<void> {
  const loginPage = new LoginPage(driver);
  const user = testUsers[userType];

  await loginPage.goto();
  await loginPage.login(user.email, user.password);
  await loginPage.waitForUrlToNotContain('/login');
}

export async function ensureLoggedOut(driver: WebDriver): Promise<void> {
  await driver.get(`${config.baseUrl}/login`);
  // Clear local storage to remove any auth tokens
  await driver.executeScript('localStorage.clear()');
}

export async function isLoggedIn(driver: WebDriver): Promise<boolean> {
  const token = await driver.executeScript('return localStorage.getItem("token")') as string | null;
  return token !== null;
}
