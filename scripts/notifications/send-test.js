const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to load service account from env var OR local file
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        const localPath = path.resolve(__dirname, '../../firebaseTypeServiceAccount.json'); // Adjust if named differently
        // Common name might be firebase-service-account.json or similar
        // Let's try to find it in root
        const rootPath = path.resolve(__dirname, '../../firebase-service-account.json');

        if (fs.existsSync(rootPath)) {
            serviceAccount = require(rootPath);
        } else {
            // Fallback to checking the exact file user might have just downloaded
            // The user said they have the file, usually named something like 'ihafidh-firebase-adminsdk-...'
            // For now we ask them to set the ENV or rename it.
            throw new Error("Could not find firebase-service-account.json in root. Please set FIREBASE_SERVICE_ACCOUNT env var or place the JSON file in project root named 'firebase-service-account.json'.");
        }
    }
} catch (e) {
    console.error("Error loading credentials:", e.message);
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const messaging = admin.messaging();

const token = process.argv[2];

if (!token) {
    console.error('Usage: node scripts/notifications/send-test.js <DEVICE_FCM_TOKEN>');
    console.error('You can find your FCM Token in the Metro logs when the app starts: "[Push] FCM Token: ..."');
    process.exit(1);
}

async function sendTest() {
    try {
        console.log(`Sending test message to: ${token.slice(0, 10)}...`);

        const response = await messaging.send({
            token: token,
            notification: {
                title: '🧪 Test Notification',
                body: 'This is a test message sent exclusively to your device.',
            },
            data: {
                type: 'test_message',
                timestamp: Date.now().toString(),
            },
        });

        console.log('Successfully sent message:', response);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

sendTest();
