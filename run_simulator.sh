#!/bin/bash

# iOS Simulator Setup Script for iHafidh App
# Save this as run_simulator.sh and make executable with: chmod +x run_simulator.sh

set -e  # Exit on any error

# Configuration
APP_PATH="/tmp/iHafidhDerivedData/Build/Products/Release-iphonesimulator/iHafidh.app"
DEVICE_NAME="iPhone 16 Plus"

echo "🚀 Starting iOS Simulator setup for iHafidh..."
echo "================================================"

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: App not found at $APP_PATH"
    echo "Please build your app first or check the path."
    exit 1
fi
echo "✅ App found at: $APP_PATH"

# Get device UUID
echo "🔍 Looking for $DEVICE_NAME simulator..."
DEVICE=$(xcrun simctl list devices available | grep "$DEVICE_NAME (" | head -n 1 | awk -F '[()]' '{print $2}')

if [ -z "$DEVICE" ]; then
    echo "❌ Error: No available $DEVICE_NAME simulator found"
    echo "Available devices:"
    xcrun simctl list devices available | grep iPhone
    exit 1
fi
echo "✅ Found device UUID: $DEVICE"

# Get bundle identifier
echo "📱 Reading bundle identifier..."
BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP_PATH/Info.plist")

if [ -z "$BUNDLE_ID" ]; then
    echo "❌ Error: Could not read bundle identifier from Info.plist"
    exit 1
fi
echo "✅ Bundle ID: $BUNDLE_ID"

# Shutdown device (ignore errors)
echo "🛑 Shutting down simulator..."
xcrun simctl shutdown "$DEVICE" >/dev/null 2>&1 || true

# Erase device
echo "🧹 Erasing simulator data..."
if ! xcrun simctl erase "$DEVICE" >/dev/null 2>&1; then
    echo "⚠️  Warning: Could not erase device, continuing..."
fi

# Boot device
echo "🔄 Booting simulator..."
xcrun simctl boot "$DEVICE"

# Open Simulator app
echo "📱 Opening Simulator app..."
open -a Simulator

# Wait for boot to complete
echo "⏳ Waiting for simulator to fully boot..."
xcrun simctl bootstatus "$DEVICE" -b

# Install app
echo "📦 Installing app on simulator..."
xcrun simctl install "$DEVICE" "$APP_PATH"

# Launch app
echo "🚀 Launching iHafidh app..."
xcrun simctl launch "$DEVICE" "$BUNDLE_ID"

echo ""
echo "🎉 Success! iHafidh app is now running on the simulator."
echo "================================================"
