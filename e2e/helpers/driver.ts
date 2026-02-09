import { Builder, WebDriver, Browser } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { config } from '../selenium.config.js';
import * as fs from 'fs';
import * as path from 'path';

export async function createDriver(): Promise<WebDriver> {
  const options = new chrome.Options();

  if (config.headless) {
    options.addArguments('--headless=new');
  }

  options.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080'
  );

  const driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  await driver.manage().setTimeouts({
    implicit: config.timeout.implicit,
    pageLoad: config.timeout.pageLoad,
    script: config.timeout.script,
  });

  return driver;
}

export async function quitDriver(driver: WebDriver): Promise<void> {
  if (driver) {
    await driver.quit();
  }
}

export async function takeScreenshot(
  driver: WebDriver,
  name: string
): Promise<void> {
  const screenshot = await driver.takeScreenshot();
  const screenshotDir = path.join(process.cwd(), 'screenshots');

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const timestamp = Date.now();
  const filename = `${name}-${timestamp}.png`;
  fs.writeFileSync(
    path.join(screenshotDir, filename),
    screenshot,
    'base64'
  );
  console.log(`Screenshot saved: ${filename}`);
}

export async function navigateTo(
  driver: WebDriver,
  urlPath: string
): Promise<void> {
  await driver.get(`${config.baseUrl}${urlPath}`);
}
