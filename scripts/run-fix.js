const { execSync } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';
const script = isWindows
  ? 'powershell -File scripts/fix-capacitor-proguard.ps1'
  : 'bash scripts/fix-capacitor-proguard.sh';

try {
  execSync(script, { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to run ProGuard fix script:', error.message);
  process.exit(1);
}
