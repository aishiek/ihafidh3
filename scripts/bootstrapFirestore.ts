/**
 * bootstrapFirestore.ts
 *
 * Pre-creates all Firestore documents needed for Community Stats.
 * Safe to run multiple times — uses `set(..., { merge: false })` to
 * write all docs at once. Existing docs with live counts will NOT be
 * overwritten because we use `{ merge: true }` for the global doc.
 *
 * Prerequisites:
 *   1. Firestore API enabled in Firebase Console
 *   2. Firestore Database created in Firebase Console (Native mode)
 *      Go to: https://console.firebase.google.com/project/ihafidh-c0b1a/firestore
 *      Click "Create database" → Start in production mode → choose region
 *   3. `firebaseServiceAccountKey.json` present in project root
 *
 * Run:
 *   npx tsx scripts/bootstrapFirestore.ts
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { surahsData } from '../data/surahs';

const serviceAccount = require(path.join(__dirname, '../firebaseServiceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Firestore batch limit is 500 operations
const BATCH_SIZE = 499;

async function commitInBatches(
  items: Array<{ ref: admin.firestore.DocumentReference; data: any }>,
  label: string
) {
  let count = 0;
  let batchOps: Array<{ ref: admin.firestore.DocumentReference; data: any }> = [];

  for (const item of items) {
    batchOps.push(item);
    if (batchOps.length >= BATCH_SIZE) {
      const batch = db.batch();
      for (const op of batchOps) {
        batch.set(op.ref, op.data, { merge: false });
      }
      await batch.commit();
      count += batchOps.length;
      console.log(`  ✓ Committed ${count} ${label} docs...`);
      batchOps = [];
    }
  }

  if (batchOps.length > 0) {
    const batch = db.batch();
    for (const op of batchOps) {
      batch.set(op.ref, op.data, { merge: false });
    }
    await batch.commit();
    count += batchOps.length;
  }

  return count;
}

async function bootstrap() {
  console.log('🚀 Starting Firestore bootstrap for project: ihafidh-c0b1a');
  console.log('   This will create/overwrite 145 documents (1 global + 114 surah + 30 juz)\n');

  // 1. community_stats/global — use merge:true so live counters aren't reset if re-run
  console.log('📌 Creating community_stats/global...');
  const globalRef = db.collection('community_stats').doc('global');
  await globalRef.set({
    total_surahs_completed: 0,
    total_juz_completed: 0,
    total_favourites: 0,
    total_bookmarks: 0,
    total_audio_played: 0,
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true }); // merge:true — preserves existing counts if re-run
  console.log('  ✓ community_stats/global created\n');

  // 2. surah_stats/1 … surah_stats/114
  console.log('📚 Creating surah_stats (114 docs)...');
  const surahItems = surahsData.map(s => ({
    ref: db.collection('surah_stats').doc(String(s.id)),
    data: {
      surah_number: s.id,
      surah_name: s.name,
      memorized_count: 0,
      revised_count: 0,
      completed_count: 0,
      favourite_count: 0,
      bookmark_count: 0,
      audio_played_count: 0,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }
  }));
  const surahCount = await commitInBatches(surahItems, 'surah_stats');
  console.log(`  ✅ ${surahCount} surah_stats docs created\n`);

  // 3. juz_stats/1 … juz_stats/30
  console.log('📖 Creating juz_stats (30 docs)...');
  const juzItems = Array.from({ length: 30 }, (_, i) => ({
    ref: db.collection('juz_stats').doc(String(i + 1)),
    data: {
      juz_number: i + 1,
      completed_count: 0,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }
  }));
  const juzCount = await commitInBatches(juzItems, 'juz_stats');
  console.log(`  ✅ ${juzCount} juz_stats docs created\n`);

  console.log('🎉 Firestore bootstrap complete!');
  console.log('\nNext steps:');
  console.log('  1. Deploy security rules: npx firebase-tools login && npx firebase-tools deploy --only firestore:rules');
  console.log('  2. Create Remote Config params in Firebase Console:');
  console.log('     - community_stats_enabled  (boolean, default: false)');
  console.log('     - community_stats_min_threshold  (number, default: 50)');
  console.log('  3. Rebuild native iOS/Android binary');
}

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Bootstrap failed:', err?.message || err);
    if (err?.code === 5) {
      console.error('\n👉 Error code 5 = NOT_FOUND. The Firestore DATABASE has not been created yet.');
      console.error('   Go to https://console.firebase.google.com/project/ihafidh-c0b1a/firestore');
      console.error('   Click "Create database" → production mode → choose a region → Done');
      console.error('   Then re-run this script.\n');
    }
    process.exit(1);
  });
