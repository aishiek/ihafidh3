#!/bin/bash

# App Store ATT Compliance Setup Script
# Switches between analytics-only and tracking configurations

set -e

SCENARIO=${1:-""}
PROJECT_DIR="/Users/ahnaf/Documents/Aleem/ihafidh3"

if [ "$SCENARIO" != "analytics" ] && [ "$SCENARIO" != "tracking" ]; then
    echo "📱 App Store ATT Compliance Setup"
    echo ""
    echo "Usage: $0 [analytics|tracking]"
    echo ""
    echo "Scenarios:"
    echo "  analytics  - Analytics only (current, compliant) ✅"
    echo "  tracking   - With AdMob/tracking (requires ATT prompt) ⚠️"
    echo ""
    echo "Current status: Analytics-only (compliant)"
    exit 1
fi

cd "$PROJECT_DIR"

if [ "$SCENARIO" = "analytics" ]; then
    echo "🎯 Setting up ANALYTICS-ONLY configuration (Recommended)"
    echo ""
    
    # Remove tracking dependencies if they exist
    echo "📦 Removing tracking dependencies..."
    npm uninstall expo-ads-admob react-native-app-tracking-transparency 2>/dev/null || true
    
    # Ensure current app.json is correct (should already be)
    echo "✅ Your current app.json is already configured correctly for analytics-only"
    
    echo ""
    echo "✅ ANALYTICS-ONLY SETUP COMPLETE"
    echo ""
    echo "App Privacy Settings for App Store Connect:"
    echo "• Data Collection: Analytics (YES), Advertising (NO)"
    echo "• Tracking: NO"
    echo "• NSUserTrackingUsageDescription: Removed"
    echo ""
    echo "Next steps:"
    echo "1. Build your app: expo build:ios or eas build --platform ios"
    echo "2. Submit to App Store with 'No Tracking' privacy settings"
    echo "3. App will pass review ✅"

elif [ "$SCENARIO" = "tracking" ]; then
    echo "⚠️  Setting up TRACKING configuration (AdMob/Ads)"
    echo ""
    
    # Install tracking dependencies
    echo "📦 Installing tracking dependencies..."
    npm install expo-ads-admob react-native-app-tracking-transparency
    
    # Copy tracking configuration
    echo "📝 Updating app.json for tracking..."
    cp app-with-tracking.json app.json
    
    echo ""
    echo "⚠️  TRACKING SETUP COMPLETE"
    echo ""
    echo "❗ IMPORTANT: Update your AdMob App ID in app.json:"
    echo "   Replace 'ca-app-pub-XXXXXXXXXX~XXXXXXXXXX' with your real AdMob App ID"
    echo ""
    echo "App Privacy Settings for App Store Connect:"
    echo "• Data Collection: Analytics (YES), Advertising (YES)"
    echo "• Tracking: YES"
    echo "• NSUserTrackingUsageDescription: Added"
    echo ""
    echo "Next steps:"
    echo "1. Update GADApplicationIdentifier in app.json with your AdMob App ID"
    echo "2. Implement ATT prompt using hooks/useATTPermission.ts"
    echo "3. Build and test ATT prompt appears"
    echo "4. Submit to App Store with 'Tracking Enabled' privacy settings"
fi

echo ""
echo "📚 See docs/app-store-compliance.md for complete guidance"
