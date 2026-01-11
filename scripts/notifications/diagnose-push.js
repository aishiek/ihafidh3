#!/usr/bin/env node

/**
 * Push Notification Diagnostic Tool
 * 
 * This script performs comprehensive checks of the push notification system:
 * - Validates Firebase credentials
 * - Tests topic subscription and message delivery
 * - Checks message receipts and delivery status
 * - Provides actionable troubleshooting steps
 * 
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{"project_id":...}' node diagnose-push.js [timezone]
 * 
 * Example:
 *   FIREBASE_SERVICE_ACCOUNT='{"project_id":"ihafidh-app"}' node diagnose-push.js 0800
 */

const admin = require('firebase-admin');

// Parse command-line arguments
const timezone = process.argv[2] || '0800';
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

console.log('═'.repeat(70));
console.log('🔍 PUSH NOTIFICATION DIAGNOSTICS');
console.log('═'.repeat(70));
console.log();

// Step 1: Validate environment
console.log('📋 Step 1: Environment Validation');
console.log('─'.repeat(70));

if (!serviceAccountJson) {
    console.error('❌ ERROR: FIREBASE_SERVICE_ACCOUNT environment variable not set');
    console.log();
    console.log('💡 To fix:');
    console.log('   export FIREBASE_SERVICE_ACCOUNT=\'{"project_id":"..."}\'');
    console.log('   Or get from: GitHub Secrets > FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(serviceAccountJson);
    console.log(`✅ Firebase credentials loaded`);
    console.log(`   Project ID: ${serviceAccount.project_id}`);
    console.log(`   Client Email: ${serviceAccount.client_email}`);
} catch (e) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
    process.exit(1);
}

console.log(`✅ Target timezone: ${timezone}`);
console.log();

// Step 2: Initialize Firebase Admin
console.log('📋 Step 2: Firebase Admin SDK Initialization');
console.log('─'.repeat(70));

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
} catch (e) {
    console.error('❌ Firebase initialization failed:', e.message);
    process.exit(1);
}

const messaging = admin.messaging();
console.log('✅ Messaging service ready');
console.log();

// Step 3: Test message sending
async function testTopicMessage(topicName, title, body) {
    console.log(`\n🔔 Testing: ${topicName}`);
    console.log(`   Title: ${title}`);
    console.log(`   Body: ${body}`);
    
    const message = {
        topic: topicName,
        notification: {
            title: title,
            body: body
        },
        data: {
            type: topicName.split('_')[0],
            timestamp: new Date().toISOString()
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'daily-reminders',
                priority: 'high',
                sound: 'default'
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    'content-available': 1
                }
            }
        }
    };

    try {
        const messageId = await messaging.send(message);
        console.log(`   ✅ Message sent successfully`);
        console.log(`   📨 Message ID: ${messageId}`);
        
        // Extract just the message ID from the full path
        const shortId = messageId.split('/').pop();
        console.log(`   🔗 Short ID: ${shortId}`);
        
        return { success: true, messageId, shortId };
    } catch (error) {
        console.log(`   ❌ Failed to send message`);
        console.log(`   Error Code: ${error.code}`);
        console.log(`   Error Message: ${error.message}`);
        
        if (error.code === 'messaging/invalid-recipient') {
            console.log(`   💡 This usually means no devices are subscribed to topic: ${topicName}`);
        } else if (error.code === 'messaging/authentication-error') {
            console.log(`   💡 Check Firebase service account credentials`);
        }
        
        return { success: false, error: error.message };
    }
}

// Step 4: Run diagnostic tests
async function runDiagnostics() {
    console.log('📋 Step 3: Topic Message Testing');
    console.log('─'.repeat(70));
    
    const results = [];
    
    // Test 1: Broadcast topic (should work for all users)
    results.push(await testTopicMessage(
        `broadcast_${timezone}`,
        '🔔 Diagnostic Test - Broadcast',
        `Testing broadcast notifications for timezone ${timezone} at ${new Date().toLocaleString()}`
    ));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Fasting reminder topic
    results.push(await testTopicMessage(
        `fasting_${timezone}`,
        '🌙 Diagnostic Test - Fasting',
        `Testing fasting reminder notifications for timezone ${timezone}`
    ));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Daily ayah topic
    results.push(await testTopicMessage(
        `daily_ayah_${timezone}`,
        '📖 Diagnostic Test - Daily Ayah',
        `Testing daily ayah notifications for timezone ${timezone}`
    ));
    
    console.log();
    console.log('═'.repeat(70));
    console.log('📊 DIAGNOSTIC RESULTS');
    console.log('═'.repeat(70));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successful: ${successful}/3`);
    console.log(`❌ Failed: ${failed}/3`);
    
    if (successful > 0) {
        console.log();
        console.log('📨 Message IDs (for tracking in Firebase Console):');
        results.filter(r => r.success).forEach(r => {
            console.log(`   ${r.shortId}`);
        });
    }
    
    console.log();
    console.log('═'.repeat(70));
    console.log('🔍 NEXT STEPS');
    console.log('═'.repeat(70));
    
    if (successful === 3) {
        console.log('✅ All messages sent successfully to Firebase!');
        console.log();
        console.log('📱 If you STILL don\'t receive notifications on your device:');
        console.log();
        console.log('1. Check Topic Subscriptions in App:');
        console.log('   • Open app with React Native debugger');
        console.log('   • Look for: "[Push] ✅ Subscribed to: fasting_' + timezone + '"');
        console.log('   • Verify timezone offset matches your location');
        console.log();
        console.log('2. Check Device Settings:');
        console.log('   iOS:');
        console.log('   • Settings > Notifications > iHafidh > Allow Notifications ON');
        console.log('   • Settings > Focus > Do Not Disturb OFF');
        console.log('   Android:');
        console.log('   • Settings > Apps > iHafidh > Notifications > All enabled');
        console.log('   • Settings > Battery > Battery optimization > iHafidh > Don\'t optimize');
        console.log();
        console.log('3. Check In-App Settings:');
        console.log('   • Open iHafidh > Settings');
        console.log('   • "Enable Fasting Reminders" should be ON');
        console.log('   • "Enable Daily Ayah" should be ON');
        console.log();
        console.log('4. Check Firebase Console:');
        console.log('   • https://console.firebase.google.com/project/' + serviceAccount.project_id + '/messaging');
        console.log('   • Look for message IDs listed above');
        console.log('   • Check delivery status and error messages');
        console.log();
        console.log('5. Test with Firebase Console:');
        console.log('   • Go to Cloud Messaging > Send test message');
        console.log('   • Use your FCM token from app logs');
        console.log('   • Send directly to token (bypass topics)');
    } else if (successful > 0) {
        console.log('⚠️  Some messages sent, but not all');
        console.log();
        console.log('Possible causes:');
        console.log('• Network connectivity issues');
        console.log('• Firebase API rate limiting');
        console.log('• Invalid topic names');
        console.log();
        console.log('Try running the test again in a few minutes.');
    } else {
        console.log('❌ No messages could be sent');
        console.log();
        console.log('Common causes:');
        console.log('1. Invalid Firebase credentials');
        console.log('2. Firebase project misconfigured');
        console.log('3. FCM API not enabled for project');
        console.log('4. Network connectivity issues');
        console.log();
        console.log('Check Firebase Console:');
        console.log('   https://console.firebase.google.com/project/' + serviceAccount.project_id);
    }
    
    console.log();
    console.log('═'.repeat(70));
    
    process.exit(failed > 0 ? 1 : 0);
}

// Run diagnostics
runDiagnostics().catch(error => {
    console.error();
    console.error('❌ FATAL ERROR:', error.message);
    console.error();
    if (error.stack) {
        console.error('Stack trace:');
        console.error(error.stack);
    }
    process.exit(1);
});
