import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver';
import { EcoLockerNotificationsPage } from '../../pages/ecolocker';
import { loginToEcoLocker } from '../../helpers/ecolocker-auth';

describe('EcoLocker Notifications', () => {
  let driver: WebDriver;
  let notificationsPage: EcoLockerNotificationsPage;

  beforeAll(async () => {
    driver = await createDriver();
    notificationsPage = new EcoLockerNotificationsPage(driver);
    await loginToEcoLocker(driver, 'primary');
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  beforeEach(async () => {
    await notificationsPage.goto();
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it('should display Notifications page title', async () => {
    const isVisible = await notificationsPage.isPageTitleVisible();
    expect(isVisible).toBe(true);

    const text = await notificationsPage.getPageTitleText();
    expect(text).toContain('Notifications');
  });

  it('should show notifications or empty state', async () => {
    const hasContent = await notificationsPage.hasNotificationsOrEmptyState();
    expect(hasContent).toBe(true);
  });

  it('should navigate to order detail when clicking a notification', async () => {
    const count = await notificationsPage.getNotificationCardCount();
    if (count === 0) {
      console.warn('No notifications to click, skipping');
      return;
    }

    await notificationsPage.clickFirstNotification();

    // Should navigate to an order detail page
    await notificationsPage.waitForUrl('/orders/', 10000);

    const url = await notificationsPage.getCurrentUrl();
    expect(url).toContain('/orders/');
  });
});
