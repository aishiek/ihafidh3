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

        // 1. Identify valid offsets for this hour/minute
        // Current UTC time in minutes from start of day
        const utcMinutesElapsed = (now.getUTCHours() * 60) + now.getUTCMinutes();
        const TARGET_MINUTES = TARGET_HOUR * 60; // 300 (which is 5:00 AM)

        const validOffsets = [];

        // Scan offsets from -12 to +14 in 0.5 hour increments (30 mins)
        // This covers India (+5.5), Adelaide (+9.5), etc. 
        for (let offset = -12; offset <= 14; offset += 0.5) {
            let localMinutes = utcMinutesElapsed + (offset * 60);
            
            // Handle wrap around for 24h period (1440 mins)
            while (localMinutes < 0) localMinutes += 1440;
            while (localMinutes >= 1440) localMinutes -= 1440;

            if (localMinutes === TARGET_MINUTES) {
                // Ensure offset string matches App's PushNotificationService (e.g. "0530", "-0500", "0800")
                // No '+' prefix for positive values, '-' for negative. 
                const sign = offset >= 0 ? '' : '-';
                const absOffset = Math.abs(offset);
                const hours = Math.floor(absOffset);
                const mins = Math.round((absOffset - hours) * 60);
                
                const offsetStr = `${sign}${String(hours).padStart(2, '0')}${String(mins).padStart(2, '0')}`;
                validOffsets.push({ val: offset, str: offsetStr });
            }
        }

        if (validOffsets.length === 0) {
            console.log(`ℹ️  No timezones match exactly 5:00 AM at ${now.getUTCHours()}:${now.getUTCMinutes()} UTC. Exiting.`);
            console.log('='.repeat(60));
            process.exit(0);
        }

        console.log(`✅ Found ${validOffsets.length} timezone(s) hitting exactly 5:00 AM:`);
        validOffsets.forEach(o => {
            const sample = new Date(now.getTime() + (o.val * 60 * 60 * 1000));
            console.log(`   • ${o.str} (UTC${o.val >= 0 ? '+' : ''}${o.val}) → Local: ${sample.toISOString().substring(0, 16)}`);
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
                            payload: {
                                aps: {
                                    alert: {
                                        title: title,
                                        body: body
                                    },
                                    sound: 'default',
                                    badge: 1,
                                    'content-available': 1
                                }
                            }
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
            
            // Determine today's verse
            const selectedVerse = getTodayCardVerse(localDate);
            console.log(`🔍 Fetching content for Ayah: ${selectedVerse.surahId}:${selectedVerse.verseNumber}`);
            
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

            // Clean up text
            if (ayahBody) {
                // Remove [square bracket notes] often found in Asad/Sahih translations for cleaner notifications
                ayahBody = ayahBody.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
                
                // Limit text length to avoid push notification truncation (approx 200 chars is safe)
                if (ayahBody.length > 200) {
                    ayahBody = ayahBody.substring(0, 197) + '...';
                }
            }

            console.log(`📤 Sending Daily Ayah → Topic: ${ayahTopic}`);
            console.log(`   Title: "${ayahTitle}"`);
            
            try {
                const result = await messaging.send({
                    topic: ayahTopic,
                    notification: {
                        title: ayahTitle,
                        body: ayahBody
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
                        payload: {
                            aps: {
                                alert: {
                                    title: ayahTitle,
                                    body: ayahBody
                                },
                                sound: 'default',
                                badge: 1,
                                'content-available': 1
                            }
                        }
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
