#!/bin/bash

# Clean up Node.js modules and cache
echo "🧹 Cleaning up Node.js modules..."
rm -rf node_modules
npm cache clean --force

# Clean up iOS build artifacts
echo "🧹 Cleaning up iOS build artifacts..."
cd ios
rm -rf Pods
rm -rf build
rm -rf Podfile.lock
pod deintegrate
cd ..

# Clean up Android build artifacts (if you have an Android directory)
if [ -d "android" ]; then
    echo "🧹 Cleaning up Android build artifacts..."
    cd android
    ./gradlew clean
    rm -rf .gradle
    cd ..
fi

# Reinstall dependencies
echo "📦 Reinstalling dependencies..."
npm install --legacy-peer-deps

# Install iOS pods
echo "📱 Installing iOS pods..."
cd ios
pod install --repo-update
cd ..

echo "✅ Cleanup complete! You can now run: npx expo start --clear"