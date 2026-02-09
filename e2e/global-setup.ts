/**
 * Jest Global Setup
 * Runs before all tests - verifies application is healthy
 */

import config from './selenium.config';

async function globalSetup(): Promise<void> {
  console.log('\n🚀 E2E Test Suite Starting...');
  console.log(`📍 Target URL: ${config.baseUrl}`);
  console.log(`🖥️  Headless: ${config.browser.headless}`);

  // Wait for application to be ready
  const healthUrl = `${config.baseUrl}${config.healthCheck.endpoint}`;
  let attempts = 0;
  let healthy = false;

  console.log(`\n⏳ Waiting for application health check at ${healthUrl}...`);

  while (attempts < config.healthCheck.maxAttempts && !healthy) {
    attempts++;
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        healthy = true;
        console.log(`✅ Application is healthy (attempt ${attempts}/${config.healthCheck.maxAttempts})`);
      } else {
        console.log(`⚠️  Health check returned ${response.status} (attempt ${attempts}/${config.healthCheck.maxAttempts})`);
      }
    } catch (error) {
      console.log(`⚠️  Health check failed (attempt ${attempts}/${config.healthCheck.maxAttempts}): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!healthy && attempts < config.healthCheck.maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, config.healthCheck.intervalMs));
    }
  }

  if (!healthy) {
    throw new Error(
      `Application failed health check after ${config.healthCheck.maxAttempts} attempts. ` +
      `Ensure the application is running at ${config.baseUrl}`
    );
  }

  console.log('\n📋 Test Configuration:');
  console.log(`   - Browser: ${config.browser.name}`);
  console.log(`   - Window Size: ${config.browser.windowSize.width}x${config.browser.windowSize.height}`);
  console.log(`   - Screenshot on Failure: ${config.screenshots.onFailure}`);
  console.log('\n');
}

export default globalSetup;
