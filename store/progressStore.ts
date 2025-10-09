import { surahsData } from '@/data/surahs';
import { logVerseActivity } from '@/database/QuranDatabase';
import { Verse } from '@/types';
import { logAyahMemorized, logAyahRevised, logBadgeEarned } from '@/utils/analyticsUniversal';
import { formatDate } from '@/utils/dateUtils';
import { getJuzVerseRange } from '@/utils/juzCalculator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { TOTAL_VERSES } from '@/constants/quran';
import { createJSONStorage, persist } from 'zustand/middleware';

interface TimeSpent {
  total: number; // in seconds
  daily: Record<string, number>; // date string -> seconds
}

interface QuizResult {
  id: string;
  date: string;
  verseIds: number[];
  score: number;
  totalQuestions: number;
  correct: number;
  surahId?: number;
  juzNumber?: number;
}

interface Badges {
  awwalNoor: boolean; // First Light - Complete Juz Amma (Surah 78-114)
  hamilAlHikmah: boolean; // Bearer of Wisdom - Memorize 10 complete surahs
  saariSabeelillah: boolean; // 7-day streak
  muratilQuran: boolean; // 10 perfect quizzes
  hafizJuz: boolean; // Complete one full juz
  hafizQuran: boolean; // Complete entire Quran
}

interface RevisionSchedule {
  versesPerDay: number;
  surahsPerWeek: number[];
  completedToday: number[];
  completedThisWeek: number[];
  lastResetDate: string | null;
}

interface Surah {
  id: number;
  name: string;
  englishName: string;
  versesCount: number;
}

interface RevisedVerse {
  verseId: number;
  revisionDate: string;
}

interface RevisionTracker {
  verseId: number;
  date: string;
}

interface ProgressState {
  // Unified verse status map (source of truth going forward)
  verseStatus: Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }>; 
  memorizedVerses: number[]; // Array of verse IDs
  revisedVerses: RevisedVerse[]; // Array of objects with verse ID and revision date
  dailyRevisedVerses: RevisionTracker[]; // New: Track daily revised verses
  weeklyRevisedVerses: RevisionTracker[]; // New: Track weekly revised verses  
  // Aggregates (derived but cached for cheap subscriptions)
  memorizedCount?: number;
  revisedCount?: number;
  dailyStreak: number;
  lastOpenDate: string | null;
  timeSpent: TimeSpent;
  quizResults: QuizResult[];
  badges: Badges;
  lastReadVerse: Verse | null;
  completedToday: number[]; // Array of verse IDs completed today
  revisionSchedule: RevisionSchedule;
  dailyMarkedForRevisionCount: number;
  lastDailyMarkedForRevisionReset: string | null;
  weeklyRevisedSurahsCompleted: number[]; // IDs of surahs completed for weekly target
  lastWeeklyRevisedSurahsReset: string | null;
  // New: store memorization date per verse (yyyy-MM-dd)
  memorizedVerseDates: Record<number, string>;
  
  markVerseAsMemorized: (verseId: number) => void;
  unmarkVerseAsMemorized: (verseId: number) => void;
  bulkMarkVersesMemorized: (verseIds: number[], isMemorized?: boolean) => Promise<void>;
  markVerseAsRevised: (verseId: number) => void;
  bulkMarkVersesRevised: (verseIds: number[]) => Promise<void>;
  updateDailyStreak: () => void;
  startTimeTracking: () => void;
  stopTimeTracking: () => void;
  addQuizResult: (result: Omit<QuizResult, 'id' | 'date'>) => void;
  updateBadges: () => void;
  setLastReadVerse: (verse: Verse) => void;
  markVerseAsCompletedToday: (verseId: number) => void;
  markVerseAsCompletedThisWeek: (verseId: number) => void;
  resetCompletedToday: () => void;
  setRevisionSchedule: (versesPerDay: number, surahsPerWeek: number[]) => void;
  updateRevisionSchedule: (schedule: Partial<RevisionSchedule>) => void;
  resetDailyMarkedForRevisionCount: () => void;
  resetWeeklyRevisedSurahsCompleted: () => void;
  markVerseForRevision: (verseId: number) => void;
  updateDailyRevisedVerses: (verseId: number) => void; // New
  updateWeeklyRevisedVerses: (verseId: number) => void; // New
  setDailyRevisionTarget: (verses: number) => void; // New
  setWeeklyRevisionSurahs: (surahs: number[]) => void; // New
  updateMemorizedVerses: (ids: number[]) => void;
  updateRevisedVerses: (ids: number[]) => void;
}

const defaultRevisionSchedule: RevisionSchedule = {
  versesPerDay: 5,
  surahsPerWeek: [],
  completedToday: [],
  completedThisWeek: [],
  lastResetDate: null,
};

const defaultBadges: Badges = {
  awwalNoor: false,
  hamilAlHikmah: false,
  saariSabeelillah: false,
  muratilQuran: false,
  hafizJuz: false,
  hafizQuran: false,
};

const defaultTimeSpent: TimeSpent = {
  total: 0,
  daily: {},
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      memorizedVerses: [],
      revisedVerses: [],
      dailyRevisedVerses: [],
      weeklyRevisedVerses: [],
      dailyStreak: 0,
      lastOpenDate: null,
      timeSpent: defaultTimeSpent,
      quizResults: [],
      badges: defaultBadges,
      lastReadVerse: null,
      completedToday: [],
      revisionSchedule: defaultRevisionSchedule,
      dailyMarkedForRevisionCount: 0,
      lastDailyMarkedForRevisionReset: null,
      weeklyRevisedSurahsCompleted: [],
      lastWeeklyRevisedSurahsReset: null,
    memorizedVerseDates: {},
  verseStatus: {},
    memorizedCount: 0,
    revisedCount: 0,
      
      markVerseAsMemorized: (verseId) => {
        set((state): Partial<ProgressState> => {
          const today = formatDate(new Date());
          const current = state.verseStatus[verseId]?.status || 'not_started';
          if (current === 'memorized') return state; // no change

          // Remove from revised if switching
          let revisedVerses = state.revisedVerses;
          if (current === 'revised') {
            revisedVerses = revisedVerses.filter(v => v.verseId !== verseId);
          }

            const newMemorizedVerses = state.memorizedVerses.includes(verseId)
              ? state.memorizedVerses
              : [...state.memorizedVerses, verseId];
          const newStatus = { ...state.verseStatus, [verseId]: { status: 'memorized', last_updated: today } };
          const newMemDates = { ...state.memorizedVerseDates, [verseId]: today };
          const typedStatus = newStatus as Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }>;
          const agg = recomputeAggregates(typedStatus);
          return { memorizedVerses: newMemorizedVerses, revisedVerses, verseStatus: newStatus as Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }>, memorizedVerseDates: newMemDates, memorizedCount: agg.memorizedCount, revisedCount: agg.revisedCount };
        });
        // Log activity (non-blocking)
        setTimeout(() => { try { logVerseActivity(verseId, 'memorized'); } catch {} }, 0);
      },
      
      unmarkVerseAsMemorized: (verseId) => {
        set((state): Partial<ProgressState> => {
          if (!state.memorizedVerses.includes(verseId)) return state as any;
          const newMemorizedVerses = state.memorizedVerses.filter(id => id !== verseId);
          const { [verseId]: _removed, ...restDates } = state.memorizedVerseDates || {};
          const newStatus = { ...state.verseStatus, [verseId]: { status: 'not_started', last_updated: formatDate(new Date()) } };
          setTimeout(() => { try { get().updateBadges(); } catch {} }, 0);
          const typedStatus2 = newStatus as Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }>;
          const agg = recomputeAggregates(typedStatus2);
          return { memorizedVerses: newMemorizedVerses, memorizedVerseDates: restDates, verseStatus: newStatus as Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }>, memorizedCount: agg.memorizedCount, revisedCount: agg.revisedCount };
        });
      },
      
      // Optimized bulk operation for memorizing/unmarking multiple verses
      bulkMarkVersesMemorized: async (verseIds: number[], isMemorized: boolean = true) => {
        try {
          const { bulkMarkVersesMemorized } = await import('../database/QuranDatabase');
          
          // Update database first (batch operation)
          await bulkMarkVersesMemorized(verseIds, isMemorized);
          
          // Update store state efficiently 
          set((state) => {
            const today = formatDate(new Date());
            let memorizedVerses = [...state.memorizedVerses];
            let memorizedVerseDates = { ...state.memorizedVerseDates };
            const verseStatus = { ...state.verseStatus } as Record<number, { status: 'not_started'|'memorized'|'revised'; last_updated: string }>;

            if (isMemorized) {
              const toAdd = verseIds.filter(id => !memorizedVerses.includes(id));
              if (toAdd.length) {
                memorizedVerses.push(...toAdd);
                toAdd.forEach(id => {
                  memorizedVerseDates[id] = today;
                  verseStatus[id] = { status: 'memorized', last_updated: today };
                  // If previously revised, ensure it's not double-counted in revisedVerses array removal not needed here (status map is source of truth for aggregates)
                });
              }
            } else {
              if (verseIds.length) {
                memorizedVerses = memorizedVerses.filter(id => !verseIds.includes(id));
                verseIds.forEach(id => {
                  delete memorizedVerseDates[id];
                  // revert to not_started only if not revised already
                  if (verseStatus[id]?.status === 'memorized') {
                    verseStatus[id] = { status: 'not_started', last_updated: today };
                  }
                });
              }
            }

            // Recompute aggregates from updated status map
            const agg = recomputeAggregates(verseStatus);
            return {
              memorizedVerses,
              memorizedVerseDates,
              verseStatus,
              memorizedCount: agg.memorizedCount,
              revisedCount: agg.revisedCount,
            } as Partial<ProgressState>;
          });
          
          // Update badges and analytics (non-blocking)
          setTimeout(() => {
            try {
              if (isMemorized) {
                const currentTotal = get().memorizedVerses.length;
                logAyahMemorized(currentTotal, 'daily').catch(() => {});
              }
              get().updateBadges();
            } catch (error) {
              // Silently handle errors
            }
          }, 0);
          
        } catch (error) {
          console.error('Bulk mark verses failed:', error);
        }
      },
      
      markVerseAsRevised: (verseId) => {
        set((state): Partial<ProgressState> => {
          const today = formatDate(new Date());
          const current = state.verseStatus[verseId]?.status || 'not_started';
          if (current === 'revised') return state;

          // Remove from memorized if switching
          let memorizedVerses = state.memorizedVerses;
          let memorizedVerseDates = state.memorizedVerseDates;
          if (current === 'memorized') {
            memorizedVerses = memorizedVerses.filter(id => id !== verseId);
            const { [verseId]: _removed, ...rest } = memorizedVerseDates;
            memorizedVerseDates = rest;
          }

          // Add to revised arrays if not already
          const exists = state.revisedVerses.some(v => v.verseId === verseId);
          const newRevisedVerses = exists ? state.revisedVerses : [...state.revisedVerses, { verseId, revisionDate: today }];
          const newDailyRevisedVerses = exists ? state.dailyRevisedVerses : [...state.dailyRevisedVerses, { verseId, date: today }];
          const newWeeklyRevisedVerses = exists ? state.weeklyRevisedVerses : [...state.weeklyRevisedVerses, { verseId, date: today }];

          // Determine surah
          let currentVerseId = 0; let surahId = 1;
          for (const surah of surahsData) { if (verseId <= currentVerseId + surah.versesCount) break; currentVerseId += surah.versesCount; surahId++; }
          const newWeeklyRevisedSurahsCompleted = state.weeklyRevisedSurahsCompleted.includes(surahId)
            ? state.weeklyRevisedSurahsCompleted
            : [...state.weeklyRevisedSurahsCompleted, surahId];

          const newStatus = { ...state.verseStatus, [verseId]: { status: 'revised', last_updated: today } };
          const newState: Partial<ProgressState> = {
            memorizedVerses,
            memorizedVerseDates,
            revisedVerses: newRevisedVerses,
            dailyRevisedVerses: newDailyRevisedVerses,
            weeklyRevisedVerses: newWeeklyRevisedVerses,
            weeklyRevisedSurahsCompleted: newWeeklyRevisedSurahsCompleted,
            verseStatus: newStatus as Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }>,
          };
          const typedStatus3 = newStatus as Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }>;
          const agg = recomputeAggregates(typedStatus3);
          (newState as any).memorizedCount = agg.memorizedCount;
          (newState as any).revisedCount = agg.revisedCount;
          return newState;
        });
        // Log activity (non-blocking)
        setTimeout(() => { try { logVerseActivity(verseId, 'revised'); } catch {} }, 0);
        // After marking as revised, update notifications (non-blocking)
        setTimeout(() => {
          try {
            const revisedVerses = get().revisedVerses;
            logAyahRevised(revisedVerses.length).catch(() => {
              // Silently handle analytics errors to avoid UI lag
            });
          } catch (error) {
            // Silently handle any synchronous errors
          }
        }, 0);
      },
      
      // Optimized bulk operation for marking multiple verses as revised
      bulkMarkVersesRevised: async (verseIds: number[]) => {
        try {
          const { bulkLogRevisions } = await import('../database/QuranDatabase');
          
          // Log bulk revisions to database
          await bulkLogRevisions(verseIds);
          
          // Update store state efficiently
          set((state) => {
            const today = formatDate(new Date());
            let newRevisedVerses = [...state.revisedVerses];
            let newDailyRevisedVerses = [...state.dailyRevisedVerses];
            let newWeeklyRevisedVerses = [...state.weeklyRevisedVerses];
            let newWeeklyRevisedSurahsCompleted = [...state.weeklyRevisedSurahsCompleted];
            
            verseIds.forEach(verseId => {
              // Only add if not already revised
              if (!newRevisedVerses.some(v => v.verseId === verseId)) {
                newRevisedVerses.push({ verseId, revisionDate: today });
                newDailyRevisedVerses.push({ verseId, date: today });
                newWeeklyRevisedVerses.push({ verseId, date: today });
                
                // Find surah ID for weekly tracking
                let currentVerseId = 0;
                let surahId = 1;
                for (const surah of surahsData) {
                  if (verseId <= currentVerseId + surah.versesCount) {
                    break;
                  }
                  currentVerseId += surah.versesCount;
                  surahId++;
                }
                
                if (!newWeeklyRevisedSurahsCompleted.includes(surahId)) {
                  newWeeklyRevisedSurahsCompleted.push(surahId);
                }
              }
            });
            
            // Update unified status map
            const todayLocal = formatDate(new Date());
            const verseStatus = { ...state.verseStatus };
            verseIds.forEach(id => {
              verseStatus[id] = { status: 'revised', last_updated: todayLocal } as { status: 'revised'; last_updated: string };
            });
            const partial = {
              revisedVerses: newRevisedVerses,
              dailyRevisedVerses: newDailyRevisedVerses,
              weeklyRevisedVerses: newWeeklyRevisedVerses,
              weeklyRevisedSurahsCompleted: newWeeklyRevisedSurahsCompleted,
              verseStatus: verseStatus as Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }>,
            } as Partial<ProgressState>;
            const agg = recomputeAggregates(verseStatus);
            (partial as any).memorizedCount = agg.memorizedCount;
            (partial as any).revisedCount = agg.revisedCount;
            return partial;
          });
          
          // Update analytics (non-blocking)
          setTimeout(() => {
            try {
              const revisedVerses = get().revisedVerses;
              logAyahRevised(revisedVerses.length).catch(() => {});
            } catch (error) {
              // Silently handle errors
            }
          }, 0);
          
        } catch (error) {
          console.error('Bulk mark verses revised failed:', error);
        }
      },
      
      updateDailyStreak: () => {
        set((state) => {
          const today = formatDate(new Date());

          let newStreak = state.dailyStreak;
          let newLastOpenDate = state.lastOpenDate;

          // Handle daily streak logic based on calendar dates
          if (state.lastOpenDate === today) {
            // Same day, maintain current streak
            newStreak = state.dailyStreak;
            newLastOpenDate = today;
          } else if (!state.lastOpenDate) {
            // First time opening the app - start streak at 1
            newStreak = 1;
            newLastOpenDate = today;
          } else {
            // Calculate the difference in calendar days
            const lastDate = new Date(state.lastOpenDate + 'T00:00:00'); // Ensure consistent timezone
            const currentDate = new Date(today + 'T00:00:00');
            
            // Calculate difference in days using calendar dates
            const diffTime = currentDate.getTime() - lastDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
              // Consecutive day - increment streak
              newStreak = state.dailyStreak + 1;
              newLastOpenDate = today;
            } else if (diffDays > 1) {
              // Missed one or more days - reset streak to 1 (today is the new start)
              newStreak = 1;
              newLastOpenDate = today;
            } else {
              // This shouldn't happen if dates are properly formatted, but handle gracefully
              newStreak = state.dailyStreak;
              newLastOpenDate = today;
            }
          }

          // Reset daily count and daily revised verses if it's a new day
          const lastDailyResetDate = state.lastDailyMarkedForRevisionReset;
          let newDailyMarkedForRevisionCount = state.dailyMarkedForRevisionCount;
          let newLastDailyRevisionReset = lastDailyResetDate;
          let newDailyRevisedVerses = state.dailyRevisedVerses;

          if (lastDailyResetDate !== today) {
            newDailyMarkedForRevisionCount = 0;
            newLastDailyRevisionReset = today;
            // Clear daily revised verses for the new day
            newDailyRevisedVerses = [];
          }

          // Reset weekly count and weekly revised verses if it's a new week (Sunday)
          const lastWeeklyResetDate = state.lastWeeklyRevisedSurahsReset;
          let newWeeklyRevisedSurahsCompleted = state.weeklyRevisedSurahsCompleted;
          let newLastWeeklyRevisedSurahsReset = lastWeeklyResetDate;
          let newWeeklyRevisedVerses = state.weeklyRevisedVerses;
          const todayDayOfWeek = new Date(today).getDay(); // 0 for Sunday
          
          // Condition to reset weekly: today is Sunday AND it hasn't been reset today yet
          const shouldResetWeekly = todayDayOfWeek === 0 && lastWeeklyResetDate !== today;
          
          if (shouldResetWeekly) {
              newWeeklyRevisedSurahsCompleted = [];
              newLastWeeklyRevisedSurahsReset = today;
              // Clear weekly revised verses for the new week
              newWeeklyRevisedVerses = [];
          }

          const newState = { 
            ...state, 
            dailyStreak: newStreak, 
            lastOpenDate: newLastOpenDate, 
            dailyMarkedForRevisionCount: newDailyMarkedForRevisionCount, 
            lastDailyMarkedForRevisionReset: newLastDailyRevisionReset, 
            weeklyRevisedSurahsCompleted: newWeeklyRevisedSurahsCompleted, 
            lastWeeklyRevisedSurahsReset: newLastWeeklyRevisedSurahsReset,
            dailyRevisedVerses: newDailyRevisedVerses,
            weeklyRevisedVerses: newWeeklyRevisedVerses
          };
          return newState;
        });
      },
      
      startTimeTracking: () => {
        const startTime = Date.now();
        
        // Store start time in AsyncStorage
        AsyncStorage.setItem('timeTrackingStart', startTime.toString());
      },
      
      stopTimeTracking: () => {
        AsyncStorage.getItem('timeTrackingStart').then((startTimeStr) => {
          if (!startTimeStr) {
            return;
          }
          
          const startTime = parseInt(startTimeStr);
          const endTime = Date.now();
          const sessionDuration = Math.floor((endTime - startTime) / 1000); // in seconds
          
          if (sessionDuration <= 0) return;
          
          set((state) => {
            const today = formatDate(new Date());
            const dailyTime = state.timeSpent.daily[today] || 0;
            return {
              timeSpent: {
                total: state.timeSpent.total + sessionDuration,
                daily: {
                  ...state.timeSpent.daily,
                  [today]: dailyTime + sessionDuration,
                },
              },
            };
          });
          
          // Clear the start time
          AsyncStorage.removeItem('timeTrackingStart');
        });
      },
      
      addQuizResult: (result) => {
        set((state) => {
          const newResult: QuizResult = {
            ...result,
            id: Date.now().toString(),
            date: formatDate(new Date()),
          };
          
          const newResults = [...state.quizResults, newResult];
          
          // Update badges after adding a quiz result
          setTimeout(() => get().updateBadges(), 0);
          
          return { quizResults: newResults };
        });
      },
      
      updateBadges: () => {
        set((state) => {
          const { memorizedVerses, dailyStreak, quizResults } = state;
          
          // First Light badge: all verses from Surah 78 to 114 must be memorized
          let verseCount = 0;
          for (let i = 1; i < 78; i++) {
            verseCount += surahsData[i-1].versesCount;
          }
          const startId = verseCount + 1;
          let endId = verseCount;
          for (let i = 78; i <= 114; i++) {
            endId += surahsData[i-1].versesCount;
          }
          let allJuz30Memorized = true;
          for (let id = startId; id <= endId; id++) {
            if (!memorizedVerses.includes(id)) {
              allJuz30Memorized = false;
              break;
            }
          }
          const awwalNoor = allJuz30Memorized;
          
          // Hamil Al-Hikmah badge: memorize 10 complete surahs
          const completeSurahs = surahsData.filter((surah: Surah) => {
            let verseCount = 0;
            for (let i = 1; i < surah.id; i++) {
              const prevSurah = surahsData.find((s: Surah) => s.id === i);
              if (prevSurah) verseCount += prevSurah.versesCount;
            }
            const startId = verseCount + 1;
            const endId = verseCount + surah.versesCount;
            return Array.from({ length: surah.versesCount }, (_, i) => startId + i)
              .every(id => memorizedVerses.includes(id));
          }).length;
          const hamilAlHikmah = completeSurahs >= 10;
          
          // Saari Sabeelillah badge: 7-day streak
          const saariSabeelillah = dailyStreak >= 7;
          
          // Muratil Quran badge: 10 perfect quizzes
          const perfectQuizzes = quizResults.filter(
            (r) => r.score === r.totalQuestions
          ).length;
          const muratilQuran = perfectQuizzes >= 10;
          
          // Hafiz Juz badge: complete one full juz
          const juzMemorized = Array.from(new Set(memorizedVerses.map(id => {
            // Use proper Juz calculation instead of simple division
            let verseCounter = 0;
            for (let s = 0; s < surahsData.length; s++) {
              const surah = surahsData[s];
              for (let v = 1; v <= surah.versesCount; v++) {
                verseCounter++;
                if (verseCounter === id) {
                  // Find which Juz this verse belongs to using proper mapping
                  for (let juz = 1; juz <= 30; juz++) {
                    const range = getJuzVerseRange(juz);
                    if (id >= range.startVerseId && id <= range.endVerseId) {
                      return juz;
                    }
                  }
                  return 1; // fallback
                }
              }
            }
            return 1; // fallback
          }))).length;
          const hafizJuz = juzMemorized >= 1;
          
          // Hafiz Quran badge: complete entire Quran
          const hafizQuran = memorizedVerses.length >= 6236;
          const newBadges = {
              awwalNoor,
              hamilAlHikmah,
              saariSabeelillah,
              muratilQuran,
              hafizJuz,
              hafizQuran,
          };
          // Only update if badges actually changed
          if (JSON.stringify(state.badges) !== JSON.stringify(newBadges)) {
            // Log badge achievements non-blocking to avoid UI lag
            (Object.keys(newBadges) as (keyof typeof newBadges)[]).forEach((badge) => {
              if (newBadges[badge] && !state.badges[badge]) {
                setTimeout(() => {
                  logBadgeEarned(badge).catch(() => {
                    // Silently handle analytics errors
                  });
                }, 0);
              }
            });
            return { badges: newBadges };
          }
          return state; // No change
        });
      },
      
      setLastReadVerse: (verse) => {
        set({ lastReadVerse: verse });
      },
      
      markVerseAsCompletedToday: (verseId) => {
        set((state) => {
          if (state.completedToday.includes(verseId)) {
            return state;
          }
          
          return { completedToday: [...state.completedToday, verseId] };
        });
      },
      
      markVerseAsCompletedThisWeek: (verseId) => {
        set((state) => {
          const currentSchedule = state.revisionSchedule || defaultRevisionSchedule;
          if (currentSchedule.completedThisWeek.includes(verseId)) {
            return state;
          }
          
          return {
            revisionSchedule: {
              ...currentSchedule,
              completedThisWeek: [...currentSchedule.completedThisWeek, verseId]
            }
          };
        });
      },
      
      resetCompletedToday: () => {
        set({ completedToday: [] });
      },
      
      setRevisionSchedule: (versesPerDay, surahsPerWeek) => {
        set((state) => ({
          revisionSchedule: {
            ...(state.revisionSchedule || defaultRevisionSchedule),
            versesPerDay,
            surahsPerWeek,
          },
        }));
      },
      
      updateRevisionSchedule: (schedule) => {
        set((state) => ({
          revisionSchedule: {
            ...(state.revisionSchedule || defaultRevisionSchedule),
            ...schedule,
          },
        }));
      },
      
      resetDailyMarkedForRevisionCount: () => {
        set({ dailyMarkedForRevisionCount: 0, lastDailyMarkedForRevisionReset: formatDate(new Date()) });
      },
      
      resetWeeklyRevisedSurahsCompleted: () => {
        set({ weeklyRevisedSurahsCompleted: [], lastWeeklyRevisedSurahsReset: formatDate(new Date()) });
      },
      
      markVerseForRevision: (verseId) => {
        set((state) => {
          // Mark the verse as revised
          state.markVerseAsRevised(verseId);
          return state;
        });
      },
      
      updateDailyRevisedVerses: (verseId) => {
        set((state) => {
          const today = formatDate(new Date());
          const newDailyRevisedVerses = [...state.dailyRevisedVerses, { verseId, date: today }];
          return { dailyRevisedVerses: newDailyRevisedVerses };
        });
      },
      
      updateWeeklyRevisedVerses: (verseId) => {
        set((state) => {
          const today = formatDate(new Date());
          const newWeeklyRevisedVerses = [...state.weeklyRevisedVerses, { verseId, date: today }];
          return { weeklyRevisedVerses: newWeeklyRevisedVerses };
        });
      },
      
      setDailyRevisionTarget: (verses) => {
        set((state) => ({
          revisionSchedule: {
            ...state.revisionSchedule,
            versesPerDay: verses,
          },
        }));
      },
      
      setWeeklyRevisionSurahs: (surahs) => {
        set((state) => ({
          revisionSchedule: {
            ...state.revisionSchedule,
            surahsPerWeek: surahs,
          },
        }));
      },
      updateMemorizedVerses: (ids: number[]) => set({ memorizedVerses: ids }),
      updateRevisedVerses: (ids: number[]) => set({ revisedVerses: ids.map(id => ({ verseId: id, revisionDate: new Date().toISOString() })) }),
    }),
    {
      name: 'progress-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Ensure proper initialization of nested objects and new counters
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure revisionSchedule is properly initialized
          if (!state.revisionSchedule) {
            state.revisionSchedule = { ...defaultRevisionSchedule };
          } else {
            // Ensure all properties exist with proper defaults
            state.revisionSchedule = {
              versesPerDay: state.revisionSchedule.versesPerDay || 5,
              surahsPerWeek: state.revisionSchedule.surahsPerWeek || [],
              completedToday: state.revisionSchedule.completedToday || [],
              completedThisWeek: state.revisionSchedule.completedThisWeek || [],
              lastResetDate: state.revisionSchedule.lastResetDate || null,
            };
          }
          
          // Ensure badges are properly initialized
          if (!state.badges) {
            state.badges = { ...defaultBadges };
          } else {
            state.badges = {
              ...defaultBadges,
              ...state.badges,
            };
          }
          
          // Ensure timeSpent is properly initialized
          if (!state.timeSpent) {
            state.timeSpent = { ...defaultTimeSpent };
          } else {
            state.timeSpent = {
              total: state.timeSpent.total || 0,
              daily: state.timeSpent.daily || {},
            };
          }
          
          // Ensure arrays are properly initialized
          if (!Array.isArray(state.memorizedVerses)) {
            state.memorizedVerses = [];
          }
          if (!Array.isArray(state.revisedVerses)) {
            state.revisedVerses = [];
          }
          if (!Array.isArray(state.completedToday)) {
            state.completedToday = [];
          }
          if (!Array.isArray(state.quizResults)) {
            state.quizResults = [];
          }
          if (!Array.isArray(state.dailyRevisedVerses)) {
            state.dailyRevisedVerses = [];
          }
          if (!Array.isArray(state.weeklyRevisedVerses)) {
            state.weeklyRevisedVerses = [];
          }
          
          // Ensure new revision counters and reset dates are initialized
          if (state.dailyMarkedForRevisionCount === undefined) state.dailyMarkedForRevisionCount = 0;
          if (state.lastDailyMarkedForRevisionReset === undefined) state.lastDailyMarkedForRevisionReset = null;
          if (state.weeklyRevisedSurahsCompleted === undefined) state.weeklyRevisedSurahsCompleted = [];
          if (state.lastWeeklyRevisedSurahsReset === undefined) state.lastWeeklyRevisedSurahsReset = null;
          
          // Ensure memorized verse dates object is initialized
          if (!state.memorizedVerseDates) {
            state.memorizedVerseDates = {} as Record<number, string>;
          }

          // Migration: populate verseStatus if empty using existing arrays
          if (state.verseStatus && Object.keys(state.verseStatus).length === 0) {
            const today = formatDate(new Date());
            const vs: Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }> = {};
            (state.memorizedVerses || []).forEach(id => { vs[id] = { status: 'memorized', last_updated: today }; });
            (state.revisedVerses || []).forEach(rv => { vs[rv.verseId] = { status: 'revised', last_updated: rv.revisionDate || today }; });
            state.verseStatus = vs;
          }
          // Recompute aggregates
          const agg = recomputeAggregates(state.verseStatus || {});
          state.memorizedCount = agg.memorizedCount;
            state.revisedCount = agg.revisedCount;
          const total = (agg.memorizedCount || 0) + (agg.revisedCount || 0);
          if (total > TOTAL_VERSES) {
            console.warn('[progressStore] Invariant violation: total progressed verses exceeds TOTAL_VERSES');
          }
        }
      },
    }
  )
);

// Utility to recompute aggregates centrally
function recomputeAggregates(verseStatus: Record<number, { status: 'not_started' | 'memorized' | 'revised'; last_updated: string }>) {
  let memorizedCount = 0; let revisedCount = 0;
  Object.values(verseStatus).forEach(entry => {
    if (entry.status === 'memorized') memorizedCount++; else if (entry.status === 'revised') revisedCount++;
  });
  return { memorizedCount, revisedCount };
}

// Public selector helpers
export const selectProgressAggregates = (state: ProgressState) => {
  const memorizedCount = state.memorizedCount || 0;
  const revisedCount = state.revisedCount || 0;
  const total = Math.min(memorizedCount + revisedCount, TOTAL_VERSES);
  return {
    memorizedCount,
    revisedCount,
    totalProgressed: total,
    percent: (total / TOTAL_VERSES) * 100,
  };
};