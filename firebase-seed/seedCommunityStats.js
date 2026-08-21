/**
 * seedCommunityStats.js
 * ------------------------------------------------------------------
 * ONE-TIME script to initialize the Firestore documents that the app's
 * increment*() functions (in communityStatsService.ts) expect to already
 * exist. Run this once, from a trusted machine (NOT from the app),
 * using a Firebase Admin service account.
 *
 * Why this is needed:
 *  - The app's write functions use batch.update(ref, {...}), and
 *    Firestore's update() throws if the target document doesn't exist.
 *  - If surah_stats/{n}, juz_stats/{n}, or community_stats/global were
 *    never created, every increment call has been silently failing in
 *    production, which is why the Community Stats screen shows all zeros.
 *
 * What this script does:
 *  1. Creates community_stats/global with all counters at 0.
 *  2. Creates surah_stats/1 .. surah_stats/114, each with surah_number,
 *     surah_name, and all counters at 0.
 *  3. Creates juz_stats/1 .. juz_stats/30, each with juz_number and
 *     counters at 0.
 *  4. Uses set({ merge: true }) — safe to re-run; it will NOT overwrite
 *     existing counts, only fill in missing fields/documents.
 *
 * SETUP:
 *  1. npm install firebase-admin
 *  2. Download a service account key from:
 *     Firebase Console -> Project Settings -> Service Accounts
 *     -> Generate new private key
 *     Save it as ./serviceAccountKey.json (same folder as this script)
 *  3. node seedCommunityStats.js
 *
 * IMPORTANT: never commit serviceAccountKey.json to git. Delete it
 * from your machine once you're done if you don't need it again.
 * ------------------------------------------------------------------
 */

const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccountPath = fs.existsSync('./serviceAccountKey.json') ? './serviceAccountKey.json' : '../firebaseServiceAccountKey.json';
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Standard English names for all 114 surahs, in Quran order.
const SURAH_NAMES = [
  'Al-Fatihah', 'Al-Baqarah', 'Ali \'Imran', 'An-Nisa', 'Al-Ma\'idah',
  'Al-An\'am', 'Al-A\'raf', 'Al-Anfal', 'At-Tawbah', 'Yunus',
  'Hud', 'Yusuf', 'Ar-Ra\'d', 'Ibrahim', 'Al-Hijr',
  'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Ta-Ha',
  'Al-Anbiya', 'Al-Hajj', 'Al-Mu\'minun', 'An-Nur', 'Al-Furqan',
  'Ash-Shu\'ara', 'An-Naml', 'Al-Qasas', 'Al-Ankabut', 'Ar-Rum',
  'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir',
  'Ya-Sin', 'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir',
  'Fussilat', 'Ash-Shuraa', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jathiyah',
  'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf',
  'Adh-Dhariyat', 'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman',
  'Al-Waqi\'ah', 'Al-Hadid', 'Al-Mujadila', 'Al-Hashr', 'Al-Mumtahanah',
  'As-Saf', 'Al-Jumu\'ah', 'Al-Munafiqun', 'At-Taghabun', 'At-Talaq',
  'At-Tahrim', 'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', 'Al-Ma\'arij',
  'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah',
  'Al-Insan', 'Al-Mursalat', 'An-Naba', 'An-Nazi\'at', '\'Abasa',
  'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Inshiqaq', 'Al-Buruj',
  'At-Tariq', 'Al-A\'la', 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad',
  'Ash-Shams', 'Al-Layl', 'Ad-Duhaa', 'Ash-Sharh', 'At-Tin',
  'Al-\'Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', 'Al-\'Adiyat',
  'Al-Qari\'ah', 'At-Takathur', 'Al-\'Asr', 'Al-Humazah', 'Al-Fil',
  'Quraysh', 'Al-Ma\'un', 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr',
  'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas',
];

async function seedGlobal() {
  const ref = db.collection('community_stats').doc('global');
  await ref.set(
    {
      total_verses_memorized: 0,
      total_surahs_completed: 0,
      total_juz_completed: 0,
      total_favourites: 0,
      total_bookmarks: 0,
      total_hafidh_completions: 0,
      total_quizzes_ai: 0,
      total_quizzes_manual: 0,
      total_audio_played: 0,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('✓ Seeded community_stats/global');
}

async function seedSurahs() {
  // Firestore batches max out at 500 ops; 114 fits easily in one batch,
  // but we chunk anyway to keep this safe if you ever expand the list.
  const chunkSize = 100;
  for (let start = 0; start < SURAH_NAMES.length; start += chunkSize) {
    const batch = db.batch();
    const chunk = SURAH_NAMES.slice(start, start + chunkSize);
    chunk.forEach((name, i) => {
      const surahNumber = start + i + 1;
      const ref = db.collection('surah_stats').doc(String(surahNumber));
      batch.set(
        ref,
        {
          surah_number: surahNumber,
          surah_name: name,
          memorized_count: 0,
          revised_count: 0,
          completed_count: 0,
          favourite_count: 0,
          bookmark_count: 0,
          audio_played_count: 0,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
    console.log(`✓ Seeded surah_stats ${start + 1}-${start + chunk.length}`);
  }
}

const JUZ_NAMES = [
  '',
  'Alif Lam Meem',
  'Sayaqool',
  'Tilkal Rusul',
  'Lan Tanaloo',
  'Wal Muhsanat',
  'La Yuhibbullah',
  "Wa Iza Sami'oo",
  'Wa Lau Annana',
  "Qalal Mala'u",
  "Wa'lamoo",
  "Ya'taziroon",
  'Wa Ma Min Dabbatin',
  "Wa Ma Ubabri'u",
  'Rubama',
  'Subhanallazi',
  'Qala Alam',
  'Iqtaraba',
  'Qad Aflaha',
  'Wa Qalallazina',
  'Ammana Khalaqa',
  'Utlu Ma Oohiya',
  'Wa Man Yaqnut',
  'Wa Mali',
  'Faman Azlamu',
  'Ilaihi Yuraddu',
  'Ha Meem',
  'Qala Fama Khatbukum',
  "Qad Sami'allah",
  'Tabarakallazi',
  "‘Amma",
];

async function seedJuz() {
  const batch = db.batch();
  for (let juzNumber = 1; juzNumber <= 30; juzNumber++) {
    const ref = db.collection('juz_stats').doc(String(juzNumber));
    const name = JUZ_NAMES[juzNumber] || '';
    batch.set(
      ref,
      {
        juz_number: juzNumber,
        juz_name: name,
        juz_display_name: `Juz ${juzNumber} (${name})`,
        completed_count: 0,
        revised_count: 0,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();
  console.log('✓ Seeded juz_stats 1-30 with names');
}

async function seedBadges() {
  const badgeIds = [
    'awwal-noor', 'munir-al-darb', 'hamil-hikmah', 'sahib-istiqaamah',
    'saari-sabeelillah', 'sahib-azm', 'naasir-quran', 'rahiq-yaqeen', 'hafidh-quran'
  ];
  const batch = db.batch();
  badgeIds.forEach((id) => {
    const ref = db.collection('badge_stats').doc(id);
    batch.set(
      ref,
      {
        badge_id: id,
        unlock_count: 0,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
  console.log('✓ Seeded badge_stats');
}

async function main() {
  console.log('Starting community stats seed...\n');
  await seedGlobal();
  await seedSurahs();
  await seedJuz();
  await seedBadges();
  console.log('\nDone. All documents exist. The app\'s increment*() calls should now succeed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});