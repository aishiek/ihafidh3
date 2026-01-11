#!/usr/bin/env node

/**
 * Test push notification delivery RIGHT NOW
 * Sends to all three topics to verify which ones are subscribed
 */

const admin = require('firebase-admin');

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
// Remove '+' from timezone for FCM topic compatibility (e.g., '+0800' → '0800')
const timezone = (process.argv[2] || '+0800').replace(/^\+/, '');

if (!serviceAccountJson) {
    console.error('❌ ERROR: FIREBASE_SERVICE_ACCOUNT environment variable not set');
    console.log('');
    console.log('Get the value from GitHub Secrets:');
    console.log('1. Go to: https://github.com/aishiek/ihafidh3/settings/secrets/actions');
    console.log('2. Copy FIREBASE_SERVICE_ACCOUNT value');
    console.log('3. Run: FIREBASE_SERVICE_ACCOUNT=\'...\' node test-now.js +0800');
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(serviceAccountJson);
} catch (e) {
    console.error('❌ Failed to parse service account JSON');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const messaging = admin.messaging();

async function sendTestNotification(topic, title, body) {
    try {
        const result = await messaging.send({
            topic: topic,
            notification: { title, body },
            data: {
                type: 'test',
                timestamp: Date.now().toString()
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'default',
                    priority: 'high',
                    sound: 'default'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        });
        
        const shortId = result.split('/').pop();
        console.log(`✅ ${topic}: SUCCESS`);
        console.log(`   Message ID: ${shortId}`);
        return true;
    } catch (error) {
        console.log(`❌ ${topic}: FAILED`);
        console.log(`   Error: ${error.message}`);
        if (error.code === 'messaging/invalid-recipient') {
            console.log(`   💡 No devices subscribed to this topic`);
        }
        return false;
    }
}

async function main() {
    console.log('═'.repeat(70));
    console.log('🧪 IMMEDIATE NOTIFICATION TEST');
    console.log('═'.repeat(70));
    console.log();
    console.log(`🌍 Timezone: ${timezone}`);
    console.log(`📱 Check your device in the next 10 seconds...`);
    console.log();
    console.log('Testing 3 topics:');
    console.log('─'.repeat(70));
    
    const results = [];
    
    // Test broadcast (should always work - auto-subscribed)
    results.push(await sendTestNotification(
        `broadcast_${timezone}`,
        '🧪 Test Broadcast',
        'Testing broadcast notifications - you should receive this!'
    ));
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Test fasting (only works if "Daily Reminders" enabled)
    results.push(await sendTestNotification(
        `fasting_${timezone}`,
        '🌙 Test Fasting',
        'Testing fasting reminders - requires "Daily Reminders" ON in settings'
    ));
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Test daily ayah (only works if "Daily Ayah" enabled)
    results.push(await sendTestNotification(
        `daily_ayah_${timezone}`,
        '📖 Test Daily Ayah',
        'Testing daily ayah - requires "Daily Ayah" ON in settings'
    ));
    
    console.log();
    console.log('═'.repeat(70));
    console.log('📊 RESULTS');
    console.log('═'.repeat(70));
    
    const successful = results.filter(r => r).length;
    const failed = results.filter(r => !r).length;
    
    console.log(`✅ Successful: ${successful}/3`);
    console.log(`❌ Failed: ${failed}/3`);
    console.log();
    
    if (successful === 3) {
        console.log('🎉 All topics working! Check your device now.');
    } else if (successful === 1) {
        console.log('⚠️  Only broadcast working (auto-subscribed on app install)');
        console.log('');
        console.log('To fix:');
        console.log('1. Open iHafidh app');
        console.log('2. Go to Settings');
        console.log('3. Enable "Daily Reminders" toggle → subscribes to fasting_' + timezone);
        console.log('4. Enable "Daily Ayah" toggle → subscribes to daily_ayah_' + timezone);
        console.log('5. Run this test again');
    } else {
        console.log('❌ No topics working - app may not be installed or notifications disabled');
        console.log('');
        console.log('Check:');
        console.log('1. App installed on device?');
        console.log('2. Device notification permissions granted?');
        console.log('3. App opened at least once (initializes FCM)?');
    }
    
    console.log();
    console.log('═'.repeat(70));
    
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error('❌ FATAL ERROR:', error);
    process.exit(1);
});
