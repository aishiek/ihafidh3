// Full-ish, compatible persisted progress store (types + simple implementations)
import {
  bulkLogRevisions,
  bulkMarkVersesMemorized,
  logVerseMemorization,
  logVerseRevision
} from '@/assets/database/QuranDatabase';
import { TOTAL_VERSES } from '@/constants/quran';
import { Verse } from '@/types/verse';
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
  bulkMarkVersesRevised: (ids: number[]) => void;
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
          console.log('[celebrateBadge] No callback set');
          return;
        }

        const badge = useBadgeStore.getState().badges.find(b => b.id === badgeId);
        if (!badge) {
          console.log('[celebrateBadge] Badge not found:', badgeId);
          return;
        }

        if (!badge.unlocked) {
          console.log('[celebrateBadge] Badge not unlocked:', badgeId);
          return;
        }

        const isHafidh = badge.id === 'hafidh-quran';
        console.log('[celebrateBadge] Celebrating badge:', badge.name, 'isHafidh:', isHafidh);
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

        console.log('[checkAndCelebrateBadges] Actual completed Juz:', actualCompletedJuz, 'Total verses:', memorizedVerses.length);

        // Check for new badges using actual Juz count
        const newlyUnlocked = useBadgeStore.getState().checkAndUnlockBadges(actualCompletedJuz);

        console.log('[checkAndCelebrateBadges] Newly unlocked badges:', newlyUnlocked.map(b => b.name));

        // Celebrate each newly unlocked badge
        newlyUnlocked.forEach(badge => {
          const isHafidh = badge.id === 'hafidh-quran';
          if (__DEV__) console.log('[checkAndCelebrateBadges] Celebrating badge:', badge.name, 'isHafidh:', isHafidh);
          badgeCelebrationCallback(badge, isHafidh);
        });
      },

      // actions
      markVerseAsMemorized: (verseId: number) => {
        // Log memorization activity to the database
        logVerseMemorization(verseId).catch(() => { });

        set((s) => {
          if (s.memorizedVerses.includes(verseId)) return {};
          const memorizedVerses = [...s.memorizedVerses, verseId];
          const memorizedVerseDates = { ...s.memorizedVerseDates, [verseId]: formatDate(new Date()) };
          const verseStatus = { ...s.verseStatus, [verseId]: { status: 'memorized' as const, last_updated: formatDate(new Date()) } };
          const agg = recomputeAggregatesFromStatus(verseStatus);
          return { memorizedVerses, memorizedVerseDates, verseStatus, ...agg };
        });
      },

      unmarkVerseAsMemorized: (verseId: number) => {
        set((s) => {
          const memorizedVerses = s.memorizedVerses.filter((v) => v !== verseId);
          const memorizedVerseDates = { ...s.memorizedVerseDates };
          delete memorizedVerseDates[verseId];
          const verseStatus = { ...s.verseStatus, [verseId]: { status: 'not_started' as const, last_updated: formatDate(new Date()) } };
          const agg = recomputeAggregatesFromStatus(verseStatus);
          return { memorizedVerses, memorizedVerseDates, verseStatus, ...agg };
        });
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
            last_updated: formatDate(new Date())
          }));

          const agg = recomputeAggregatesFromStatus(verseStatus);
          return { memorizedVerses, memorizedVerseDates, verseStatus, ...agg };
        });

        // Check for badge unlocks after marking (only when marking, not unmarking)
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
          const dailyRevisedVerses = [...s.dailyRevisedVerses, { verseId, date: today }];
          const weeklyRevisedVerses = [...s.weeklyRevisedVerses, { verseId, date: today }];
          const verseStatus = {
            ...s.verseStatus,
            [verseId]: {
              status: 'revised' as const,
              last_updated: today
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
              last_updated: formatDate(new Date())
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
      },

      bulkMarkVersesRevised: (ids: number[]) => {
        // Log bulk revision activity to the database
        bulkLogRevisions(ids).catch(() => { });

        set((s) => {
          const today = formatDate(new Date());
          const revisedVerses = [...s.revisedVerses];
          const dailyRevisedVerses = [...s.dailyRevisedVerses];
          const weeklyRevisedVerses = [...s.weeklyRevisedVerses];
          // Only add verses that aren't already marked as revised
          ids.forEach((id) => {
            if (!revisedVerses.some((r) => r.verseId === id)) {
              revisedVerses.push({ verseId: id, revisionDate: today });
              dailyRevisedVerses.push({ verseId: id, date: today });
              weeklyRevisedVerses.push({ verseId: id, date: today });
            }
          });
          // Update verse status for all provided IDs
          const verseStatus = { ...s.verseStatus };
          ids.forEach((id) => {
            verseStatus[id] = {
              status: 'revised' as const,
              last_updated: today
            };
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
        set((s) => ({
          dailyRevisedVerses: [
            ...s.dailyRevisedVerses,
            { verseId, date: formatDate(new Date()) }
          ]
        }));
      },

      updateWeeklyRevisedVerses: (verseId: number) => {
        set((s) => ({
          weeklyRevisedVerses: [
            ...s.weeklyRevisedVerses,
            { verseId, date: formatDate(new Date()) }
          ]
        }));
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

          // Check if we need to reset daily/weekly counters based on date?
          // Ideally this reset logic should be centralized, but for now we append.
          // The reset logic usually happens on app open or when accessing the schedule.
          // Here we just add to the list if not present.

          const completedPagesToday = currentSchedule.completedPagesToday.includes(pageKey)
            ? currentSchedule.completedPagesToday
            : [...currentSchedule.completedPagesToday, pageKey];

          const completedPagesThisWeek = currentSchedule.completedPagesThisWeek.includes(pageKey)
            ? currentSchedule.completedPagesThisWeek
            : [...currentSchedule.completedPagesThisWeek, pageKey];

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
              completedPagesToday: currentSchedule.completedPagesToday.filter(k => k !== pageKey),
              completedPagesThisWeek: currentSchedule.completedPagesThisWeek.filter(k => k !== pageKey)
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

          console.log('[getActivityData] Querying database from', startDateStr, 'to', endDate);

          // Get activities from database
          const activities = await getVerseActivitiesBetween(startDateStr, endDate);

          console.log('[getActivityData] Retrieved', activities.length, 'activity groups from database');

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

          console.log('[getActivityData] Processed results:', {
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
        if (!state.revisionSchedule) state.revisionSchedule = DEFAULT_SCHEDULE;
        if (!state.badges) state.badges = DEFAULT_BADGES;
        if (!state.timeSpent) state.timeSpent = DEFAULT_TIME;

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

            console.log('[onRehydrateStorage] Re-syncing badges with actual progress:', actualCompletedJuz, 'Juz');
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
