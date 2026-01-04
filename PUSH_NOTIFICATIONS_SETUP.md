# Firebase Cloud Messaging Setup Complete ✅

## What Was Done

### 1. ✅ Moved google-services.json to Correct Location
- **From**: `app/google-services.json`
- **To**: `android/app/google-services.json`

### 2. ✅ Updated Gradle Files

**android/build.gradle** (Root-level):
- Added Google services Gradle plugin: `com.google.gms:google-services:4.4.4`

**android/app/build.gradle** (App-level):
- Added plugin: `apply plugin: "com.google.gms.google-services"`
- Added Firebase BoM: `com.google.firebase:firebase-bom:34.6.0`
- Added Firebase Messaging: `com.google.firebase:firebase-messaging`
- Added Firebase Analytics: `com.google.firebase:firebase-analytics`

### 3. ✅ Installed React Native Firebase Packages
```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

### 4. ✅ Created PushNotificationService
- **File**: `services/PushNotificationService.ts`
- Handles FCM token registration
- Manages foreground/background notifications
- Integrates with Cloudflare Worker backend

### 5. ✅ Integrated into App
- **File**: `app/_layout.tsx`
- Added initialization on app startup
- Runs after 1 second delay to avoid blocking

---

## Next Steps

### Step 1: Set Up Cloudflare Worker

1. **Install Wrangler CLI**:
```bash
npm install -g wrangler
```

2. **Login to Cloudflare**:
```bash
wrangler login
```

3. **Create Worker File** (`worker.js`):
```javascript
// Cloudflare Worker for Push Notifications

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: Register FCM token
    if (url.pathname === '/register' && request.method === 'POST') {
      const { userId, token } = await request.json();
      await env.FCM_TOKENS.put(userId, token);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Route: Send broadcast notification
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const { title, body, data, secret } = await request.json();
      
      if (secret !== env.BROADCAST_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }

      const list = await env.FCM_TOKENS.list();
      const tokens = await Promise.all(
        list.keys.map(key => env.FCM_TOKENS.get(key.name))
      );

      const results = await sendToFCM(tokens, title, body, data, env.FCM_SERVER_KEY);

      return new Response(JSON.stringify({
        success: true,
        sent: results.success,
        failed: results.failure
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function sendToFCM(tokens, title, body, data, serverKey) {
  const validTokens = tokens.filter(t => t);
  
  if (validTokens.length === 0) {
    return { success: 0, failure: 0 };
  }

  const batches = [];
  for (let i = 0; i < validTokens.length; i += 1000) {
    batches.push(validTokens.slice(i, i + 1000));
  }

  let totalSuccess = 0;
  let totalFailure = 0;

  for (const batch of batches) {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registration_ids: batch,
        notification: { title, body, sound: 'default' },
        data: data || {},
        priority: 'high',
      }),
    });

    const result = await response.json();
    totalSuccess += result.success || 0;
    totalFailure += result.failure || 0;
  }

  return { success: totalSuccess, failure: totalFailure };
}
```

4. **Create wrangler.toml**:
```toml
name = "ihafidh-push"
main = "worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "FCM_TOKENS"
id = "YOUR_KV_NAMESPACE_ID"  # Will be filled after creating KV

[vars]
FCM_SERVER_KEY = "YOUR_FIREBASE_SERVER_KEY"
BROADCAST_SECRET = "YOUR_SECRET_KEY_HERE"
```

5. **Get Firebase Server Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `ihafidh-c0b1a`
   - Go to Project Settings → Cloud Messaging
   - Copy the **Server key** (under Cloud Messaging API - Legacy)

6. **Create KV Namespace**:
```bash
wrangler kv:namespace create "FCM_TOKENS"
# Copy the ID from output and paste into wrangler.toml
```

7. **Deploy Worker**:
```bash
wrangler deploy
# Note the URL (e.g., https://ihafidh-push.YOUR_SUBDOMAIN.workers.dev)
```

8. **Update PushNotificationService.ts**:
   - Replace `WORKER_URL` with your actual Cloudflare Worker URL

---

### Step 2: Build and Test

1. **Rebuild Android App** (required for native changes):
```bash
npx expo run:android
```

2. **Check Logs** for FCM token:
```bash
# You should see:
[Push] Initializing Firebase Cloud Messaging...
[Push] Permission granted
[Push] FCM Token: <long-token-string>
[Push] Token registered successfully
```

3. **Test Broadcast Notification**:
```bash
curl -X POST https://ihafidh-push.YOUR_SUBDOMAIN.workers.dev/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_SECRET_KEY_HERE",
    "title": "📖 Test Notification",
    "body": "This is a test push notification!",
    "data": {
      "type": "test"
    }
  }'
```

---

### Step 3: iOS Setup (Optional)

For iOS, you'll also need:

1. **APNs Certificate**:
   - Go to Apple Developer Portal
   - Create APNs certificate
   - Upload to Firebase Console

2. **GoogleService-Info.plist**:
   - Download from Firebase Console
   - Place in `ios/` directory

3. **Update ios/Podfile**:
```ruby
pod 'Firebase/Messaging'
```

4. **Rebuild iOS**:
```bash
npx expo run:ios
```

---

## Cost Breakdown

- **Cloudflare Workers**: FREE (100,000 requests/day)
- **Cloudflare KV**: FREE (1 GB storage)
- **Firebase Cloud Messaging**: FREE (unlimited notifications)
- **Total**: $0/month 🎉

---

## Troubleshooting

### Token Not Registering
- Check that `WORKER_URL` is correct in `PushNotificationService.ts`
- Verify Cloudflare Worker is deployed and accessible
- Check app logs for errors

### Notifications Not Appearing
- Ensure app has notification permission
- Check Firebase Server Key is correct in `wrangler.toml`
- Verify FCM token is valid (check Firebase Console)

### Build Errors
- Clean build: `cd android && ./gradlew clean && cd ..`
- Rebuild: `npx expo run:android`
- Check that `google-services.json` is in `android/app/`

---

## Files Modified

1. ✅ `android/build.gradle` - Added Google services plugin
2. ✅ `android/app/build.gradle` - Added Firebase dependencies
3. ✅ `android/app/google-services.json` - Moved from `app/`
4. ✅ `services/PushNotificationService.ts` - Created
5. ✅ `app/_layout.tsx` - Added initialization
6. ✅ `package.json` - Added Firebase packages

---

## Ready to Deploy! 🚀

Your app is now configured for push notifications. Complete the Cloudflare Worker setup and you'll be able to broadcast messages to all users!
