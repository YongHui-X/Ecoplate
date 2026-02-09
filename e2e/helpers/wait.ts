/**
 * Custom Wait Conditions for Selenium
 */

import { By, until, WebDriver, WebElement } from 'selenium-webdriver';
import config from '../selenium.config';
import { getDriver } from './driver';

/**
 * Wait for an element to be present in the DOM
 */
export async function waitForElement(
  locator: By,
  timeout: number = config.timeouts.element
): Promise<WebElement> {
  const driver = getDriver();
  return driver.wait(until.elementLocated(locator), timeout);
}

/**
 * Wait for an element to be visible
 */
export async function waitForVisible(
  locator: By,
  timeout: number = config.timeouts.element
): Promise<WebElement> {
  const driver = getDriver();
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  return element;
}

/**
 * Wait for an element to be clickable
 */
export async function waitForClickable(
  locator: By,
  timeout: number = config.timeouts.element
): Promise<WebElement> {
  const driver = getDriver();
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  await driver.wait(until.elementIsEnabled(element), timeout);
  return element;
}

/**
 * Wait for an element to disappear
 */
export async function waitForElementToDisappear(
  locator: By,
  timeout: number = config.timeouts.element
): Promise<void> {
  const driver = getDriver();
  await driver.wait(until.stalenessOf(await driver.findElement(locator)), timeout);
}

/**
 * Wait for URL to contain a specific path
 */
export async function waitForUrlContains(
  path: string,
  timeout: number = config.timeouts.navigation
): Promise<void> {
  const driver = getDriver();
  await driver.wait(until.urlContains(path), timeout);
}

/**
 * Wait for URL to match exactly
 */
export async function waitForUrl(
  url: string,
  timeout: number = config.timeouts.navigation
): Promise<void> {
  const driver = getDriver();
  await driver.wait(until.urlIs(url), timeout);
}

/**
 * Wait for page title to contain text
 */
export async function waitForTitleContains(
  text: string,
  timeout: number = config.timeouts.navigation
): Promise<void> {
  const driver = getDriver();
  await driver.wait(until.titleContains(text), timeout);
}

/**
 * Wait for text to be present in an element
 */
export async function waitForTextInElement(
  locator: By,
  text: string,
  timeout: number = config.timeouts.element
): Promise<WebElement> {
  const driver = getDriver();
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementTextContains(element, text), timeout);
  return element;
}

/**
 * Wait for a specific number of elements
 */
export async function waitForElementCount(
  locator: By,
  count: number,
  timeout: number = config.timeouts.element
): Promise<WebElement[]> {
  const driver = getDriver();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const elements = await driver.findElements(locator);
    if (elements.length === count) {
      return elements;
    }
    await driver.sleep(200);
  }

  throw new Error(`Expected ${count} elements but found different count`);
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(
  timeout: number = config.timeouts.pageLoad
): Promise<void> {
  const driver = getDriver();
  await driver.wait(async () => {
    const readyState = await driver.executeScript('return document.readyState');
    return readyState === 'complete';
  }, timeout);
}

/**
 * Wait for network to be idle (no pending requests)
 */
export async function waitForNetworkIdle(
  idleTime: number = 500,
  timeout: number = config.timeouts.pageLoad
): Promise<void> {
  const driver = getDriver();
  const startTime = Date.now();

  // Simple approach: wait for document ready and a small delay
  await waitForPageLoad(timeout);
  await driver.sleep(idleTime);
}

/**
 * Wait with a custom condition
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = config.timeouts.element,
  pollInterval: number = 200
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Sleep for a specified duration (use sparingly)
 */
export async function sleep(ms: number): Promise<void> {
  const driver = getDriver();
  await driver.sleep(ms);
}
