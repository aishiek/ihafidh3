const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../../firebaseServiceAccountKey.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const messaging = admin.messaging();

/**
 * Test direct iOS notification with detailed error logging
 * 
 * Usage: node test-ios-apns.js <FCM_TOKEN>
 */

const token = process.argv[2];

if (!token) {
    console.error('❌ Error: FCM token required');
    console.log('\nUsage: node test-ios-apns.js <FCM_TOKEN>');
    console.log('\nGet your FCM token from the debug screen in the app');
    process.exit(1);
}

console.log('🧪 Testing iOS APNs Direct Send');
console.log('='.repeat(60));
console.log(`📱 Target Token: ${token.substring(0, 20)}...`);
console.log('');

async function testIOSNotification() {
    try {
        console.log('📤 Sending notification...');
        
        const message = {
            token: token,
            notification: {
                title: '🧪 iOS APNs Test',
                body: 'Direct token test - if you see this, APNs is working!'
            },
            data: {
                type: 'apns_test',
                timestamp: Date.now().toString()
            },
            apns: {
                headers: {
                    'apns-priority': '10',
                },
                payload: {
                    aps: {
                        alert: {
                            title: '🧪 iOS APNs Test',
                            body: 'Direct token test - if you see this, APNs is working!'
                        },
                        sound: 'default',
                        badge: 1,
                        'content-available': 1,
                    }
                }
            }
        };

        console.log('Message payload:', JSON.stringify(message, null, 2));
        console.log('');

        const response = await messaging.send(message);
        
        console.log('✅ Message sent successfully!');
        console.log(`📋 Message ID: ${response}`);
        console.log('');
        console.log('📱 Check your iOS device now!');
        console.log('   - If you receive notification: APNs configuration is correct');
        console.log('   - If no notification: APNs key/certificate issue in Firebase');
        
    } catch (error) {
        console.error('❌ Error sending message:', error.code);
        console.error('');
        console.error('Error details:', error);
        console.error('');
        
        if (error.code === 'messaging/invalid-registration-token') {
            console.error('🔍 Token is invalid or expired. Get a fresh token from the app.');
        } else if (error.code === 'messaging/registration-token-not-registered') {
            console.error('🔍 Token is not registered. App might need to re-register.');
        } else if (error.code === 'messaging/invalid-apns-credentials') {
            console.error('🔍 APNs credentials in Firebase are invalid!');
            console.error('   → Check Firebase Console → Project Settings → Cloud Messaging');
            console.error('   → Verify APNs Authentication Key is correct');
            console.error('   → Key ID: Should be QK3WYVDT6Q');
            console.error('   → Team ID: Should be Z68D25352K');
        } else {
            console.error('🔍 Unexpected error. Check Firebase Console logs.');
        }
        
        process.exit(1);
    }
}

testIOSNotification();
