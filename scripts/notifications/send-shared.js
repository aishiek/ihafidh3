const admin = require('firebase-admin');

// Service Account from Environment Variable (GitHub Secret)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

// Initialize Firebase
if (Object.keys(serviceAccount).length > 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    console.error('FIREBASE_SERVICE_ACCOUNT missing');
    process.exit(1);
}

const messaging = admin.messaging();

// Constants
const TOPIC_FASTING = 'fasting';
const TOPIC_DAILY_AYAH = 'daily_ayah';

async function main() {
    try {
        console.log('='.repeat(60));
        console.log('🚀 DAILY NOTIFICATIONS - Starting System Check');
        console.log('='.repeat(60));

        const now = new Date();
        const utcHour = now.getUTCHours();
        const TARGET_HOUR = 5; // 5 AM Local Time

        console.log(`⏰ Current Time (UTC): ${now.toISOString()}`);
        console.log(`⏰ Current UTC Hour: ${utcHour}`);
        console.log(`🎯 Target Local Hour: ${TARGET_HOUR} AM`);
        console.log('');

        // 1. Identify valid offsets for this hour
        // Formula: (utc + offset) % 24 == target
        const validOffsets = [];

        // Scan standard offsets (-11 to +14)
        // We include half-hour offsets if needed, but for simplicity starting with integers
        // To cover half-hours (e.g. India +5:30), we would need to run script every 30 mins
        // For now, we support integer offsets (covering most major users)
        for (let offset = -11; offset <= 14; offset++) {
            let localHour = (utcHour + offset);
            // Handle wrap around
            if (localHour < 0) localHour += 24;
            if (localHour >= 24) localHour -= 24;

            if (localHour === TARGET_HOUR) {
                // Format offset string matches App (e.g. "+0800", "-0500" but without + for FCM topic compatibility)
                const sign = offset >= 0 ? '' : '-';
                const abs = Math.abs(offset);
                const offsetStr = `${sign}${String(abs).padStart(2, '0')}00`;
                validOffsets.push({ val: offset, str: offsetStr });
            }
        }

        if (validOffsets.length === 0) {
            console.log('ℹ️  No timezones match 5 AM right now. Exiting gracefully.');
            console.log('='.repeat(60));
            process.exit(0);
        }

        console.log(`✅ Found ${validOffsets.length} timezone(s) hitting 5 AM:`);
        validOffsets.forEach(o => {
            const sample = new Date(now.getTime() + (o.val * 60 * 60 * 1000));
            console.log(`   • ${o.str} (UTC${o.val >= 0 ? '+' : ''}${o.val}) → Local: ${sample.toISOString().substring(0, 19)}`);
        });
        console.log('');

        let totalSent = 0;
        let totalErrors = 0;

        // 2. Process each valid offset
        for (const zone of validOffsets) {
            console.log('─'.repeat(60));
            console.log(`📍 Processing Zone: ${zone.str} (UTC${zone.val >= 0 ? '+' : ''}${zone.val})`);

            // Calculate Local Date for this zone
            // We create a date object shifted by the offset
            const localDate = new Date(now.getTime() + (zone.val * 60 * 60 * 1000));
            const day = localDate.getUTCDate();
            const month = localDate.getUTCMonth() + 1;
            const year = localDate.getUTCFullYear();

            console.log(`📅 Local Date: ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);

            // Fetch Hijri info
            console.log(`🔍 Fetching Hijri calendar data...`);
            const response = await fetch(`https://api.aladhan.com/v1/gToH/${day}-${month}-${year}`);
            const data = await response.json();

            if (data.code !== 200) {
                console.error(`❌ API Error for ${zone.str}:`, data);
                totalErrors++;
                continue;
            }

            const hijri = data.data.hijri;
            const hijriDay = parseInt(hijri.day);
            const hijriMonth = hijri.month.number;
            const weekday = data.data.gregorian.weekday.en;

            console.log(`🌙 Hijri: ${hijri.day} ${hijri.month.en} (${hijriMonth}/${hijriDay})`);
            console.log(`📆 Gregorian: ${weekday}`);

            // --- Fasting Check (Is TODAY a fasting day?) ---
            let sendFasting = false;
            let title = '';
            let body = '';

            // Mon/Thu
            if (weekday === 'Monday' || weekday === 'Thursday') {
                sendFasting = true;
                title = `Sunnah Fasting Today`;
                body = `Today is ${weekday}. Just a reminder for Sunnah fasting!`;
            }

            // White Days (13, 14, 15)
            if (hijriDay >= 13 && hijriDay <= 15) {
                sendFasting = true;
                title = `White Days Fasting`;
                body = `Today is the ${hijriDay}th of ${hijri.month.en}. Remind yourself to fast!`;
            }

            // Ashura
            if (hijriMonth === 1 && hijriDay === 10) {
                sendFasting = true;
                title = `Ashura Fasting`;
                body = `Today is Ashura (10th Muharram).`;
            }

            // Arafah
            if (hijriMonth === 12 && hijriDay === 9) {
                sendFasting = true;
                title = `Day of Arafah`;
                body = `Today is the Day of Arafah.`;
            }

            if (sendFasting) {
                const topic = `${TOPIC_FASTING}_${zone.str}`;
                console.log(`📤 Sending Fasting Notification → Topic: ${topic}`);
                console.log(`   Title: "${title}"`);
                console.log(`   Body: "${body}"`);
                
                try {
                    const result = await messaging.send({
                        topic: topic,
                        notification: { title, body },
                        data: { type: 'fasting_reminder', timestamp: Date.now().toString() },
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
                            payload: { aps: { sound: 'default', badge: 1 } }
                        }
                    });
                    console.log(`✅ Fasting notification sent successfully (Message ID: ${result})`);
                    totalSent++;
                } catch (error) {
                    console.error(`❌ Failed to send fasting notification:`, error.message);
                    totalErrors++;
                }
            } else {
                console.log(`ℹ️  No fasting reminder for today.`);
            }

            // --- Daily Ayah (Always Send) ---
            const ayahTopic = `${TOPIC_DAILY_AYAH}_${zone.str}`;
            console.log(`📤 Sending Daily Ayah → Topic: ${ayahTopic}`);
            
            try {
                const result = await messaging.send({
                    topic: ayahTopic,
                    notification: {
                        title: "Daily Ayah",
                        body: "Read your Ayah of the Day"
                    },
                    data: { type: 'daily_ayah', target: 'index', timestamp: Date.now().toString() },
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
                        payload: { aps: { sound: 'default', badge: 1 } }
                    }
                });
                console.log(`✅ Daily Ayah sent successfully (Message ID: ${result})`);
                totalSent++;
            } catch (error) {
                console.error(`❌ Failed to send daily ayah:`, error.message);
                totalErrors++;
            }
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successfully sent: ${totalSent} notification(s)`);
        console.log(`❌ Errors: ${totalErrors}`);
        console.log(`🌍 Timezones processed: ${validOffsets.length}`);
        console.log('='.repeat(60));

        process.exit(totalErrors > 0 ? 1 : 0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
