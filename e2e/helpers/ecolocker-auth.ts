import { WebDriver } from 'selenium-webdriver';
import { loginAsTestUser } from './auth';
import { config } from '../selenium.config';

/**
 * Login to EcoLocker via EcoPlate SSO bridge.
 *
 * 1. Logs into EcoPlate (stores JWT in localStorage)
 * 2. Reads the token from localStorage
 * 3. Navigates to /ecolocker/?token=<token> so AuthContext picks it up
 * 4. Waits for redirect to the EcoLocker home page
 */
export async function loginToEcoLocker(
  driver: WebDriver,
  userType: 'primary' | 'secondary' = 'primary'
): Promise<void> {
  // Step 1: Log in to EcoPlate
  await loginAsTestUser(driver, userType);

  // Step 2: Read JWT from localStorage
  const token = await driver.executeScript(
    'return localStorage.getItem("token")'
  ) as string | null;

  if (!token) {
    throw new Error('No auth token found in localStorage after EcoPlate login');
  }

  // Step 3: Navigate to EcoLocker with token in URL
  await driver.get(`${config.baseUrl}/ecolocker/?token=${token}`);

  // Step 4: Wait for AuthContext to process the token and redirect
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl();
    // The AuthContext strips the ?token= param after processing
    return url.includes('/ecolocker') && !url.includes('token=');
  }, 15000, 'EcoLocker auth redirect timed out');
}
