import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccount = require(path.join(__dirname, '../firebaseServiceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function resetStatsToZero() {
  console.log('🚀 Starting clean reset of all Firestore community stats to 0...');

  try {
    let batch = db.batch();
    let count = 0;

    // 1. Reset surah_stats (1..114)
    for (let i = 1; i <= 114; i++) {
      const ref = db.collection('surah_stats').doc(String(i));
      batch.set(ref, {
        surah_number: i,
        memorized_count: 0,
        completed_count: 0,
        revised_count: 0,
        favourite_count: 0,
        bookmark_count: 0,
        audio_played_count: 0,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    // 2. Reset juz_stats (1..30)
    for (let j = 1; j <= 30; j++) {
      const ref = db.collection('juz_stats').doc(String(j));
      batch.set(ref, {
        juz_number: j,
        completed_count: 0,
        revised_count: 0,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    // 3. Reset community_stats/global
    const globalRef = db.collection('community_stats').doc('global');
    batch.set(globalRef, {
      total_verses_memorized: 0,
      total_surahs_completed: 0,
      total_surahs_memorized: 0,
      total_juz_completed: 0,
      total_favourites: 0,
      total_bookmarks: 0,
      total_hafidh_completions: 0,
      total_quizzes_ai: 0,
      total_quizzes_manual: 0,
      total_audio_played: 0,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    count++;

    if (count > 0) {
      await batch.commit();
    }

    console.log('✅ Successfully reset all 114 surahs, 30 juzes, and global stats to 0 in Firestore!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting Firestore community stats:', err);
    process.exit(1);
  }
}

resetStatsToZero();
