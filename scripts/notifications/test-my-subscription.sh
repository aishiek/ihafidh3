#!/bin/bash
# Quick test to send notification to broadcast_0800 only

if [ -z "$FIREBASE_SERVICE_ACCOUNT" ]; then
    echo "❌ FIREBASE_SERVICE_ACCOUNT not set"
    echo "Get it from: https://github.com/aishiek/ihafidh3/settings/secrets/actions"
    exit 1
fi

echo "🧪 Sending test to broadcast_0800..."
echo ""

node -e "
const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });

admin.messaging().send({
  topic: 'broadcast_0800',
  notification: {
    title: '🧪 Device Test',
    body: 'If you see this, your subscription works! Time: ' + new Date().toLocaleTimeString()
  },
  data: { test: 'true', timestamp: Date.now().toString() }
}).then(result => {
  console.log('✅ Sent to broadcast_0800');
  console.log('   Message ID:', result.split('/').pop());
  console.log('');
  console.log('📱 Check your device now!');
  process.exit(0);
}).catch(err => {
  console.log('❌ Failed:', err.message);
  process.exit(1);
});
"
