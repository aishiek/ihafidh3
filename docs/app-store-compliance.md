# App Store Compliance Guide - ATT (App Tracking Transparency)

## Current Status: ✅ COMPLIANT (Analytics-Only)

Your app is currently configured for **analytics-only** usage without IDFA tracking, which is compliant with App Store guidelines.

## Scenario 1: Analytics Only (Current Configuration)

### ✅ What's Already Done:
- `NSUserTrackingUsageDescription` removed from `app.json`
- Firebase Analytics configured for anonymous analytics
- No AdMob or advertising SDKs

### App Privacy Settings in App Store Connect:
```
Data Collection:
- Analytics: YES
- App Functionality: YES (location for Qibla)
- Product Personalization: NO
- Advertising or Marketing: NO
- Other Purposes: NO

Data Types Collected:
- Location: YES (for Qibla functionality)
- Usage Data: YES (analytics)
- Identifiers: NO (no IDFA tracking)

Tracking:
- Does this app or third-party SDKs collect data for tracking? NO
```

### Verification Steps:
1. Build the app: `expo build:ios` or `eas build --platform ios`
2. Check the generated Info.plist contains no `NSUserTrackingUsageDescription`
3. Verify no ATT prompt appears when testing

## Scenario 2: With AdMob/Tracking (Alternative Configuration)

If you need to add advertising/AdMob in the future, use this configuration:

### Required Changes:

#### 1. Install AdMob Dependencies:
```bash
npm install expo-ads-admob react-native-app-tracking-transparency
```

#### 2. Update app.json:
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSUserTrackingUsageDescription": "This app uses tracking to provide personalized ads and improve user experience.",
        "GADApplicationIdentifier": "ca-app-pub-XXXXXXXXXX~XXXXXXXXXX",
        "SKAdNetworkItems": [
          {
            "SKAdNetworkIdentifier": "cstr6suwn9.skadnetwork"
          }
        ]
      }
    },
    "plugins": [
      "expo-ads-admob"
    ]
  }
}
```

#### 3. Implement ATT Prompt:
```typescript
// utils/trackingPermission.ts
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'react-native-app-tracking-transparency';

export const requestTrackingPermission = async (): Promise<boolean> => {
  try {
    const { status } = await getTrackingPermissionsAsync();
    
    if (status === 'undetermined') {
      const { status: newStatus } = await requestTrackingPermissionsAsync();
      return newStatus === 'granted';
    }
    
    return status === 'granted';
  } catch (error) {
    console.log('Tracking permission error:', error);
    return false;
  }
};
```

#### 4. Use ATT in App:
```typescript
// app/_layout.tsx or similar
import { requestTrackingPermission } from '../utils/trackingPermission';

export default function RootLayout() {
  useEffect(() => {
    const setupTracking = async () => {
      const hasPermission = await requestTrackingPermission();
      if (hasPermission) {
        // Initialize AdMob or other tracking services
        console.log('Tracking permission granted');
      } else {
        console.log('Tracking permission denied');
      }
    };
    
    setupTracking();
  }, []);

  return (
    // Your layout JSX
  );
}
```

#### 5. App Privacy Settings for Tracking Version:
```
Data Collection:
- Analytics: YES
- App Functionality: YES
- Product Personalization: YES
- Advertising or Marketing: YES
- Other Purposes: NO

Tracking:
- Does this app collect data for tracking? YES
- Do any third-party SDKs collect data for tracking? YES
```

## Build Verification Commands

### Check Info.plist (after build):
```bash
# For Expo managed workflow
expo export --platform ios
# Check: expo-export/ios/Info.plist

# For EAS build
eas build --platform ios --local
# Check the generated iOS project Info.plist
```

### Confirm NSUserTrackingUsageDescription Status:
```bash
# Search for tracking usage description in built app
grep -r "NSUserTrackingUsageDescription" ./ios/ || echo "✅ No tracking description found"
```

## Recommendation

**Stick with Scenario 1** (current configuration) unless you specifically need advertising revenue, as it:
- ✅ Passes App Store review immediately
- ✅ No user permission prompts required
- ✅ Better user experience
- ✅ Full analytics capabilities for app improvement
