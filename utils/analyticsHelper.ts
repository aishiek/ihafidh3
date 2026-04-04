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

      try {
        await a.logEvent(eventName, params || {});
        if (__DEV__) console.debug(`[Analytics] ${eventName}:`, params);
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
 * Log screen view with error handling
 * Called from root _layout.tsx
 */
export async function logScreenView(
  screenName: string,
  screenClass?: string
): Promise<void> {
  setImmediate(async () => {
    try {
      if (!analyticsAvailable) return;
      let a: any;
      try { a = analytics(); } catch (e) { analyticsAvailable = false; if (__DEV__) console.debug('[Analytics] native factory threw (screen_view)', e); return; }
      try {
        await a.logEvent('screen_view', { screen_name: screenName, screen_class: screenClass || screenName });
        if (__DEV__) console.debug(`[Analytics] Screen view: ${screenName}`);
      } catch (e) { analyticsAvailable = false; if (__DEV__) console.debug('[Analytics] native logEvent failed (screen_view)', e); }
    } catch (error) {
      if (__DEV__) console.debug('[Analytics] unexpected error in logScreenView', error);
    }
  });
}

/**
 * CONSOLIDATED AUDIO EVENT
 * Tracks all audio playback (verse, surah, page) in single event
 * Prevents audio state complexity and ensures no blocking
 */
export async function logAudioPlayback(params: {
  action: 'play' | 'pause' | 'resume' | 'stop';
  audio_type: 'verse' | 'surah' | 'page'; // Distinguish audio source
  surah_id?: number;
  verse_id?: number;
  verse_number?: number;
  page_index?: number;
  playback_speed?: string;
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
        await a.logEvent('audio_playback', { ...params, timestamp: new Date().toISOString(), platform: Platform.OS });
        if (__DEV__) console.debug('[Analytics] audio_playback:', params);
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
          if (typeof (a as any).setUserProperty === 'function') {
            await (a as any).setUserProperty(key, value as any);
          } else if (typeof (a as any).setUserProperties === 'function') {
            await (a as any).setUserProperties({ [key]: value });
          } else {
            await a.logEvent('user_property', { property: key, value });
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
 * Get common event parameters (timestamp, platform, version)
 */
export function getCommonParams(): Record<string, any> {
  const params: Record<string, any> = {
    timestamp: new Date().toISOString(),
    platform: Platform.OS, // 'ios' or 'android'
    app_version: Constants.expoConfig?.version || 'unknown',
  };

  try {
    // Lazy require to avoid circular dependencies
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
    
    // Calculate accurate counts using tracker
    const memorizedVersesFormatted = memorizedVerseIds.map((vId: number) => {
      let startId = 0;
      for (let i = 1; i <= 114; i++) {
        const s = surahsData.find((sd: any) => sd.id === i);
        if (!s) continue;
        if (vId <= startId + s.versesCount) return `${i}:${vId - startId}`;
        startId += s.versesCount;
      }
      return '';
    }).filter(Boolean);

    const tracker = new QuranProgressTracker({
      memorizedSurahs: [],
      memorizedJuz: [],
      memorizedVerses: memorizedVersesFormatted,
      memorizedVerseIds: memorizedVerseIds
    });
    const stats = tracker.calculateProgress();

    params.total_verses_memorized = memorizedVerseIds.length;
    params.total_surahs_memorized = stats.surahs.completed;
    params.total_juz_memorized = stats.juz.completed;
    params.total_bookmarks = bookmarkState.bookmarks?.length || 0;
    params.total_favourites = favouriteState.favourites?.length || 0;
    params.total_badges = badgeState.unlockedBadges?.length || 0;
    params.language = settingsState.translationLanguage || 'en.asad';

    // Add Mustahabbah count
    const mustahabbahRaw = [36, 32, 73, 18, 55, 67, 56, 62, 76];
    let mustahabbahCompleted = 0;
    mustahabbahRaw.forEach(id => {
      let startId = 0;
      for (let i = 1; i < id; i++) {
        const s = surahsData.find((sd: any) => sd.id === i);
        if (s) startId += s.versesCount;
      }
      const surah = surahsData.find((sd: any) => sd.id === id);
      if (surah) {
        const surahVerses = memorizedVerseIds.filter((vId: number) => vId > startId && vId <= startId + surah.versesCount);
        if (surahVerses.length === surah.versesCount) mustahabbahCompleted++;
      }
    });
    params.total_mustahabbah_completed = mustahabbahCompleted;
  } catch (e) {
    // Ignore errors in common params to prevent analytics from crashing the app
  }

  return params;
}

/**
 * Extract screen name from pathname for route tracking
 * Handles Expo Router group-based routes
 */
export function getScreenNameFromPath(pathname: string): string {
  // Remove leading/trailing slashes and convert groups to readable names
  const cleaned = pathname
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\(tabs\)_/, '') // (tabs)_index → index
    .replace(/^\(tabs\)/, 'home') // (tabs) → home
    .replace(/\//g, '_'); // Remaining slashes to underscores

  // Map routes to analytics screen names
  const screenMap: Record<string, string> = {
    '': 'home',
    'index': 'home',
    'read': 'recite',
    'quiz': 'quiz',
    'revision': 'revise',
    'stats': 'stats',
    'settings': 'setup',
    'moon-phases': 'moon_phases',
    'about': 'about',
    'push-debug': 'push_debug',
  };

  return screenMap[cleaned] || cleaned || 'unknown';
}
