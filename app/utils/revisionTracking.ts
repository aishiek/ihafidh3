import { useProgressStore } from '@/store/progressStore';
import { PageProgress, RevisionGoals } from '@/types/revision';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOALS_KEY = '@revision_goals_v2';
const DAILY_PAGE_STATS_KEY = '@revision_daily_page_stats';

export async function saveRevisionGoals(goals: RevisionGoals): Promise<void> {
  try {
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  } catch (err) {
    console.warn('[saveRevisionGoals] Failed to persist goals', err);
  }
}

export async function loadRevisionGoals(): Promise<RevisionGoals> {
  try {
    const raw = await AsyncStorage.getItem(GOALS_KEY);
    if (!raw) {
      return {
        daily: { verses: 5, pages: 1 },
        weekly: { verses: 35, surahs: [], pages: 7 }
      };
    }
    return JSON.parse(raw) as RevisionGoals;
  } catch (err) {
    console.warn('[loadRevisionGoals] Failed to load goals', err);
    return { daily: { verses: 5, pages: 1 }, weekly: { verses: 35, surahs: [], pages: 7 } };
  }
}

/**
 * Track a page-level action. This updates the persistent progress store and
 * app-level daily page stats in AsyncStorage for quick lookup.
 */
export async function trackPageProgress(
  action: 'memorized' | 'revised',
  pageInfo: {
    surahNumber: number;
    startAyah: number;
    endAyah: number;
    verseCount: number;
    versesPerPage: number;
    verseIds?: number[];
  }
): Promise<void> {
  try {
    // Compose a pageId which is unique per surah + start/end
    const pageId = `${pageInfo.surahNumber}_${pageInfo.startAyah}_${pageInfo.endAyah}`;

    const progress: PageProgress = {
      id: `${pageId}_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      action,
      pageId,
      surahNumber: pageInfo.surahNumber,
      startAyah: pageInfo.startAyah,
      endAyah: pageInfo.endAyah,
      verseCount: pageInfo.verseCount,
      versesPerPage: pageInfo.versesPerPage,
      createdAt: new Date().toISOString()
    };

    // Update progress store (use startAyah as pageIndex identifier)
    const store = useProgressStore.getState();
    const pageIndex = pageInfo.startAyah; // deterministic per surah
    const verseIds = pageInfo.verseIds || [];

    if (action === 'memorized') {
      store.markPageAsMemorized('surah', pageInfo.surahNumber, pageIndex, pageInfo.versesPerPage, verseIds);
    } else {
      store.markPageAsRevised('surah', pageInfo.surahNumber, pageIndex, pageInfo.versesPerPage, verseIds);
    }

    // Update daily page counters in AsyncStorage for fast queries
    await updateDailyPageCounters(progress.date, action);
  } catch (err) {
    console.warn('[trackPageProgress] failed', err);
  }
}

async function updateDailyPageCounters(date: string, action: 'memorized' | 'revised') {
  try {
    const raw = await AsyncStorage.getItem(DAILY_PAGE_STATS_KEY);
    const payload: Record<string, { memorized: number; revised: number }> = raw ? JSON.parse(raw) : {};

    const cur = payload[date] || { memorized: 0, revised: 0 };
    if (action === 'memorized') cur.memorized += 1;
    else cur.revised += 1;

    payload[date] = cur;
    await AsyncStorage.setItem(DAILY_PAGE_STATS_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[updateDailyPageCounters] failed', err);
  }
}

export async function getPageProgressForDate(date: string): Promise<{ memorized: number; revised: number }> {
  try {
    // First try the async storage counters
    const raw = await AsyncStorage.getItem(DAILY_PAGE_STATS_KEY);
    if (raw) {
      const payload: Record<string, { memorized: number; revised: number }> = JSON.parse(raw);
      const cur = payload[date];
      if (cur) return { memorized: cur.memorized, revised: cur.revised };
    }

    // Fallback: scan store.pageMarks
    const store = useProgressStore.getState();
    const memorized = store.pageMarks.filter(m => m.markedDate === date && m.type === 'memorized').length;
    const revised = store.pageMarks.filter(m => m.markedDate === date && m.type === 'revised').length;
    return { memorized, revised };
  } catch (err) {
    console.warn('[getPageProgressForDate] failed', err);
    return { memorized: 0, revised: 0 };
  }
}
