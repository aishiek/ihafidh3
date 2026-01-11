# Push Notification Debugging Guide

This guide helps diagnose why push notifications are not being received on iOS or Android devices.

## Quick Diagnosis

### Step 1: Run Diagnostic Script

```bash
cd /Users/ahnaf/Documents/Aleem/ihafidh3

# For Singapore (UTC+8)
FIREBASE_SERVICE_ACCOUNT='<paste-from-github-secrets>' \
node scripts/notifications/diagnose-push.js 0800

# For other timezones, adjust offset (e.g., -0500 for EST, +0900 for JST)
```

This script will:
- ✅ Validate Firebase credentials
- ✅ Send test notifications to all three topics (broadcast, fasting, daily_ayah)
- ✅ Display message IDs for tracking
- ✅ Provide troubleshooting steps if messages don't arrive

### Step 2: Check In-App Debug Info

1. Open the app on your device
2. Go to **Settings**
3. Scroll to **Notifications** section
4. Tap **🔍 Debug Notifications** button
5. Check React Native debugger console for output

Expected output:
```
═════════════════════════════════════
🔔 PUSH NOTIFICATION DEBUG INFO
═════════════════════════════════════

Platform: IOS
Permission: ✅ Granted
Auth Status: Authorized
Timezone: +0800

FCM Token:
dK3f9h2j...  (token truncated)

Expected Topic Subscriptions:
  • broadcast_+0800
  • fasting_+0800
  • daily_ayah_+0800
```

## Common Issues and Solutions

### Issue 1: No Devices Subscribed to Topics

**Symptoms:**
- ✅ Diagnostic script shows "Message sent successfully"
- ✅ Message IDs displayed
- ❌ No notifications received on device

**Cause:** Users haven't enabled notifications in app settings.

**Solution:**
1. Open app on device
2. Go to **Settings**
3. Enable **Daily Reminders** toggle
4. Enable **Daily Ayah** toggle
5. Check console for subscription confirmations:
   ```
   [Push] ✅ Subscribed to: fasting_+0800
   [Push] ✅ Subscribed to: daily_ayah_+0800
   ```

### Issue 2: Device Permissions Not Granted

**Symptoms:**
- Debug info shows `Permission: ❌ Denied`
- App can't get FCM token

**Solution:**

**iOS:**
1. Settings > Notifications > iHafidh
2. Enable "Allow Notifications"
3. Set to "Immediate Delivery"
4. Enable Sounds, Badges, and Banners

**Android:**
1. Settings > Apps > iHafidh > Notifications
2. Enable all notification categories
3. Set to "Alerting" (not Silent)
4. Settings > Battery > Battery Optimization
5. Find iHafidh > Don't Optimize

### Issue 3: Wrong Timezone Calculation

**Symptoms:**
- GitHub Actions shows successful run
- But notifications arrive at wrong time
- Or don't arrive at all

**Diagnosis:**
Check timezone calculation in debug info. For Singapore (UTC+8), it should show `+0800`.

**Solution:**
The system automatically detects device timezone. If incorrect:
1. Check device Settings > Date & Time
2. Ensure "Set Automatically" is enabled
3. Restart app to refresh timezone

### Issue 4: GitHub Actions Not Triggering at Right Time

**Symptoms:**
- Notifications should arrive at 5 AM local time
- But Actions runs at wrong hour

**Diagnosis:**
Check the GitHub Actions workflow logs. For Singapore (UTC+8), the workflow should trigger at **21:00 UTC** (which is 5 AM SGT the next day).

**Solution:**
1. Go to GitHub Actions > Daily Notifications
2. Download "notification-logs" artifact
3. Check timestamp and timezone detection:
   ```
   UTC Time: 2024-01-15 21:00:00 UTC
   
   Found 1 timezone(s) hitting 5 AM:
   ─────────────────────────────────
   Timezone: +0800
     UTC Offset: +08:00
     Sample Time: 05:00 (local time)
   ```

### Issue 5: Firebase Credentials Invalid

**Symptoms:**
- ❌ Diagnostic script fails immediately
- Error: "authentication-error"

**Solution:**
1. Go to GitHub repository > Settings > Secrets
2. Verify `FIREBASE_SERVICE_ACCOUNT` secret exists
3. Get fresh service account key:
   - Firebase Console > Project Settings
   - Service Accounts tab
   - Generate New Private Key
4. Update GitHub secret with new JSON

### Issue 6: Do Not Disturb / Focus Mode

**Symptoms:**
- Everything configured correctly
- Message IDs show in Firebase
- Still no notifications

**Solution:**

**iOS:**
1. Check Focus mode (moon icon in Control Center)
2. Settings > Focus > Do Not Disturb
3. Either disable DND or add iHafidh to allowed apps

**Android:**
1. Settings > Sound & vibration > Do Not Disturb
2. Ensure DND is off during expected notification time
3. Or add iHafidh as exception

### Issue 7: App in Background/Killed

**Note:** FCM should work even when app is killed, but some devices are aggressive.

**Android Solution:**
Some manufacturers (Xiaomi, Huawei, OnePlus) kill background apps aggressively:
1. Settings > Apps > iHafidh
2. Battery > Unrestricted
3. Autostart > Enable
4. Lock app in recent apps list (prevents swipe-away)

## Testing Flow

### 1. Manual Test via Script

```bash
# Test immediately
FIREBASE_SERVICE_ACCOUNT='...' \
node scripts/notifications/diagnose-push.js 0800
```

Expected: Notification arrives within 10 seconds

### 2. Test via GitHub Actions

```bash
# Trigger workflow manually
gh workflow run daily-push.yml

# Check logs
gh run list --workflow=daily-push.yml --limit 1
gh run view --log
```

### 3. Test via Firebase Console

1. Go to Firebase Console > Cloud Messaging
2. Click "Send your first message"
3. Enter title and body
4. Next > Target: Topic
5. Enter: `broadcast_0800` (your timezone)
6. Review + Publish

### 4. Test Direct to Token

Most reliable test (bypasses topics):

```javascript
// In scripts/notifications/test-direct.js
const messaging = admin.messaging();

await messaging.send({
    token: 'YOUR_FCM_TOKEN_FROM_DEBUG_INFO',
    notification: {
        title: 'Direct Test',
        body: 'Testing direct token delivery'
    }
});
```

## Monitoring Production

### Check GitHub Actions Artifacts

After each hourly run:
1. Go to Actions > Daily Notifications
2. Click latest run
3. Download "notification-logs" artifact
4. Review for:
   - ✅ Successful sends with message IDs
   - ❌ Any error messages
   - 📊 Success/failure counts

### Check Firebase Console Metrics

1. Firebase Console > Cloud Messaging
2. View delivery statistics:
   - Messages sent
   - Messages delivered
   - Bounce rate
   - Error rate

### Check Topic Subscriber Count

Firebase doesn't directly show subscriber counts, but you can infer:
- Send test message to topic
- Check "sent" vs "delivered" in console
- If sent=100 but delivered=0, no active subscribers

## Expected Behavior

### Timezone: Singapore (UTC+8)

| Local Time | UTC Time | Action |
|------------|----------|--------|
| 5:00 AM SGT | 9:00 PM UTC | GitHub Actions should NOT trigger |
| 5:00 AM SGT (next day) | 9:00 PM UTC | GitHub Actions SHOULD trigger |

The workflow runs every hour (`:00`), checks which timezones are at 5 AM, and sends to those topics.

### Topic Naming

- **Broadcast**: `broadcast_+0800` - Always subscribed
- **Fasting**: `fasting_+0800` - Only if "Daily Reminders" enabled
- **Daily Ayah**: `daily_ayah_+0800` - Only if "Daily Ayah" enabled

## Advanced Debugging

### Enable Verbose Logging

In `services/PushNotificationService.ts`, the `__DEV__` mode already has extensive logging. Run in debug mode:

```bash
# iOS
npx react-native run-ios --configuration Debug

# Android
npx react-native run-android --variant=debug
```

Watch console for:
```
═══════════════════════════════════════════════
🔔 PUSH NOTIFICATION SERVICE - Initializing
═══════════════════════════════════════════════
[Push] FCM Token obtained: dK3f9h2j...
[Push] ✅ Subscribed to: broadcast_+0800
```

### Check Message Receipt on Device

Add this to your app's notification handler:

```typescript
// In app/_layout.tsx or similar
messaging().onMessage(async remoteMessage => {
    console.log('📨 Foreground notification received!', remoteMessage);
    // Should log when notification arrives
});

messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('📨 Background notification received!', remoteMessage);
});
```

### Check APNs Certificate (iOS Only)

1. Firebase Console > Project Settings
2. Cloud Messaging tab
3. iOS app configuration
4. Verify APNs certificates are valid
5. Check expiration date

### Check Google Services JSON/Plist

**Android:** Verify `android/app/google-services.json` exists and contains correct `project_id`.

**iOS:** Verify `ios/GoogleService-Info.plist` exists and contains correct `PROJECT_ID`.

## Still Not Working?

### Collect Comprehensive Debug Info

1. Run diagnostic script, save output
2. Get in-app debug info, screenshot
3. Check GitHub Actions logs, download artifact
4. Check Firebase Console metrics

### Create GitHub Issue

Include:
- Platform (iOS/Android)
- Device model and OS version
- Timezone
- Diagnostic script output
- In-app debug info screenshot
- GitHub Actions log excerpt
- Firebase Console screenshots
- What you've tried so far

### Quick Checklist

- [ ] Device permissions granted
- [ ] In-app settings enabled (Daily Reminders + Daily Ayah)
- [ ] Do Not Disturb OFF
- [ ] Battery optimization disabled (Android)
- [ ] FCM token obtained successfully
- [ ] Timezone detection correct
- [ ] Topics subscribed (check console logs)
- [ ] Diagnostic script sends successfully
- [ ] Message IDs displayed
- [ ] GitHub Actions runs at correct UTC hour
- [ ] Firebase credentials valid
- [ ] APNs/FCM configured in Firebase Console
- [ ] google-services.json/GoogleService-Info.plist present

If ALL above are ✅ and still no notifications, the issue is likely device-specific or carrier-related (some carriers block push notifications).
