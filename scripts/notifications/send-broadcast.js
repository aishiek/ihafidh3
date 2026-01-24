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

// Get command line arguments
const title = process.env.BROADCAST_TITLE || process.argv[2];
const body = process.env.BROADCAST_BODY || process.argv[3];
const type = process.env.BROADCAST_TYPE || process.argv[4] || 'announcement';
const targetTimezone = process.env.TARGET_TIMEZONE || process.argv[5] || 'all';

if (!title || !body) {
    console.error('❌ Usage: node send-broadcast.js <TITLE> <BODY> [TYPE] [TIMEZONE]');
    console.error('');
    console.error('Examples:');
    console.error('  node send-broadcast.js "Eid Mubarak!" "May Allah accept your fasting and prayers" "greeting"');
    console.error('  node send-broadcast.js "New Feature" "Check out our new Mushaf viewer!" "announcement" "0800"');
    console.error('');
    console.error('Types: announcement, greeting, promotion, update');
    console.error('Timezone: all, 0800, -0500, etc.');
    process.exit(1);
}

async function sendBroadcast() {
    try {
        console.log('📢 Broadcasting Message');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Title: ${title}`);
        console.log(`Body: ${body}`);
        console.log(`Type: ${type}`);
        console.log(`Target: ${targetTimezone === 'all' ? 'All Users' : `Timezone ${targetTimezone}`}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const topics = [];

        if (targetTimezone === 'all') {
            // Send to all timezone-based topics
            // Generate common timezone offsets (-12 to +14)
            for (let offset = -12; offset <= 14; offset++) {
                const sign = offset >= 0 ? '' : '-';
                const abs = Math.abs(offset);
                const offsetStr = `${sign}${String(abs).padStart(2, '0')}00`;
                topics.push(`broadcast_${offsetStr}`);
            }
        } else {
            // Send to specific timezone
            topics.push(`broadcast_${targetTimezone}`);
        }

        console.log(`\n📡 Sending to ${topics.length} topic(s)...`);

        let successCount = 0;
        let failCount = 0;

        for (const topic of topics) {
            try {
                await messaging.send({
                    topic: topic,
                    notification: {
                        title: title,
                        body: body,
                    },
                    data: {
                        type: type,
                        timestamp: Date.now().toString(),
                        broadcast: 'true'
                    },
                    // High priority ensures delivery even when app is backgrounded/quit
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: 'default',
                            sound: 'default',
                            priority: 'high',
                            defaultSound: true,
                            defaultVibrateTimings: true,
                        }
                    },
                    apns: {
                        headers: {
                            'apns-priority': '10',
                        },
                        payload: {
                            aps: {
                                alert: {
                                    title: title,
                                    body: body,
                                },
                                sound: 'default',
                                badge: 1,
                                'content-available': 1,
                            }
                        }
                    },
                });
                successCount++;
                console.log(`✅ ${topic}`);
            } catch (error) {
                failCount++;
                console.log(`❌ ${topic}: ${error.message}`);
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Success: ${successCount}`);
        console.log(`❌ Failed: ${failCount}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        process.exit(failCount > 0 ? 1 : 0);
    } catch (error) {
        console.error('❌ Broadcast Error:', error);
        process.exit(1);
    }
}

sendBroadcast();
