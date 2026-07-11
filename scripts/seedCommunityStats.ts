/**
 * seedCommunityStats.ts
 *
 * One-time admin seeding script to populate community stats from
 * any known historical counts. This is a SAFE upsert — existing live
 * counters are preserved via { merge: true }.
 *
 * USAGE:
 *   1. Ensure firebaseServiceAccountKey.json is in project root
 *   2. Edit the SEED_DATA section below with your known counts (leave 0 to skip)
 *   3. Run:  npx tsx scripts/seedCommunityStats.ts
 *
 * SAFETY: Uses set(..., { merge: true }) so re-running is safe. Counts
 * are only SET if they are > 0 in the seed data (to avoid overwriting live counts).
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { surahsData } from '../data/surahs';

// ─── SERVICE ACCOUNT ─────────────────────────────────────────────────────────
const serviceAccount = require(path.join(__dirname, '../firebaseServiceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db   = admin.firestore();
const BATCH_LIMIT = 499;

// ─── SEED DATA ────────────────────────────────────────────────────────────────
// Fill in your known historical counts here.
// Set a value to 0 to skip that field (existing live counter is preserved).
//
// HOW TO GET THESE NUMBERS:
//   - memorized_count per surah: count of memorized verses that belong to that surah
//   - completed_count per surah: number of users who finished all verses of that surah
//   - revised_count per surah: count of revision events for that surah
//   - completed_count per juz: how many times any user completed a full juz
//
// For now these are set to 0 — fill them in as needed.
// Alternatively, you can pass the --from-json flag with a JSON file.

interface SurahSeed {
  memorized_count?: number;
  revised_count?: number;
  completed_count?: number;
  favourite_count?: number;
  bookmark_count?: number;
}
interface JuzSeed {
  completed_count?: number;
  revised_count?: number;
}
interface GlobalSeed {
  total_surahs_completed?: number;
  total_juz_completed?: number;
  total_favourites?: number;
  total_bookmarks?: number;
  total_hafidh_completions?: number;
  total_quizzes_ai?: number;
  total_quizzes_manual?: number;
  total_audio_played?: number;
}

// ── Edit these ────────────────────────────────────────────────────────────────
const GLOBAL_SEED: GlobalSeed = {
  total_surahs_completed: 2071,
  total_juz_completed: 244,
  total_favourites: 73,
  total_bookmarks: 768,
  total_hafidh_completions: 377,
  total_quizzes_ai: 0,
  total_quizzes_manual: 308,
  total_audio_played: 4738,
};

// Surah-level seed — keyed by surah number (1-114)
// Example: { 1: { memorized_count: 42, revised_count: 128 }, 36: { memorized_count: 10 } }
const SURAH_SEED: Record<number, SurahSeed> = {
  // 1: { memorized_count: 10, revised_count: 20 },
};

// Juz-level seed — keyed by juz number (1-30)
// Example: { 30: { completed_count: 5 } }
const JUZ_SEED: Record<number, JuzSeed> = {
  // 30: { completed_count: 5 },
};
// ─────────────────────────────────────────────────────────────────────────────

async function commitInBatches(
  ops: Array<{ ref: admin.firestore.DocumentReference; data: Record<string, any>; options?: admin.firestore.SetOptions }>
) {
  let done = 0;
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const op of chunk) {
      batch.set(op.ref, op.data, op.options ?? { merge: true });
    }
    await batch.commit();
    done += chunk.length;
    console.log(`  Committed ${done}/${ops.length} docs…`);
  }
}

function stripZeroes<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => typeof v === 'number' ? v > 0 : v != null)
  ) as Partial<T>;
}

async function seed() {
  console.log('🌱 Seeding community stats to ihafidh-c0b1a…\n');

  // 1. Global doc — merge non-zero fields only
  const globalPayload = stripZeroes(GLOBAL_SEED) as Record<string, any>;
  if (Object.keys(globalPayload).length > 0) {
    globalPayload.updated_at = admin.firestore.FieldValue.serverTimestamp();
    console.log('📌 Updating community_stats/global:', globalPayload);
    await db.collection('community_stats').doc('global').set(globalPayload, { merge: true });
    console.log('  ✓ Done\n');
  } else {
    console.log('ℹ️  No global seed data — skipping global doc update\n');
  }

  // 2. Surah stats (always ensure all 114 exist, seed with non-zero fields where provided)
  console.log('📚 Upserting 114 surah_stats docs…');
  const surahOps = surahsData.map(s => {
    const seed = SURAH_SEED[s.id] ?? {};
    const base: Record<string, any> = {
      surah_number: s.id,
      surah_name:   s.name,
      updated_at:   admin.firestore.FieldValue.serverTimestamp(),
    };
    const nonZeroSeed = stripZeroes(seed);
    return {
      ref: db.collection('surah_stats').doc(String(s.id)),
      data: { ...base, ...nonZeroSeed },
      options: { merge: true } as admin.firestore.SetOptions,
    };
  });
  await commitInBatches(surahOps);
  console.log('  ✅ surah_stats complete\n');

  // 3. Juz stats (always ensure all 30 exist)
  console.log('📖 Upserting 30 juz_stats docs…');
  const juzOps = Array.from({ length: 30 }, (_, i) => {
    const juzNum = i + 1;
    const seed   = JUZ_SEED[juzNum] ?? {};
    const base: Record<string, any> = {
      juz_number: juzNum,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    const nonZeroSeed = stripZeroes(seed);
    return {
      ref: db.collection('juz_stats').doc(String(juzNum)),
      data: { ...base, ...nonZeroSeed },
      options: { merge: true } as admin.firestore.SetOptions,
    };
  });
  await commitInBatches(juzOps);
  console.log('  ✅ juz_stats complete\n');

  console.log('🎉 Seed complete!');
  console.log('\nNext: Fill in the SURAH_SEED / JUZ_SEED / GLOBAL_SEED objects with');
  console.log('real historical counts and re-run to populate data.');
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Seed failed:', err?.message ?? err);
    process.exit(1);
  });
