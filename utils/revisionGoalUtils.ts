import { useProgressStore } from '@/store/progressStore';

// Check if daily revision goal is met
export function isDailyRevisionGoalMet() {
  const state = useProgressStore.getState();
  const today = new Date().toISOString().slice(0, 10);
  // You may want to use your own date formatting logic
  const revisedToday = state.dailyRevisedVerses.filter(v => v.date === today).length;
  return revisedToday >= (state.revisionSchedule.versesPerDay || 5);
}

// Check if weekly revision goal is met
export function isWeeklyRevisionGoalMet() {
  const state = useProgressStore.getState();
  // Weekly goal: number of surahs completed this week >= target
  const target = (state.revisionSchedule.surahsPerWeek || []).length;
  return state.weeklyRevisedSurahsCompleted.length >= target;
}
