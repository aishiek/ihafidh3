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
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.error('❌ ERROR: Could not parse FIREBASE_SERVICE_ACCOUNT as JSON.');
    console.error('It looks like the secret you pasted is not valid JSON.');
    console.error(`String starts with: "${rawSA.trim().substring(0, 15)}..."`);
    console.error('Detailed Error:', e.message);
    process.exit(1);
}

const messaging = admin.messaging();

async function main() {
    try {
        console.log('--- Sending Immediate Test Broadcast to +0800 (Your Timezone) ---');

        const topicFasting = 'fasting_0800';
        const topicAyah = 'daily_ayah_0800';

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
