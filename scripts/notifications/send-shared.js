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

// Daily Ayah is delivered in the morning, unchanged from the original schedule.
const TARGET_HOUR_AYAH = 5; // 5 AM Local Time

// Fasting reminders must land the EVENING BEFORE the fasting day (around Maghrib/Isha),
// not the morning of, so the user has time to make niyyah and prepare suhoor before
// Fajr. This is the fix for the bug where the reminder arrived the same day as the
// fast — by then it's too late to be useful.
const TARGET_HOUR_FASTING = 19; // 7 PM Local Time (evening before)

/**
 * Robust fetch with retries
 */
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response;
        } catch (err) {
            console.warn(`⚠️  Attempt ${i + 1} failed: ${err.message}`);
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, backoff * Math.pow(2, i))); // Exponential backoff
        }
    }
}

// Load Daily Ayah List
const dailyAyahList = require('../../data/daily_ayah_list.json');

function getTodayCardVerse(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 0);
    const diff = (date.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - date.getTimezoneOffset()) * 60000);
    const dayOfYear = Math.floor(diff / 86400000); // 1..366
    const index = (dayOfYear - 1) % dailyAyahList.length;
    return dailyAyahList[index];
}

/**
 * Given the current UTC instant, find every UTC offset (in 0.5h steps, -12..+14)
 * whose local wall-clock time currently equals targetHour:00.
 */
function findOffsetsAtLocalHour(now, targetHour) {
    const utcMinutesElapsed = (now.getUTCHours() * 60) + now.getUTCMinutes();
    const targetMinutes = targetHour * 60;

    const offsets = [];
    for (let offset = -12; offset <= 14; offset += 0.5) {
        let localMinutes = utcMinutesElapsed + (offset * 60);
        while (localMinutes < 0) localMinutes += 1440;
        while (localMinutes >= 1440) localMinutes -= 1440;

        if (localMinutes === targetMinutes) {
            // Ensure offset string matches App's PushNotificationService (e.g. "0530", "-0500", "0800")
            const sign = offset >= 0 ? '' : '-';
            const absOffset = Math.abs(offset);
            const hours = Math.floor(absOffset);
            const mins = Math.round((absOffset - hours) * 60);
            const offsetStr = `${sign}${String(hours).padStart(2, '0')}${String(mins).padStart(2, '0')}`;
            offsets.push({ val: offset, str: offsetStr });
        }
    }
    return offsets;
}

async function sendFastingReminders(now, fastingOffsets) {
    let sent = 0;
    let errors = 0;

    for (const zone of fastingOffsets) {
        console.log('─'.repeat(60));
        console.log(`📍 [Fasting] Processing Zone: ${zone.str} (UTC${zone.val >= 0 ? '+' : ''}${zone.val})`);

        // Local "today" for this zone.
        const localDate = new Date(now.getTime() + (zone.val * 60 * 60 * 1000));

        // We're sending at 7 PM local (evening before), so the fasting day we care
        // about is TOMORROW relative to local "today" — not today. This is the fix
        // for the "fires the same day" bug.
        const fastingCheckDate = new Date(localDate.getTime() + 24 * 60 * 60 * 1000);
        const day = fastingCheckDate.getUTCDate();
        const month = fastingCheckDate.getUTCMonth() + 1;
        const year = fastingCheckDate.getUTCFullYear();

        console.log(`📅 Local Date (today): ${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`);
        console.log(`📅 Checking fasting status for (tomorrow): ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);

        console.log(`🔍 Fetching Hijri calendar data...`);
        let data;
        try {
            const response = await fetch(`https://api.aladhan.com/v1/gToH/${day}-${month}-${year}`);
            data = await response.json();
        } catch (err) {
            console.error(`❌ Hijri API request failed for ${zone.str}:`, err.message);
            errors++;
            continue;
        }

        if (!data || data.code !== 200) {
            console.error(`❌ API Error for ${zone.str}:`, data);
            errors++;
            continue;
        }

        const hijri = data.data.hijri;
        const hijriDay = parseInt(hijri.day);
        const hijriMonth = hijri.month.number;
        const weekday = data.data.gregorian.weekday.en;

        console.log(`🌙 Hijri (tomorrow): ${hijri.day} ${hijri.month.en} (${hijriMonth}/${hijriDay})`);
        console.log(`📆 Gregorian (tomorrow): ${weekday}`);

        // --- Fasting Check (Is TOMORROW a fasting day?) ---
        // Audited fasting types: Mon/Thu (regular Sunnah), White Days (Ayyamul Bidh),
        // Ashura, and Arafah all go through this same evening-before send path.
        let sendFasting = false;
        let title = '';
        let body = '';

        // Mon/Thu
        if (weekday === 'Monday' || weekday === 'Thursday') {
            sendFasting = true;
            title = `Sunnah Fasting Tomorrow`;
            body = `Tomorrow is ${weekday}. Make your niyyah tonight for Sunnah fasting!`;
        }

        // White Days (13, 14, 15)
        if (hijriDay >= 13 && hijriDay <= 15) {
            sendFasting = true;
            title = `White Days Fasting Tomorrow`;
            body = `Tomorrow is the ${hijriDay}th of ${hijri.month.en}. Make your niyyah tonight!`;
        }

        // Ashura
        if (hijriMonth === 1 && hijriDay === 10) {
            sendFasting = true;
            title = `Ashura Fasting Tomorrow`;
            body = `Tomorrow is Ashura (10th Muharram). Make your niyyah tonight.`;
        }

        // Arafah
        if (hijriMonth === 12 && hijriDay === 9) {
            sendFasting = true;
            title = `Day of Arafah Tomorrow`;
            body = `Tomorrow is the Day of Arafah. Make your niyyah tonight.`;
        }

        if (!sendFasting) {
            console.log(`ℹ️  No fasting reminder for tomorrow.`);
            continue;
        }

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
                    payload: {
                        aps: {
                            alert: { title, body },
                            sound: 'default',
                            badge: 1,
                            'content-available': 1
                        }
                    }
                }
            });
            console.log(`✅ Fasting notification sent successfully (Message ID: ${result})`);
            sent++;
        } catch (error) {
            console.error(`❌ Failed to send fasting notification:`, error.message);
            errors++;
        }
    }

    return { sent, errors };
}

async function fetchAyahText(selectedVerse) {
    let ayahTitle = "Daily Ayah";
    let ayahBody = "Read your Ayah of the Day";

    try {
        console.log(`🔍 Try primary API (AlQuran.cloud) for ${selectedVerse.surahId}:${selectedVerse.verseNumber}`);
        const ayahResponse = await fetchWithRetry(`https://api.alquran.cloud/v1/ayah/${selectedVerse.surahId}:${selectedVerse.verseNumber}/en.asad`);
        const ayahData = await ayahResponse.json();

        if (ayahData.code === 200 && ayahData.data) {
            const surahName = ayahData.data.surah.englishName;
            const verseNum = ayahData.data.numberInSurah;
            const translationText = ayahData.data.text;

            ayahTitle = `Daily Ayah: ${surahName} [${verseNum}]`;
            ayahBody = translationText;
            console.log(`✅ Fetched via AlQuran.cloud`);
        } else {
            throw new Error(`Invalid response code: ${ayahData.code}`);
        }
    } catch (err) {
        console.warn(`⚠️  Primary API failed, trying secondary API (Quran.com): ${err.message}`);
        try {
            // Try Quran.com API as fallback (English Sahih International / Asad equivalent)
            const quranComResp = await fetchWithRetry(`https://api.quran.com/api/v4/quran/translations/20?verse_key=${selectedVerse.surahId}:${selectedVerse.verseNumber}`);
            const quranComData = await quranComResp.json();

            if (quranComData.translations?.length > 0) {
                const translationText = quranComData.translations[0].text.replace(/<[^>]+>/g, ''); // strip HTML if any
                ayahTitle = `Daily Ayah [${selectedVerse.surahId}:${selectedVerse.verseNumber}]`;
                ayahBody = translationText;
                console.log(`✅ Fetched via Quran.com`);
            } else {
                throw new Error("No translations in Quran.com response");
            }
        } catch (secondaryErr) {
            console.error(`❌ ALL content APIs failed: ${secondaryErr.message}. Moving with default message.`);
            ayahTitle = "📖 Daily Ayah of the Day";
            ayahBody = "Open iHafidh to read and reflect on today's verses.";
        }
    }

    if (ayahBody) {
        // Remove [square bracket notes] often found in Asad/Sahih translations for cleaner notifications
        ayahBody = ayahBody.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
        // Limit text length to avoid push notification truncation (approx 200 chars is safe)
        if (ayahBody.length > 200) {
            ayahBody = ayahBody.substring(0, 197) + '...';
        }
    }

    return { ayahTitle, ayahBody };
}

async function sendDailyAyah(now, ayahOffsets) {
    let sent = 0;
    let errors = 0;

    for (const zone of ayahOffsets) {
        console.log('─'.repeat(60));
        console.log(`📍 [Daily Ayah] Processing Zone: ${zone.str} (UTC${zone.val >= 0 ? '+' : ''}${zone.val})`);

        const localDate = new Date(now.getTime() + (zone.val * 60 * 60 * 1000));
        const ayahTopic = `${TOPIC_DAILY_AYAH}_${zone.str}`;

        const selectedVerse = getTodayCardVerse(localDate);
        console.log(`🔍 Fetching content for Ayah: ${selectedVerse.surahId}:${selectedVerse.verseNumber}`);

        const { ayahTitle, ayahBody } = await fetchAyahText(selectedVerse);

        console.log(`📤 Sending Daily Ayah → Topic: ${ayahTopic}`);
        console.log(`   Title: "${ayahTitle}"`);

        try {
            const result = await messaging.send({
                topic: ayahTopic,
                notification: { title: ayahTitle, body: ayahBody },
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
                    payload: {
                        aps: {
                            alert: { title: ayahTitle, body: ayahBody },
                            sound: 'default',
                            badge: 1,
                            'content-available': 1
                        }
                    }
                }
            });
            console.log(`✅ Daily Ayah sent successfully (Message ID: ${result})`);
            sent++;
        } catch (error) {
            console.error(`❌ Failed to send daily ayah:`, error.message);
            errors++;
        }
    }

    return { sent, errors };
}

async function main() {
    try {
        console.log('='.repeat(60));
        console.log('🚀 DAILY NOTIFICATIONS - Starting System Check');
        console.log('='.repeat(60));

        const now = new Date();
        console.log(`⏰ Current Time (UTC): ${now.toISOString()}`);
        console.log(`🎯 Daily Ayah target local hour: ${TARGET_HOUR_AYAH}:00 AM`);
        console.log(`🎯 Fasting reminder target local hour: ${TARGET_HOUR_FASTING}:00 (7 PM, evening before the fast)`);
        console.log('');

        // These two run on independent schedules — a timezone can hit one, both, or
        // neither target hour on a given 30-minute tick, since they're 14 hours apart.
        const fastingOffsets = findOffsetsAtLocalHour(now, TARGET_HOUR_FASTING);
        const ayahOffsets = findOffsetsAtLocalHour(now, TARGET_HOUR_AYAH);

        if (fastingOffsets.length === 0 && ayahOffsets.length === 0) {
            console.log(`ℹ️  No timezones match a target hour at ${now.getUTCHours()}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC. Exiting.`);
            console.log('='.repeat(60));
            process.exit(0);
        }

        console.log(`✅ ${fastingOffsets.length} timezone(s) hitting the fasting reminder hour (${TARGET_HOUR_FASTING}:00 local).`);
        console.log(`✅ ${ayahOffsets.length} timezone(s) hitting the daily ayah hour (${TARGET_HOUR_AYAH}:00 local).`);
        console.log('');

        const fastingResult = fastingOffsets.length > 0
            ? await sendFastingReminders(now, fastingOffsets)
            : { sent: 0, errors: 0 };

        const ayahResult = ayahOffsets.length > 0
            ? await sendDailyAyah(now, ayahOffsets)
            : { sent: 0, errors: 0 };

        const totalSent = fastingResult.sent + ayahResult.sent;
        const totalErrors = fastingResult.errors + ayahResult.errors;

        console.log('');
        console.log('='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successfully sent: ${totalSent} notification(s)`);
        console.log(`❌ Errors: ${totalErrors}`);
        console.log(`🌍 Fasting timezones processed: ${fastingOffsets.length}`);
        console.log(`🌍 Daily Ayah timezones processed: ${ayahOffsets.length}`);
        console.log('='.repeat(60));

        process.exit(totalErrors > 0 ? 1 : 0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
