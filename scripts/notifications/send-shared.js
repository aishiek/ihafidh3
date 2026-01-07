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
        console.log('--- Starting System Check (Hourly Timezone Aware) ---');

        const now = new Date();
        const utcHour = now.getUTCHours();
        const TARGET_HOUR = 5; // 5 AM Local Time

        console.log(`Current UTC Hour: ${utcHour}`);
        console.log(`Target Local Hour: ${TARGET_HOUR}`);

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
                // Format offset string matches App (e.g. "+0800", "-0500")
                const sign = offset >= 0 ? '' : '-'; // Removed '+' for valid topic name
                const abs = Math.abs(offset);
                const offsetStr = `${sign}${String(abs).padStart(2, '0')}00`;
                validOffsets.push({ val: offset, str: offsetStr });
            }
        }

        if (validOffsets.length === 0) {
            console.log('No timezones match 5 AM right now. Exiting.');
            process.exit(0);
        }

        console.log(`Found timezones hitting 5 AM:`, validOffsets.map(o => o.str));

        // 2. Process each valid offset
        for (const zone of validOffsets) {
            console.log(`Processing Zone: ${zone.str} (UTC${zone.val})`);

            // Calculate Local Date for this zone
            // We create a date object shifted by the offset
            const localDate = new Date(now.getTime() + (zone.val * 60 * 60 * 1000));
            const day = localDate.getUTCDate();
            const month = localDate.getUTCMonth() + 1;
            const year = localDate.getUTCFullYear();

            console.log(`  Local Date: ${year}-${month}-${day}`);

            // Fetch Hijri info
            const response = await fetch(`https://api.aladhan.com/v1/gToH/${day}-${month}-${year}`);
            const data = await response.json();

            if (data.code !== 200) {
                console.error(`  API Error for ${zone.str}`, data);
                continue;
            }

            const hijri = data.data.hijri;
            const hijriDay = parseInt(hijri.day);
            const hijriMonth = hijri.month.number;
            const weekday = data.data.gregorian.weekday.en;

            console.log(`  Hijri: ${hijri.day} ${hijri.month.en} - ${weekday}`);

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
                console.log(`  Sending Fasting -> ${topic}`);
                await messaging.send({
                    topic: topic,
                    notification: { title, body },
                    data: { type: 'fasting_reminder' }
                });
            } else {
                console.log(`  No fasting today.`);
            }

            // --- Daily Ayah (Always Send) ---
            const ayahTopic = `${TOPIC_DAILY_AYAH}_${zone.str}`;
            console.log(`  Sending Ayah -> ${ayahTopic}`);
            await messaging.send({
                topic: ayahTopic,
                notification: {
                    title: "Daily Ayah",
                    body: "Read your Ayah of the Day"
                },
                data: { type: 'daily_ayah', target: 'index' }
            });
        }

        console.log('--- Done ---');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
