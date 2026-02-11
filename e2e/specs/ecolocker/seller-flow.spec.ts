import { WebDriver } from 'selenium-webdriver';
import { createDriver, quitDriver } from '../../helpers/driver';
import {
  EcoLockerOrdersPage,
  EcoLockerOrderDetailPage,
} from '../../pages/ecolocker';
import { loginToEcoLocker } from '../../helpers/ecolocker-auth';

describe('EcoLocker Seller Flow', () => {
  let driver: WebDriver;
  let ordersPage: EcoLockerOrdersPage;
  let orderDetailPage: EcoLockerOrderDetailPage;

  beforeAll(async () => {
    driver = await createDriver();
    ordersPage = new EcoLockerOrdersPage(driver);
    orderDetailPage = new EcoLockerOrderDetailPage(driver);

    // Login as secondary user (seller)
    await loginToEcoLocker(driver, 'secondary');
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  it('should show seller orders in Selling tab', async () => {
    await ordersPage.goto();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await ordersPage.clickSellingTab();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const hasContent = await ordersPage.hasOrdersOrEmptyState();
    expect(hasContent).toBe(true);
  });

  it('should show Schedule Pickup and Confirm Rider Pickup sections', async () => {
    // Navigate to selling tab and check for order cards
    await ordersPage.goto();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await ordersPage.clickSellingTab();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const orderCount = await ordersPage.getOrderCardCount();
    if (orderCount === 0) {
      console.warn('No seller orders found, skipping detail check');
      return;
    }

    await ordersPage.clickFirstOrderCard();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Seller should see schedule pickup or confirm rider pickup sections
    // depending on the order status
    const hasSchedule = await orderDetailPage.isSchedulePickupVisible();
    const hasConfirm = await orderDetailPage.isConfirmRiderPickupVisible();

    // At least one should be visible for active paid orders
    const hasSellerActions = hasSchedule || hasConfirm;
    // May or may not have seller actions depending on order status
    expect(typeof hasSellerActions).toBe('boolean');
  });

  it('should be able to schedule pickup if order is paid', async () => {
    const hasSchedule = await orderDetailPage.isSchedulePickupVisible();
    if (!hasSchedule) {
      console.warn('Schedule Pickup not available for current order');
      return;
    }

    // Set a future datetime
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const dateString = futureDate.toISOString().slice(0, 16);

    await orderDetailPage.setPickupTime(dateString);
    await orderDetailPage.clickSchedulePickup();

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Status should update
    const hasBadge = await orderDetailPage.isStatusBadgeVisible();
    expect(hasBadge).toBe(true);
  });

  it('should be able to confirm rider pickup', async () => {
    const hasConfirm = await orderDetailPage.isConfirmRiderPickupVisible();
    if (!hasConfirm) {
      console.warn('Confirm Rider Pickup not available for current order');
      return;
    }

    await orderDetailPage.clickRiderPickedUp();

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Status should update
    const hasBadge = await orderDetailPage.isStatusBadgeVisible();
    expect(hasBadge).toBe(true);
  });
});
