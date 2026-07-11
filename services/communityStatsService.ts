import firestore from '@react-native-firebase/firestore';
import { AppState, AppStateStatus } from 'react-native';

export interface GlobalStats {
  total_surahs_completed: number;
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
 * Fetch all stats with a single round-trip for each collection (3 reads total).
 * Uses in-memory caching.
 */
export async function fetchAllStats(forceRefresh = false): Promise<CommunityStatsData | null> {
  const cacheDuration = 3600 * 1000; // 1 hour cache TTL
  const now = Date.now();

  if (!forceRefresh && statsCache && (now - statsCache.timestamp < cacheDuration)) {
    if (__DEV__) console.log('[CommunityStatsService] Returning cached community stats.');
    return statsCache;
  }

  try {
    if (__DEV__) console.log('[CommunityStatsService] Fetching fresh community stats from Firestore...');
    
    // Perform reads safely with fallback defaults if individual docs/collections are uninitialized
    let globalData: GlobalStats = {
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
        if (data && data.surah_number) {
          surahsMap.set(data.surah_number, data);
        }
      });
    } else if (surahsRes.status === 'rejected' && __DEV__) {
      console.warn('[CommunityStatsService] Could not fetch surah_stats collection:', surahsRes.reason);
    }

    if (juzRes.status === 'fulfilled') {
      juzRes.value.forEach((doc) => {
        const data = doc.data() as JuzStat;
        if (data && data.juz_number) {
          juzMap.set(data.juz_number, data);
        }
      });
    } else if (juzRes.status === 'rejected' && __DEV__) {
      console.warn('[CommunityStatsService] Could not fetch juz_stats collection:', juzRes.reason);
    }

    if (badgesRes.status === 'fulfilled') {
      badgesRes.value.forEach((doc) => {
        const data = doc.data() as BadgeStat;
        if (data && data.badge_id) {
          badgesMap.set(data.badge_id, data);
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
            if (data && data.surah_number) surahsMap.set(data.surah_number, data);
          });
        }
        if (cachedJuz.status === 'fulfilled') {
          cachedJuz.value.forEach((doc) => {
            const data = doc.data() as JuzStat;
            if (data && data.juz_number) juzMap.set(data.juz_number, data);
          });
        }
      } catch (cacheErr) {
        if (__DEV__) console.warn('[CommunityStatsService] Local cache fallback failed:', cacheErr);
      }
    }

    statsCache = {
      global: globalData,
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
  } catch (error) {
    console.warn('[CommunityStatsService] Firestore batch commit failed:', error);
  }
}

export function incrementVerseMemorization(surahId: number, isMemorized: boolean) {
  if (surahId < 1 || surahId > 114) return;
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));

  batch.set(surahRef, {
    memorized_count: firestore.FieldValue.increment(isMemorized ? 1 : -1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
}

export function incrementVerseRevision(surahId: number, isRevised: boolean) {
  if (surahId < 1 || surahId > 114) return;
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));

  batch.set(surahRef, {
    revised_count: firestore.FieldValue.increment(isRevised ? 1 : -1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
}

export function incrementSurahCompletion(surahId: number) {
  if (surahId < 1 || surahId > 114) return;
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));
  const globalRef = firestore().collection('community_stats').doc('global');

  batch.set(surahRef, {
    completed_count: firestore.FieldValue.increment(1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(globalRef, {
    total_surahs_completed: firestore.FieldValue.increment(1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
}

export function incrementJuzCompletion(juzId: number) {
  if (juzId < 1 || juzId > 30) return;
  const batch = firestore().batch();
  const juzRef = firestore().collection('juz_stats').doc(String(juzId));
  const globalRef = firestore().collection('community_stats').doc('global');

  batch.set(juzRef, {
    completed_count: firestore.FieldValue.increment(1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(globalRef, {
    total_juz_completed: firestore.FieldValue.increment(1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
}

export function incrementFavourite(surahId: number, isAdded: boolean, verseNumber?: number) {
  if (surahId < 1 || surahId > 114) return;
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));
  const globalRef = firestore().collection('community_stats').doc('global');

  const surahUpdate: any = {
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
  }
}

export function incrementBookmark(surahId: number, isAdded: boolean, verseNumber?: number) {
  if (surahId < 1 || surahId > 114) return;
  const batch = firestore().batch();
  const surahRef = firestore().collection('surah_stats').doc(String(surahId));
  const globalRef = firestore().collection('community_stats').doc('global');

  const surahUpdate: any = {
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
  }
}

export function incrementJuzRevision(juzId: number, isRevised: boolean) {
  if (juzId < 1 || juzId > 30) return;
  const batch = firestore().batch();
  const juzRef = firestore().collection('juz_stats').doc(String(juzId));

  batch.set(juzRef, {
    revised_count: firestore.FieldValue.increment(isRevised ? 1 : -1),
    updated_at: firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  commitBatch(batch);
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
      audio_played_count: firestore.FieldValue.increment(1),
      updated_at: firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  commitBatch(batch);

  // Synchronously update local cache for instant UI feedback
  if (statsCache) {
    if (statsCache.global) {
      statsCache.global.total_audio_played = (statsCache.global.total_audio_played || 0) + 1;
    }
    if (surahId && surahId >= 1 && surahId <= 114 && statsCache.surahs.has(surahId)) {
      const s = statsCache.surahs.get(surahId)!;
      statsCache.surahs.set(surahId, { ...s, audio_played_count: (s.audio_played_count || 0) + 1 });
    }
  }
}
