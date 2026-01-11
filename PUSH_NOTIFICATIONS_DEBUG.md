# Push Notification Debugging Guide

## Critical Fix Applied ✅

**The main issue**: `setBackgroundMessageHandler()` was called inside `initialize()`, but React Native Firebase requires it at the **top level** in `index.js`.

This has been fixed. You MUST rebuild your app for this change to take effect.

## Rebuild Steps

### Android
```bash
cd android
./gradlew clean
./gradlew assembleRelease
# Or if using Debug:
./gradlew assembleDebug
```

### iOS
```bash
cd ios
pod install
# Then rebuild in Xcode
```

## Quick Test After Rebuild

1. **Launch App & Check Logs**
   ```
   [Push] Permission granted
   [Push] Token: fXXXXXXXXXXXXXXXXXXXX
   [Push] Subscribed to broadcast topic: broadcast_0800
   ```

2. **Send Test Notification**
   ```bash
   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   node scripts/notifications/debug-topics.js broadcast_0800
   ```

3. **Check All App States**
   - ✅ **Foreground**: Should show heads-up notification
   - ✅ **Background**: Should show in notification tray
   - ✅ **Quit**: Should show in notification tray
   - ✅ **Tap notification**: Should open app and route

## What Was Fixed

### 1. Background Handler Location ⚠️ CRITICAL
**Before** (BROKEN):
```typescript
// In PushNotificationService.ts initialize()
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[Push] Background message:', remoteMessage);
});
```

**After** (WORKING):
```javascript
// In index.js (TOP LEVEL!)
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[Push:Background] Message received:', remoteMessage);
});
```

### 2. Android Configuration
Added proper Android notification config to all send scripts:
```javascript
android: {
    priority: 'high',
    notification: {
        channelId: 'default',
        sound: 'default',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
    }
}
```

### 3. APNS Configuration
Added proper iOS payload structure:
```javascript
apns: {
    headers: { 'apns-priority': '10' },
    payload: {
        aps: {
            sound: 'default',
            badge: 1,
        }
    }
}
```

## Testing Checklist

- [ ] Rebuild app completely (clean build)
- [ ] Install on physical device (not simulator)
- [ ] Launch app and verify logs show:
  - `[Push] Token: ...`
  - `[Push] Subscribed to broadcast topic: broadcast_XXXX`
- [ ] Wait 30 seconds (topic subscription propagation)
- [ ] Run debug script: `node scripts/notifications/debug-topics.js broadcast_0800`
- [ ] Test in all states:
  - [ ] Foreground (app open)
  - [ ] Background (app minimized)
  - [ ] Quit (app force-closed)
- [ ] Test tap behavior in all states
- [ ] Run GitHub Action manually and verify logs show `✅ broadcast_XXXX`

## Common Mistakes

1. **Not rebuilding after changes** → Old code still running
2. **Testing on simulator** → Push notifications don't work on iOS Simulator
3. **Wrong timezone topic** → App subscribes to `broadcast_0800` but you're sending to `broadcast_0000`
4. **Not waiting for propagation** → Topic subscriptions take 10-30 seconds to propagate
5. **Permissions denied** → Check device settings
6. **Firebase credentials expired** → Check GitHub secrets
7. **Git exit code 128 in Actions** → Workflows updated to use `actions/checkout@v4` and `actions/setup-node@v4`

## Expected Logs

### Successful Initialization
```
[Push] Permission granted
[Push] Token: fA1B2C3D4E5F6G7H8I9J0...
[Push] Subscribed to broadcast topic: broadcast_0800
[Push] Initialization complete
```

### Receiving Notification (Foreground)
```
[Push] Foreground message: {notification: {...}, data: {...}}
```

### Receiving Notification (Background)
```
[Push:Background] Message received: {notification: {...}, data: {...}}
```

### Tapping Notification
```
[Notifee] Background event: PRESS {...}
[NotificationInteraction] Handling: {type: 'announcement', ...}
```

## Still Not Working?

### Check GitHub Action Logs
1. Go to GitHub → Actions
2. Click latest workflow run
3. Look for:
   ```
   Found timezones hitting 5 AM: [ '0800' ]
   Processing Zone: 0800 (UTC8)
   ✅ broadcast_0800
   ```

### Check Firebase Console
1. Go to Firebase Console → Cloud Messaging
2. Send test message directly from console
3. If this works, the problem is with your scripts/actions
4. If this doesn't work, check device setup

### Enable Verbose Logging
```typescript
// In PushNotificationService.ts, add more logs:
const token = await messaging().getToken();
console.log('[Push] Full Token:', token);
console.log('[Push] Token length:', token.length);

const offset = this.getTimezoneOffset();
console.log('[Push] Calculated offset:', offset);
console.log('[Push] Current timezone minutes:', new Date().getTimezoneOffset());
```

### Verify Topic Name Matches
```bash
# In app logs:
[Push] Subscribed to broadcast topic: broadcast_0800

# In GitHub Action:
✅ broadcast_0800

# These MUST match exactly!
```

## Contact Points

If still broken, check:
1. ✅ Rebuilt app after code changes?
2. ✅ Testing on physical device?
3. ✅ Notification permissions granted?
4. ✅ FCM token logged successfully?
5. ✅ Topic subscription logged?
6. ✅ Waited 30 seconds after subscription?
7. ✅ GitHub Action shows success?
8. ✅ Firebase credentials valid?

If all checked and still not working, the issue may be with:
- Firebase project configuration
- Google Services JSON/plist files
- Network/firewall blocking FCM
- Device-specific FCM issues
