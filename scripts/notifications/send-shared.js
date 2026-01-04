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
        console.log('--- Starting Notification Check ---');

        // 1. Get Tomorrow's Date (Singapore Time as reference)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const day = tomorrow.getDate();
        const month = tomorrow.getMonth() + 1;
        const year = tomorrow.getFullYear();

        console.log(`Checking for date: ${year}-${month}-${day}`);

        // 2. Fetch Hijri Date from Aladhan API
        const response = await fetch(`https://api.aladhan.com/v1/gToH/${day}-${month}-${year}`);
        const data = await response.json();

        if (data.code !== 200) throw new Error('API Error');

        const hijri = data.data.hijri;
        const hijriDay = parseInt(hijri.day);
        const hijriMonth = hijri.month.number;
        const weekday = data.data.gregorian.weekday.en; // Monday, Thursday...

        console.log(`Hijri: ${hijri.day} ${hijri.month.en} (${hijri.year}) - ${weekday}`);

        /// --- FASTING LOGIC --- ///
        let sendFasting = false;
        let title = '';
        let body = '';

        // Mon/Thu
        if (weekday === 'Monday' || weekday === 'Thursday') {
            sendFasting = true;
            title = `Sunnah Fasting Tomorrow (${weekday})`;
            body = `Don't forget to fast tomorrow! It is a Sunnah act.`;
        }

        // White Days (13, 14, 15)
        if (hijriDay >= 13 && hijriDay <= 15) {
            sendFasting = true;
            title = `Ayyamul Bidh Fasting Tomorrow`;
            body = `Tomorrow is the ${hijriDay}th of ${hijri.month.en}. Remind yourself to fast!`;
        }

        // Ashura (10th Muharram)
        if (hijriMonth === 1 && hijriDay === 10) {
            sendFasting = true;
            title = `Ashura Fasting Tomorrow`;
            body = `Tomorrow is Ashura (10th Muharram). Proven expiation for the previous year's sins.`;
        }

        // Arafah (9th Dhul Hijjah)
        if (hijriMonth === 12 && hijriDay === 9) {
            sendFasting = true;
            title = `Day of Arafah Tomorrow`;
            body = `Fasting on Arafah expiates sins for the past and coming year.`;
        }

        if (sendFasting) {
            console.log(`Sending Fasting Notification: ${title}`);
            await messaging.send({
                topic: TOPIC_FASTING,
                notification: { title, body },
                data: { type: 'fasting_reminder' }
            });
            console.log('Fasting notification sent.');
        } else {
            console.log('No fasting notification for tomorrow.');
        }

        /// --- DAILY AYAH LOGIC --- ///
        // Simple deterministic selection based on day of year
        // We replicate the logic from ayahOfTheDay.ts (simplified)
        // Since we don't import TS files here, we rely on a fixed list or simplified logic.
        // For robustness in this script, we'll fetch a daily verse from an API or use a simple modulo of the day number.

        // NOTE: Ideally, we should sync this list with client. For now, we will send a generic "Read your Daily Ayah" 
        // OR we can embed the same list here. Embedding the list ensures exact match.
        // For brevity, we will send a prompt for now, and the app will open to the correct verse automatically.
        // The app calculates the verse based on DATE locally in `handleNotificationInteraction`.

        const ayahTitle = "Daily Ayah";
        const ayahBody = "Tap to read your Ayah of the Day.";

        console.log(`Sending Daily Ayah Notification`);
        await messaging.send({
            topic: TOPIC_DAILY_AYAH,
            notification: { title: ayahTitle, body: ayahBody },
            data: { type: 'daily_ayah', target: 'index' }
        });
        console.log('Daily Ayah notification sent.');

        console.log('--- Done ---');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
