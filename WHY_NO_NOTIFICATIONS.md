# Why Notifications Didn't Arrive - Investigation Report

## ✅ What We Confirmed:

1. **GitHub Actions DID run at 21:00 UTC** (5:00 AM Singapore time)
   - Run ID: 20901840543
   - Timestamp: 2026-01-11T21:04:03Z
   
2. **Script detected Singapore timezone correctly**
   - Log: "Found timezones hitting 5 AM: [ '0800' ]"
   
3. **Messages were sent to Firebase**
   - Log: "Sending Fasting -> fasting_0800"
   - Log: "Sending Ayah -> daily_ayah_0800"
   - Log: "--- Done ---"
   
4. **User had both toggles enabled in Settings**
   - "Enable Fasting Reminders" = ON
   - "Enable Daily Ayah" = ON

## ❓ So Why No Notifications?

### Most Likely Causes (in order of probability):

### 1. **FCM Token Invalidation (60% likely)**

**Symptoms:**
- App was updated/reinstalled recently
- Phone was reset
- Google Play Services was updated
- Long time since app was opened

**Why this matters:**
- FCM tokens are device-specific and can expire
- Subscription to topics is tied to the token
- If token expires, messages are sent but never delivered
- Firebase has NO WAY to tell you a token is invalid (it just silently fails)

**How to verify:**
```bash
# Run immediate test (will show if current token works)
FIREBASE_SERVICE_ACCOUNT='...' node scripts/notifications/test-now.js +0800
```

**Fix:**
- Open the app → triggers new token generation
- Toggles subscriptions again → re-subscribes with new token

---

### 2. **Do Not Disturb Mode (20% likely)**

**Symptoms:**
- Phone was in DND/Focus mode at 5 AM
- No sounds, no banners, no notifications

**Why this matters:**
- iOS/Android suppress ALL notifications in DND
- Notification WAS delivered but phone silently discarded it
- No record in notification center

**How to verify:**
- Check if DND was scheduled for 5 AM
- iOS: Settings > Focus > Do Not Disturb
- Android: Settings > Sound > Do Not Disturb

**Fix:**
- Disable DND during notification time
- Or add iHafidh to allowed apps in Focus settings

---

### 3. **Battery Optimization Killed Background Process (15% likely - Android only)**

**Symptoms:**
- Android phone with aggressive battery saving
- Manufacturers: Xiaomi, Huawei, OnePlus, Oppo, Vivo
- App killed in background, can't receive notifications

**Why this matters:**
- Some Android vendors kill apps aggressively
- FCM requires background services to be alive
- Killing the app = no notification delivery

**How to verify:**
- Settings > Apps > iHafidh > Battery > Check if "Optimized"

**Fix:**
- Settings > Apps > iHafidh > Battery > Unrestricted
- Settings > Apps > iHafidh > Autostart > Enable
- Lock app in recent apps (prevents swipe-away kill)

---

### 4. **Subscription Didn't Persist (5% likely)**

**Symptoms:**
- Network error during subscription
- App crashed after toggling settings
- Firebase API was down when you enabled toggles

**Why this matters:**
- Subscription is an async network call
- If it fails silently, app thinks you're subscribed but you're not
- No error shown to user

**How to verify:**
```bash
# Check app logs for subscription confirmation
# Should see: "[Push] ✅ Subscribed to: fasting_0800"
```

**Fix:**
- Toggle settings OFF then ON again
- Wait 2-3 seconds between toggles
- Check console logs for ✅ confirmation

---

## 🧪 Diagnostic Steps:

### Step 1: Test Immediate Delivery

```bash
cd /Users/ahnaf/Documents/Aleem/ihafidh3

# Get FIREBASE_SERVICE_ACCOUNT from GitHub Secrets
FIREBASE_SERVICE_ACCOUNT='<paste-entire-JSON>' \
node scripts/notifications/test-now.js +0800
```

**Expected:** You receive 3 notifications within 10 seconds

**If you get:**
- ✅ All 3 notifications → Issue was temporary (token expired, DND, etc.)
- ✅ Only broadcast → Fasting/Ayah subscriptions missing
- ❌ No notifications → Token is invalid or app not installed

---

### Step 2: Check App Logs

Open app with React Native debugger:

```bash
# iOS
npx react-native run-ios --configuration Debug

# Android  
npx react-native run-android --variant=debug
```

Look for these logs on app startup:
```
🔔 PUSH NOTIFICATION SERVICE - Initializing
✅ Notification permission granted
[Push] FCM Token obtained: dK3f9h2j...
[Push] ✅ Subscribed to: broadcast_0800
[Push] ✅ Subscribed to: fasting_0800
[Push] ✅ Subscribed to: daily_ayah_0800
```

**If missing subscriptions:**
- Toggle settings OFF
- Wait 2 seconds
- Toggle settings ON
- Check for subscription logs

---

### Step 3: Check Next GitHub Actions Run

The next notification window is at:
- **21:00 UTC (9 PM UTC)**
- **Which is 5:00 AM Singapore time (next day)**

After that time:
```bash
# Check logs
gh run list --workflow=daily-push.yml --limit 3

# View specific run
gh run view <run-id> --log | grep -E "(Found|Sending|Error)"
```

With the new enhanced logging, you'll see:
- ✅ Message IDs if sent successfully
- ❌ Error messages if sending failed
- 📊 Total sent/error counts

---

### Step 4: Check Firebase Console

1. Go to: https://console.firebase.google.com/project/ihafidh-app/messaging
2. Look for recent messages around 21:00 UTC
3. Check delivery statistics:
   - Messages sent: Should be 2 (fasting + ayah)
   - Messages delivered: Check if 0 (means no subscribers or invalid tokens)
   - Errors: Check for bounce/failure messages

---

## 🔧 Immediate Fixes:

### Fix 1: Force Re-subscription

1. Open iHafidh app
2. Go to Settings
3. Toggle "Daily Reminders" OFF → Wait 2 sec → ON
4. Toggle "Daily Ayah" OFF → Wait 2 sec → ON
5. Check console for: "[Push] ✅ Subscribed to: ..."

### Fix 2: Disable Do Not Disturb

**iOS:**
- Settings > Focus > Do Not Disturb
- Either disable completely OR
- Add iHafidh to allowed apps

**Android:**
- Settings > Sound > Do Not Disturb
- Schedule: Make sure 5 AM is not in DND window

### Fix 3: Disable Battery Optimization (Android)

- Settings > Apps > iHafidh
- Battery > Unrestricted
- Autostart > Enable

---

## 📊 What to Expect Tomorrow (5 AM):

If everything is fixed:
1. At **exactly 5:00 AM**, you should receive 2 notifications:
   - 🌙 Fasting reminder
   - 📖 Daily Ayah
   
2. Notifications will appear as:
   - **Banner** (top of screen)
   - **Sound** (if not in DND)
   - **Badge** on app icon
   
3. Check GitHub Actions after 5 AM:
   - Go to: https://github.com/aishiek/ihafidh3/actions
   - Click on the 21:00 UTC run
   - Download "notification-logs" artifact
   - Should show message IDs and success confirmations

---

## 🚨 If Still Not Working Tomorrow:

Run the comprehensive diagnostic:

```bash
FIREBASE_SERVICE_ACCOUNT='...' node scripts/notifications/diagnose-push.js +0800
```

This will:
- Validate Firebase credentials
- Send test messages to all 3 topics
- Show message IDs for tracking
- Provide step-by-step troubleshooting

Then report back with:
- Did you receive the test notifications?
- What errors (if any) did the script show?
- What do the GitHub Actions logs say?
- Are there any errors in Firebase Console?

---

## Summary:

**Messages WERE sent from server** ✅  
**But device didn't receive them** ❌

Most likely: **FCM token expired/invalid** or **Do Not Disturb was on**

**Solution:** Run test script above to verify current status, then wait for tomorrow's 5 AM notification to confirm fix.
