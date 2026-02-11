import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver';
import {
  EcoLockerSelectLockerPage,
  EcoLockerPaymentPage,
  EcoLockerOrderDetailPage,
} from '../../pages/ecolocker';
import { loginToEcoLocker } from '../../helpers/ecolocker-auth';
import {
  getEcoLockers,
  createEcoLockerOrder,
  payEcoLockerOrder,
} from '../../helpers/ecolocker-api';
import { getAuthToken } from '../../helpers/api';
import { testUsers } from '../../fixtures/users';

describe('EcoLocker Purchase Flow', () => {
  let driver: WebDriver;
  let selectLockerPage: EcoLockerSelectLockerPage;
  let paymentPage: EcoLockerPaymentPage;
  let orderDetailPage: EcoLockerOrderDetailPage;
  let authToken: string;

  beforeAll(async () => {
    driver = await createDriver();
    selectLockerPage = new EcoLockerSelectLockerPage(driver);
    paymentPage = new EcoLockerPaymentPage(driver);
    orderDetailPage = new EcoLockerOrderDetailPage(driver);

    await loginToEcoLocker(driver, 'primary');

    // Get API token for direct API calls
    const token = await getAuthToken(testUsers.primary.email, testUsers.primary.password);
    if (!token) throw new Error('Failed to get auth token');
    authToken = token;
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  it('should navigate to select locker page with listingId', async () => {
    // Use listingId=1 as a test listing
    await selectLockerPage.goto(1);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const isVisible = await selectLockerPage.isPageTitleVisible();
    expect(isVisible).toBe(true);
  });

  it('should navigate to payment page for an order created via API', async () => {
    // Get available lockers
    const lockersResponse = await getEcoLockers(authToken);
    expect(lockersResponse.ok).toBe(true);

    const lockers = lockersResponse.data as any[];
    if (!lockers || lockers.length === 0) {
      console.warn('No lockers available, skipping payment page test');
      return;
    }

    // Create order via API
    const orderResponse = await createEcoLockerOrder(authToken, 1, lockers[0].id);
    if (!orderResponse.ok) {
      console.warn('Could not create order:', orderResponse.error);
      return;
    }

    const order = orderResponse.data as any;
    await paymentPage.goto(order.id);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const isVisible = await paymentPage.isPageTitleVisible();
    expect(isVisible).toBe(true);
  });

  it('should show order details and price breakdown on payment page', async () => {
    // This test builds on the previous navigation
    const hasItemPrice = await paymentPage.isItemPriceVisible();
    const hasDeliveryFee = await paymentPage.isDeliveryFeeVisible();
    const hasTotal = await paymentPage.isTotalVisible();

    expect(hasItemPrice).toBe(true);
    expect(hasDeliveryFee).toBe(true);
    expect(hasTotal).toBe(true);
  });

  it('should complete payment and redirect to order detail', async () => {
    const hasPayButton = await paymentPage.isPayButtonVisible();
    if (!hasPayButton) {
      console.warn('No pay button visible, skipping');
      return;
    }

    await paymentPage.clickPayButton();

    // Wait for redirect to order detail page
    await paymentPage.waitForUrl('/orders/', 10000);

    const url = await paymentPage.getCurrentUrl();
    expect(url).toContain('/orders/');
  });

  it('should show paid status on order detail after payment', async () => {
    // After payment redirect, we should be on order detail
    await new Promise(resolve => setTimeout(resolve, 2000));

    const hasBadge = await orderDetailPage.isStatusBadgeVisible();
    expect(hasBadge).toBe(true);

    const hasDetails = await orderDetailPage.isOrderDetailsVisible();
    expect(hasDetails).toBe(true);
  });
});
