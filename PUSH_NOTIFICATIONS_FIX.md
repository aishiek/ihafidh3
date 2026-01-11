# Push Notifications Bug Fixes

## Issues Fixed

### 1. GitHub Actions Notifications Not Received ✅
**Problem**: Daily notifications and fasting reminders from GitHub Actions workflows were not being received even though Actions showed success (green).

**Root Cause**: Topic naming format. FCM (Firebase Cloud Messaging) doesn't allow `+` symbols in topic names, so positive timezone offsets need to be formatted without the `+` prefix.

**Solution**: 
- Scripts already format topics correctly (e.g., `0800` for UTC+8, `-0500` for UTC-5)
- Updated comments to clarify this format is for FCM compatibility
- App's `PushNotificationService.getTimezoneOffset()` already matches this format
- Handles 30-minute offsets correctly (e.g., `0530` for India)

**Topics Format**:
- Fasting: `fasting_0800`, `fasting_-0500`, `fasting_0530`
- Daily Ayah: `daily_ayah_0800`, `daily_ayah_-0500`
- Broadcast: `broadcast_0800`, `broadcast_-0500`

### 2. Fasting Notifications Not Working from Actions ✅
**Problem**: Same as issue #1 - topic format mismatch.

**Solution**: Same fix applies to both daily notifications and fasting reminders since they use the same topic naming system.

### 3. Custom Message Notifications Disappear When Touched ✅
**Problem**: When tapping a push notification from custom broadcast messages, the notification would disappear without opening the app or showing the message content.

**Root Cause**: 
1. Missing notification press handlers in `PushNotificationService.ts`
2. Missing Notifee background event handler in `_layout.tsx`
3. Notifications displayed via Notifee in `onMessage` require Notifee event listeners, not FCM handlers

**Solution**:
Added comprehensive notification handling across both FCM and Notifee layers:

**In PushNotificationService.ts**:
```typescript
// 1. Create Android notification channel (required for Android 8.0+)
if (Platform.OS === 'android') {
    await notifee.createChannel({
        id: 'default',
        name: 'Default Notifications',
        importance: AndroidImportance.HIGH,
    });
}

// 2. Abstracted iOS registration into reusable helper
private static async ensureIosRegistered(): Promise<boolean> {
    if (Platform.OS !== 'ios') return true;
    // ... handles device registration check
}

// 3. Generic topic sync to eliminate code duplication
private static async syncTopic(baseName: string, enabled: boolean) {
    // ... handles subscribe/unsubscribe for any topic
}

// 4. Foreground handler displays notification via Notifee
messaging().onMessage(async (remoteMessage) => {
    await notifee.displayNotification({
        // ... with HIGH importance for heads-up notifications
    });
});
```

**In _layout.tsx**:
```typescript
// Notifee Foreground Event (when app is open)
notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
        handleNotificationInteraction(detail.notification?.data);
    }
});

// Notifee Background Event (when app is backgrounded) ✨ NEW
notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
        handleNotificationInteraction(detail.notification?.data);
    }
});

// Cold start handler
const initialNotification = await notifee.getInitialNotification();
if (initialNotification) {
    handleNotificationInteraction(initialNotification.notification.data);
}

// Notification routing based on type
case 'fasting_reminder':
    router.replace('/moon-phases');
    break;
case 'announcement':
case 'greeting':
case 'promotion':
case 'update':
    router.replace('/(tabs)/index');
    break;
```

### 4. Background/Quit State Notifications Not Received ✅
**Problem**: Notifications sent via GitHub Actions were not being received when app was in background or quit state on Android.

**Root Causes**:
1. **Background Message Handler**: `setBackgroundMessageHandler()` was called inside `initialize()` function, but React Native Firebase requires it to be set at the **top level** (in `index.js`)
2. **Missing Android Configuration**: Notification payloads lacked proper Android-specific configuration for background delivery
3. **Missing APNS Configuration**: iOS notifications lacked proper payload structure

**Solution**:
```javascript
// In index.js (TOP LEVEL - CRITICAL!)
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[Push:Background] Message received:', remoteMessage);
    // Handle background notifications here
});
```

```javascript
// In send-broadcast.js and send-shared.js
await messaging.send({
    topic: topic,
    notification: { title, body },
    data: { type: 'announcement' },
    android: {
        priority: 'high',
        notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
        }
    },
    apns: {
        headers: { 'apns-priority': '10' },
        payload: {
            aps: {
                sound: 'default',
                badge: 1,
            }
        }
    }
});
```

### 5. GitHub Actions Git Exit Code 128 Error ✅
**Problem**: GitHub Actions workflow fails with "The process '/usr/bin/git' failed with exit code 128" during checkout step.

**Root Cause**: 
- Using outdated `actions/checkout@v3` which has known issues with certain repository configurations
- Missing `fetch-depth` parameter can cause shallow clone issues

**Solution**:
Updated all workflows to use latest actions versions:
```yaml
- uses: actions/checkout@v4
  with:
      fetch-depth: 0

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
      node-version: "20"
```

This provides:
- Better error handling in checkout action
- Full repository history with `fetch-depth: 0`
- Latest Node.js LTS version (20)
- Improved compatibility with GitHub's infrastructure

### 6. Code Quality Improvements ✅
**Changes Made**:
- Abstracted iOS registration logic into `ensureIosRegistered()` helper
- Created generic `syncTopic()` method to eliminate duplication
- Explicit Android notification channel creation for Android 8.0+ compatibility
- Improved timezone handling with clear documentation for 30-minute offsets
- Added Notifee background event listener for proper tap handling
- **CRITICAL**: Moved `setBackgroundMessageHandler()` to top-level in `index.js`
- Added comprehensive Android and APNS configuration to all notification payloads

## Architecture Overview

### Notification Flow
1. **FCM Receives Message** → Firebase Cloud Messaging delivers to device
2. **App State Determines Handler**:
   - **Foreground**: `messaging().onMessage()` → Display via Notifee
   - **Background**: System displays natively (FCM handles)
   - **Quit**: System displays natively (FCM handles)
3. **User Taps Notification**:
   - **Notifee-displayed** → `notifee.onBackgroundEvent()` or `onForegroundEvent()`
   - **FCM-displayed** → `messaging().onNotificationOpenedApp()` or `getInitialNotification()`
   - **Cold start** → `notifee.getInitialNotification()`
4. **Deep Link** → `handleNotificationInteraction()` routes to appropriate screen

## Testing

### Quick Test (Manual Send)
```bash
# Set your Firebase credentials
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Test with your timezone topic
node scripts/notifications/debug-topics.js broadcast_0800

# Or test other topics
node scripts/notifications/debug-topics.js fasting_0800
node scripts/notifications/debug-topics.js daily_ayah_0530
```

Check your device immediately after running this command. If you don't receive it:
1. Check app logs for: `[Push] Subscribed to broadcast topic: broadcast_XXXX`
2. Verify your device timezone matches the topic you're testing
3. Ensure app has notification permissions enabled

### Test Daily/Fasting Notifications
1. Enable notifications in Settings → Notifications
2. Check device timezone offset: Look for log `[Push] Subscribed to broadcast topic: broadcast_XXXX`
3. Trigger manual GitHub Action run with `workflow_dispatch`
4. Wait for notification (scheduled for 5 AM local time)
5. **Test tap behavior**:
   - Tap notification when app is **foreground** → Should route immediately
   - Tap notification when app is **backgrounded** → Should open app and route
   - Tap notification when app is **quit** → Should launch app and route

### Test Custom Broadcast
1. Go to GitHub → Actions → "Send Custom Broadcast"
2. Click "Run workflow"
3. Fill in:
   - Title: "Test Notification"
   - Message: "Testing push notification handling"
   - Type: "announcement"
   - Timezone: "all" (or your specific timezone)
4. Run workflow
5. **Test all app states**:
   - **Foreground**: Notification appears as heads-up, tap should route
   - **Background**: Notification in tray, tap should open app and route
   - **Quit**: Notification in tray, tap should launch app and route
6. App should open to home screen for announcement type

### Verify Notification Press
Check logs for:
```
[Notifee] Foreground event: PRESS {...}
[Notifee] Background event: PRESS {...}
[NotificationInteraction] Handling: {type: 'announcement', ...}
```

### Test Timezone Edge Cases
Test with devices in timezones with 30-minute offsets:
- India: UTC+0530
- Iran: UTC+0430
- Afghanistan: UTC+0430
- Venezuela: UTC-0430

Verify topic subscriptions show correct format:
```
[Push] Subscribed to broadcast topic: broadcast_0530
[Push] Subscribed to: fasting_0530
```

## Deployment

### GitHub Actions
Workflows are already updated:
- `.github/workflows/daily-push.yml` - Hourly check for 5 AM timezone matching
- `.github/workflows/custom-broadcast.yml` - Manual broadcast sender

### App Updates
Changes are in:
- `services/PushNotificationService.ts` - Press handlers
- `app/_layout.tsx` - Notification type routing
- `scripts/notifications/send-shared.js` - Topic format clarification

## Debugging

### Check Topic Subscriptions
Look for logs like:
```
[Push] Subscribed to broadcast topic: broadcast_0800
[Push] Subscribing to: fasting_0800
[Push] Subscribing to: daily_ayah_0800
```

### Check Notification Delivery
GitHub Actions logs should show:
```
✅ fasting_0800
✅ daily_ayah_0800
```

### Verify Event Handlers
Check which handler is being triggered:
```
[Push] Foreground message: {...}           # FCM foreground
[Notifee] Foreground event: PRESS {...}    # Notifee tap (app open)
[Notifee] Background event: PRESS {...}    # Notifee tap (app backgrounded)
[NotificationColdStart] App opened from notification: {...}  # Cold start
```

### Common Issues
1. **Simulator**: Push notifications don't work on iOS Simulator without special setup
2. **APNS Token**: Device needs valid APNS token for iOS (check for errors in logs)
3. **FCM Token**: Android needs FCM token (check for `[Push] Token: ...` log)
4. **Topic Format**: Topics must not contain `+` symbol (use `0800` not `+0800`)
5. **Android Channel**: Notifications won't show on Android 8.0+ without channel creation
6. **Notifee Events**: Taps on Notifee-displayed notifications require Notifee listeners, not FCM listeners
7. **30-min Offsets**: Ensure server-side scripts handle formats like `0530` for India
8. **Background Handler Location**: `setBackgroundMessageHandler()` MUST be at top level in `index.js`, not in a function
9. **No Devices Subscribed**: If you just installed the app, wait a few seconds for subscription to propagate (FCM can take 10-30 seconds)
10. **Permissions**: Ensure notification permissions are granted in device settings

### Troubleshooting Tap Issues
If notifications don't open the app when tapped:
1. Check if notification was displayed via Notifee (foreground) or FCM (background/quit)
2. Verify `notifee.onBackgroundEvent()` is registered in `_layout.tsx`
3. Check Android notification channel has `importance: HIGH` for proper tap handling
4. Ensure `pressAction: { id: 'default' }` is set in Android notification config
5. Look for `[NotificationInteraction] Handling:` logs to confirm routing logic

### Troubleshooting No Notifications Received

**Step 1: Check Device Logs**
```bash
# Android
adb logcat | grep -i "Push"

# iOS (Xcode)
# Open Console.app and filter for "Push"
```

Look for:
- `[Push] Token: ...` (FCM token received)
- `[Push] Subscribed to broadcast topic: broadcast_XXXX` (topic subscription)
- `[Push] Permission granted` (permissions OK)

**Step 2: Verify Topic Subscription**
1. Open app and check logs for timezone: `broadcast_0800`, `fasting_0530`, etc.
2. Wait 30 seconds (FCM topic subscription propagation time)
3. Send test notification to that specific topic

**Step 3: Test with Debug Script**
```bash
export FIREBASE_SERVICE_ACCOUNT='...'
node scripts/notifications/debug-topics.js broadcast_0800
```

If this works, the issue is with your GitHub Action timing/timezone logic.
If this doesn't work, check:
- Device has internet connection
- App has notification permissions
- FCM token was generated (check logs)

**Step 4: Verify GitHub Action Ran**
1. Go to GitHub → Actions
2. Click on the workflow run
3. Check logs show: `✅ broadcast_XXXX` or `✅ fasting_XXXX`
4. If you see errors, check Firebase credentials secret

**Step 5: Check Firebase Console**
1. Go to Firebase Console → Cloud Messaging
2. Try sending a test message directly from console
3. If this works but scripts don't, issue is with the script configuration

## Notes
- Topics use timezone offsets (-11 to +14), with 30-minute precision (e.g., `0530` for India)
- Script runs hourly to check which timezones are at 5 AM
- Broadcast messages can target "all" or specific timezone
- **Notification Display Layers**:
  - **Foreground**: FCM → Notifee → User sees heads-up notification
  - **Background/Quit**: FCM → System UI → User sees in notification tray
- **Tap Handling Layers**:
  - **Notifee-displayed** (foreground notifications): Use `notifee.onBackgroundEvent()` / `onForegroundEvent()`
  - **FCM-displayed** (background/quit notifications): Use `messaging().onNotificationOpenedApp()` / `getInitialNotification()`
  - Both layers route through `handleNotificationInteraction()` for consistent deep linking
- **iOS Registration**: Abstracted into `ensureIosRegistered()` helper to avoid code duplication
- **Android Channels**: Must be created before displaying notifications on Android 8.0+
- **Topic Sync**: Generic `syncTopic()` method handles subscribe/unsubscribe for all topics
