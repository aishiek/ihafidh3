// Full-ish, compatible persisted progress store (types + simple implementations)
import {
    bulkLogRevisions,
    bulkMarkVersesMemorized,
    logVerseMemorization,
    logVerseRevision
} from '@/assets/database/QuranDatabase';
import { TOTAL_VERSES } from '@/constants/quran';
import { Verse } from '@/types/verse';
import {logAnalyticsEvent } from '@/utils/analyticsHelper';

// ─── Analytics helper: resolve surah metadata from a cumulative verse ID ───────
// verseId is 1-based cumulative (1=Al-Fatihah:1, 7=Al-Fatihah:7, 8=Al-Baqarah:1…)
// Returns { surahId, surahName, verseNumber, juzNumber } or fallback zeros.




// Definitive per-juz cumulative last-verse-id table (Uthmani standard, 6236 total verses)
const JUZ_BOUNDARIES: readonly number[] = [
  148,  // Juz 1  (Al-Fatiha:1 – Al-Baqarah:141)
  259,  // Juz 2  (Al-Baqarah:142 – Al-Baqarah:252)
  384,  // Juz 3  (Al-Baqarah:253 – Al-Imran:91)
  519,  // Juz 4  (Al-Imran:92 – An-Nisa:23)
  640,  // Juz 5  (An-Nisa:24 – An-Nisa:147)
  755,  // Juz 6  (An-Nisa:148 – Al-Maidah:81)
  868,  // Juz 7  (Al-Maidah:82 – Al-Anam:110)
  996,  // Juz 8  (Al-Anam:111 – Al-Araf:87)
  1125, // Juz 9  (Al-Araf:88 – Al-Anfal:40)
  1240, // Juz 10 (Al-Anfal:41 – At-Tawbah:92)
  1361, // Juz 11 (At-Tawbah:93 – Hud:5)
  1482, // Juz 12 (Hud:6 – Yusuf:52)
  1609, // Juz 13 (Yusuf:53 – Ibrahim:52)
  1741, // Juz 14 (Al-Hijr:1 – An-Nahl:128)
  1802, // Juz 15 (Al-Isra:1 – Al-Kahf:74)  [Al-Isra starts at cumulative 1742]
  1901, // Juz 16 (Al-Kahf:75 – Ta-Ha:135)
  2029, // Juz 17 (Al-Anbiya:1 – Al-Hajj:78)
  2140, // Juz 18 (Al-Muminun:1 – Al-Furqan:20)
  2254, // Juz 19 (Al-Furqan:21 – An-Naml:55)
  2396, // Juz 20 (An-Naml:56 – Al-Ankabut:44)
  2519, // Juz 21 (Al-Ankabut:45 – Al-Ahzab:30)
  2637, // Juz 22 (Al-Ahzab:31 – Ya-Sin:27)
  2760, // Juz 23 (Ya-Sin:28 – Az-Zumar:31)
  2882, // Juz 24 (Az-Zumar:32 – Fussilat:46)
  3002, // Juz 25 (Fussilat:47 – Al-Jathiyah:37)
  3114, // Juz 26 (Al-Ahqaf:1 – Adh-Dhariyat:30)
  3185, // Juz 27 (Adh-Dhariyat:31 – Al-Hadid:29)
  3314, // Juz 28 (Al-Mujadila:1 – At-Tahrim:12)
  3416, // Juz 29 (Al-Mulk:1 – Al-Mursalat:50)
  6236, // Juz 30 (An-Naba:1 – An-Nas:6)
] as const;

/** Returns the 1-based juz number (1–30) for a given cumulative verse ID. O(30) lookup. */
function getJuzFromVerseId(verseId: number): number {
  for (let i = 0; i < JUZ_BOUNDARIES.length; i++) {
    if (verseId <= JUZ_BOUNDARIES[i]) return i + 1;
  }
  return 30; // fallback: anything beyond 6236 is treated as Juz 30
}

function resolveVerseInfo(verseId: number): {
  surahId: number;
  surahName: string;
  verseNumber: number;
  juzNumber: number;
} {
  try {
    const { surahsData } = require('@/data/surahs');
    let startId = 0;
    for (const s of surahsData) {
      if (verseId > startId && verseId <= startId + s.versesCount) {
        const verseNumber = verseId - startId;
        // Use verse-boundary table — NOT surah-level, handles cross-surah juz splits correctly
        const juzNumber = getJuzFromVerseId(verseId);
        return {
          surahId: s.id,
          surahName: (s.englishName || s.name || `surah_${s.id}`).toLowerCase().replace(/\s+/g, '_'),
          verseNumber,
          juzNumber,
        };
      }
      startId += s.versesCount;
    }
  } catch { /* non-fatal: analytics must never crash */ }
  return { surahId: 0, surahName: 'unknown', verseNumber: 0, juzNumber: 0 };
}

import { formatDate } from '@/utils/dateUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Badge, useBadgeStore } from './badgeStore';

type BadgeCelebrationCallback = (badge: Badge, isHafidh: boolean) => void;

type RevisedVerse = { verseId: number; revisionDate: string };
type RevisionTracker = { verseId: number; date: string };
type QuizResult = { id: string; date: string; verseIds: number[]; score: number; totalQuestions: number; correct: number; surahId?: number; juzNumber?: number };

type TimeSpent = { total: number; daily: Record<string, number> };

type Badges = Record<string, boolean>;

type RevisionSchedule = {
  versesPerDay: number;
  surahsPerWeek: number[];
  pagesPerDay: number;
  pagesPerWeek: number;
  completedToday: number[];
  completedThisWeek: number[];
  completedPagesToday: string[]; // keys: scope-entityId-pageIndex
  completedPagesThisWeek: string[]; // keys: scope-entityId-pageIndex
  lastResetDate: string | null;
};

type VerseStatusEntry = { status: 'not_started' | 'memorized' | 'revised'; last_updated?: string };

// Page mark entry: tracks when a page was marked memorized/revised
type PageMark = {
  scope: 'surah' | 'juz';
  entityId: number; // surahId or juzNumber
  pageIndex: number;
  versesPerPage: number;
  verseIds: number[]; // verses in this page
  markedDate: string;
  type: 'memorized' | 'revised';
};

export interface ProgressState {
  // persisted arrays / objects
  memorizedVerses: number[];
  memorizedVerseDates: Record<number, string>;
  revisedVerses: RevisedVerse[];
  pageMarks: PageMark[]; // NEW: Track page-level marks
  dailyRevisedVerses: RevisionTracker[];
  weeklyRevisedVerses: RevisionTracker[];
  verseStatus: Record<number, VerseStatusEntry>;
  quizResults: QuizResult[];
  badges: Badges;
  lastReadVerse: Verse | null;
  completedToday: number[];
  revisionSchedule: RevisionSchedule;
  weeklyRevisedSurahsCompleted: number[];

  // counters / aggregates
  memorizedCount: number;
  revisedCount: number;
  dailyStreak: number;
  lastOpenDate: string | null;
  timeSpent: TimeSpent;

  // Badge celebration callback (not persisted)
  badgeCelebrationCallback: BadgeCelebrationCallback | null;
  setBadgeCelebrationCallback: (callback: BadgeCelebrationCallback | null) => void;
  celebrateBadge: (badgeId: string) => void;
  checkAndCelebrateBadges: () => void;

  // actions (many are lightweight stubs sufficient for compatibility)
  markVerseAsMemorized: (verseId: number) => void;
  unmarkVerseAsMemorized: (verseId: number) => void;
  bulkMarkVersesMemorized: (ids: number[], isMarking?: boolean) => void;
  markVerseAsRevised: (verseId: number) => void;
  unmarkVerseAsRevised: (verseId: number) => void;
  bulkMarkVersesRevised: (ids: number[], isMarking?: boolean) => void;
  updateBadges: () => void;
  setLastReadVerse: (v: Verse | null) => void;
  updateDailyStreak: () => void;
  startTimeTracking: () => void;
  stopTimeTracking: () => void;
  addQuizResult: (result: Omit<QuizResult, 'id' | 'date'>) => void;
  setRevisionSchedule: (versesPerDay: number, surahsPerWeek: number[], pagesPerDay?: number, pagesPerWeek?: number) => void;
  setDailyRevisionTarget: (verses: number) => void;
  setWeeklyRevisionSurahs: (surahs: number[]) => void;
  setDailyPageTarget: (pages: number) => void;
  setWeeklyPageTarget: (pages: number) => void;
  updateDailyRevisedVerses: (verseId: number) => void;
  updateWeeklyRevisedVerses: (verseId: number) => void;
  updateMemorizedVerses: (ids: number[]) => void;
  updateRevisedVerses: (ids: number[]) => void;

  // NEW: Page-level tracking
  markPageAsMemorized: (scope: 'surah' | 'juz', entityId: number, pageIndex: number, versesPerPage: number, verseIds: number[]) => void;
  markPageAsRevised: (scope: 'surah' | 'juz', entityId: number, pageIndex: number, versesPerPage: number, verseIds: number[]) => void;
  unmarkPageAsMemorized: (scope: 'surah' | 'juz', entityId: number, pageIndex: number) => void;
  unmarkPageAsRevised: (scope: 'surah' | 'juz', entityId: number, pageIndex: number) => void;
  getPageMarks: (scope: 'surah' | 'juz', entityId: number, type?: 'memorized' | 'revised') => PageMark[];
  isPageMarked: (scope: 'surah' | 'juz', entityId: number, pageIndex: number, type: 'memorized' | 'revised') => boolean;

  // NEW: Get activity data for charts (async to query database)
  getActivityData: () => Promise<{
    memorizedVerses: Array<{ date: string; count: number }>;
    revisedVerses: Array<{ date: string; count: number }>;
  }>;

  getPageActivityData: () => {
    memorizedPages: Array<{ date: string; count: number }>;
    revisedPages: Array<{ date: string; count: number }>;
  };
}

const DEFAULT_BADGES: Badges = {};
const DEFAULT_SCHEDULE: RevisionSchedule = {
  versesPerDay: 5,
  surahsPerWeek: [],
  pagesPerDay: 1,
  pagesPerWeek: 5,
  completedToday: [],
  completedThisWeek: [],
  completedPagesToday: [],
  completedPagesThisWeek: [],
  lastResetDate: null
};
const DEFAULT_TIME: TimeSpent = { total: 0, daily: {} };

function recomputeAggregatesFromStatus(status: Record<number, VerseStatusEntry> | undefined) {
  const vs = status || {};
  let memorized = 0;
  let revised = 0;

  Object.values(vs).forEach((v) => {
    if (v.status === 'memorized') memorized++;
    if (v.status === 'revised') revised++;
  });

  return { memorizedCount: memorized, revisedCount: revised };
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      // persisted defaults
      memorizedVerses: [],
      memorizedVerseDates: {},
      revisedVerses: [],
      pageMarks: [],
      dailyRevisedVerses: [],
      weeklyRevisedVerses: [],
      verseStatus: {},
      quizResults: [],
      badges: DEFAULT_BADGES,
      lastReadVerse: null,
      completedToday: [],
      revisionSchedule: DEFAULT_SCHEDULE,
      weeklyRevisedSurahsCompleted: [],

      // aggregates
      memorizedCount: 0,
      revisedCount: 0,
      dailyStreak: 0,
      lastOpenDate: null,
      timeSpent: DEFAULT_TIME,

      // Badge celebration (not persisted)
      badgeCelebrationCallback: null,

      setBadgeCelebrationCallback: (callback: BadgeCelebrationCallback | null) => {
        set({ badgeCelebrationCallback: callback });
      },

      /**
       * Manually trigger celebration for a specific badge by ID.
       * Useful for celebrating badges that were just unlocked after a re-sync.
       */
      celebrateBadge: (badgeId: string) => {
        const { badgeCelebrationCallback } = get();
        if (!badgeCelebrationCallback) {
          if (__DEV__) console.log('[celebrateBadge] No callback set');
          return;
        }

        const badge = useBadgeStore.getState().badges.find(b => b.id === badgeId);
        if (!badge) {
          if (__DEV__) console.log('[celebrateBadge] Badge not found:', badgeId);
          return;
        }

        if (!badge.unlocked) {
          if (__DEV__) console.log('[celebrateBadge] Badge not unlocked:', badgeId);
          return;
        }

        const isHafidh = badge.id === 'hafidh-quran';
        if (__DEV__) if (__DEV__) console.log('[celebrateBadge] Celebrating badge:', badge.name, 'isHafidh:', isHafidh);
        badgeCelebrationCallback(badge, isHafidh);
      },

      checkAndCelebrateBadges: () => {
        const state = get();
        const { badgeCelebrationCallback, memorizedVerses } = state;

        if (!badgeCelebrationCallback) return;

        // Use QuranProgressTracker to calculate actual Juz completion (same as stats/badges screen)
        const { QuranProgressTracker } = require('@/data/quranProgress');
        const { surahsData } = require('@/data/surahs');

        // Convert verseIds to surah:verse format for QuranProgressTracker
        const memorizedVersesFormatted = memorizedVerses.map(verseId => {
          let startVerseId = 0;
          for (let i = 1; i <= 114; i++) {
            const surah = surahsData.find((s: any) => s.id === i);
            if (!surah) continue;

            if (verseId <= startVerseId + surah.versesCount) {
              const verseNumber = verseId - startVerseId;
              return `${i}:${verseNumber}`;
            }
            startVerseId += surah.versesCount;
          }
          return '';
        }).filter(Boolean);

        const progressTracker = new QuranProgressTracker({
          memorizedSurahs: [],
          memorizedJuz: [],
          memorizedVerses: memorizedVersesFormatted,
          memorizedVerseIds: memorizedVerses // Pass cumulative verse IDs for accurate Juz calculation
        });

        const progress = progressTracker.calculateProgress();
        const actualCompletedJuz = progress.juz.completed;

        if (__DEV__) console.log('[checkAndCelebrateBadges] Actual completed Juz:', actualCompletedJuz, 'Total verses:', memorizedVerses.length);

        // Check for new badges using actual Juz count
        const newlyUnlocked = useBadgeStore.getState().checkAndUnlockBadges(actualCompletedJuz);

        if (__DEV__) console.log('[checkAndCelebrateBadges] Newly unlocked badges:', newlyUnlocked.map(b => b.name));

        // Celebrate each newly unlocked badge
        newlyUnlocked.forEach(badge => {
          const isHafidh = badge.id === 'hafidh-quran';
          if (__DEV__) console.log('[checkAndCelebrateBadges] Celebrating badge:', badge.name, 'isHafidh:', isHafidh);
          
          let daysSinceInstall = 1;
          try {
            const installDateStr = (get() as any)._installDateCache;
            if (installDateStr) {
               const installDate = new Date(installDateStr + 'T00:00:00');
               const today = new Date();
               daysSinceInstall = Math.max(1, Math.round((today.getTime() - installDate.getTime()) / 86400000));
            }
          } catch {}

          // ANALYTICS: Badge earned (Event 7 — P1)
          try {
            const totalBadgesEarned = useBadgeStore.getState().getUnlockedBadges().length;
            logAnalyticsEvent('badge_earned', {
              badge_id: badge.id ?? 'unknown',
              badge_name: (badge.name ?? 'unknown').toLowerCase().replace(/\s+/g, '_'),
              badge_category: isHafidh ? 'completion' : 'memorization',
              total_badges_earned: totalBadgesEarned ?? 0,
            });
          } catch { /* analytics must never crash */ }

          // ANALYTICS: Milestone reached (if Juz-based)
          if (badge.requirement > 0) {
            try {
              logAnalyticsEvent('memorization_milestone', {
                milestone_type: `${badge.requirement}_juz`,
                badge_name: (badge.name ?? 'unknown').toLowerCase().replace(/\s+/g, '_'),
                total_verses_memorized: memorizedVerses.length ?? 0,
                total_surahs_completed: 0,
                juz_count: actualCompletedJuz ?? 0,
              });
            } catch { /* analytics must never crash */ }
          }

          badgeCelebrationCallback(badge, isHafidh);
        });

        // ANALYTICS: juz_completed — fires once per newly completed Juz, at 100%
        // Detect newly completed Juz by comparing which specific juz IDs are now complete
        const previousJuzCount = (get() as any)._lastJuzCount || 0;
        if (actualCompletedJuz > previousJuzCount) {
          // Calculate how many new Juz were completed
          const newJuzCompleted = actualCompletedJuz - previousJuzCount;
          // Days since install for days_to_complete
          let daysToComplete = 1;
          try {
            const { getOrSetInstallDate } = require('@/utils/installDate');
            // Use synchronous AsyncStorage cached value — best effort
            const installDateStr = (get() as any)._installDateCache;
            if (installDateStr) {
              const installDate = new Date(installDateStr + 'T00:00:00');
              const today = new Date();
              daysToComplete = Math.max(1, Math.round((today.getTime() - installDate.getTime()) / 86400000));
            }
          } catch { }

          const { logAnalyticsEvent} = require('@/utils/analyticsHelper');
          // Fire one event per newly completed juz
          for (let i = 1; i <= newJuzCompleted; i++) {
            const completedJuzNumber = previousJuzCount + i;
            logAnalyticsEvent('juz_completed', {
              juz_number: completedJuzNumber,   // the specific juz (1-30)
              juz_name: `Juz ${completedJuzNumber}`,
              total_juz_completed: previousJuzCount + i,
              verses_count: memorizedVerses.length,
              days_to_complete: daysToComplete,});
          }
          set({ _lastJuzCount: actualCompletedJuz } as any);

          // Trigger SadaqahPrompt for first Juz completed
          setTimeout(() => {
            const { useSettingsStore } = require('./settingsStore');
            const { shouldShowReviewPrompt } = require('@/utils/reviewPrompt');
            const settingsState = useSettingsStore.getState();
            if (shouldShowReviewPrompt(settingsState.reviewPromptState, settingsState.reviewPromptSessionShown)) {
              if (previousJuzCount === 0 && newJuzCompleted > 0) {
                settingsState.triggerSadaqahPrompt('juz_completed');
              }
            }
          }, 1500);
        }

        // ANALYTICS: surah_completed — fires when all verses of a surah are memorized
        const previousCompletedSurahs = (get() as any)._lastCompletedSurahIds || [];
        
        // Find which surah contains the latest memorized verse
        const verse = memorizedVerses[memorizedVerses.length - 1];
        if (verse) {
           let startId = 0;
           const currentSurah = surahsData.find((s: any) => {
              const inside = verse > startId && verse <= startId + s.versesCount;
              if (!inside) startId += s.versesCount;
              return inside;
           });

           if (currentSurah && !previousCompletedSurahs.includes(currentSurah.id)) {
              // Check if all verses in this surah are memorized
              const memorizedInSurah = memorizedVerses.filter(id => id > startId && id <= startId + currentSurah.versesCount).length;
              if (memorizedInSurah === currentSurah.versesCount) {
                 const { logAnalyticsEvent} = require('@/utils/analyticsHelper');
                  const { getJuzForSurah } = require("@/utils/juzCalculator");
                  const juzNum = typeof getJuzForSurah === "function" ? getJuzForSurah(currentSurah.id) : 0;
                  try {
                     logAnalyticsEvent('surah_completed', {
                       surah_number: currentSurah.id ?? 0,
                       surah_name: (currentSurah.englishName || currentSurah.name || `surah_${currentSurah.id}`).toLowerCase().replace(/\s+/g, '_'),
                       total_verses: currentSurah.versesCount ?? 0,
                       juz_number: juzNum ?? 0,
                       completion_type: 'memorization',
                     });
                   } catch { /* analytics must never crash */ }
                 set({ _lastCompletedSurahIds: [...previousCompletedSurahs, currentSurah.id] } as any);
              }
           }
        }
      },

      // actions
      markVerseAsMemorized: (verseId: number) => {
        // Log memorization activity to the database
        logVerseMemorization(verseId).catch(() => { });

        set((s) => {
          if (__DEV__) if (__DEV__) console.log('[markVerseAsMemorized] marking verse', verseId);
          if (s.memorizedVerses.includes(verseId)) return {};
          const memorizedVerses = [...s.memorizedVerses, verseId];
          const memorizedVerseDates = { ...s.memorizedVerseDates, [verseId]: formatDate(new Date()) };
          const verseStatus = { ...s.verseStatus, [verseId]: { status: 'memorized' as const, last_updated: new Date().toISOString() } };
          const agg = recomputeAggregatesFromStatus(verseStatus);
          return { memorizedVerses, memorizedVerseDates, verseStatus, ...agg };
        });

        // ANALYTICS: Individual verse memorization - centralized here
        const newTotal = (get().memorizedVerses.length || 0) + 1;
        try {
          const { surahId, surahName, verseNumber, juzNumber } = resolveVerseInfo(verseId);
          logAnalyticsEvent('verse_memorization_toggled', {
            surah_number: surahId ?? 0,
            surah_name: surahName ?? 'unknown',
            verse_number: verseNumber ?? 0,
            state: 'memorized',
            juz_number: juzNumber ?? 0,
            total_verses_memorized: newTotal,
          });
        } catch { /* analytics must never crash */ }

        // Check for milestones
        const milestones = [1, 10, 50, 100, 250, 500, 1000, 2000, 6236];
        if (milestones.includes(newTotal)) {
          const milestoneTypeMap: Record<number, string> = {
            1: 'first_verse', 10: '10_verses', 50: '50_verses', 100: '100_verses',
            250: '250_verses', 500: '500_verses', 1000: '1000_verses', 2000: '2000_verses', 6236: 'full_quran',
          };
          try {
            const completedJuzNow = (() => {
              try {
                const { QuranProgressTracker } = require('@/data/quranProgress');
                const { surahsData } = require('@/data/surahs');
                const allMem = get().memorizedVerses;
                let sid = 0;
                const formatted = allMem.map((vid: number) => {
                  let start = 0;
                  for (const s of surahsData) {
                    if (vid > start && vid <= start + s.versesCount) return `${s.id}:${vid - start}`;
                    start += s.versesCount;
                  }
                  return '';
                }).filter(Boolean);
                const p = new QuranProgressTracker({ memorizedSurahs: [], memorizedJuz: [], memorizedVerses: formatted, memorizedVerseIds: allMem }).calculateProgress();
                return p.juz.completed;
              } catch { return 0; }
            })();
            logAnalyticsEvent('memorization_milestone', {
              milestone_type: milestoneTypeMap[newTotal] ?? `${newTotal}_verses`,
              badge_name: 'unknown',
              total_verses_memorized: newTotal,
              total_surahs_completed: 0,
              juz_count: completedJuzNow,
            });
          } catch { /* analytics must never crash */ }
        }
        
        // Check for surah and juz completions
        setTimeout(() => {
           get().checkAndCelebrateBadges();
        }, 100);
      },

      unmarkVerseAsMemorized: (verseId: number) => {
        set((s) => {
          const memorizedVerses = s.memorizedVerses.filter((v) => v !== verseId);
          const memorizedVerseDates = { ...s.memorizedVerseDates };
          delete memorizedVerseDates[verseId];
          const verseStatus = { ...s.verseStatus, [verseId]: { status: 'not_started' as const, last_updated: new Date().toISOString() } };
          const agg = recomputeAggregatesFromStatus(verseStatus);
          return { memorizedVerses, memorizedVerseDates, verseStatus, ...agg };
        });

        // ANALYTICS: Individual verse unmark - centralized here
        try {
          const { surahId, surahName, verseNumber, juzNumber } = resolveVerseInfo(verseId);
          logAnalyticsEvent('verse_memorization_toggled', {
            surah_number: surahId ?? 0,
            surah_name: surahName ?? 'unknown',
            verse_number: verseNumber ?? 0,
            state: 'unmemorized',
            juz_number: juzNumber ?? 0,
            total_verses_memorized: get().memorizedVerses.length,
          });
        } catch { /* analytics must never crash */ }
      },

      bulkMarkVersesMemorized: (ids: number[], isMarking = true) => {
        // Log bulk memorization activities to the database
        bulkMarkVersesMemorized(ids, isMarking).catch(() => { });

        set((s) => {
          const memorizedVerses = isMarking
            ? Array.from(new Set([...s.memorizedVerses, ...ids]))
            : s.memorizedVerses.filter((x) => !ids.includes(x));

          const memorizedVerseDates = { ...s.memorizedVerseDates };

          if (isMarking) {
            ids.forEach((id) => (memorizedVerseDates[id] = memorizedVerseDates[id] || formatDate(new Date())));
          } else {
            ids.forEach((id) => delete memorizedVerseDates[id]);
          }

          const verseStatus = { ...s.verseStatus };
          ids.forEach((id) => (verseStatus[id] = {
            status: isMarking ? 'memorized' as const : 'not_started' as const,
            last_updated: new Date().toISOString()
          }));

          const agg = recomputeAggregatesFromStatus(verseStatus);
          return { memorizedVerses, memorizedVerseDates, verseStatus, ...agg };
        });

        // ANALYTICS: bulk_mark_verses — juz_number only; surah detail omitted to reduce noise
        try {
          const firstId = ids[0];
          const { juzNumber } = firstId ? resolveVerseInfo(firstId) : { juzNumber: 0 };
          logAnalyticsEvent('bulk_mark_verses', {
            juz_number: juzNumber ?? 0,
            verse_count: ids.length ?? 0,
            state: isMarking ? 'memorized' : 'unmemorized',
            action: isMarking ? 'mark_all' : 'unmark_all',
          });
        } catch { /* analytics must never crash */ }

        // Check for badge unlocks and completions after marking
        if (isMarking) {
          // Use setTimeout to ensure state has been updated
          setTimeout(() => {
            get().checkAndCelebrateBadges();
          }, 100);
        }
      },

      markVerseAsRevised: (verseId: number) => {
        // Log revision activity to the database
        logVerseRevision(verseId).catch(() => { });

        set((s) => {
          if (s.revisedVerses.some((r) => r.verseId === verseId)) return {};
          const today = formatDate(new Date());
          const revisedVerses = [...s.revisedVerses, { verseId, revisionDate: today }];

          // Avoid duplicate entries for daily/weekly arrays (same verseId + same date)
          const alreadyInDaily = s.dailyRevisedVerses.some(r => r.verseId === verseId && r.date === today);
          const alreadyInWeekly = s.weeklyRevisedVerses.some(r => r.verseId === verseId && r.date === today);

          const dailyRevisedVerses = alreadyInDaily ? s.dailyRevisedVerses : [...s.dailyRevisedVerses, { verseId, date: today }];
          const weeklyRevisedVerses = alreadyInWeekly ? s.weeklyRevisedVerses : [...s.weeklyRevisedVerses, { verseId, date: today }];
          const verseStatus = {
            ...s.verseStatus,
            [verseId]: {
              status: 'revised' as const,
              last_updated: new Date().toISOString()
            }
          };
          const agg = recomputeAggregatesFromStatus(verseStatus);
          return {
            revisedVerses,
            dailyRevisedVerses,
            weeklyRevisedVerses,
            verseStatus,
            ...agg
          };
        });

        // ANALYTICS: Individual verse revision - centralized here
        try {
          const { surahId, surahName, verseNumber, juzNumber } = resolveVerseInfo(verseId);
          logAnalyticsEvent('verse_revision_toggled', {
            surah_number: surahId ?? 0,
            surah_name: surahName ?? 'unknown',
            verse_number: verseNumber ?? 0,
            state: 'revised',
            juz_number: juzNumber ?? 0,
          });
        } catch { /* analytics must never crash */ }
      },

      unmarkVerseAsRevised: (verseId: number) => {
        set((s) => {
          const revisedVerses = s.revisedVerses.filter((r) => r.verseId !== verseId);
          const dailyRevisedVerses = s.dailyRevisedVerses.filter((r) => r.verseId !== verseId);
          const weeklyRevisedVerses = s.weeklyRevisedVerses.filter((r) => r.verseId !== verseId);

          const verseStatus = {
            ...s.verseStatus,
            [verseId]: {
              status: s.memorizedVerses.includes(verseId) ? 'memorized' as const : 'not_started' as const,
              last_updated: new Date().toISOString()
            }
          };

          const agg = recomputeAggregatesFromStatus(verseStatus);
          return {
            revisedVerses,
            dailyRevisedVerses,
            weeklyRevisedVerses,
            verseStatus,
            ...agg
          };
        });

        // ANALYTICS: Individual verse revision unmark - centralized here
        try {
          const { surahId, surahName, verseNumber, juzNumber } = resolveVerseInfo(verseId);
          logAnalyticsEvent('verse_revision_toggled', {
            surah_number: surahId ?? 0,
            surah_name: surahName ?? 'unknown',
            verse_number: verseNumber ?? 0,
            state: 'unrevised',
            juz_number: juzNumber ?? 0,
          });
        } catch { /* analytics must never crash */ }
      },

      bulkMarkVersesRevised: (ids: number[], isMarking = true) => {
        // Log bulk revision activity to the database
        if (isMarking) {
          bulkLogRevisions(ids).catch(() => { });
        }

        set((s) => {
          if (__DEV__) if (__DEV__) console.log('[bulkMarkVersesRevised] processing verses', ids, 'isMarking:', isMarking);
          const today = formatDate(new Date());
          let revisedVerses = [...s.revisedVerses];
          let dailyRevisedVerses = [...s.dailyRevisedVerses];
          let weeklyRevisedVerses = [...s.weeklyRevisedVerses];

          if (isMarking) {
            // Only add verses that aren't already marked as revised
            ids.forEach((id) => {
              if (!revisedVerses.some((r) => r.verseId === id)) {
                revisedVerses.push({ verseId: id, revisionDate: today });
                dailyRevisedVerses.push({ verseId: id, date: today });
                weeklyRevisedVerses.push({ verseId: id, date: today });
              }
            });
          } else {
            // Remove verses
            revisedVerses = revisedVerses.filter(r => !ids.includes(r.verseId));
            dailyRevisedVerses = dailyRevisedVerses.filter(r => !ids.includes(r.verseId));
            weeklyRevisedVerses = weeklyRevisedVerses.filter(r => !ids.includes(r.verseId));
          }

          // Update verse status for all provided IDs
          const verseStatus = { ...s.verseStatus };
          ids.forEach((id) => {
            if (isMarking) {
              verseStatus[id] = {
                status: 'revised' as const,
                last_updated: new Date().toISOString()
              };
            } else {
              // Revert to memorized if it was memorized, otherwise not_started
              verseStatus[id] = {
                status: s.memorizedVerses.includes(id) ? 'memorized' as const : 'not_started' as const,
                last_updated: new Date().toISOString()
              };
            }
          });
          const agg = recomputeAggregatesFromStatus(verseStatus);
          return {
            revisedVerses,
            dailyRevisedVerses,
            weeklyRevisedVerses,
            verseStatus,
            ...agg
          };
        });
      },

      updateBadges: () => {
        set((s) => {
          const newBadges: Badges = { ...s.badges };
          newBadges.hafizQuran = (s.memorizedCount || 0) >= TOTAL_VERSES;

          // Only update if badges actually changed
          if (JSON.stringify(s.badges) !== JSON.stringify(newBadges)) {
            return { badges: newBadges };
          }
          return {};
        });
      },

      setLastReadVerse: (v: Verse | null) => set({ lastReadVerse: v }),

      updateDailyStreak: () => {
        set((s) => {
          const today = formatDate(new Date());

          // If this is the first time opening the app, start a streak
          if (!s.lastOpenDate) {
            return { dailyStreak: 1, lastOpenDate: today };
          }

          // If already updated today, don't recalculate
          if (s.lastOpenDate === today) {
            return s; // No changes needed
          }

          const last = new Date(s.lastOpenDate + 'T00:00:00');
          const cur = new Date(today + 'T00:00:00');
          const diff = Math.floor((cur.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

          let newStreak = s.dailyStreak;

          // If last opened yesterday, increment streak
          if (diff === 1) {
            newStreak = s.dailyStreak + 1;
          }
          // If more than one day has passed, reset streak
          else if (diff > 1) {
            newStreak = 1;
          }
          // If diff === 0, this shouldn't happen due to early return above
          // but keeping streak the same just in case

          return {
            dailyStreak: newStreak,
            lastOpenDate: today
          };
        });
      },

      startTimeTracking: () => {
        // Store the start time in AsyncStorage
        AsyncStorage.setItem('timeTrackingStart', Date.now().toString());
      },

      stopTimeTracking: () => {
        // Get the start time from AsyncStorage
        AsyncStorage.getItem('timeTrackingStart').then((t) => {
          if (!t) return;

          const start = parseInt(t, 10);
          const session = Math.max(0, Math.floor((Date.now() - start) / 1000));

          // Only update if there was actual time spent
          if (session <= 0) return;

          set((s) => {
            const today = formatDate(new Date());
            const daily = s.timeSpent.daily[today] || 0;

            return {
              timeSpent: {
                total: s.timeSpent.total + session,
                daily: {
                  ...s.timeSpent.daily,
                  [today]: daily + session
                }
              }
            };
          });

          // Clean up the start time
          AsyncStorage.removeItem('timeTrackingStart');
        });
      },

      addQuizResult: (result) => {
        set((s) => {
          const newResult: QuizResult = {
            ...result,
            id: Date.now().toString(),
            date: formatDate(new Date())
          };

          const quizResults = [...s.quizResults, newResult];

          // Update badges after adding quiz result
          setTimeout(() => get().updateBadges(), 0);

          return { quizResults };
        });

        // ANALYTICS: Quiz completed
        const percentage = Math.round((result.score / result.totalQuestions) * 100);
        const { surahsData } = require('@/data/surahs');
        const surah = surahsData.find((s: any) => s.id === result.surahId);
        
        logAnalyticsEvent('quiz_completed', {
          surah_id: result.surahId || 0,
          surah_name: surah ? surah.englishName : 'Unknown',
          quiz_score: result.score,
          total_questions: result.totalQuestions,
          percentage: percentage,
          passed: percentage >= 70,});
      },

      setRevisionSchedule: (versesPerDay, surahsPerWeek, pagesPerDay, pagesPerWeek) => {
        set((s) => ({
          revisionSchedule: {
            ...(s.revisionSchedule || DEFAULT_SCHEDULE),
            versesPerDay,
            surahsPerWeek,
            pagesPerDay: pagesPerDay ?? (s.revisionSchedule?.pagesPerDay || DEFAULT_SCHEDULE.pagesPerDay),
            pagesPerWeek: pagesPerWeek ?? (s.revisionSchedule?.pagesPerWeek || DEFAULT_SCHEDULE.pagesPerWeek)
          }
        }));
      },

      setDailyRevisionTarget: (verses) => {
        set((s) => ({
          revisionSchedule: {
            ...(s.revisionSchedule || DEFAULT_SCHEDULE),
            versesPerDay: verses
          }
        }));
      },

      setWeeklyRevisionSurahs: (surahs) => {
        set((s) => ({
          revisionSchedule: {
            ...(s.revisionSchedule || DEFAULT_SCHEDULE),
            surahsPerWeek: surahs
          }
        }));
      },

      setDailyPageTarget: (pages) => {
        set((s) => ({
          revisionSchedule: {
            ...(s.revisionSchedule || DEFAULT_SCHEDULE),
            pagesPerDay: pages
          }
        }));
      },

      setWeeklyPageTarget: (pages) => {
        set((s) => ({
          revisionSchedule: {
            ...(s.revisionSchedule || DEFAULT_SCHEDULE),
            pagesPerWeek: pages
          }
        }));
      },

      updateDailyRevisedVerses: (verseId: number) => {
        set((s) => {
          const today = formatDate(new Date());
          if (s.dailyRevisedVerses.some(r => r.verseId === verseId && r.date === today)) {
            if (__DEV__) if (__DEV__) console.log('[updateDailyRevisedVerses] already present', verseId, today);
            return {};
          }
          return {
            dailyRevisedVerses: [...s.dailyRevisedVerses, { verseId, date: today }]
          };
        });
      },

      updateWeeklyRevisedVerses: (verseId: number) => {
        set((s) => {
          const today = formatDate(new Date());
          if (s.weeklyRevisedVerses.some(r => r.verseId === verseId && r.date === today)) {
            if (__DEV__) if (__DEV__) console.log('[updateWeeklyRevisedVerses] already present', verseId, today);
            return {};
          }
          return {
            weeklyRevisedVerses: [...s.weeklyRevisedVerses, { verseId, date: today }]
          };
        });
      },

      updateMemorizedVerses: (ids: number[]) => {
        set(() => ({
          memorizedVerses: ids,
          memorizedCount: ids.length
        }));
      },

      updateRevisedVerses: (ids: number[]) => {
        set(() => {
          const arr = ids.map((id) => ({
            verseId: id,
            revisionDate: formatDate(new Date())
          }));

          return {
            revisedVerses: arr,
            revisedCount: arr.length
          };
        });
      },

      // NEW: Page-level tracking
      markPageAsMemorized: (scope, entityId, pageIndex, versesPerPage, verseIds) => {
        set((s) => {
          const existing = s.pageMarks.find(
            (m) => m.scope === scope && m.entityId === entityId && m.pageIndex === pageIndex && m.type === 'memorized'
          );
          if (existing) return {}; // Already marked

          const newMark: PageMark = {
            scope,
            entityId,
            pageIndex,
            versesPerPage,
            verseIds,
            markedDate: formatDate(new Date()),
            type: 'memorized',
          };

          return { pageMarks: [...s.pageMarks, newMark] };
        });
      },

      markPageAsRevised: (scope, entityId, pageIndex, versesPerPage, verseIds) => {
        set((s) => {
          const today = formatDate(new Date());
          const existingToday = s.pageMarks.find(
            (m) => m.scope === scope && m.entityId === entityId && m.pageIndex === pageIndex && m.type === 'revised' && m.markedDate === today
          );

          if (existingToday) return {}; // Already marked today

          const newMark: PageMark = {
            scope,
            entityId,
            pageIndex,
            versesPerPage,
            verseIds,
            markedDate: today,
            type: 'revised',
          };

          // Update revision schedule tracking
          const pageKey = `${scope}-${entityId}-${pageIndex}`;
          const currentSchedule = s.revisionSchedule || DEFAULT_SCHEDULE;

          // Safely handle potentially undefined arrays (from old persistence state)
          const todayList = currentSchedule.completedPagesToday || [];
          const weekList = currentSchedule.completedPagesThisWeek || [];

          const completedPagesToday = todayList.includes(pageKey)
            ? todayList
            : [...todayList, pageKey];

          const completedPagesThisWeek = weekList.includes(pageKey)
            ? weekList
            : [...weekList, pageKey];

          return {
            pageMarks: [...s.pageMarks, newMark],
            revisionSchedule: {
              ...currentSchedule,
              completedPagesToday,
              completedPagesThisWeek
            }
          };
        });
      },

      unmarkPageAsMemorized: (scope, entityId, pageIndex) => {
        set((s) => ({
          pageMarks: s.pageMarks.filter(
            (m) => !(m.scope === scope && m.entityId === entityId && m.pageIndex === pageIndex && m.type === 'memorized')
          ),
        }));
      },

      unmarkPageAsRevised: (scope, entityId, pageIndex) => {
        set((s) => {
          const pageKey = `${scope}-${entityId}-${pageIndex}`;
          const currentSchedule = s.revisionSchedule || DEFAULT_SCHEDULE;

          return {
            pageMarks: s.pageMarks.filter(
              (m) => !(m.scope === scope && m.entityId === entityId && m.pageIndex === pageIndex && m.type === 'revised')
            ),
            revisionSchedule: {
              ...currentSchedule,
              completedPagesToday: (currentSchedule.completedPagesToday || []).filter(k => k !== pageKey),
              completedPagesThisWeek: (currentSchedule.completedPagesThisWeek || []).filter(k => k !== pageKey)
            }
          };
        });
      },

      getPageMarks: (scope, entityId, type) => {
        const state = get();
        return state.pageMarks.filter(
          (m) => m.scope === scope && m.entityId === entityId && (!type || m.type === type)
        );
      },

      isPageMarked: (scope, entityId, pageIndex, type) => {
        const state = get();
        return state.pageMarks.some(
          (m) => m.scope === scope && m.entityId === entityId && m.pageIndex === pageIndex && m.type === type
        );
      },

      // NEW: Get activity data for charts - reads from database for accurate stats
      getActivityData: async () => {
        try {
          // Import database function dynamically to avoid circular dependencies
          const { getVerseActivitiesBetween } = await import('@/assets/database/QuranDatabase');

          // Query last 3 years of data to cover all timeframes in the chart
          const endDate = formatDate(new Date());
          const startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 3);
          const startDateStr = formatDate(startDate);

          if (__DEV__) if (__DEV__) console.log('[getActivityData] Querying database from', startDateStr, 'to', endDate);

          // Get activities from database
          const activities = await getVerseActivitiesBetween(startDateStr, endDate);

          if (__DEV__) if (__DEV__) console.log('[getActivityData] Retrieved', activities.length, 'activity groups from database');

          // Aggregate by date and type
          const memorizedByDate: Record<string, number> = {};
          const revisedByDate: Record<string, number> = {};

          activities.forEach((activity) => {
            if (activity.activityType === 'memorized') {
              memorizedByDate[activity.activityDate] = (memorizedByDate[activity.activityDate] || 0) + activity.count;
            } else if (activity.activityType === 'revised') {
              revisedByDate[activity.activityDate] = (revisedByDate[activity.activityDate] || 0) + activity.count;
            }
          });

          const result = {
            memorizedVerses: Object.entries(memorizedByDate).map(([date, count]) => ({
              date,
              count,
            })),
            revisedVerses: Object.entries(revisedByDate).map(([date, count]) => ({
              date,
              count,
            })),
          };

          if (__DEV__) if (__DEV__) console.log('[getActivityData] Processed results:', {
            memorizedDates: result.memorizedVerses.length,
            revisedDates: result.revisedVerses.length,
            totalMemorized: Object.values(memorizedByDate).reduce((a, b) => a + b, 0),
            totalRevised: Object.values(revisedByDate).reduce((a, b) => a + b, 0),
          });

          return result;
        } catch (error) {
          console.error('[getActivityData] Error querying database:', error);

          // Fallback to store data if database query fails
          const state = get();
          const memorizedByDate: Record<string, number> = {};

          Object.entries(state.memorizedVerseDates).forEach(([verseId, date]) => {
            if (date) {
              memorizedByDate[date] = (memorizedByDate[date] || 0) + 1;
            }
          });

          const revisedByDate: Record<string, Set<number>> = {};

          state.revisedVerses.forEach((verse) => {
            if (verse.revisionDate) {
              if (!revisedByDate[verse.revisionDate]) {
                revisedByDate[verse.revisionDate] = new Set();
              }
              revisedByDate[verse.revisionDate].add(verse.verseId);
            }
          });

          return {
            memorizedVerses: Object.entries(memorizedByDate).map(([date, count]) => ({
              date,
              count,
            })),
            revisedVerses: Object.entries(revisedByDate).map(([date, verseSet]) => ({
              date,
              count: verseSet.size,
            })),
          };
        }
      },

      getPageActivityData: () => {
        const state = get();
        const memorizedByDate: Record<string, number> = {};
        const revisedByDate: Record<string, number> = {};

        state.pageMarks.forEach((mark) => {
          if (mark.type === 'memorized') {
            memorizedByDate[mark.markedDate] = (memorizedByDate[mark.markedDate] || 0) + 1;
          } else if (mark.type === 'revised') {
            revisedByDate[mark.markedDate] = (revisedByDate[mark.markedDate] || 0) + 1;
          }
        });

        return {
          memorizedPages: Object.entries(memorizedByDate).map(([date, count]) => ({
            date,
            count,
          })),
          revisedPages: Object.entries(revisedByDate).map(([date, count]) => ({
            date,
            count,
          })),
        };
      },
    }),
    {
      name: 'progress-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Ensure all required arrays/objects exist
        if (!Array.isArray(state.memorizedVerses)) state.memorizedVerses = [];
        if (!Array.isArray(state.revisedVerses)) state.revisedVerses = [];
        if (!Array.isArray(state.pageMarks)) state.pageMarks = [];
        if (!Array.isArray(state.dailyRevisedVerses)) state.dailyRevisedVerses = [];
        if (!Array.isArray(state.weeklyRevisedVerses)) state.weeklyRevisedVerses = [];
        if (!state.memorizedVerseDates) state.memorizedVerseDates = {};
        if (!state.verseStatus) state.verseStatus = {};
        if (!state.revisionSchedule) {
          state.revisionSchedule = DEFAULT_SCHEDULE;
        } else {
          // Robustly ensure all fields exist (deep merge defaults)
          state.revisionSchedule.completedToday = state.revisionSchedule.completedToday || [];
          state.revisionSchedule.completedThisWeek = state.revisionSchedule.completedThisWeek || [];
          state.revisionSchedule.completedPagesToday = state.revisionSchedule.completedPagesToday || [];
          state.revisionSchedule.completedPagesThisWeek = state.revisionSchedule.completedPagesThisWeek || [];
          // Ensure other fields
          if (state.revisionSchedule.versesPerDay === undefined) state.revisionSchedule.versesPerDay = 5;
          if (state.revisionSchedule.pagesPerDay === undefined) state.revisionSchedule.pagesPerDay = 1;
        }

        if (!state.badges) state.badges = DEFAULT_BADGES;
        if (!state.timeSpent) state.timeSpent = DEFAULT_TIME;

        // Check for daily reset
        const today = formatDate(new Date());
        if (state.revisionSchedule.lastResetDate !== today) {
          if (__DEV__) if (__DEV__) console.log('[progressStore] Resetting daily revision schedule (new day)');
          state.revisionSchedule.completedToday = [];
          state.revisionSchedule.completedPagesToday = [];
          state.revisionSchedule.lastResetDate = today;

          // Note: Weekly reset is a bit more complex, ignoring for now to avoid side effects
        }

        // Recompute aggregates
        const { memorizedCount, revisedCount } = recomputeAggregatesFromStatus(state.verseStatus);
        state.memorizedCount = memorizedCount;
        state.revisedCount = revisedCount;

        // Re-sync badge states with actual progress to fix any stale data
        setTimeout(() => {
          try {
            const { QuranProgressTracker } = require('@/data/quranProgress');
            const { surahsData } = require('@/data/surahs');
            const memorizedVerses = state.memorizedVerses || [];

            // Convert verseIds to surah:verse format for QuranProgressTracker
            const memorizedVersesFormatted = memorizedVerses.map(verseId => {
              let startVerseId = 0;
              for (let i = 1; i <= 114; i++) {
                const surah = surahsData.find((s: any) => s.id === i);
                if (!surah) continue;

                if (verseId <= startVerseId + surah.versesCount) {
                  const verseNumber = verseId - startVerseId;
                  return `${i}:${verseNumber}`;
                }
                startVerseId += surah.versesCount;
              }
              return '';
            }).filter(Boolean);

            const progressTracker = new QuranProgressTracker({
              memorizedSurahs: [],
              memorizedJuz: [],
              memorizedVerses: memorizedVersesFormatted
            });

            const progress = progressTracker.calculateProgress();
            const actualCompletedJuz = progress.juz.completed;

            if (__DEV__) if (__DEV__) console.log('[onRehydrateStorage] Re-syncing badges with actual progress:', actualCompletedJuz, 'Juz');
            const resynced = useBadgeStore.getState().resyncBadgesWithProgress(actualCompletedJuz);

            // Note: We don't celebrate on rehydration - celebrations only happen when 
            // actively unlocking badges during app use, not on every app restart
          } catch (error) {
            console.error('[onRehydrateStorage] Error re-syncing badges:', error);
          }
        }, 100);
      },
    }
  )
);

export const selectProgressAggregates = (state: ProgressState) => {
  const memorizedCount = state.memorizedCount || 0;
  const revisedCount = state.revisedCount || 0;
  const total = Math.min(memorizedCount + revisedCount, TOTAL_VERSES);

  return {
    memorizedCount,
    revisedCount,
    totalProgressed: total,
    percent: (total / TOTAL_VERSES) * 100
  };
};
