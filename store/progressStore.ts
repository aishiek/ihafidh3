// Full-ish, compatible persisted progress store (types + simple implementations)
import {
    bulkLogRevisions,
    bulkMarkVersesMemorized,
    logVerseMemorization,
    logVerseRevision
} from '@/assets/database/QuranDatabase';
import { TOTAL_VERSES } from '@/constants/quran';
import { Verse } from '@/types/verse';
import { logAnalyticsEvent, buildMemorizationAnalyticsPayload } from '@/utils/analyticsHelper';

import { JUZ_BOUNDARIES, getJuzFromVerseId, getSurahName, getJuzVerseCount, getJuzSurahCount } from '@/constants/quranMeta';
import { incrementVerseMemorization, incrementVerseRevision, syncMemorizationStats } from '@/services/communityStatsService';

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
        const juzNumber = getJuzFromVerseId(verseId);
        return {
          surahId: s.id,
          surahName: getSurahName(s.id),
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

// ── Bulk-operation guard ────────────────────────────────────────────────────
// Set to true before any bulk write (juz/surah mark-all) and back to false after.
// verse_memorization_toggled checks this and skips firing during bulk operations
// so only juz_memorization_toggled / surah_memorization_toggled fire instead.
let isBulkOperation = false;
export const setBulkOperationGuard = (val: boolean) => { isBulkOperation = val; };

// Separate flag that survives the setTimeout boundary in bulkMarkVersesMemorized.
// isBulkOperation is reset synchronously in finally{} before the setTimeout fires,
// so checkAndCelebrateBadges would see it as false and flood surah_completed events
// (one per newly-completed surah in the juz). This flag is cleared AFTER the callback.
let isBulkCelebration = false;

type BadgeCelebrationCallback = (badge: Badge, isHafidh: boolean) => void;

type RevisedVerse = { verseId: number; revisionDate: string };
type RevisionTracker = { verseId: number; date: string };
type QuizResult = { id: string; date: string; verseIds: number[]; score: number; totalQuestions: number; correct: number; surahId?: number; juzNumber?: number; isAiMode?: boolean };

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
  _lastJuzCount?: number;
  _lastCompletedSurahIds?: number[];

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
  updateDailyStreak: (hasReadEnough?: boolean) => void;
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
      dailyStreak: 1,
      lastOpenDate: null,
      timeSpent: DEFAULT_TIME,
      _lastJuzCount: 0,
      _lastCompletedSurahIds: [],

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

        // Convert verseIds to surah:verse format for QuranProgressTracker
        const memorizedVersesFormatted = memorizedVerses.map(verseId => {
          const info = verseSurahMap[verseId];
          return info ? `${info.surahId}:${info.verseNum}` : '';
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
              days_since_install: daysSinceInstall,
            });
          } catch { /* analytics must never crash */ }

          // ANALYTICS: Milestone reached (if Juz-based)
          if (badge.requirement > 0) {
            try {
              logAnalyticsEvent('memorization_milestone', {
                milestone_type: `${badge.requirement}_juz`,
                badge_unlocked: badge.name ?? 'unknown',
                badge_name: (badge.name ?? 'unknown').toLowerCase().replace(/\s+/g, '_'),
                total_verses_memorized: memorizedVerses.length ?? 0,
                total_surahs_completed: progress.surahs.completed.length ?? 0,
                juz_count: actualCompletedJuz ?? 0,
              });
            } catch { /* analytics must never crash */ }
          }

          badgeCelebrationCallback(badge, isHafidh);
        });

        // ANALYTICS: juz_completed — fires once per newly completed Juz, at 100%
        // Exact tracking for Surah and Juz completions/uncompletions via one unified batch
        const previousJuzCount = (get() as any)._lastJuzCount || 0;
        const previousCompletedJuzIds: number[] = (get() as any)._lastCompletedJuzIds || [];
        const currentCompletedJuzIds: number[] = Array.from((progressTracker as any).userProgress?.memorizedJuz || []);

        const memorizedCountsBySurah: Record<number, number> = {};
        for (const vId of memorizedVerses) {
          const info = verseSurahMap[vId];
          if (info) {
            memorizedCountsBySurah[info.surahId] = (memorizedCountsBySurah[info.surahId] || 0) + 1;
          }
        }

        const previousCompletedSurahs: number[] = (get() as any)._lastCompletedSurahIds || [];
        const currentCompletedSurahIds: number[] = Object.entries(memorizedCountsBySurah)
          .filter(([surahIdStr, count]) => {
            const sId = parseInt(surahIdStr, 10);
            return surahMap[sId] && count === surahMap[sId].versesCount;
          })
          .map(([surahIdStr]) => parseInt(surahIdStr, 10));

        const newlyCompletedSurahIds = currentCompletedSurahIds.filter(id => !previousCompletedSurahs.includes(id));
        const newlyUncompletedSurahIds = previousCompletedSurahs.filter(id => !currentCompletedSurahIds.includes(id));
        const newlyCompletedJuzIds = currentCompletedJuzIds.filter(id => !previousCompletedJuzIds.includes(id));
        const newlyUncompletedJuzIds = previousCompletedJuzIds.filter(id => !currentCompletedJuzIds.includes(id));

        // Fire analytics for newly completed Juzes
        if (newlyCompletedJuzIds.length > 0) {
          try {
            const { logAnalyticsEvent } = require('@/utils/analyticsHelper');
            newlyCompletedJuzIds.forEach(juzNum => {
              logAnalyticsEvent('juz_completed', {
                juz_number: juzNum,
                verse_count: getJuzVerseCount(juzNum),
                surah_count: getJuzSurahCount(juzNum),
                source_screen: 'recite',
              });
            });
          } catch { /* analytics must never crash */ }

          if (previousJuzCount === 0 && actualCompletedJuz > 0) {
            setTimeout(() => {
              try {
                const { useSettingsStore } = require('./settingsStore');
                const { shouldShowReviewPrompt } = require('@/utils/reviewPrompt');
                const settingsState = useSettingsStore.getState();
                if (shouldShowReviewPrompt(settingsState.reviewPromptState, settingsState.reviewPromptSessionShown)) {
                  settingsState.queueSadaqahPrompt('juz_completed');
                }
              } catch { }
            }, 1500);
          }
        }

        // Fire analytics for newly completed Surahs (only when not in a massive bulk celebration)
        if (newlyCompletedSurahIds.length > 0 && !isBulkCelebration) {
          try {
            const { logAnalyticsEvent } = require('@/utils/analyticsHelper');
            const { getJuzForSurah } = require("@/utils/juzCalculator");
            newlyCompletedSurahIds.forEach(sId => {
              const surah = surahMap[sId];
              const juzNum = typeof getJuzForSurah === "function" ? getJuzForSurah(sId) : 0;
              logAnalyticsEvent('surah_completed', {
                surah_number: sId ?? 0,
                surah_name: getSurahName(sId),
                verse_count: surah?.versesCount ?? 0,
                total_verses: surah?.versesCount ?? 0,
                juz_number: juzNum ?? 0,
                completion_type: 'memorization',
                source_screen: 'recite',
              });
            });
          } catch { /* analytics must never crash */ }
        }

        // Batched Firestore Sync: exactly one single batch commit with no double counting
        if (
          newlyCompletedSurahIds.length > 0 ||
          newlyUncompletedSurahIds.length > 0 ||
          newlyCompletedJuzIds.length > 0 ||
          newlyUncompletedJuzIds.length > 0
        ) {
          syncMemorizationStats(
            newlyCompletedSurahIds,
            newlyUncompletedSurahIds,
            newlyCompletedJuzIds,
            newlyUncompletedJuzIds
          );
        }

        set({
          _lastCompletedSurahIds: currentCompletedSurahIds,
          _lastCompletedJuzIds: currentCompletedJuzIds,
          _lastJuzCount: actualCompletedJuz
        } as any);
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
        // Skip during bulk operations — only juz_memorization_toggled / surah_memorization_toggled
        // should fire during mark-all to prevent event flooding.
        const newTotal = (get().memorizedVerses.length || 0) + 1;
        if (!isBulkOperation) {
          try {
            const { surahId, surahName, verseNumber, juzNumber } = resolveVerseInfo(verseId);
            logAnalyticsEvent('verse_memorization_toggled', {
              surah_number: surahId ?? 0,
              surah_name: surahName ?? 'unknown',
              juz_number: juzNumber ?? 0,
              verse_number: verseNumber ?? 0,
              is_memorized: true,
              state: 'memorized',
              source_screen: 'recite',
            });
            incrementVerseMemorization(surahId, true);
          } catch { /* analytics must never crash */ }
        }

        // Check for milestones
        const milestones = [1, 10, 50, 100, 250, 500, 1000, 2000, 6236];
        if (milestones.includes(newTotal)) {
          const milestoneTypeMap: Record<number, string> = {
            1: 'first_verse', 10: '10_verses', 50: '50_verses', 100: '100_verses',
            250: '250_verses', 500: '500_verses', 1000: '1000_verses', 2000: '2000_verses', 6236: 'full_quran',
          };
          try {
            const completedStatsNow = (() => {
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
                return { completedJuz: p.juz.completed, completedSurahs: p.surahs.completed.length };
              } catch { return { completedJuz: 0, completedSurahs: 0 }; }
            })();
            logAnalyticsEvent('memorization_milestone', {
              milestone_type: milestoneTypeMap[newTotal] ?? `${newTotal}_verses`,
              badge_unlocked: milestoneTypeMap[newTotal] ?? `${newTotal} Verses`,
              badge_name: 'unknown',
              total_verses_memorized: newTotal,
              total_surahs_completed: completedStatsNow.completedSurahs ?? 0,
              juz_count: completedStatsNow.completedJuz ?? 0,
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

        // ANALYTICS: Individual verse unmark - skip during bulk operations
        if (!isBulkOperation) {
          try {
            const { surahId, surahName, verseNumber, juzNumber } = resolveVerseInfo(verseId);
            logAnalyticsEvent('verse_memorization_toggled', {
              surah_number: surahId ?? 0,
              surah_name: surahName ?? 'unknown',
              juz_number: juzNumber ?? 0,
              verse_number: verseNumber ?? 0,
              is_memorized: false,
              state: 'unmemorized',
              source_screen: 'recite',
            });
            incrementVerseMemorization(surahId, false);
          } catch { /* analytics must never crash */ }
        }

        // Check for surah and juz uncompletions
        setTimeout(() => {
           get().checkAndCelebrateBadges();
        }, 100);
      },

      bulkMarkVersesMemorized: (ids: number[], isMarking = true) => {
        // Set guard BEFORE writing so individual verse events are suppressed
        isBulkOperation = true;
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

        // ANALYTICS: bulk_mark_verses — fire SINGLE aggregate event, then clear guard
        try {
          const firstId = ids[0];
          const { juzNumber } = firstId ? resolveVerseInfo(firstId) : { juzNumber: 0 };
          logAnalyticsEvent('juz_memorization_toggled', buildMemorizationAnalyticsPayload({
            event_scope: 'juz',
            action: isMarking ? 'mark_memorized' : 'unmark_memorized',
            state: isMarking ? 'memorized' : 'unmemorized',
            trigger_source: 'juz_bulk_action',
            juz_number: juzNumber ?? 0,
            juz_name: `Juz ${juzNumber ?? 0}`,
            verses_count: ids.length ?? 0,
          }));
        } catch { /* analytics must never crash */ } finally {
          // Clear guard regardless of analytics outcome
          isBulkOperation = false;
        }

        // Check for badge unlocks and completions/uncompletions after any bulk operation
        isBulkCelebration = true;
        setTimeout(() => {
          try {
            get().checkAndCelebrateBadges();
          } finally {
            isBulkCelebration = false;
          }
        }, 100);
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
        if (!isBulkOperation) {
          try {
            const { surahId, surahName, verseNumber, juzNumber } = resolveVerseInfo(verseId);
            logAnalyticsEvent('verse_revision_toggled', {
              surah_number: surahId ?? 0,
              surah_name: surahName ?? 'unknown',
              juz_number: juzNumber ?? 0,
              verse_number: verseNumber ?? 0,
              is_revised: true,
              state: 'revised',
              source_screen: 'revise',
            });
            incrementVerseRevision(surahId, true);
          } catch { /* analytics must never crash */ }
        }
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
        if (!isBulkOperation) {
          try {
            const { surahId, surahName, verseNumber, juzNumber } = resolveVerseInfo(verseId);
            logAnalyticsEvent('verse_revision_toggled', {
              surah_number: surahId ?? 0,
              surah_name: surahName ?? 'unknown',
              juz_number: juzNumber ?? 0,
              verse_number: verseNumber ?? 0,
              is_revised: false,
              state: 'unrevised',
              source_screen: 'revise',
            });
            incrementVerseRevision(surahId, false);
          } catch { /* analytics must never crash */ }
        }
      },

      bulkMarkVersesRevised: (ids: number[], isMarking = true) => {
        // Set guard BEFORE writing so individual verse events are suppressed
        isBulkOperation = true;
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

        // ANALYTICS: bulk_mark_verses_revised — fire SINGLE aggregate event
        try {
          const firstId = ids[0];
          const { juzNumber } = firstId ? resolveVerseInfo(firstId) : { juzNumber: 0 };
          logAnalyticsEvent('juz_revision_toggled', {
            juz_number: juzNumber ?? 0,
            verse_count: ids.length ?? 0,
            state: isMarking ? 'revised' : 'unrevised',
            action: isMarking ? 'mark_all' : 'unmark_all',
          });
        } catch { /* analytics must never crash */ } finally {
          isBulkOperation = false;
        }
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

      updateDailyStreak: (hasReadEnough: boolean = false) => {
        set((s) => {
          const today = formatDate(new Date());

          if (!s.lastOpenDate) {
            if (hasReadEnough) {
              return { dailyStreak: 1, lastOpenDate: today };
            }
            return s;
          }

          if (s.lastOpenDate === today) {
            return s; // Already updated today
          }

          // Use UTC dates to avoid Daylight Savings Time (DST) calculation bugs
          const parseDate = (dStr: string) => {
            const [y, m, d] = dStr.split('-').map(Number);
            return Date.UTC(y, m - 1, d);
          };

          const lastTime = parseDate(s.lastOpenDate);
          const curTime = parseDate(today);
          const diff = Math.floor((curTime - lastTime) / (1000 * 60 * 60 * 24));

          if (diff > 1) {
            // Streak broken.
            // If they read enough today, start a new streak of 1
            if (hasReadEnough) {
              return { dailyStreak: 1, lastOpenDate: today };
            } else {
              // Streak broken — reset to 1 (minimum streak is always 1)
              return { dailyStreak: 1 };
            }
          } else if (diff === 1) {
            // Consecutive day. Only increment if they read enough.
            if (hasReadEnough) {
              return { dailyStreak: s.dailyStreak + 1, lastOpenDate: today };
            }
          }
          
          return s;
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
        if (result.isAiMode !== undefined) {
          const { incrementQuizCompletion } = require('@/services/communityStatsService');
          incrementQuizCompletion(result.isAiMode);
        }

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

        // ANALYTICS: Page memorized
        try {
          logAnalyticsEvent('page_memorization_toggled', {
            scope,
            entity_id: entityId,
            page_index: pageIndex,
            verse_count: verseIds.length,
            state: 'memorized',
          });
        } catch { /* analytics must never crash */ }
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

        // ANALYTICS: Page revised
        try {
          logAnalyticsEvent('page_revision_toggled', {
            scope,
            entity_id: entityId,
            page_index: pageIndex,
            verse_count: verseIds.length,
            state: 'revised',
          });
        } catch { /* analytics must never crash */ }
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
