/**
 * Selenium E2E Test Configuration
 */

export const config = {
  // Base URL for the application
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  // Browser configuration
  browser: {
    name: 'chrome',
    headless: process.env.HEADLESS !== 'false', // Default to headless
    windowSize: {
      width: 1280,
      height: 720,
    },
  },

  // Timeouts
  timeouts: {
    implicit: 10000,      // 10 seconds
    pageLoad: 30000,      // 30 seconds
    script: 30000,        // 30 seconds
    element: 10000,       // Wait for element
    navigation: 15000,    // Wait for navigation
  },

  // Screenshot settings
  screenshots: {
    directory: './screenshots',
    onFailure: true,
  },

  // Report settings
  reports: {
    directory: './reports',
  },

  // Health check settings
  healthCheck: {
    endpoint: '/api/v1/health',
    maxAttempts: 30,
    intervalMs: 5000,
  },
};

export default config;
