const admin = require('firebase-admin');

// Get FCM token from command line
const token = process.argv[2];

if (!token) {
    console.error('❌ Usage: node test-direct-token.js <FCM_TOKEN>');
    console.error('Example: node test-direct-token.js "dKJH...xyz"');
    process.exit(1);
}

const rawSA = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawSA) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT not set');
    process.exit(1);
}

try {
    const serviceAccount = JSON.parse(rawSA);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.error('❌ Failed to initialize Firebase:', e.message);
    process.exit(1);
}

const messaging = admin.messaging();

async function sendDirectNotification() {
    try {
        console.log(`\n📱 Sending test notification to device...`);
        console.log(`Token: ${token.substring(0, 20)}...`);
        
        const message = {
            token: token,
            notification: {
                title: '🔔 Direct Test Notification',
                body: 'If you see this, FCM is working! 🎉'
            },
            data: {
                type: 'test',
                timestamp: new Date().toISOString()
            },
            // High priority for immediate delivery
            android: {
                priority: 'high'
            },
            apns: {
                headers: {
                    'apns-priority': '10'
                },
                payload: {
                    aps: {
                        alert: {
                            title: '🔔 Direct Test Notification',
                            body: 'If you see this, FCM is working! 🎉'
                        },
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };

        const response = await messaging.send(message);
        console.log('✅ Notification sent successfully!');
        console.log(`Message ID: ${response}`);
        console.log('\n📲 Check your device now - notification should appear within seconds!');
        
    } catch (error) {
        console.error('❌ Failed to send notification:');
        console.error(error.message);
        if (error.code) {
            console.error(`Error code: ${error.code}`);
        }
        process.exit(1);
    }
}

sendDirectNotification();
