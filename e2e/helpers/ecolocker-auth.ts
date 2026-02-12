import { WebDriver } from 'selenium-webdriver';
import { EcoLockerLoginPage } from '../pages/ecolocker';
import { testUsers } from '../fixtures/users';
import { config } from '../selenium.config';

/**
 * Login to EcoLocker (now part of main EcoPlate app)
 * Uses the main app's login page since EcoLocker is integrated
 */
export async function loginToEcoLocker(driver: WebDriver, userType: 'primary' | 'secondary' = 'primary'): Promise<void> {
  const loginPage = new EcoLockerLoginPage(driver);
  const user = testUsers[userType];

  await loginPage.goto();
  await loginPage.login(user.email, user.password);
  await loginPage.waitForUrlToNotContain('/login');
}

export async function ensureEcoLockerLoggedOut(driver: WebDriver): Promise<void> {
  // EcoLocker now uses main app login
  await driver.get(`${config.baseUrl}/login`);
  // Clear local storage to remove any auth tokens
  await driver.executeScript('localStorage.clear()');
}

export async function isEcoLockerLoggedIn(driver: WebDriver): Promise<boolean> {
  // EcoLocker now uses main app token
  const token = await driver.executeScript('return localStorage.getItem("token")') as string | null;
  return token !== null;
}
