#!/bin/bash

echo "========================================"
echo "Building EcoPlate for Android"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../frontend"

echo ""
echo "Installing dependencies..."
bun install
if [ $? -ne 0 ]; then
    echo "Failed to install dependencies"
    exit 1
fi

echo ""
echo "Checking for Android platform..."
if [ ! -d "android" ]; then
    echo "Adding Android platform..."
    bunx cap add android
    if [ $? -ne 0 ]; then
        echo "Failed to add Android platform"
        exit 1
    fi
fi

echo ""
echo "Building frontend for mobile..."
bun run build:android
if [ $? -ne 0 ]; then
    echo "Failed to build frontend"
    exit 1
fi

echo ""
echo "========================================"
echo "Android build complete!"
echo ""
echo "To open in Android Studio, run:"
echo "  cd frontend && bunx cap open android"
echo ""
echo "Or open: frontend/android in Android Studio"
echo ""
echo "To build APK from command line:"
echo "  cd frontend/android && ./gradlew assembleDebug"
echo ""
echo "APK will be at:"
echo "  frontend/android/app/build/outputs/apk/debug/app-debug.apk"
echo "========================================"
