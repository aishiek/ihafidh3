import { QuranActiveTimeManager } from '@/utils/activeTimeTracker';
import { logAnalyticsEvent } from '@/utils/analyticsHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { formatDate } from '../utils/dateUtils';

interface TimeSpent {
  daily: number; // seconds
  weekly: number; // seconds
  monthly: number; // seconds
  total: number; // seconds
  lastResetDaily: string; // YYYY-MM-DD
  lastResetWeekly: string; // YYYY-MM-DD
  lastResetMonthly: string; // YYYY-MM-DD
}

interface DailyActivity {
  date: string; // YYYY-MM-DD
  versesRead: number;
  timeSpent: number; // seconds
  hadActivity: boolean;
  readVerseKeys?: string[]; // "surahId:verseNumber"
  readSurahIds?: number[];
}

interface ActivityState {
  // Streak tracking
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  
  // Time tracking
  sessionStartTime: number | null;
  timeSpent: TimeSpent;
  dailyActivities: DailyActivity[];
  
  // Active time manager (not persisted)
  activeTimeManager: QuranActiveTimeManager | null;
  
  // Daily revision tracking
  dailyRevisionTarget: number;
  dailyRevisionCompleted: number;
  weeklyRevisionTarget: number; // surahs
  weeklyRevisionCompleted: number;
  weeklyRevisionSurahs: number[]; // surah IDs
  
  // Actions
  initializeActiveTimeManager: () => QuranActiveTimeManager | null;
  startSession: () => void;
  endSession: () => void;
  forceClearSession: () => void;
  updateStreak: () => void;
  recordActivity: (versesRead: number) => void;
  recordVerseRead: (surahId: number, verseNumber: number) => void;
  setDailyRevisionTarget: (target: number) => void;
  setWeeklyRevisionTarget: (target: number) => void;
  markVerseRevised: () => void;
  markSurahRevised: (surahId: number) => void;
  getTimeSpentToday: () => number;
  getTimeSpentThisWeek: () => number;
  getTimeSpentThisMonth: () => number;
  resetDailyProgress: () => void;
  resetWeeklyProgress: () => void;
}

const getTodayDate = () => formatDate(new Date());

const getWeekStart = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split('T')[0];
};

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: null,
      sessionStartTime: null,
      activeTimeManager: null, // Not persisted, will be initialized
      timeSpent: {
        daily: 0,
        weekly: 0,
        monthly: 0,
        total: 0,
        lastResetDaily: getTodayDate(),
        lastResetWeekly: getWeekStart(),
        lastResetMonthly: getMonthStart(),
      },
      dailyActivities: [],
      dailyRevisionTarget: 5,
      dailyRevisionCompleted: 0,
      weeklyRevisionTarget: 2,
      weeklyRevisionCompleted: 0,
      weeklyRevisionSurahs: [],
      
      initializeActiveTimeManager: () => {
        const state = get();
        if (state.activeTimeManager) return state.activeTimeManager;
        try {
          const manager = new QuranActiveTimeManager();
          set({ activeTimeManager: manager });
          return manager;
        } catch (e) {
          console.warn('[activity] Failed to init active time manager:', e);
          return null;
        }
      },
      
      startSession: () => {
        const state = get();
        // Ensure manager exists and capture the instance to avoid races
        const manager = state.activeTimeManager ?? state.initializeActiveTimeManager();
        
        const today = getTodayDate();
        const weekStart = getWeekStart();
        const monthStart = getMonthStart();
        
        // Check if we need to reset daily progress
        if (state.timeSpent.lastResetDaily !== today) {
          state.resetDailyProgress();
        }
        
        // Check if we need to reset weekly progress
        if (state.timeSpent.lastResetWeekly !== weekStart) {
          state.resetWeeklyProgress();
        }
        
        // Check if we need to reset monthly progress
        if (state.timeSpent.lastResetMonthly !== monthStart) {
          set({
            timeSpent: {
              ...state.timeSpent,
              monthly: 0,
              lastResetMonthly: monthStart,
            },
          });
        }
        
        // Start active time tracking (ensure manager exists now)
        try {
          manager?.startReading();
        } catch (e) {
          console.warn('[activity] startReading failed:', e);
        }
        
        set({ sessionStartTime: Date.now() });
      },
      
      endSession: () => {
        const { sessionStartTime, timeSpent, activeTimeManager } = get();
        
        if (!sessionStartTime) {
          return;
        }
        
        // Calculate elapsed time
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        
        // Get manager time if available
        let managerTime = 0;
        if (activeTimeManager) {
          try {
            const stats = activeTimeManager.getStats();
            managerTime = stats?.totalTimeSeconds || 0;
            // Stop the manager after getting stats
            activeTimeManager.stopReading();
          } catch (e) {
            console.warn('[ActivityStore] Error getting manager stats:', e);
          }
        }
        
        // Use activeTimeManager if available (it correctly pauses when app is idle or in background).
        // Otherwise fallback to elapsed capped at 4 hours (14400s) to prevent overnight accumulation.
        const timeToAdd = activeTimeManager ? managerTime : Math.min(elapsed, 14400);
        
        // CRITICAL: Add to total
        const newTotal = (timeSpent?.total || 0) + timeToAdd;
        
        // Update state
        set({
          sessionStartTime: null,
          timeSpent: {
            daily: timeSpent.daily + timeToAdd,
            weekly: timeSpent.weekly + timeToAdd,
            monthly: timeSpent.monthly + timeToAdd,
            total: newTotal,
            lastResetDaily: timeSpent.lastResetDaily,
            lastResetWeekly: timeSpent.lastResetWeekly,
            lastResetMonthly: timeSpent.lastResetMonthly,
          },
        });
        
        // Update daily activity
        get().recordActivity(0);
      },

      // In case we detect an orphaned session on startup or error conditions
      forceClearSession: () => {
        const s = get();
        if (s.sessionStartTime) {
          set({ sessionStartTime: null });
        }
      },
      
      updateStreak: () => {
        const { lastActivityDate, currentStreak, longestStreak } = get();
        const today = getTodayDate();
        const hasReadEnough = get().getTimeSpentToday() >= 60;
        
        if (!lastActivityDate) {
          if (hasReadEnough) {
            const newLongest = Math.max(1, longestStreak);
            set({
              currentStreak: 1,
              longestStreak: newLongest,
              lastActivityDate: today,
            });
            logAnalyticsEvent('streak_achieved', {
              streak_days: 1,
              longest_streak: newLongest,
              is_milestone: false,
            });
          }
          return;
        }

        if (lastActivityDate === today) {
          return; // Already updated today
        }
        
        const parseDate = (dStr: string) => {
          const [y, m, d] = dStr.split('-').map(Number);
          return Date.UTC(y, m - 1, d);
        };
        
        const lastTime = parseDate(lastActivityDate);
        const curTime = parseDate(today);
        const diffDays = Math.floor((curTime - lastTime) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
          // Streak broken
          if (hasReadEnough) {
            const newLongest = Math.max(1, longestStreak);
            set({
              currentStreak: 1,
              longestStreak: newLongest,
              lastActivityDate: today,
            });
            logAnalyticsEvent('streak_achieved', {
              streak_days: 1,
              longest_streak: newLongest,
              is_milestone: false,
            });
          } else {
            set({ currentStreak: 1 }); // reset to 1 — minimum streak is always 1
          }
        } else if (diffDays === 1) {
          // Consecutive day
          if (hasReadEnough) {
            const newStreak = currentStreak + 1;
            const newLongest = Math.max(newStreak, longestStreak);
            set({
              currentStreak: newStreak,
              longestStreak: newLongest,
              lastActivityDate: today,
            });
            const isMilestone = [3, 7, 14, 30, 60, 100, 365].includes(newStreak);
            logAnalyticsEvent('streak_achieved', {
              streak_days: newStreak,
              longest_streak: newLongest,
              is_milestone: isMilestone,
            });

            // Item 10: streak milestone is one of the three positive moments
            // the spec calls out for the review sentiment prompt.
            if (isMilestone) {
              setTimeout(() => {
                try {
                  const { useSettingsStore } = require('./settingsStore');
                  const { shouldShowReviewPrompt } = require('@/utils/reviewPrompt');
                  const settingsState = useSettingsStore.getState();
                  if (shouldShowReviewPrompt(settingsState.reviewPromptState, settingsState.reviewPromptSessionShown)) {
                    settingsState.queueSadaqahPrompt('streak_milestone');
                  }
                } catch { }
              }, 1500);
            }
          }
        }
      },
      
      recordActivity: (versesRead: number) => {
        const { dailyActivities } = get();
        const today = getTodayDate();
        
        const existingActivity = dailyActivities.find(a => a.date === today);
        
        if (existingActivity) {
          // Update existing activity
          const updated = dailyActivities.map(a => 
            a.date === today 
              ? { 
                  ...a, 
                  versesRead: a.versesRead + versesRead, 
                  timeSpent: get().getTimeSpentToday(),
                  hadActivity: true 
                }
              : a
          );
          set({ dailyActivities: updated });
        } else {
          // Create new activity
          set({
            dailyActivities: [
              ...dailyActivities,
              {
                date: today,
                versesRead,
                timeSpent: get().getTimeSpentToday(),
                hadActivity: true,
              },
            ].slice(-365), // Keep last 365 days
          });
        }
        
        get().updateStreak();
      },
      
      recordVerseRead: (surahId: number, verseNumber: number) => {
        const { dailyActivities } = get();
        const today = getTodayDate();
        const verseKey = `${surahId}:${verseNumber}`;
        
        const existingActivity = dailyActivities.find(a => a.date === today);
        
        if (existingActivity) {
          const readVerseKeys = existingActivity.readVerseKeys || [];
          const readSurahIds = existingActivity.readSurahIds || [];
          
          const hasVerse = readVerseKeys.includes(verseKey);
          const hasSurah = readSurahIds.includes(surahId);
          
          if (!hasVerse || !hasSurah) {
            const nextVerseKeys = hasVerse ? readVerseKeys : [...readVerseKeys, verseKey];
            const nextSurahIds = hasSurah ? readSurahIds : [...readSurahIds, surahId];
            
            const updated = dailyActivities.map(a => 
              a.date === today 
                ? { 
                    ...a, 
                    versesRead: nextVerseKeys.length, 
                    timeSpent: get().getTimeSpentToday(),
                    readVerseKeys: nextVerseKeys,
                    readSurahIds: nextSurahIds,
                    hadActivity: true 
                  }
                : a
            );
            set({ dailyActivities: updated });
          } else {
            // Even if already recorded, update timeSpent just in case
            const updated = dailyActivities.map(a => 
              a.date === today 
                ? { 
                    ...a, 
                    timeSpent: get().getTimeSpentToday(),
                  }
                : a
            );
            set({ dailyActivities: updated });
          }
        } else {
          // Create new activity
          set({
            dailyActivities: [
              ...dailyActivities,
              {
                date: today,
                versesRead: 1,
                timeSpent: get().getTimeSpentToday(),
                hadActivity: true,
                readVerseKeys: [verseKey],
                readSurahIds: [surahId],
              },
            ].slice(-365), // Keep last 365 days
          });
        }
        
        get().updateStreak();
      },
      
      setDailyRevisionTarget: (target: number) => {
        set({ dailyRevisionTarget: target });
      },
      
      setWeeklyRevisionTarget: (target: number) => {
        set({ weeklyRevisionTarget: target });
      },
      
      markVerseRevised: () => {
        const { dailyRevisionCompleted } = get();
        set({ dailyRevisionCompleted: dailyRevisionCompleted + 1 });
      },
      
      markSurahRevised: (surahId: number) => {
        const { weeklyRevisionSurahs } = get();
        if (!weeklyRevisionSurahs.includes(surahId)) {
          set({
            weeklyRevisionSurahs: [...weeklyRevisionSurahs, surahId],
            weeklyRevisionCompleted: weeklyRevisionSurahs.length + 1,
          });
        }
      },
      
      getTimeSpentToday: () => {
        const { timeSpent, sessionStartTime, activeTimeManager } = get();
        let currentSession = 0;
        if (activeTimeManager) {
          try {
            currentSession = activeTimeManager.getStats()?.totalTimeSeconds || 0;
          } catch {
            currentSession = sessionStartTime ? Math.min(Math.floor((Date.now() - sessionStartTime) / 1000), 14400) : 0;
          }
        } else if (sessionStartTime) {
          currentSession = Math.min(Math.floor((Date.now() - sessionStartTime) / 1000), 14400);
        }
        return timeSpent.daily + currentSession;
      },
      
      getTimeSpentThisWeek: () => {
        const { timeSpent, sessionStartTime, activeTimeManager } = get();
        let currentSession = 0;
        if (activeTimeManager) {
          try {
            currentSession = activeTimeManager.getStats()?.totalTimeSeconds || 0;
          } catch {
            currentSession = sessionStartTime ? Math.min(Math.floor((Date.now() - sessionStartTime) / 1000), 14400) : 0;
          }
        } else if (sessionStartTime) {
          currentSession = Math.min(Math.floor((Date.now() - sessionStartTime) / 1000), 14400);
        }
        return timeSpent.weekly + currentSession;
      },
      
      getTimeSpentThisMonth: () => {
        const { timeSpent, sessionStartTime, activeTimeManager } = get();
        let currentSession = 0;
        if (activeTimeManager) {
          try {
            currentSession = activeTimeManager.getStats()?.totalTimeSeconds || 0;
          } catch {
            currentSession = sessionStartTime ? Math.min(Math.floor((Date.now() - sessionStartTime) / 1000), 14400) : 0;
          }
        } else if (sessionStartTime) {
          currentSession = Math.min(Math.floor((Date.now() - sessionStartTime) / 1000), 14400);
        }
        return timeSpent.monthly + currentSession;
      },
      
      resetDailyProgress: () => {
        const today = getTodayDate();
        set({
          timeSpent: {
            ...get().timeSpent,
            daily: 0,
            lastResetDaily: today,
          },
          dailyRevisionCompleted: 0,
        });
      },
      
      resetWeeklyProgress: () => {
        const weekStart = getWeekStart();
        set({
          timeSpent: {
            ...get().timeSpent,
            weekly: 0,
            lastResetWeekly: weekStart,
          },
          weeklyRevisionCompleted: 0,
          weeklyRevisionSurahs: [],
        });
      },
    }),
    {
      name: 'activity-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        // Exclude activeTimeManager (class instance) and sessionStartTime (runtime-only) from persistence
        const { activeTimeManager, sessionStartTime, ...persistedState } = state as any;
        return persistedState;
      },
    }
  )
); 