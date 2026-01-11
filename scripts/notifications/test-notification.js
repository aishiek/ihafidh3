const admin = require('firebase-admin');

// Service Account from Environment Variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (Object.keys(serviceAccount).length === 0) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT missing');
    console.error('Usage: FIREBASE_SERVICE_ACCOUNT=\'{"project_id":...}\' node test-notification.js <timezone_offset>');
    console.error('Example: FIREBASE_SERVICE_ACCOUNT=\'...\' node test-notification.js 0800');
    process.exit(1);
}

// Initialize Firebase
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const messaging = admin.messaging();

// Get timezone offset from command line (e.g., "0800", "-0500")
const timezoneOffset = process.argv[2] || '0800';

async function testNotifications() {
    console.log('═'.repeat(70));
    console.log('🧪 PUSH NOTIFICATION TEST');
    console.log('═'.repeat(70));
    console.log('');
    
    console.log('📋 Configuration:');
    console.log(`   Project ID: ${serviceAccount.project_id}`);
    console.log(`   Timezone Offset: ${timezoneOffset}`);
    console.log('');

    // Test topics
    const testTopics = [
        { name: `fasting_${timezoneOffset}`, title: '🧪 Test Fasting', body: 'This is a test fasting notification' },
        { name: `daily_ayah_${timezoneOffset}`, title: '🧪 Test Daily Ayah', body: 'This is a test daily ayah notification' },
        { name: `broadcast_${timezoneOffset}`, title: '🧪 Test Broadcast', body: 'This is a test broadcast notification' }
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const test of testTopics) {
        console.log('─'.repeat(70));
        console.log(`📤 Testing Topic: ${test.name}`);
        console.log(`   Title: "${test.title}"`);
        console.log(`   Body: "${test.body}"`);
        
        try {
            const result = await messaging.send({
                topic: test.name,
                notification: {
                    title: test.title,
                    body: test.body
                },
                data: {
                    type: 'test',
                    timestamp: Date.now().toString(),
                    topic: test.name
                },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'default',
                        sound: 'default',
                        priority: 'high',
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

            console.log(`✅ SUCCESS - Message ID: ${result}`);
            successCount++;
        } catch (error) {
            console.error(`❌ FAILED - ${error.message}`);
            if (error.code) {
                console.error(`   Error Code: ${error.code}`);
            }
            errorCount++;
        }
        
        // Wait 500ms between sends to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('');
    console.log('═'.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(70));
    console.log(`✅ Successful: ${successCount}/${testTopics.length}`);
    console.log(`❌ Failed: ${errorCount}/${testTopics.length}`);
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Check your device notifications (should arrive in ~10 seconds)');
    console.log('   2. If no notifications received:');
    console.log('      - Verify app is installed and permissions granted');
    console.log(`      - Confirm device is subscribed to topics with offset: ${timezoneOffset}`);
    console.log('      - Check device notification settings (Do Not Disturb, etc.)');
    console.log('      - Try uninstalling and reinstalling the app');
    console.log('═'.repeat(70));

    process.exit(errorCount > 0 ? 1 : 0);
}

testNotifications().catch(error => {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
});
