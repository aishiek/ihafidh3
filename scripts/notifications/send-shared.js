const admin = require('firebase-admin');
const ayahList = require('./ayahs.json');

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

// ------------------------------------------------------------
// Get deterministic daily ayah based on local date
// Same ayah for all users in the same timezone on the same day
// ------------------------------------------------------------
function getDailyAyah(localDate) {
    const start = new Date(Date.UTC(localDate.getUTCFullYear(), 0, 0));
    const dayOfYear = Math.floor((localDate - start) / 86400000);
    return ayahList[dayOfYear % ayahList.length];
}

// ------------------------------------------------------------
// Fetch verse from api.alquran.cloud (same source as the app)
// ------------------------------------------------------------
async function fetchVerse(surahId, verseNumber) {
    const url = `https://api.alquran.cloud/v1/ayah/${surahId}:${verseNumber}/en.sahih`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 200) {
        throw new Error(`AlQuran Cloud API error for ${surahId}:${verseNumber} — ${data.status}`);
    }

    const translation = data.data.text;
    const surahName = data.data.surah.englishName;

    return { translation, surahName, key: `${surahId}:${verseNumber}` };
}

// ------------------------------------------------------------
// Truncate safely for FCM body character limit (~200 chars)
// ------------------------------------------------------------
function truncate(str, max = 200) {
    if (!str || str.length <= max) return str;
    return str.slice(0, max - 1) + '…';
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function main() {
    try {
        console.log('--- Starting System Check (Hourly Timezone Aware) ---');

        const now = new Date();
        const utcHour = now.getUTCHours();
        const TARGET_HOUR = 5; // 5 AM Local Time

        console.log(`Current UTC Hour: ${utcHour}`);
        console.log(`Target Local Hour: ${TARGET_HOUR}`);

        // 1. Identify valid offsets for this UTC hour
        const validOffsets = [];

        for (let offset = -11; offset <= 14; offset++) {
            const localHour = (utcHour + offset + 24) % 24;

            if (localHour === TARGET_HOUR) {
                const sign = offset < 0 ? '-' : '';
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
            console.log(`\nProcessing Zone: UTC${zone.val >= 0 ? '+' : ''}${zone.val}`);

            // Calculate local date for this timezone
            const localDate = new Date(now.getTime() + zone.val * 3600000);
            const day = localDate.getUTCDate();
            const month = localDate.getUTCMonth() + 1;
            const year = localDate.getUTCFullYear();

            console.log(`  Local Date: ${year}-${month}-${day}`);

            // --- Daily Ayah ---
            const { surahId, verseNumber } = getDailyAyah(localDate);
            console.log(`  Daily Ayah: Surah ${surahId}, Verse ${verseNumber}`);

            let ayahTitle = 'Daily Ayah';
            let ayahBody = 'Tap to read your Ayah of the Day';

            try {
                const { translation, surahName, key } = await fetchVerse(surahId, verseNumber);
                ayahTitle = `${surahName} (${key})`;
                ayahBody = truncate(translation);
                console.log(`  Fetched: ${key} — "${ayahBody.slice(0, 60)}..."`);
            } catch (err) {
                // Fallback to plain text if API fails — don't block other zones
                console.warn(`  Failed to fetch verse, using fallback. Error: ${err.message}`);
            }

            const ayahTopic = `${TOPIC_DAILY_AYAH}_${zone.str}`;
            console.log(`  Sending Ayah -> ${ayahTopic}`);

            await messaging.send({
                topic: ayahTopic,
                notification: {
                    title: ayahTitle,
                    body: ayahBody,
                },
                data: {
                    type: 'daily_ayah',
                    target: 'index',
                    surahId: String(surahId),
                    verseNumber: String(verseNumber),
                },
                android: {
                    notification: {
                        priority: 'high',
                    }
                }
            });

            // --- Hijri Calendar (for fasting check) ---
            const hijriResponse = await fetch(
                `https://api.aladhan.com/v1/gToH/${day}-${month}-${year}`
            );
            const hijriData = await hijriResponse.json();

            if (hijriData.code !== 200) {
                console.error(`  Hijri API error for ${zone.str}`, hijriData);
                continue;
            }

            const hijri = hijriData.data.hijri;
            const hijriDay = parseInt(hijri.day);
            const hijriMonth = hijri.month.number;
            const weekday = hijriData.data.gregorian.weekday.en;

            console.log(`  Hijri: ${hijri.day} ${hijri.month.en} — ${weekday}`);

            // --- Fasting Check ---
            let sendFasting = false;
            let title = '';
            let body = '';

            // Monday / Thursday Sunnah
            if (weekday === 'Monday' || weekday === 'Thursday') {
                sendFasting = true;
                title = `Sunnah Fasting Today`;
                body = `Today is ${weekday}. Just a reminder for Sunnah fasting!`;
            }

            // White Days (13th, 14th, 15th of Hijri month)
            if (hijriDay >= 13 && hijriDay <= 15) {
                sendFasting = true;
                title = `White Days Fasting`;
                body = `Today is the ${hijriDay}th of ${hijri.month.en}. Remind yourself to fast!`;
            }

            // Ashura (10th Muharram)
            if (hijriMonth === 1 && hijriDay === 10) {
                sendFasting = true;
                title = `Ashura Fasting`;
                body = `Today is Ashura (10th Muharram).`;
            }

            // Day of Arafah (9th Dhul Hijjah)
            if (hijriMonth === 12 && hijriDay === 9) {
                sendFasting = true;
                title = `Day of Arafah`;
                body = `Today is the Day of Arafah.`;
            }

            if (sendFasting) {
                const fastingTopic = `${TOPIC_FASTING}_${zone.str}`;
                console.log(`  Sending Fasting -> ${fastingTopic}`);
                await messaging.send({
                    topic: fastingTopic,
                    notification: { title, body },
                    data: { type: 'fasting_reminder' }
                });
            } else {
                console.log(`  No fasting today.`);
            }
        }

        console.log('\n--- Done ---');
        process.exit(0);

    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
}

main();
