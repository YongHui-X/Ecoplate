import { Builder, WebDriver, Browser } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';
import { config } from '../selenium.config';
import * as fs from 'fs';
import * as path from 'path';

export async function createDriver(): Promise<WebDriver> {
  const browserName = config.browser.name.toLowerCase();
  let driver: WebDriver;

  if (browserName === 'firefox') {
    const options = new firefox.Options();

    if (config.browser.headless) {
      options.addArguments('-headless');
    }

    options.addArguments(
      `-width=${config.browser.windowSize.width}`,
      `-height=${config.browser.windowSize.height}`
    );

    driver = await new Builder()
      .forBrowser(Browser.FIREFOX)
      .setFirefoxOptions(options)
      .build();
  } else {
    // Default to Chrome
    const options = new chrome.Options();

    if (config.browser.headless) {
      options.addArguments('--headless=new');
    }

    options.addArguments(
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    );

    driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(options)
      .build();
  }

  await driver.manage().setTimeouts({
    implicit: config.timeouts.implicit,
    pageLoad: config.timeouts.pageLoad,
    script: config.timeouts.script,
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
