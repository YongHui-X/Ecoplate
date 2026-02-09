import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/specs/**/*.spec.ts'],
  testTimeout: 60000,
  maxWorkers: 1, // Run tests sequentially
  verbose: true,
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'EcoPlate E2E Test Report',
      outputPath: './reports/test-report.html',
      includeFailureMsg: true,
      includeSuiteFailure: true,
      includeConsoleLog: true,
      dateFormat: 'yyyy-mm-dd HH:MM:ss',
    }]
  ],
  setupFilesAfterEnv: [],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
};

export default config;
