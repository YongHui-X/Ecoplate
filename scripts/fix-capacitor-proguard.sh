#!/usr/bin/env bash
# Fix ProGuard configuration in Capacitor packages for AGP 9.0+ compatibility
# This is a fallback script - the primary solution is the Gradle configuration override
# in frontend/android/build.gradle

set -e  # Exit on error

echo "🔧 Checking Capacitor ProGuard configurations..."

FIXED_COUNT=0

# Fix all Capacitor plugin build.gradle files
for file in node_modules/@capacitor/*/android/build.gradle; do
  if [ -f "$file" ] && grep -q "proguard-android\.txt" "$file" 2>/dev/null; then
    # Detect OS for sed compatibility
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "s/proguard-android\.txt/proguard-android-optimize.txt/g" "$file"
    else
      # Linux and Windows Git Bash
      sed -i "s/proguard-android\.txt/proguard-android-optimize.txt/g" "$file"
    fi
    echo "  ✓ Fixed: $file"
    ((FIXED_COUNT++))
  fi
done

if [ $FIXED_COUNT -gt 0 ]; then
  echo "✅ Fixed $FIXED_COUNT Capacitor package(s)"
  echo "ℹ️  Note: This is a fallback - primary fix is in frontend/android/build.gradle"
else
  echo "ℹ️  No Capacitor packages needed fixing (likely already handled by Gradle override)"
fi
