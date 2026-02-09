import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver.js';
import { EcoPointsPage } from '../../pages/EcoPointsPage.js';
import { loginAsTestUser } from '../../helpers/auth.js';

describe('Gamification - EcoPoints', () => {
  let driver: WebDriver;
  let ecoPointsPage: EcoPointsPage;

  beforeAll(async () => {
    driver = await createDriver();
    ecoPointsPage = new EcoPointsPage(driver);
    await loginAsTestUser(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  it('should navigate to ecopoints page', async () => {
    await ecoPointsPage.goto();
    
    const url = await ecoPointsPage.getCurrentUrl();
    expect(url).toContain('/ecopoints');
  });
});
