import firestore from '@react-native-firebase/firestore';
import { AppState, AppStateStatus } from 'react-native';
import { surahsData } from '@/data/surahs';
import { getJuzSurahsList } from '@/constants/quranMeta';

// Local lookup helper — pure data, no network
function getSurahName(surahId: number): string {
  return surahsData.find(s => s.id === surahId)?.name ?? `Surah ${surahId}`;
}


export interface GlobalStats {
  total_verses_memorized: number;  // ← aggregate of all surah memorized_counts
  total_surahs_completed: number;
  total_surahs_memorized?: number;
  total_juz_completed: number;
  total_favourites: number;
  total_bookmarks: number;
  total_hafidh_completions: number;
  total_quizzes_ai: number;
  total_quizzes_manual: number;
  total_audio_played: number;
  updated_at?: any;
}

export interface BadgeStat {
  badge_id: string;
  unlock_count: number;
  updated_at?: any;
}

export interface SurahStat {
  surah_number: number;
  surah_name: string;
  memorized_count: number;
  revised_count: number;
  completed_count: number;
  favourite_count: number;
  bookmark_count: number;
  audio_played_count: number;
  verse_favourites?: Record<number, number>;
  verse_bookmarks?: Record<number, number>;
  updated_at?: any;
}

export interface JuzStat {
  juz_number: number;
  completed_count: number;
  revised_count: number;
  updated_at?: any;
}

export interface CommunityStatsData {
  global: GlobalStats;
  surahs: Map<number, SurahStat>;
  juz: Map<number, JuzStat>;
  badges: Map<string, BadgeStat>;
  timestamp: number; // local client cache timestamp
}

// Module-level in-memory cache
let statsCache: CommunityStatsData | null = null;
let lastBackgroundTime = 0;

// Listen to AppState to clear cache if app was backgrounded for > 1 hour
AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
  if (nextAppState === 'background') {
    lastBackgroundTime = Date.now();
  } else if (nextAppState === 'active') {
    if (lastBackgroundTime > 0 && Date.now() - lastBackgroundTime > 3600 * 1000) {
      // Backgrounded > 1 hour, clear cache
      statsCache = null;
      if (__DEV__) console.log('[CommunityStatsService] Cache invalidated due to app background duration.');
    }
  }
});

/**
 * Real-time listener for the Global Ummah stats card.
/**
 * Clamps all global numeric counters so they can never be negative (< 0).
 */
export function clampGlobalStats(data: Partial<GlobalStats> = {}): GlobalStats {
  return {
    total_verses_memorized: Math.max(0, data.total_verses_memorized ?? 0),
    total_surahs_completed: Math.max(0, data.total_surahs_completed ?? 0),
    total_surahs_memorized: Math.max(0, data.total_surahs_memorized ?? 0),
    total_juz_completed: Math.max(0, data.total_juz_completed ?? 0),
    total_favourites: Math.max(0, data.total_favourites ?? 0),
    total_bookmarks: Math.max(0, data.total_bookmarks ?? 0),
    total_hafidh_completions: Math.max(0, data.total_hafidh_completions ?? 0),
    total_quizzes_ai: Math.max(0, data.total_quizzes_ai ?? 0),
    total_quizzes_manual: Math.max(0, data.total_quizzes_manual ?? 0),
    total_audio_played: Math.max(0, data.total_audio_played ?? 0),
    updated_at: data.updated_at,
  };
}

/**
 * Subscribe to real-time updates for global stats.
 * Lightweight (1 document read per connection + 1 per update) safe for Firebase Spark Plan.
 */
export function subscribeToGlobalStats(callback: (globalStats: GlobalStats) => void): () => void {
  const docRef = firestore().collection('community_stats').doc('global');
  return docRef.onSnapshot(
    (docSnapshot) => {
      if (typeof docSnapshot.exists === 'function' ? docSnapshot.exists() : docSnapshot.exists) {
        const data = clampGlobalStats(docSnapshot.data() as GlobalStats);
        if (statsCache && statsCache.global) {
          statsCache.global = { ...statsCache.global, ...data };
        }
        callback(data);
      }
    },
    (err) => {
      if (__DEV__) console.warn('[CommunityStatsService] subscribeToGlobalStats error:', err);
    }
  );
}

/**
 * Fetch all stats with a single round-trip for each collection (3 reads total).
 * Uses in-memory caching.
 */
export async function fetchAllStats(forceRefresh = false): Promise<CommunityStatsData | null> {
  const cacheDuration = 5 * 60 * 1000; // 5 minute cache TTL — keeps data fresh after actions
  const now = Date.now();

  if (!forceRefresh && statsCache && (now - statsCache.timestamp < cacheDuration)) {
    if (__DEV__) console.log('[CommunityStatsService] Returning cached community stats.');
    return statsCache;
  }

  try {
    if (__DEV__) console.log('[CommunityStatsService] Fetching fresh community stats from Firestore...');
    
    // Perform reads safely with fallback defaults if individual docs/collections are uninitialized
    let globalData: GlobalStats = {
      total_verses_memorized: 0,
      total_surahs_completed: 0,
      total_juz_completed: 0,
      total_favourites: 0,
      total_bookmarks: 0,
      total_hafidh_completions: 0,
      total_quizzes_ai: 0,
      total_quizzes_manual: 0,
      total_audio_played: 0,
    };
    const surahsMap = new Map<number, SurahStat>();
    const juzMap = new Map<number, JuzStat>();
    const badgesMap = new Map<string, BadgeStat>();

    const [globalRes, surahsRes, juzRes, badgesRes] = await Promise.allSettled([
      firestore().collection('community_stats').doc('global').get(),
      firestore().collection('surah_stats').get(),
      firestore().collection('juz_stats').get(),
      firestore().collection('badge_stats').get(),
    ]);

    if (globalRes.status === 'fulfilled' && (typeof globalRes.value.exists === 'function' ? globalRes.value.exists() : globalRes.value.exists)) {
      globalData = { ...globalData, ...(globalRes.value.data() as GlobalStats) };
    } else if (globalRes.status === 'rejected' && __DEV__) {
      console.warn('[CommunityStatsService] Could not fetch global stats doc:', globalRes.reason);
    }

    if (surahsRes.status === 'fulfilled') {
      surahsRes.value.forEach((doc) => {
        const data = doc.data() as SurahStat;
        const surahId = data?.surah_number || parseInt(doc.id, 10);
        if (surahId >= 1 && surahId <= 114) {
          surahsMap.set(surahId, {
            ...data,
            surah_number: surahId,
            surah_name: data?.surah_name || getSurahName(surahId)
          });
        }
      });
    } else if (surahsRes.status === 'rejected' && __DEV__) {
      console.warn('[CommunityStatsService] Could not fetch surah_stats collection:', surahsRes.reason);
    }

    if (juzRes.status === 'fulfilled') {
      juzRes.value.forEach((doc) => {
        const data = doc.data() as JuzStat;
        const juzId = data?.juz_number || parseInt(doc.id, 10);
        if (juzId >= 1 && juzId <= 30) {
          juzMap.set(juzId, {
            ...data,
            juz_number: juzId
          });
        }
      });
    } else if (juzRes.status === 'rejected' && __DEV__) {
      console.warn('[CommunityStatsService] Could not fetch juz_stats collection:', juzRes.reason);
    }

    if (badgesRes.status === 'fulfilled') {
      badgesRes.value.forEach((doc) => {
        const data = doc.data() as BadgeStat;
        const badgeId = data?.badge_id || doc.id;
        if (badgeId) {
          badgesMap.set(badgeId, {
            ...data,
            badge_id: badgeId
          });
        }
      });
    } else if (badgesRes.status === 'rejected' && __DEV__) {
      console.warn('[CommunityStatsService] Could not fetch badge_stats collection:', badgesRes.reason);
    }

    // If all three network requests completely rejected, attempt local client cache lookup before falling back
    if (globalRes.status === 'rejected' && surahsRes.status === 'rejected' && juzRes.status === 'rejected') {
      if (statsCache) return statsCache;
      try {
        const [cachedGlobal, cachedSurahs, cachedJuz] = await Promise.allSettled([
          firestore().collection('community_stats').doc('global').get({ source: 'cache' }),
          firestore().collection('surah_stats').get({ source: 'cache' }),
          firestore().collection('juz_stats').get({ source: 'cache' }),
        ]);
        if (cachedGlobal.status === 'fulfilled' && (typeof cachedGlobal.value.exists === 'function' ? cachedGlobal.value.exists() : cachedGlobal.value.exists)) {
          globalData = { ...globalData, ...(cachedGlobal.value.data() as GlobalStats) };
        }
        if (cachedSurahs.status === 'fulfilled') {
          cachedSurahs.value.forEach((doc) => {
            const data = doc.data() as SurahStat;
            const surahId = data?.surah_number || parseInt(doc.id, 10);
            if (surahId >= 1 && surahId <= 114) {
              surahsMap.set(surahId, {
                ...data,
                surah_number: surahId,
                surah_name: data?.surah_name || getSurahName(surahId)
              });
            }
          });
        }
        if (cachedJuz.status === 'fulfilled') {
          cachedJuz.value.forEach((doc) => {
            const data = doc.data() as JuzStat;
            const juzId = data?.juz_number || parseInt(doc.id, 10);
            if (juzId >= 1 && juzId <= 30) {
              juzMap.set(juzId, {
                ...data,
                juz_number: juzId
              });
            }
          });
        }
      } catch (cacheErr) {
        if (__DEV__) console.warn('[CommunityStatsService] Local cache fallback failed:', cacheErr);
      }
    }

    // Ensure all 114 surahs and 30 juzes exist in the maps (even if no document exists in Firestore yet)
    for (let i = 1; i <= 114; i++) {
      if (!surahsMap.has(i)) {
        surahsMap.set(i, {
          surah_number: i,
          surah_name: getSurahName(i),
          memorized_count: 0,
          completed_count: 0,
          favourite_count: 0,
          bookmark_count: 0,
          revised_count: 0,
          audio_played_count: 0,
        });
      }
    }
    for (let i = 1; i <= 30; i++) {
      if (!juzMap.has(i)) {
        juzMap.set(i, {
          juz_number: i,
          completed_count: 0,
          revised_count: 0,
        });
      }
    }

    // Aggregate in-memory totals cleanly from surahs collection for accurate UI display
    // STRICTLY READ-ONLY: No Firestore writes or reset calls are ever performed inside fetchAllStats.
    if (surahsMap.size > 0 || juzMap.size > 0) {
      const calculatedSurahsMemorized = Array.from(surahsMap.values())
        .reduce((sum, s) => sum + (s.memorized_count ?? s.completed_count ?? 0), 0);

      const calculatedVersesMemorized = Array.from(surahsMap.values())
        .reduce((sum, s) => {
          const count = s.memorized_count ?? s.completed_count ?? 0;
          const versesInSurah = surahsData.find(sd => sd.id === s.surah_number)?.versesCount || 0;
          return sum + (count * versesInSurah);
        }, 0);

      const calculatedJuzCompleted = Array.from(juzMap.values())
        .reduce((sum, j) => sum + (j.completed_count ?? 0), 0);

      if (calculatedSurahsMemorized > 0 || calculatedJuzCompleted > 0) {
        globalData.total_surahs_memorized = calculatedSurahsMemorized;
        globalData.total_surahs_completed = calculatedSurahsMemorized;
        globalData.total_verses_memorized = calculatedVersesMemorized;
        globalData.total_juz_completed = calculatedJuzCompleted;
      }
    }

    // Clamp all individual surah and juz values so they never go negative
    surahsMap.forEach((s, key) => {
      surahsMap.set(key, {
        ...s,
        memorized_count: Math.max(0, s.memorized_count ?? 0),
        completed_count: Math.max(0, s.completed_count ?? 0),
        favourite_count: Math.max(0, s.favourite_count ?? 0),
        bookmark_count: Math.max(0, s.bookmark_count ?? 0),
        revised_count: Math.max(0, s.revised_count ?? 0),
        audio_played_count: Math.max(0, s.audio_played_count ?? 0),
      });
    });
    juzMap.forEach((j, key) => {
      juzMap.set(key, {
        ...j,
        completed_count: Math.max(0, j.completed_count ?? 0),
        revised_count: Math.max(0, j.revised_count ?? 0),
      });
    });

    statsCache = {
      global: clampGlobalStats(globalData),
      surahs: surahsMap,
      juz: juzMap,
      badges: badgesMap,
      timestamp: now,
    };

    return statsCache;
  } catch (error) {
    // Always log fetch failures — these are silent in production otherwise
    console.warn('[CommunityStatsService] Error fetching community stats:', error);
    // Return cached value if available during offline/error state, otherwise return safe defaults instead of null
    if (!statsCache) {
      statsCache = {
        global: {
          total_verses_memorized: 0,
          total_surahs_completed: 0,
          total_juz_completed: 0,
          total_favourites: 0,
          total_bookmarks: 0,
          total_hafidh_completions: 0,
          total_quizzes_ai: 0,
          total_quizzes_manual: 0,
          total_audio_played: 0,
        },
        surahs: new Map(),
        juz: new Map(),
        badges: new Map(),
        timestamp: Date.now(),
      };
    }
    return statsCache;
  }
}

/**
 * Hook to get Cached Surah stats. Helps with inline list rendering.
 */
export function getCachedSurahStats(): Map<number, SurahStat> | null {
  return statsCache ? statsCache.surahs : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Firestore Writes (Direct from Client, Fire-and-Forget, Batched)
// Note: Trade-off - Client could theoretically manipulate values, accepted.
// ─────────────────────────────────────────────────────────────────────────────

/** Helper to wrap batch commits — always logs errors regardless of build mode */
async function commitBatch(batch: ReturnType<typeof firestore>['batch'] extends () => infer R ? R : any) {
  try {
    await batch.commit();
    if (__DEV__) console.log('[CommunityStatsService] ✅ Firestore batch committed successfully');
  } catch (error) {
    console.error('[CommunityStatsService] ❌ CRITICAL FIRESTORE BATCH COMMIT FAILED:', error);
  }
}

export function incrementVerseMemorization(surahId: number, isMemorized: boolean) {
  if (surahId < 1 || surahId > 114) return;
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));
  const globalRef = firestore().collection('community_stats').doc('global');

  // FIX: surah_number + surah_name must be written so read-side guard doesn't drop the doc
  // Note: memorized_count on surah_stats now tracks Full Surah Completions (not individual verses)
  batch.set(surahRef, {
    surah_number: surahId,
    surah_name: getSurahName(surahId),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Track total verses memorized globally across all community members
  batch.set(globalRef, {
    total_verses_memorized: firestore.FieldValue.increment(isMemorized ? 1 : -1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
  statsCache = null; // Bust cache so next open reflects this write immediately
}

export function incrementVerseRevision(surahId: number, isRevised: boolean) {
  if (surahId < 1 || surahId > 114) return;
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));

  // FIX: surah_number + surah_name must be written so read-side guard doesn't drop the doc
  batch.set(surahRef, {
    surah_number: surahId,
    surah_name: getSurahName(surahId),
    revised_count: firestore.FieldValue.increment(isRevised ? 1 : -1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
  statsCache = null;
}

/**
 * Called after any BULK verse memorization (Juz or Surah level) since isBulkOperation
 * suppresses per-verse incrementVerseMemorization calls.
 * Pass the NET verse count delta (positive = marking, negative = unmarking).
 */
export function incrementBulkVersesMemorized(count: number, isMarking: boolean) {
  if (count <= 0) return;
  // Guard against negative decrement if global counter is already 0
  if (!isMarking && statsCache?.global && (statsCache.global.total_verses_memorized || 0) <= 0) {
    if (__DEV__) console.log('[CommunityStatsService] Skipping verse decrement — global count is already 0.');
    return;
  }
  const batch = firestore().batch();
  const globalRef = firestore().collection('community_stats').doc('global');

  batch.set(globalRef, {
    total_verses_memorized: firestore.FieldValue.increment(isMarking ? count : -count),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
  statsCache = null;
}

export function incrementSurahCompletion(surahId: number, isCompleted = true) {
  if (surahId < 1 || surahId > 114) return;
  if (!isCompleted && statsCache?.surahs && (statsCache.surahs.get(surahId)?.completed_count || 0) <= 0) {
    if (__DEV__) console.log('[CommunityStatsService] Skipping surah decrement — surah count is already 0.');
    return;
  }
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));
  const globalRef = firestore().collection('community_stats').doc('global');

  const delta = isCompleted ? 1 : -1;

  // FIX: include surah_number + surah_name so read-side guard doesn't drop the doc
  // Both memorized_count and completed_count increment by +1/-1 for every full Surah memorized
  batch.set(surahRef, {
    surah_number: surahId,
    surah_name: getSurahName(surahId),
    memorized_count: firestore.FieldValue.increment(delta),
    completed_count: firestore.FieldValue.increment(delta),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  if (isCompleted || !statsCache?.global || (statsCache.global.total_surahs_completed || 0) > 0) {
    batch.set(globalRef, {
      total_surahs_completed: firestore.FieldValue.increment(delta),
      total_surahs_memorized: firestore.FieldValue.increment(delta),
      updated_at: firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  commitBatch(batch);
  statsCache = null;
}

export function incrementJuzCompletion(juzId: number, isCompleted = true) {
  if (juzId < 1 || juzId > 30) return;
  if (!isCompleted && statsCache?.juz && (statsCache.juz.get(juzId)?.completed_count || 0) <= 0) {
    if (__DEV__) console.log('[CommunityStatsService] Skipping juz decrement — juz count is already 0.');
    return;
  }
  const batch = firestore().batch();
  const juzRef = firestore().collection('juz_stats').doc(String(juzId));
  const globalRef = firestore().collection('community_stats').doc('global');

  const delta = isCompleted ? 1 : -1;

  // Update juz stats only — never double-count surahs here because surah completions are tracked separately
  batch.set(juzRef, {
    juz_number: juzId,
    completed_count: firestore.FieldValue.increment(delta),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  if (isCompleted || !statsCache?.global || (statsCache.global.total_juz_completed || 0) > 0) {
    batch.set(globalRef, {
      total_juz_completed: firestore.FieldValue.increment(delta),
      updated_at: firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  commitBatch(batch);
  statsCache = null;
}

/**
 * Batched sync for exact surah and juz completions/uncompletions during bulk Operations
 * Guarantees zero double counting and exactly one network batch request.
 */
export function syncMemorizationStats(
  completedSurahIds: number[],
  uncompletedSurahIds: number[],
  completedJuzIds: number[],
  uncompletedJuzIds: number[]
) {
  const batch = firestore().batch();
  const globalRef = firestore().collection('community_stats').doc('global');
  let surahDelta = 0;
  let juzDelta = 0;
  let hasUpdates = false;

  // Process completed surahs (+1)
  completedSurahIds.forEach(surahId => {
    if (surahId >= 1 && surahId <= 114) {
      surahDelta += 1;
      hasUpdates = true;
      const surahRef = firestore().collection('surah_stats').doc(String(surahId));
      batch.set(surahRef, {
        surah_number: surahId,
        surah_name: getSurahName(surahId),
        memorized_count: firestore.FieldValue.increment(1),
        completed_count: firestore.FieldValue.increment(1),
        updated_at: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  // Process uncompleted surahs (-1)
  uncompletedSurahIds.forEach(surahId => {
    if (surahId >= 1 && surahId <= 114) {
      if (statsCache?.surahs && (statsCache.surahs.get(surahId)?.completed_count || 0) <= 0) {
        if (__DEV__) console.log(`[CommunityStatsService] Skipping unmark decrement for surah ${surahId} — count is 0.`);
        return;
      }
      surahDelta -= 1;
      hasUpdates = true;
      const surahRef = firestore().collection('surah_stats').doc(String(surahId));
      batch.set(surahRef, {
        surah_number: surahId,
        surah_name: getSurahName(surahId),
        memorized_count: firestore.FieldValue.increment(-1),
        completed_count: firestore.FieldValue.increment(-1),
        updated_at: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  // Process completed juzes (+1)
  completedJuzIds.forEach(juzId => {
    if (juzId >= 1 && juzId <= 30) {
      juzDelta += 1;
      hasUpdates = true;
      const juzRef = firestore().collection('juz_stats').doc(String(juzId));
      batch.set(juzRef, {
        juz_number: juzId,
        completed_count: firestore.FieldValue.increment(1),
        updated_at: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  // Process uncompleted juzes (-1)
  uncompletedJuzIds.forEach(juzId => {
    if (juzId >= 1 && juzId <= 30) {
      if (statsCache?.juz && (statsCache.juz.get(juzId)?.completed_count || 0) <= 0) {
        if (__DEV__) console.log(`[CommunityStatsService] Skipping unmark decrement for juz ${juzId} — count is 0.`);
        return;
      }
      juzDelta -= 1;
      hasUpdates = true;
      const juzRef = firestore().collection('juz_stats').doc(String(juzId));
      batch.set(juzRef, {
        juz_number: juzId,
        completed_count: firestore.FieldValue.increment(-1),
        updated_at: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  if (!hasUpdates) return;

  const globalUpdate: any = { updated_at: firestore.FieldValue.serverTimestamp() };
  if (surahDelta !== 0) {
    // Prevent decreasing global surah counters if already 0
    if (surahDelta > 0 || !statsCache?.global || (statsCache.global.total_surahs_completed || 0) > 0) {
      globalUpdate.total_surahs_completed = firestore.FieldValue.increment(surahDelta);
      globalUpdate.total_surahs_memorized = firestore.FieldValue.increment(surahDelta);
    }
  }
  if (juzDelta !== 0) {
    if (juzDelta > 0 || !statsCache?.global || (statsCache.global.total_juz_completed || 0) > 0) {
      globalUpdate.total_juz_completed = firestore.FieldValue.increment(juzDelta);
    }
  }

  batch.set(globalRef, globalUpdate, { merge: true });
  commitBatch(batch);
  statsCache = null;
}

export function incrementFavourite(surahId: number, isAdded: boolean, verseNumber?: number) {
  if (surahId < 1 || surahId > 114) return;
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));
  const globalRef = firestore().collection('community_stats').doc('global');

  const surahUpdate: any = {
    surah_number: surahId,
    surah_name: getSurahName(surahId),
    favourite_count: firestore.FieldValue.increment(isAdded ? 1 : -1),
    updated_at: firestore.FieldValue.serverTimestamp()
  };
  if (verseNumber && verseNumber > 0) {
    surahUpdate[`verse_favourites.${verseNumber}`] = firestore.FieldValue.increment(isAdded ? 1 : -1);
  }

  batch.set(surahRef, surahUpdate, { merge: true });

  batch.set(globalRef, {
    total_favourites: firestore.FieldValue.increment(isAdded ? 1 : -1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);

  // Synchronously update local cache for instant UI feedback
  if (statsCache && statsCache.surahs.has(surahId)) {
    const s = statsCache.surahs.get(surahId)!;
    const oldFavCount = s.favourite_count || 0;
    const newFavCount = Math.max(0, oldFavCount + (isAdded ? 1 : -1));
    const newVerseFavs = { ...(s.verse_favourites || {}) };
    if (verseNumber && verseNumber > 0) {
      const oldVF = newVerseFavs[verseNumber] || 0;
      newVerseFavs[verseNumber] = Math.max(0, oldVF + (isAdded ? 1 : -1));
    }
    statsCache.surahs.set(surahId, { ...s, favourite_count: newFavCount, verse_favourites: newVerseFavs });
    if (statsCache.global) {
      statsCache.global.total_favourites = Math.max(0, (statsCache.global.total_favourites || 0) + (isAdded ? 1 : -1));
    }
  } else {
    statsCache = null;
  }
}

export function incrementBookmark(surahId: number, isAdded: boolean, verseNumber?: number) {
  if (surahId < 1 || surahId > 114) return;
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));
  const globalRef = firestore().collection('community_stats').doc('global');

  const surahUpdate: any = {
    surah_number: surahId,
    surah_name: getSurahName(surahId),
    bookmark_count: firestore.FieldValue.increment(isAdded ? 1 : -1),
    updated_at: firestore.FieldValue.serverTimestamp()
  };
  if (verseNumber && verseNumber > 0) {
    surahUpdate[`verse_bookmarks.${verseNumber}`] = firestore.FieldValue.increment(isAdded ? 1 : -1);
  }

  batch.set(surahRef, surahUpdate, { merge: true });

  batch.set(globalRef, {
    total_bookmarks: firestore.FieldValue.increment(isAdded ? 1 : -1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);

  // Synchronously update local cache for instant UI feedback
  if (statsCache && statsCache.surahs.has(surahId)) {
    const s = statsCache.surahs.get(surahId)!;
    const oldBkmCount = s.bookmark_count || 0;
    const newBkmCount = Math.max(0, oldBkmCount + (isAdded ? 1 : -1));
    const newVerseBkms = { ...(s.verse_bookmarks || {}) };
    if (verseNumber && verseNumber > 0) {
      const oldVB = newVerseBkms[verseNumber] || 0;
      newVerseBkms[verseNumber] = Math.max(0, oldVB + (isAdded ? 1 : -1));
    }
    statsCache.surahs.set(surahId, { ...s, bookmark_count: newBkmCount, verse_bookmarks: newVerseBkms });
    if (statsCache.global) {
      statsCache.global.total_bookmarks = Math.max(0, (statsCache.global.total_bookmarks || 0) + (isAdded ? 1 : -1));
    }
  } else {
    statsCache = null;
  }
}

export function incrementJuzRevision(juzId: number, isRevised: boolean) {
  if (juzId < 1 || juzId > 30) return;
  const batch = firestore().batch();
  const juzRef = firestore().collection('juz_stats').doc(String(juzId));
  const delta = isRevised ? 1 : -1;
  const surahsInJuz = getJuzSurahsList(juzId);

  // FIX: include juz_number so read-side guard doesn't drop the doc
  batch.set(juzRef, {
    juz_number: juzId,
    revised_count: firestore.FieldValue.increment(delta),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Update every surah belonging to this Juz because revising a Juz means all its Surahs are revised
  surahsInJuz.forEach(surahId => {
    const surahRef = firestore().collection('surah_stats').doc(String(surahId));
    batch.set(surahRef, {
      surah_number: surahId,
      surah_name: getSurahName(surahId),
      revised_count: firestore.FieldValue.increment(delta),
      updated_at: firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  commitBatch(batch);
  statsCache = null;
}

export function incrementHafidhCompletion() {
  const batch = firestore().batch();
  const globalRef = firestore().collection('community_stats').doc('global');
  const badgeRef = firestore().collection('badge_stats').doc('hafidh-quran');

  batch.set(globalRef, {
    total_hafidh_completions: firestore.FieldValue.increment(1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(badgeRef, {
    badge_id: 'hafidh-quran',
    unlock_count: firestore.FieldValue.increment(1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
}

export function incrementQuizCompletion(isAiMode: boolean) {
  const batch = firestore().batch();
  const globalRef = firestore().collection('community_stats').doc('global');

  batch.set(globalRef, {
    [isAiMode ? 'total_quizzes_ai' : 'total_quizzes_manual']: firestore.FieldValue.increment(1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
  if (statsCache && statsCache.global) {
    if (isAiMode) {
      statsCache.global.total_quizzes_ai = (statsCache.global.total_quizzes_ai || 0) + 1;
    } else {
      statsCache.global.total_quizzes_manual = (statsCache.global.total_quizzes_manual || 0) + 1;
    }
  } else {
    statsCache = null;
  }
}

export function incrementBadgeUnlock(badgeId: string) {
  if (!badgeId) return;
  if (badgeId === 'hafidh-quran') {
    incrementHafidhCompletion();
    return;
  }
  const batch = firestore().batch();
  const badgeRef = firestore().collection('badge_stats').doc(badgeId);

  batch.set(badgeRef, {
    badge_id: badgeId,
    unlock_count: firestore.FieldValue.increment(1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
}

export function incrementAudioPlayed(surahId?: number) {
  const batch = firestore().batch();
  const globalRef = firestore().collection('community_stats').doc('global');

  const globalUpdate: any = {
    total_audio_played: firestore.FieldValue.increment(1),
    updated_at: firestore.FieldValue.serverTimestamp()
  };
  batch.set(globalRef, globalUpdate, { merge: true });

  if (surahId && surahId >= 1 && surahId <= 114) {
    const surahRef = firestore().collection('surah_stats').doc(String(surahId));
    batch.set(surahRef, {
      surah_number: surahId,
      surah_name: getSurahName(surahId),
      audio_played_count: firestore.FieldValue.increment(1),
      updated_at: firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  commitBatch(batch);

  // Synchronously update local cache for instant UI feedback
  if (statsCache && surahId && surahId >= 1 && surahId <= 114 && statsCache.surahs.has(surahId)) {
    if (statsCache.global) {
      statsCache.global.total_audio_played = (statsCache.global.total_audio_played || 0) + 1;
    }
    const s = statsCache.surahs.get(surahId)!;
    statsCache.surahs.set(surahId, { ...s, audio_played_count: (s.audio_played_count || 0) + 1 });
  } else {
    statsCache = null;
  }
}

