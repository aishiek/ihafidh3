const admin = require('firebase-admin');

const rawSA = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!rawSA || rawSA.trim() === "") {
  console.error('FIREBASE_SERVICE_ACCOUNT is empty or missing in environment variables.');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(rawSA);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (e) {
  console.error('❌ ERROR: Could not parse FIREBASE_SERVICE_ACCOUNT as JSON.');
  console.error('Detailed Error:', e.message);
  process.exit(1);
}

const messaging = admin.messaging();

async function testNotification() {
  const testTopic = process.argv[2] || 'broadcast_0800';

  console.log('Test Testing Push Notification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(\`Topic: \${testTopic}\`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const result = await messaging.send({
      topic: testTopic,
      notification: {
        title: 'Test Notification',
        body: \`This is a test message to \${testTopic}. If you receive this, push notifications are working!\`,
      },
      data: {
        type: 'announcement',
        timestamp: Date.now().toString(),
        test: 'true',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });

    console.log('✅ Notification sent successfully!');
    console.log('Response:', result);
    console.log('\n📱 Check your device now. If subscribed to', testTopic, 'you should receive it.');
    console.log('\nCommon timezone topics:');
    console.log('  broadcast_0800  (UTC+8: Singapore, Perth, Hong Kong, Beijing)');
    console.log('  broadcast_0530  (UTC+5:30: India)');
    console.log('  broadcast_0000  (UTC: London)');
    console.log('  broadcast_-0500 (UTC-5: New York, Toronto)');
    console.log('  fasting_0800    (Fasting reminders for UTC+8)');
    console.log('  daily_ayah_0800 (Daily Ayah for UTC+8)');
  } catch (error) {
    console.error('❌ Failed to send notification:', error.message);
    console.error('\nPossible issues:');
    console.error('  1. No devices subscribed to topic:', testTopic);
    console.error('  2. Invalid topic name (must be alphanumeric with - and _)');
    console.error('  3. Firebase credentials issue');
    process.exit(1);
  }
}

testNotification();
