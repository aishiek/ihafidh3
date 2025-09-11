import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDate } from '@/utils/dateUtils';
import { Verse } from '@/types';
import { surahsData } from '@/data/surahs';
import { getJuzVerseRange } from '@/utils/juzCalculator';
import { scheduleRevisionReminders } from '@/utils/notificationUtils';
import { isDailyRevisionGoalMet, isWeeklyRevisionGoalMet } from '@/utils/revisionGoalUtils';
import { logBadgeEarned, logAyahMemorized, logAyahRevised, logSurahRevised } from '@/utils/analyticsUniversal';

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
  saariSabeelillah: boolean; // Walking the Path - 7-day streak
  muratilQuran: boolean; // Beautiful Reciter - 10 perfect quizzes
  hafizJuz: boolean; // Juz Memorizer - Complete one full juz
  hafizQuran: boolean; // Quran Memorizer - Complete entire Quran
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
  memorizedVerses: number[]; // Array of verse IDs
  revisedVerses: RevisedVerse[]; // Array of objects with verse ID and revision date
  dailyRevisedVerses: RevisionTracker[]; // New: Track daily revised verses
  weeklyRevisedVerses: RevisionTracker[]; // New: Track weekly revised verses  
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
  
  markVerseAsMemorized: (verseId: number) => void;
  unmarkVerseAsMemorized: (verseId: number) => void;
  markVerseAsRevised: (verseId: number) => void;
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
      
      markVerseAsMemorized: (verseId) => {
        set((state) => {
          if (state.memorizedVerses.includes(verseId)) {
            return state;
          }
          
          const newMemorizedVerses = [...state.memorizedVerses, verseId];
          
          // Update badges after adding a new memorized verse
          setTimeout(async () => {
            await logAyahMemorized(newMemorizedVerses.length, 'daily');
            get().updateBadges();
          }, 0);
          
          return { memorizedVerses: newMemorizedVerses };
        });
      },
      
      unmarkVerseAsMemorized: (verseId) => {
        set((state) => {
          if (!state.memorizedVerses.includes(verseId)) {
            return state;
          }
          
          const newMemorizedVerses = state.memorizedVerses.filter(id => id !== verseId);
          
          // Update badges after removing a memorized verse
          setTimeout(() => get().updateBadges(), 0);
          
          return { memorizedVerses: newMemorizedVerses };
        });
      },
      
      markVerseAsRevised: (verseId) => {
        set((state) => {
          // Check if the verse is already in the revised list by verseId
          if (state.revisedVerses.some(v => v.verseId === verseId)) {
             return state; // No change needed if already revised
          }

          const today = formatDate(new Date());
          const newRevisedVerses = [...state.revisedVerses, { verseId, revisionDate: today }];
          
          // Update daily revised verses
          const newDailyRevisedVerses = [...state.dailyRevisedVerses, { verseId, date: today }];
          
          // Update weekly revised verses
          const newWeeklyRevisedVerses = [...state.weeklyRevisedVerses, { verseId, date: today }];
          
          // Find surah ID for the verse
          let currentVerseId = 0;
          let surahId = 1;
          for (const surah of surahsData) {
            if (verseId <= currentVerseId + surah.versesCount) {
              break;
            }
            currentVerseId += surah.versesCount;
            surahId++;
          }
          
          // Update weekly revised surahs if not already marked
          const newWeeklyRevisedSurahsCompleted = 
            state.weeklyRevisedSurahsCompleted.includes(surahId)
              ? state.weeklyRevisedSurahsCompleted
              : [...state.weeklyRevisedSurahsCompleted, surahId];
          
          return { 
            revisedVerses: newRevisedVerses,
            dailyRevisedVerses: newDailyRevisedVerses,
            weeklyRevisedVerses: newWeeklyRevisedVerses,
            weeklyRevisedSurahsCompleted: newWeeklyRevisedSurahsCompleted
          };
        });
        // After marking as revised, update notifications
        setTimeout(async () => {
          const revisedVerses = get().revisedVerses;
          await logAyahRevised(revisedVerses.length);
        }, 0);
      },
      
      updateDailyStreak: () => {
        set((state) => {
          const today = formatDate(new Date());
          const currentDate = new Date(today);

          let newStreak = state.dailyStreak;
          let newLastOpenDate = state.lastOpenDate;

          // Handle daily streak logic
          if (state.lastOpenDate === today) {
            // Same day, maintain streak
            newStreak = state.dailyStreak;
            newLastOpenDate = today;
          } else if (!state.lastOpenDate) {
            // First time opening the app
            newStreak = 0;
            newLastOpenDate = today;
          } else {
            const lastDate = new Date(state.lastOpenDate);
            const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
              // Consecutive day
              newStreak = state.dailyStreak + 1;
              newLastOpenDate = today;
            } else if (diffDays > 1) {
              // Streak broken
              newStreak = 0;
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
          const todayDayOfWeek = currentDate.getDay(); // 0 for Sunday
          
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
            (Object.keys(newBadges) as (keyof typeof newBadges)[]).forEach(async (badge) => {
              if (newBadges[badge] && !state.badges[badge]) {
                await logBadgeEarned(badge);
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
        }
      },
    }
  )
);