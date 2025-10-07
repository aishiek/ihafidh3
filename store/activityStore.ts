import { QuranActiveTimeManager } from '@/utils/activeTimeTracker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

const getTodayDate = () => new Date().toISOString().split('T')[0];

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
      currentStreak: 0,
      longestStreak: 0,
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
        const state = get();
        if (!state.sessionStartTime) return;
        
        // Stop active time tracking and get the actual active time
        let activeTimeInSeconds = 0;
        try {
          if (state.activeTimeManager) {
            // Read current stats just before stopping
            const stats = state.activeTimeManager.getStats();
            activeTimeInSeconds = stats.totalTimeSeconds;
            // Stop the tracking and commit time to store synchronously
            state.activeTimeManager.stopReading((timeInSeconds: number) => {
              activeTimeInSeconds = timeInSeconds;
            });
          }
        } catch (e) {
          console.warn('[activity] endSession stop/commit failed:', e);
        }
        
        // Use active time instead of total session time
        const sessionDuration = Math.max(activeTimeInSeconds, 0);
        const { timeSpent } = state;
        
        // Update time spent with only active time
        set({
          sessionStartTime: null,
          timeSpent: {
            daily: timeSpent.daily + sessionDuration,
            weekly: timeSpent.weekly + sessionDuration,
            monthly: timeSpent.monthly + sessionDuration,
            total: timeSpent.total + sessionDuration,
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
        
        if (lastActivityDate === today) {
          return; // Already updated today
        }
        
        // Calculate yesterday's date properly
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        let newStreak = currentStreak;
        
        if (!lastActivityDate) {
          // First time - start streak at 1
          newStreak = 1;
        } else if (lastActivityDate === yesterdayStr) {
          // Continue streak - consecutive day
          newStreak = currentStreak + 1;
        } else {
          // Calculate days difference for streak break detection
          const lastDate = new Date(lastActivityDate + 'T00:00:00');
          const currentDate = new Date(today + 'T00:00:00');
          const diffTime = currentDate.getTime() - lastDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            // Consecutive day (shouldn't reach here due to yesterday check, but for safety)
            newStreak = currentStreak + 1;
          } else {
            // Streak broken - reset to 1 (today is new start)
            newStreak = 1;
          }
        }
        
        set({
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, longestStreak),
          lastActivityDate: today,
        });
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
        const { timeSpent, sessionStartTime } = get();
        const currentSession = sessionStartTime 
          ? Math.floor((Date.now() - sessionStartTime) / 1000)
          : 0;
        return timeSpent.daily + currentSession;
      },
      
      getTimeSpentThisWeek: () => {
        const { timeSpent, sessionStartTime } = get();
        const currentSession = sessionStartTime 
          ? Math.floor((Date.now() - sessionStartTime) / 1000)
          : 0;
        return timeSpent.weekly + currentSession;
      },
      
      getTimeSpentThisMonth: () => {
        const { timeSpent, sessionStartTime } = get();
        const currentSession = sessionStartTime 
          ? Math.floor((Date.now() - sessionStartTime) / 1000)
          : 0;
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