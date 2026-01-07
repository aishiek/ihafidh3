const admin = require('firebase-admin');

// Service Account from Environment Variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (Object.keys(serviceAccount).length > 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    console.error('FIREBASE_SERVICE_ACCOUNT missing');
    process.exit(1);
}

const messaging = admin.messaging();

async function main() {
    try {
        console.log('--- Sending Immediate Test Broadcast to +0800 (Your Timezone) ---');

        const topicFasting = 'fasting_+0800';
        const topicAyah = 'daily_ayah_+0800';

        // 1. Send Fasting Test
        console.log(`Sending to: ${topicFasting}`);
        await messaging.send({
            topic: topicFasting,
            notification: {
                title: '🌙 Fasting Reminder (Test)',
                body: 'This is a test notification to verify your connection! It works!'
            },
            data: { type: 'fasting_reminder', test: 'true' }
        });

        // 2. Send Ayah Test
        console.log(`Sending to: ${topicAyah}`);
        await messaging.send({
            topic: topicAyah,
            notification: {
                title: "Daily Ayah (Test)",
                body: "Connection verified! You will now receive daily Ayahs at 5 AM."
            },
            data: { type: 'daily_ayah', test: 'true' }
        });

        console.log('--- Done! Check your phone ---');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
