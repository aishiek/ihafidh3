import analytics from '@react-native-firebase/analytics';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Probe whether native analytics module is usable. If not, we silently disable analytics.
let analyticsAvailable = true;
try {
  const _a = (() => { try { return analytics(); } catch (e) { return null; } })();
  if (!_a || typeof (_a as any).logEvent !== 'function') analyticsAvailable = false;
} catch (e) {
  analyticsAvailable = false;
}

/**
 * Safely log analytics event with error handling
 * Non-blocking: Uses setImmediate to prevent blocking UI/audio threads
 */
export async function logAnalyticsEvent(
  eventName: string,
  params?: Record<string, any>
): Promise<void> {
  // Dispatch asynchronously to prevent blocking critical operations (audio, UI)
  setImmediate(async () => {
    try {
      if (!analyticsAvailable) return;
      let a: any;
      try {
        a = analytics();
      } catch (e) {
        analyticsAvailable = false;
        if (__DEV__) console.debug('[Analytics] native factory threw, disabling analytics', e);
        return;
      }

      // Strip nulls/undefined to prevent native crashes/drops
      const cleanParams = params ? Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== null && v !== undefined)
      ) : {};

      try {
        await a.logEvent(eventName, cleanParams);
        if (__DEV__) console.debug(`[Analytics] ${eventName}:`, cleanParams);
      } catch (e) {
        analyticsAvailable = false;
        if (__DEV__) console.debug('[Analytics] native logEvent failed, disabling analytics', e);
      }
    } catch (error) {
      if (__DEV__) console.debug('[Analytics] unexpected error in logAnalyticsEvent', error);
    }
  });
}

/**
 * Log screen view with error handling.
 * Uses the non-deprecated modular `logScreenView` API.
 * IMPORTANT: Must NOT be wrapped in setImmediate — Firebase needs the screen_name
 * to be set synchronously relative to the navigation event to win the race against
 * the native automatic screen reporter (which we've also disabled via firebase.json).
 */
export async function logScreenView(
  screenName: string,
  screenClass?: string
): Promise<void> {
  try {
    if (!analyticsAvailable) return;
    const resolvedClass = screenClass || screenName;

    let a: ReturnType<typeof analytics>;
    try {
      a = analytics();
    } catch (e) {
      analyticsAvailable = false;
      if (__DEV__) console.debug('[Analytics] native factory threw (screen_view)', e);
      return;
    }

    // We use logEvent('screen_view', ...) instead of logScreenView(...) so we can
    // attach the app_version parameter (requested by the user).
    // Native automatic screen tracking is disabled in app.json via meta-data/infoPlist.
    await a.logEvent('screen_view', {
      screen_name: screenName,
      screen_class: resolvedClass,
      app_version: Constants.expoConfig?.version || 'unknown',
    });

    if (__DEV__) console.debug(`[Analytics] ✅ screen_view logged: ${screenName}`);
  } catch (e) {
    // Analytics must never crash the app
    if (__DEV__) console.debug('[Analytics] logScreenView failed', e);
  }
}

/**
 * CONSOLIDATED AUDIO EVENT
 * Tracks all audio playback (verse, surah, page) in single event
 * Prevents audio state complexity and ensures no blocking
 */
export async function logAudioPlayback(params: {
  action: 'play' | 'pause' | 'resume' | 'stop';
  audio_type: 'verse' | 'surah' | 'page'; // Distinguish audio source
  surah_number?: number;   // 1-114 consistent with app-wide indexing
  surah_name?: string;     // Human-readable: e.g. "Al-Fatihah"
  verse_number?: number;
  page_index?: number;
  reciter?: string;        // e.g. "ar.alafasy"
  playback_speed?: number | string;
  duration_played_seconds?: number;
  source_screen?: string;
  repeat_count?: number;
  infinite_loop?: boolean;
  source?: string;
}): Promise<void> {
  setImmediate(async () => {
    try {
      if (!analyticsAvailable) return;
      let a: any;
      try { a = analytics(); } catch (e) { analyticsAvailable = false; if (__DEV__) console.debug('[Analytics] native factory threw (audio_playback)', e); return; }
      try {
        // Null strip happens inside logAnalyticsEvent, using it directly logic
        const cleanParams = Object.fromEntries(
          Object.entries(params).filter(([_, v]) => v !== null && v !== undefined)
        );
        await a.logEvent('audio_playback', cleanParams);
        if (__DEV__) console.debug('[Analytics] audio_playback:', cleanParams);
      } catch (e) { analyticsAvailable = false; if (__DEV__) console.debug('[Analytics] native logEvent failed (audio_playback)', e); }
    } catch (error) {
      if (__DEV__) console.debug('[Analytics] unexpected error in logAudioPlayback', error);
    }
  });
}

/**
 * Set user properties for segmentation
 */
export async function setUserProperties(properties: Record<string, string>): Promise<void> {
  setImmediate(async () => {
    try {
      if (!analyticsAvailable) return;
      let a: any;
      try { a = analytics(); } catch (e) { analyticsAvailable = false; if (__DEV__) console.debug('[Analytics] native factory threw (setUserProperties)', e); return; }
      for (const [key, value] of Object.entries(properties)) {
        try {
          // Rename keys if too long (Firebase limit 24 chars)
          const cleanKey = key.substring(0, 24);
          if (typeof (a as any).setUserProperty === 'function') {
            await (a as any).setUserProperty(cleanKey, value as any);
          } else if (typeof (a as any).setUserProperties === 'function') {
            await (a as any).setUserProperties({ [cleanKey]: value });
          } else {
            await a.logEvent('user_property', { property: cleanKey, value });
          }
        } catch (e) {
          analyticsAvailable = false;
          if (__DEV__) console.debug('[Analytics] native setUserProperty failed, disabling analytics', e);
          break;
        }
      }

      if (__DEV__) console.debug('[Analytics] User properties set:', properties);
    } catch (error) {
      if (__DEV__) console.debug('[Analytics] unexpected error in setUserProperties', error);
    }
  });
}

/**
 * Track user ID (for cross-device analytics)
 * Optional: Use if you have authenticated user system
 */
export async function setUserId(userId: string): Promise<void> {
  setImmediate(async () => {
    try {
      if (!analyticsAvailable) return;
      let a: any;
      try { a = analytics(); } catch (e) { analyticsAvailable = false; if (__DEV__) console.debug('[Analytics] native factory threw (setUserId)', e); return; }
      try {
        if (typeof (a as any).setUserId === 'function') await (a as any).setUserId(userId);
        else await a.logEvent('set_user_id', { userId });
        if (__DEV__) console.debug('[Analytics] User ID set:', userId);
      } catch (e) { analyticsAvailable = false; if (__DEV__) console.debug('[Analytics] native setUserId failed, disabling analytics', e); }
    } catch (error) {
      if (__DEV__) console.debug('[Analytics] unexpected error in setUserId', error);
    }
  });
}

/**
 * Sync user-level properties (heavy computation)
 * Should be called periodically or on app startup rather than per-event
 */
export async function syncFirebaseUserProperties(): Promise<void> {
  setImmediate(async () => {
    try {
      const { useProgressStore } = require('@/store/progressStore');
      const { useBookmarkStore } = require('@/store/bookmarkStore');
      const { useFavouriteStore } = require('@/store/favouriteStore');
      const { useBadgeStore } = require('@/store/badgeStore');
      const { useSettingsStore } = require('@/store/settingsStore');
      const { QuranProgressTracker } = require('@/data/quranProgress');
      const { surahsData } = require('@/data/surahs');

      const progressState = useProgressStore.getState();
      const bookmarkState = useBookmarkStore.getState();
      const favouriteState = useFavouriteStore.getState();
      const badgeState = useBadgeStore.getState();
      const settingsState = useSettingsStore.getState();

      const memorizedVerseIds = progressState.memorizedVerses || [];
      
      // O(1) Precomputed map for overallVerseId -> surah information
      const verseSurahMap: Record<number, { surahId: number; verseNum: number }> = {};
      const surahMap: Record<number, any> = {};
      let startId = 0;
      for (const s of surahsData) {
        surahMap[s.id] = s;
        for (let v = 1; v <= s.versesCount; v++) {
          verseSurahMap[startId + v] = { surahId: s.id, verseNum: v };
        }
        startId += s.versesCount;
      }

      const memorizedVersesFormatted = memorizedVerseIds.map((vId: number) => {
        const info = verseSurahMap[vId];
        return info ? `${info.surahId}:${info.verseNum}` : '';
      }).filter(Boolean);

      const tracker = new QuranProgressTracker({
        memorizedSurahs: [],
        memorizedJuz: [],
        memorizedVerses: memorizedVersesFormatted,
        memorizedVerseIds: memorizedVerseIds
      });
      const stats = tracker.calculateProgress();

      // Optimize Mustahabbah count using the map
      const mustahabbahRaw = [36, 32, 73, 18, 55, 67, 56, 62, 76];
      let mustahabbahCompleted = 0;
      
      // Count verses per Surah in memorized set
      const memorizedCountsBySurah: Record<number, number> = {};
      for (const vId of memorizedVerseIds) {
        const info = verseSurahMap[vId];
        if (info) {
          memorizedCountsBySurah[info.surahId] = (memorizedCountsBySurah[info.surahId] || 0) + 1;
        }
      }

      mustahabbahRaw.forEach(id => {
        const surah = surahMap[id];
        if (surah && memorizedCountsBySurah[id] === surah.versesCount) {
          mustahabbahCompleted++;
        }
      });


      const properties = {
        verses_memorized: String(memorizedVerseIds.length),
        surahs_memorized: String(stats.surahs.completed),
        juz_memorized: String(stats.juz.completed),
        total_bookmarks: String(bookmarkState.bookmarks?.length || 0),
        total_favourites: String(favouriteState.favourites?.length || 0),
        total_badges: String(badgeState.unlockedBadges?.length || 0),
        language: settingsState.translationLanguage || 'en.asad',
        mustahabbah_done: String(mustahabbahCompleted),
        app_version: Constants.expoConfig?.version || 'unknown',
        mem_level: getMemorizationLevel(memorizedVerseIds.length),
        pref_font: settingsState.arabicFont || 'Uthmanic',
        pref_lang: settingsState.translationLanguage || 'en.asad',
        user_type: memorizedVerseIds.length > 0 ? 'active_learner' : 'new_user',
        os: Platform.OS
      };

      await setUserProperties(properties);
    } catch (e) {
      if (__DEV__) console.debug('[Analytics] Failed to sync properties', e);
    }
  });
}

/**
 * Helper function to determine user memorization level based on verse count
 */
export const getMemorizationLevel = (verseCount: number): string => {
  if (verseCount === 0) return 'beginner';
  if (verseCount < 100) return 'novice';
  if (verseCount < 500) return 'intermediate';
  if (verseCount < 2000) return 'advanced';
  if (verseCount < 6236) return 'expert';
  return 'hafidh'; // Completed full Quran
};

/**
 * Canonical screen name map — used by the root _layout.tsx to resolve
 * any Expo Router pathname into the exact screen_name expected by Firebase.
 *
 * Keys are normalised path segments (after stripping leading slash and
 * the (tabs) group prefix). Values are the canonical analytics names.
 */
const SCREEN_NAME_MAP: Record<string, string> = {
  // ── Tab screens ─────────────────────────────────────────────────────────
  '':              'home',
  'index':         'home',
  'home-progress': 'home_progress',
  'home_progress': 'home_progress',
  'read':          'recite',
  'quiz':          'quiz',
  'revision':      'revise',
  'stats':         'stats',
  'settings':      'setup',
  'badges':        'badges',
  'duas':          'duas',
  'help':          'help',

  // ── Top-level screens ───────────────────────────────────────────────────
  'read-mode':     'read-mode',
  'about':         'about',
  'bookmarks':     'bookmarks',
  'favourites':    'favourites',
  'moon-phases':   'moon_phases',
  'qibla':         'qibla',
  'push-debug':    'push_debug',
  'tajweed-test':  'tajweed_test',

  // ── Nested mushaf screens ────────────────────────────────────────────────
  'mushaf':          'mushaf_viewer',
  'mushaf_index':    'mushaf',
  'mushaf_viewer':   'mushaf_viewer',
  'mushaf_settings': 'mushaf_settings',
  'viewer':          'mushaf_viewer',

  // ── Nested surah/juz/pagemode/moon/fasting/qibla screens ─────────────────
  'surah':           'surah_detail',
  'juz':             'juz_detail',
  'pagemode':        'page_mode',
  'moon':            'moon_phases',
  'fasting':         'fasting_calendar',
  'fasting_calendar':'fasting_calendar',
  'fasting_settings':'fasting_settings',
  'calendar':        'fasting_calendar',
  '[surahId]':       'surah_detail',
  '[juzId]':         'juz_detail',
};

/**
 * Extract the canonical analytics screen name from an Expo Router pathname.
 *
 * Examples:
 *   /              → 'home'
 *   /(tabs)/read   → 'recite'
 *   /read-mode     → 'read-mode'
 *   /mushaf/viewer → 'mushaf_viewer'
 *   /qibla         → 'qibla'
 */
export function getScreenNameFromPath(pathname: string): string {
  // 1. Strip leading/trailing slashes
  let cleaned = pathname.replace(/^\/+/, '').replace(/\/+$/, '');

  // 2. Remove the Expo Router (tabs) group prefix
  cleaned = cleaned.replace(/^\(tabs\)\/?/, '');

  // 3. Normalise slashes to underscores so 'mushaf/viewer' → 'mushaf_viewer'
  const normalised = cleaned.replace(/\//g, '_');

  // 4. Exact match first
  if (SCREEN_NAME_MAP[normalised] !== undefined) {
    return SCREEN_NAME_MAP[normalised];
  }

  // 5. Try matching just the first path segment (covers dynamic sub-routes
  //    like /surah/2, /juz/3, /mushaf/settings, etc.)
  const firstSegment = cleaned.split('/')[0];
  if (SCREEN_NAME_MAP[firstSegment] !== undefined) {
    return SCREEN_NAME_MAP[firstSegment];
  }

  // 6. Fallback — return the normalised path so we never log 'unknown'
  return normalised || 'home';
}
