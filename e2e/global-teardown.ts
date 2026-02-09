/**
 * Jest Global Teardown
 * Runs after all tests complete
 */

async function globalTeardown(): Promise<void> {
  console.log('\n🏁 E2E Test Suite Complete');
  console.log('📊 Check ./reports/test-report.html for detailed results\n');
}

export default globalTeardown;
