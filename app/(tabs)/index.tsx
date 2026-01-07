import { MushafDownloadCard } from '@/app/mushaf/components/MushafDownloadCard';
import { getJuzProgress } from '@/assets/database/QuranDatabase';
import AyahOfTheDayCard from '@/components/AyahOfTheDayCard';
import MinimalTopStrip from '@/components/MinimalTopStrip';
import { QuranProgressTracker } from '@/data/quranProgress';
import { surahsData } from '@/data/surahs';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useActivityStore } from '@/store/activityStore';
import { usePlannerStore } from '@/store/plannerStore';
import { useProgressStore } from '@/store/progressStore';
import { useQuranStore } from '@/store/quranStore';
import { useSettingsStore } from '@/store/settingsStore';
import { calculateCurrentBadge } from '@/utils/badgeUtils';
import { formatDate } from '@/utils/dateUtils';
import { calculateJuzProgress, calculateOverallJuzStats } from '@/utils/juzCalculator';
import { saveLastRead } from '@/utils/lastReadUtils';
import { safeNavigation } from '@/utils/navigationUtils';
import { findVerseById } from '@/utils/verseUtils';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Info,
  Play,
  RotateCcw,
  Target,
  XCircle
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Dimensions, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

interface ProgressData {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
}

interface SurahActivity {
  id: string;
  type: 'memorized' | 'revised';
  surah: { englishName: string; arabicName: string };
  time: string;
}

interface QuizActivity { id: string; type: 'quiz'; score: number; time: string; }

type Activity = SurahActivity | QuizActivity;

// Verse counts for each surah (needed for global verse id calculations)
const surahVerseCounts = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6
];

const FireStreakIcon = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <Defs>
      <SvgLinearGradient id="fireGradient" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
        <Stop offset="0%" stopColor="#FF4500" />
        <Stop offset="30%" stopColor="#FF6B00" />
        <Stop offset="60%" stopColor="#FF8C00" />
        <Stop offset="80%" stopColor="#FFD700" />
        <Stop offset="100%" stopColor="#FFF700" />
      </SvgLinearGradient>
      <SvgLinearGradient id="innerFire" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
        <Stop offset="0%" stopColor="#DC143C" />
        <Stop offset="40%" stopColor="#FF4500" />
        <Stop offset="70%" stopColor="#FF8C00" />
        <Stop offset="100%" stopColor="#FFD700" />
      </SvgLinearGradient>
      <RadialGradient id="hotCore" cx="50%" cy="80%" r="30%">
        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.8} />
        <Stop offset="50%" stopColor="#FFD700" stopOpacity={0.6} />
        <Stop offset="100%" stopColor="#FF8C00" stopOpacity={0.2} />
      </RadialGradient>
    </Defs>
    <G opacity={0.7}>
      <Path d="M20 50 Q60 45 85 40 Q75 50 70 55 Q50 52 20 50 Z" fill="url(#streakTrail)" />
    </G>
    <Path d="M45 85 C35 80, 30 70, 32 60 C34 45, 40 35, 48 25 C50 20, 52 15, 55 12 C58 15, 60 20, 62 25 C70 35, 76 45, 78 60 C80 70, 75 80, 65 85 C60 88, 50 88, 45 85 Z" fill="url(#fireGradient)" />
    <Path d="M48 80 C42 76, 38 68, 40 60 C42 50, 46 42, 52 35 C54 32, 56 28, 58 26 C60 28, 62 32, 64 35 C70 42, 74 50, 76 60 C78 68, 74 76, 68 80 C65 82, 52 82, 48 80 Z" fill="url(#innerFire)" opacity={0.8} />
    <Ellipse cx="58" cy="65" rx="8" ry="12" fill="url(#hotCore)" />
  </Svg>
);


export default function HomeScreen() {
  const primary = useThemeColor({}, 'tint');
  const { plansByDate, mode: plannerMode, selectedSurahId, verseStatsByMonth } = usePlannerStore();
  const {
    memorizedVerses,
    revisedVerses,
    dailyStreak,
    quizResults,
    lastReadVerse,
    dailyRevisedVerses,
    weeklyRevisedVerses,
    revisionSchedule,
    completedToday,
    weeklyRevisedSurahsCompleted,
    updateDailyStreak
  } = useProgressStore();
  const { userName } = useSettingsStore();
  const {
    startSession,
    endSession,
    getTimeSpentToday,
    sessionStartTime,
    timeSpent,
    initializeActiveTimeManager,
    activeTimeManager
  } = useActivityStore();
  const quranStore = useQuranStore.getState();

  // Responsive card sizing for progress cards
  const screenWidth = Dimensions.get('window').width;
  const cardMargin = 20; // matches section paddingHorizontal
  const cardGap = 12; // gap between cards
  const availableWidth = screenWidth - (cardMargin * 2);
  const cardWidth = Math.max(100, (availableWidth - (cardGap * 2)) / 3);

  // Responsive minHeight for progress cards (proportional to width, clamped)
  const computedMinHeight = Math.max(180, Math.min(300, Math.round(cardWidth * 1.15)));

  const [activeReadingTime, setActiveReadingTime] = useState(0);
  const [showStreakTooltip, setShowStreakTooltip] = useState(false);
  const [showPlannerInfo, setShowPlannerInfo] = useState(false);

  // --- Helpers for planner verse id mapping ---
  const getGlobalStartIdForSurah = (surahId: number) => {
    let total = 0;
    for (let i = 1; i < surahId; i++) {
      const s = surahsData.find(x => x.id === i);
      if (s) total += s.versesCount;
    }
    return total + 1;
  };
  const toVerseId = (surahId: number, verseNumber: number) => getGlobalStartIdForSurah(surahId) + (verseNumber - 1);
  const parseDMY = (s: string): Date | null => {
    const m = /^([0-3]\d)-([0-1]\d)-(\d{4})$/.exec(s);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd ? d : null;
  };

  // --- Monthly Hifdh Planner summary (current month) ---
  const plannerSummary = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthName = now.toLocaleDateString(undefined, { month: 'long' });
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    const allPlannedVerseIds = new Set<number>();
    const plannedBySurah = new Map<number, Set<number>>();
    const plannedSurahIds = new Set<number>();

    // Collect all planned verses for keys in this month
    Object.entries(plansByDate).forEach(([key, entries]) => {
      const d = parseDMY(key);
      if (!d || d.getMonth() !== month || d.getFullYear() !== year) return;
      (entries as any[]).forEach((p: any) => {
        const surahId = Number(p.surahId) || 0;
        if (surahId <= 0) return; // guard against malformed entries

        // If in surah mode and a surah is selected, only include that surah's plans
        if (plannerMode === 'surah' && selectedSurahId != null && selectedSurahId !== surahId) return;

        plannedSurahIds.add(surahId);

        const sId = toVerseId(surahId, p.startVerse);
        const eId = toVerseId(surahId, p.endVerse);
        if (!plannedBySurah.has(surahId)) plannedBySurah.set(surahId, new Set<number>());
        const setForSurah = plannedBySurah.get(surahId)!;
        for (let id = sId; id <= eId; id++) {
          allPlannedVerseIds.add(id);
          setForSurah.add(id);
        }
      });
    });

    if (allPlannedVerseIds.size === 0) {
      return {
        monthName,
        totalPlannedVerses: 0,
        completedPlannedVerses: 0,
        inProgressSurahs: 0,
        totalPlannedSurahs: 0,
        percent: 0,
      };
    }

    const isRevised = (id: number) => revisedVerses.some((rv) => rv.verseId === id) || (plannerMode === 'verse' && !!(verseStatsByMonth[monthKey] && verseStatsByMonth[monthKey][id] && verseStatsByMonth[monthKey][id].completed));

    let completedPlannedVerses = 0;
    allPlannedVerseIds.forEach((id) => {
      if (memorizedVerses.includes(id) || isRevised(id)) completedPlannedVerses++;
    });

    // Surah in-progress: some of its planned verses are done but not all
    let inProgressSurahs = 0;
    plannedBySurah.forEach((ids, sid) => {
      // If in surah mode, only consider the selected surah
      if (plannerMode === 'surah' && selectedSurahId != null && sid !== selectedSurahId) return;
      let done = 0; const total = ids.size;
      ids.forEach((id) => { if (memorizedVerses.includes(id) || isRevised(id)) done++; });
      if (done > 0 && done < total) inProgressSurahs++;
    });

    const totalPlannedVerses = allPlannedVerseIds.size;
    // Prefer deduped surah ids set (robust against malformed keys)
    // If in surah mode with a selected surah, report 1 if that surah was planned this month, otherwise 0
    const totalPlannedSurahs = plannerMode === 'surah' && selectedSurahId != null ? (plannedSurahIds.has(selectedSurahId) ? 1 : 0) : (plannedSurahIds.size || plannedBySurah.size);
    const percent = totalPlannedVerses > 0 ? Math.round((completedPlannedVerses / totalPlannedVerses) * 100) : 0;
    return { monthName, totalPlannedVerses, completedPlannedVerses, inProgressSurahs, totalPlannedSurahs, percent };
  }, [plansByDate, memorizedVerses, revisedVerses]);

  // --- Time tracking lifecycle (resilient) ---
  useEffect(() => {
    let retryTimer: NodeJS.Timeout | null = null;
    let androidDeferred: NodeJS.Timeout | null = null;
    let mounted = true;

    const initializeTracking = () => {
      if (!mounted) return;

      try {
        if (__DEV__) {
          console.log('=== WEEKLY SURAHS DEBUG ===');
          console.log('weeklyRevisedVerses (raw):', weeklyRevisedVerses);
          console.log('revisionSchedule.surahsPerWeek:', revisionSchedule?.surahsPerWeek);
        }
        // Initialize manager first
        const mgr = initializeActiveTimeManager();

        // Get current state
        const currentState = AppState.currentState;

        // Start session if not already started
        if (!sessionStartTime) {
          // On Android, be more aggressive about starting the session
          if (Platform.OS === 'android') {
            // Always start on Android unless explicitly in background
            if (currentState !== 'background' && currentState !== 'inactive') {
              startSession();
            } else {
              // Retry after a delay
              androidDeferred = setTimeout(() => {
                if (mounted && !useActivityStore.getState().sessionStartTime) {
                  try { startSession(); } catch (e) {
                    console.warn('[TimeTracking] Deferred start failed:', e);
                  }
                }
              }, 800);
            }
          } else {
            // iOS - only start if active
            if (currentState === 'active') {
              startSession();
            }
          }
        }

        // Retry manager initialization if needed
        if (!mgr && mounted) {
          retryTimer = setTimeout(() => {
            if (mounted) {
              try { initializeActiveTimeManager(); } catch (e) {
                console.warn('[TimeTracking] Retry failed:', e);
              }
            }
          }, 1000);
        }
      } catch (e) {
        console.error('[TimeTracking] Init error:', e);
      }
    };

    // Initial call
    initializeTracking();

    // AppState listener
    const sub = AppState.addEventListener('change', (nextState) => {
      if (!mounted) return;

      try {
        const store = useActivityStore.getState();

        if (nextState === 'active') {
          // Start session when app becomes active
          if (!store.sessionStartTime) {
            startSession();
          }
        } else if (nextState === 'background' || nextState === 'inactive') {
          // CRITICAL: End session to persist time BEFORE going to background
          if (store.sessionStartTime) {
            endSession();
          }
        }
      } catch (e) {
        console.error('[TimeTracking] AppState handler error:', e);
      }
    });

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (androidDeferred) clearTimeout(androidDeferred);
      try { sub.remove(); } catch { }

      // CRITICAL: Persist time before cleanup
      try {
        const store = useActivityStore.getState();
        if (store.sessionStartTime) {
          endSession();
        }
      } catch (e) {
        console.error('[TimeTracking] Cleanup endSession error:', e);
      }

      try { activeTimeManager?.cleanup(); } catch { }
    };
  }, []); // Empty deps to prevent re-initialization

  const getCurrentActiveTime = () => {
    const store = useActivityStore.getState();
    const baseTime = store.timeSpent?.total || 0;

    // Primary: Use activeTimeManager if available
    if (activeTimeManager) {
      try {
        const stats = activeTimeManager.getStats();
        const managerTime = stats?.totalTimeSeconds || 0;
        return baseTime + managerTime;
      } catch (e) {
        console.warn('[TimeTracking] Manager stats error:', e);
      }
    }

    // Fallback: Calculate from session start time
    if (store.sessionStartTime) {
      const elapsed = Math.floor((Date.now() - store.sessionStartTime) / 1000);
      return baseTime + Math.max(0, elapsed);
    }

    // Last resort: Return base time
    return baseTime;
  };
  // Stable interval: does not restart on every total increment (avoids flicker / reset)
  useEffect(() => {
    // Initial sync
    const initialTime = getCurrentActiveTime();
    setActiveReadingTime(initialTime);

    // Use shorter interval on Android for more responsive updates
    const intervalDuration = Platform.OS === 'android' ? 500 : 1000;

    const interval = setInterval(() => {
      const newTime = getCurrentActiveTime();
      setActiveReadingTime(newTime);
    }, intervalDuration);

    return () => clearInterval(interval);
  }, []); // Stable interval

  useEffect(() => { updateDailyStreak(); }, [updateDailyStreak]);

  // --- Progress computations ---
  const progressTracker = useMemo(() => new QuranProgressTracker({
    memorizedSurahs: [],
    memorizedJuz: [],
    memorizedVerses: memorizedVerses.map(verseId => {
      let startVerseId = 0;
      for (let i = 1; i <= 114; i++) {
        const surah = surahsData.find(s => s.id === i);
        if (!surah) continue;
        if (verseId <= startVerseId + surah.versesCount) {
          const verseNumber = verseId - startVerseId;
          return `${i}:${verseNumber}`;
        }
        startVerseId += surah.versesCount;
      }
      return '';
    }).filter(Boolean),
    memorizedVerseIds: memorizedVerses // Pass cumulative verse IDs for accurate Juz calculation
  }), [memorizedVerses]);
  const progress = progressTracker.calculateProgress();

  const calculateSurahProgress = (surahId: number) => {
    let startVerseId = 0;
    for (let i = 1; i < surahId; i++) {
      const prev = surahsData.find(s => s.id === i); if (prev) startVerseId += prev.versesCount;
    }
    const surah = surahsData.find(s => s.id === surahId); if (!surah) return { memorized: 0, progress: 0 };
    const start = startVerseId + 1; const end = startVerseId + surah.versesCount;
    const memorizedInSurah = memorizedVerses.filter(id => id >= start && id <= end).length;
    return { memorized: memorizedInSurah, progress: (memorizedInSurah / surah.versesCount) * 100 };
  };
  const calculateInProgressVerses = () => surahsData.reduce((acc, s) => { const sp = calculateSurahProgress(s.id); return acc + (sp.memorized > 0 && sp.memorized < s.versesCount ? sp.memorized : 0); }, 0);
  const calculateInProgressSurahs = () => surahsData.reduce((acc, s) => { const sp = calculateSurahProgress(s.id); return acc + (sp.memorized > 0 && sp.memorized < s.versesCount ? 1 : 0); }, 0);

  const isSurahFullyMemorized = (surahId: number) => {
    let startVerseId = 0;
    for (let i = 1; i < surahId; i++) { const prev = surahsData.find(s => s.id === i); if (prev) startVerseId += prev.versesCount; }
    const surah = surahsData.find(s => s.id === surahId); if (!surah) return false;
    const start = startVerseId + 1; const end = startVerseId + surah.versesCount;
    return memorizedVerses.filter(id => id >= start && id <= end).length === surah.versesCount;
  };
  const hasSurahProgress = (surahId: number) => {
    let startVerseId = 0;
    for (let i = 1; i < surahId; i++) { const prev = surahsData.find(s => s.id === i); if (prev) startVerseId += prev.versesCount; }
    const surah = surahsData.find(s => s.id === surahId); if (!surah) return false;
    const start = startVerseId + 1; const end = startVerseId + surah.versesCount;
    return memorizedVerses.some(id => id >= start && id <= end);
  };

  const mustahabbahRaw = [36, 32, 73, 18, 55, 67, 56, 62, 76];
  const mustahabbahItems = mustahabbahRaw.map(id => ({
    key: String(id),
    label: surahsData.find(s => s.id === id)?.name || `Surah ${id}`,
    isMemorized: isSurahFullyMemorized(id),
    inProgress: !isSurahFullyMemorized(id) && hasSurahProgress(id)
  }));
  const mustahabbahMemorized = mustahabbahItems.filter(i => i.isMemorized).length;
  const mustahabbahRemaining = mustahabbahItems.length - mustahabbahMemorized;
  const getSurahStatus = (it: typeof mustahabbahItems[0]) => it.isMemorized ? 'memorized' : it.inProgress ? 'in-progress' : 'not-started';

  const getBackgroundColors = (status: string) => {
    if (status === 'memorized') return ['#7dd3a0', '#4ade80', '#22c55e', '#166534', '#2d3748'];
    if (status === 'in-progress') return ['#fde68a', '#fbbf24', '#f59e0b', '#92400e', '#374151'];
    return ['#64748b', '#475569', '#1e293b', '#0f172a']; // 4-stop for not-started
  };
  const getTextColor = (status: string) => '#ffffff'; // White text for all states for better readability

  // Juz info
  const [juzProgressList, setJuzProgressList] = useState<{ juz: number, memorized: number, total: number, progress: number }[]>([]);
  useEffect(() => { (async () => { const list: any[] = []; for (let i = 1; i <= 30; i++) { const p = await getJuzProgress(i); list.push({ juz: i, ...p }); } setJuzProgressList(list); })(); }, [memorizedVerses]);
  const allJuzInfo = useMemo(() => { const arr = [] as any[]; for (let j = 1; j <= 30; j++) { const p = calculateJuzProgress(j, memorizedVerses); arr.push({ juz: j, ...p }); } return arr; }, [memorizedVerses]); // eslint-disable-line

  const stats = useMemo(() => {
    const today = formatDate(new Date());
    const todayTimeSpent = Math.max(1, Math.round(getTimeSpentToday() / 60));

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const todayRevised = dailyRevisedVerses.filter(r => r.date === today).length;
    const thisWeekRevised = weeklyRevisedVerses.filter(r => {
      if (!r?.date) return false;
      const parts = r.date.split('-');
      if (parts.length !== 3) return false;
      // store dates as YYYY-MM-DD (ISO-like)
      const [yyyy, mm, dd] = parts.map(p => Number(p));
      if (!dd || !mm || !yyyy) return false;
      const d = new Date(yyyy, mm - 1, dd);
      return d >= startOfWeek;
    }).length;
    const weeklyTarget = revisionSchedule.surahsPerWeek.length || 2;
    const versesInProgress = calculateInProgressVerses();
    const surahsInProgress = calculateInProgressSurahs();
    const { completed: completedJuz, inProgress: inProgressJuz, notStarted: notStartedJuz } = calculateOverallJuzStats(memorizedVerses);
    return {
      verses: { total: 6236, completed: progress.verses.completed, inProgress: versesInProgress, notStarted: 6236 - progress.verses.completed - versesInProgress },
      surahs: { total: 114, completed: progress.surahs.completed, inProgress: surahsInProgress, notStarted: 114 - progress.surahs.completed - surahsInProgress },
      juz: { total: 30, completed: completedJuz, inProgress: inProgressJuz, notStarted: notStartedJuz },
      currentStreak: dailyStreak,
      totalStudyTime: todayTimeSpent,
      dailyRevisionTarget: revisionSchedule.versesPerDay || 5,
      dailyRevisionCompleted: todayRevised,
      weeklyRevisionTarget: weeklyTarget,
      weeklyRevisionCompleted: Math.min(thisWeekRevised, weeklyTarget)
    };
  }, [memorizedVerses, dailyStreak, getTimeSpentToday, dailyRevisedVerses, weeklyRevisedVerses, revisionSchedule, progress]);

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString); const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 1) return 'Yesterday'; if (diffDays < 7) return `${diffDays} days ago`; return `${Math.floor(diffDays / 7)} weeks ago`;
  };

  const recentActivity = useMemo(() => {
    // Helper: normalize + unique key
    const createUniqueKey = (activity: Activity): string => {
      if (activity.type === 'quiz') {
        return `quiz-${activity.id}`;
      }
      if (activity.type === 'revised' || activity.type === 'memorized') {
        return `${activity.type}-surah-${activity.surah.englishName.trim().toLowerCase()}`;
      }
      return activity.id;
    };

    const seenKeys = new Set<string>();
    const allActivities: (Activity & { timestamp: number; priority: number })[] = [];

    // Helper to insert unique activities
    const pushUnique = (activity: Activity & { timestamp: number; priority: number }) => {
      const key = createUniqueKey(activity);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allActivities.push(activity);
      }
    };

    // Add quiz results (priority 1 - oldest)
    quizResults.slice(-5).forEach((q) => {
      pushUnique({
        id: `quiz-${q.id}`,
        type: 'quiz',
        score: Math.round((q.correct / q.totalQuestions) * 100),
        time: getRelativeTime(q.date),
        timestamp: new Date(q.date).getTime(),
        priority: 1,
      });
    });

    // Add revision activities (priority 2 - middle)
    revisedVerses.slice(-5).forEach((rv) => {
      const verse = findVerseById(rv.verseId);
      const surah = surahsData.find((s) => s.id === verse.surahId);
      if (surah) {
        pushUnique({
          id: `rev-${rv.verseId}`,
          type: 'revised',
          surah: { englishName: surah.name, arabicName: surah.arabicName },
          time: getRelativeTime(rv.revisionDate),
          timestamp: new Date(rv.revisionDate).getTime(),
          priority: 2,
        });
      }
    });

    // Add memorization activities (priority 3 - newest)
    memorizedVerses.slice(-5).forEach((id, index) => {
      const verse = findVerseById(id);
      const surah = surahsData.find((s) => s.id === verse.surahId);
      if (surah) {
        // TODO: Replace with actual timestamp if available in schema
        const estimatedTimestamp = Date.now() - index * 60000;
        pushUnique({
          id: `mem-${id}-${verse.surahId}`,
          type: 'memorized',
          surah: { englishName: surah.name, arabicName: surah.arabicName },
          time: 'Recently',
          timestamp: estimatedTimestamp,
          priority: 3,
        });
      }
    });

    // Sort by priority then timestamp
    allActivities.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.timestamp - a.timestamp;
    });

    // Limit to 3 and strip helper fields
    return allActivities.slice(0, 3).map(({ timestamp, priority, ...clean }) => clean);
  }, [quizResults, revisedVerses, memorizedVerses]);

  const currentBadge = useMemo(() => calculateCurrentBadge(memorizedVerses, progress.juz.completed), [memorizedVerses, progress.juz.completed]);

  const quickActions = useMemo(() => {
    const actions: any[] = [];
    if (lastReadVerse) {
      const verseDetails = findVerseById(lastReadVerse.id);
      const surah = surahsData.find(s => s.id === verseDetails.surahId);
      actions.push({
        title: 'Continue Reading',
        subtitle: surah ? `${surah.name} (${surah.arabicName})` : 'Resume',
        icon: Play,
        color: '#4CAF50',
        action: async () => {
          if (surah) {
            console.log('[home] Continue Reading clicked - navigating to:', { surahId: surah.id, verseNumber: verseDetails.verseNumber, source: 'continueReading' });
            await saveLastRead(surah.id, verseDetails.verseNumber);
            // Use safeNavigation.replace to avoid stacking duplicate Read entries when resuming
            safeNavigation.replace({
              pathname: '/(tabs)/read',
              params: {
                surahId: surah.id.toString(),
                verseId: verseDetails.verseNumber.toString(),
                source: 'continueReading'
              }
            });
          }
        },
      });
    } else {
      actions.push({
        title: 'Start Reading',
        subtitle: 'Begin your journey',
        icon: Play,
        color: '#4CAF50',
        action: () => safeNavigation.push('/(tabs)/read'),
      });
    }
    const pending = revisionSchedule.versesPerDay - stats.dailyRevisionCompleted;
    actions.push(pending > 0
      ? { title: 'Revision Due', subtitle: `${pending} verses pending`, icon: RotateCcw, color: '#FF9800', action: () => safeNavigation.push('/(tabs)/revision') }
      : null);
    return actions.filter(Boolean);
  }, [lastReadVerse, revisionSchedule, stats]);

  const CircularProgress = ({ progress, size = 100, strokeWidth = 8, progressColor = '#2196F3', inProgressColor = '#FF9800', notStartedColor = '#666', completed = 0, inProgress = 0, total = 100 }: { progress: number; size?: number; strokeWidth?: number; progressColor?: string; inProgressColor?: string; notStartedColor?: string; completed?: number; inProgress?: number; total?: number; }) => {
    const radius = (size - strokeWidth) / 2; const circumference = radius * 2 * Math.PI;
    const completedOffset = circumference - (completed / total) * circumference;
    const inProgressOffset = circumference - ((completed + inProgress) / total) * circumference;
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle stroke={notStartedColor} fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
          {inProgress > 0 && <Circle stroke={inProgressColor} fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={inProgressOffset} strokeLinecap="round" />}
          <Circle stroke={progressColor} fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={completedOffset} strokeLinecap="round" />
        </Svg>
        <View style={styles.progressTextContainer}><Text style={styles.progressPercentage}>{Math.round((completed / total) * 100)}%</Text></View>
      </View>
    );
  };

  const ProgressCard = ({ title, data, cardWidth, minHeight, showJuzCompletedLabel }: { title: string; data: ProgressData; cardWidth: number; minHeight?: number; showJuzCompletedLabel?: boolean }) => {
    const circleSize = cardWidth < 120 ? 50 : cardWidth < 150 ? 60 : 70;
    const isSmall = cardWidth < 120;
    const total = data.completed + data.inProgress + data.notStarted;
    const completedPercentage = Math.round((data.completed / total) * 100);

    return (
      <View style={[styles.progressCard, { width: cardWidth, minHeight: minHeight || 160 }]}>
        <Text
          style={[styles.progressCardTitle, { fontSize: isSmall ? 12 : 14 }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>

        <View style={[styles.progressCircleContainer, { marginVertical: 8 }]}>
          <CircularProgress
            progress={completedPercentage}
            size={circleSize}
            completed={data.completed}
            inProgress={data.inProgress}
            total={total}
          />
        </View>

        <View style={styles.progressLegend}>
          <View style={styles.legendItem}>
            <Icon name="check-circle" size={16} color="#3B82F6" />
            <Text
              style={[styles.legendText, isSmall && { fontSize: 10 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {data.completed} {showJuzCompletedLabel ? 'of 30' : ''}
            </Text>
          </View>

          <View style={styles.legendItem}>
            <Icon name="refresh" size={16} color="#F59E0B" />
            <Text
              style={[styles.legendText, isSmall && { fontSize: 10 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {data.inProgress} in progress
            </Text>
          </View>

          <View style={styles.legendItem}>
            <Icon name="circle" size={16} color="#6B7280" />
            <Text
              style={[styles.legendText, isSmall && { fontSize: 10 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {data.notStarted} left
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, color = '#2196F3' }: { title: string; value: string | number | React.ReactNode; subtitle?: string; icon: any; color?: string; }) => (
    <View style={styles.statCard}>
      <Icon size={28} color={color} style={{ marginBottom: 4 }} />
      <Text style={styles.statTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>{value}</View>
      )}
      {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
    </View>
  );

  // Dynamic color function for streak milestones
  const getStreakColor = (streak: number): string => {
    if (streak >= 500) {
      return '#FFD700'; // Golden color for 500+
    }

    // Fluorescent colors for every 100 up to 500
    const milestone = Math.floor(streak / 100);
    const fluorescents = [
      '#FF6B35', // Orange-Red (0-99)
      '#FF1493', // Deep Pink (100-199) 
      '#00FFFF', // Cyan (200-299)
      '#ADFF2F', // Green Yellow (300-399)
      '#FF4500', // Orange Red (400-499)
    ];

    return fluorescents[milestone] || '#FF6B35'; // Default to first color
  };

  const StreakCard = ({ title, value, subtitle, icon: Icon, color = '#2196F3' }: { title: string; value: string | number; subtitle?: string; icon: any; color?: string; }) => (
    <View style={styles.statCard}>
      <Icon size={28} color={color} style={{ marginBottom: 4 }} />
      <Text style={styles.statTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowStreakTooltip(true);
        }}
        style={styles.infoButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Info size={14} color="#888" />
      </Pressable>
    </View>
  );

  const ActionCard = ({ title, subtitle, icon: Icon, color, action }: { title: string; subtitle: string; icon: any; color: string; action: () => void; }) => (
    <Pressable
      onPress={action}
      style={[styles.actionCard, { borderColor: color }]}
      android_ripple={{ color: '#00000022' }}
    >
      <View style={styles.actionIconWrap}><Icon size={24} color={color} /></View>
      <View style={styles.actionCardText}>
        <Text style={styles.actionCardTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
        <Text style={styles.actionCardSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
    </Pressable>
  );

  const MustahabbahCard = (
    { item, onPress, wrapperStyle }:
      { item: { label: string; status: 'memorized' | 'in-progress' | 'not-started' }, onPress?: (it: any) => void, wrapperStyle?: any }
  ) => {
    const backgroundColors = getBackgroundColors(item.status);
    const textColor = getTextColor(item.status);
    const icon = item.status === 'memorized'
      ? { symbol: '✓', color: '#ffffff' }
      : { symbol: '○', color: '#d64545' };

    // Smart text formatting for hyphenated names
    const formatSurahName = (name: string) => {
      // Check if name contains hyphen and should be split
      if (name.includes('-') && name.length >= 7) {
        const parts = name.split('-');
        if (parts.length === 2) {
          return {
            firstLine: parts[0] + '-',
            secondLine: parts[1],
            isMultiLine: true
          };
        }
      }
      return {
        firstLine: name,
        secondLine: '',
        isMultiLine: false
      };
    };

    const textFormat = formatSurahName(item.label);
    const baseFontSize = textFormat.isMultiLine ? 13 : (item.label.length > 10 ? 12 : 14);

    // Use Pressable instead of TouchableOpacity for better response
    return (
      <Pressable
        style={[styles.cardWrapper, wrapperStyle]}
        onPress={() => onPress?.(item)}
      >
        {({ pressed }) => (
          <LinearGradient
            colors={backgroundColors as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.card,
              item.status === 'not-started' && styles.notStartedBorder,
              pressed && { opacity: 0.8 }
            ]}
          >
            <View style={styles.cardContent}>
              {textFormat.isMultiLine ? (
                <>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: textColor,
                        fontSize: baseFontSize,
                        lineHeight: baseFontSize + 1,
                        marginBottom: 1
                      }
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {textFormat.firstLine}
                  </Text>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: textColor,
                        fontSize: baseFontSize,
                        lineHeight: baseFontSize + 1
                      }
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {textFormat.secondLine}
                  </Text>
                </>
              ) : (
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: textColor,
                      fontSize: baseFontSize,
                      lineHeight: baseFontSize + 2
                    }
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {item.label}
                </Text>
              )}
            </View>

            <View style={[
              styles.iconContainer,
              {
                backgroundColor: item.status === 'memorized'
                  ? 'rgba(255, 255, 255, 0.25)'
                  : 'rgba(214, 69, 69, 0.25)',
                borderColor: item.status === 'memorized' ? 'transparent' : '#d64545',
                borderWidth: item.status === 'memorized' ? 0 : 1,
              }
            ]}>
              <Text style={[styles.iconText, { color: icon.color }]}>{icon.symbol}</Text>
            </View>
          </LinearGradient>
        )}
      </Pressable>
    );
  };

  const MustahabbahGrid = ({ items, onItemPress }: { items: any[]; onItemPress: (item: any) => void; }) => {
    // maintain 3 columns; responsive sizing handled in card
    const rows: any[][] = [];
    for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
    return (
      <View style={styles.mustahabbahGrid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.mustahabbahRow}>
            {row.map((it, idx) => <MustahabbahCard key={it.key} item={it} onPress={onItemPress} />)}
          </View>
        ))}
      </View>
    );
  };

  // existing simple formatter kept for backward compatibility
  function formatTotalTime(totalSeconds: number) { if (!totalSeconds || totalSeconds < 0) return '0m'; const d = Math.floor(totalSeconds / 86400); const h = Math.floor((totalSeconds % 86400) / 3600); const m = Math.floor((totalSeconds % 3600) / 60); return `${d > 0 ? d + 'd ' : ''}${(h > 0 || d > 0) ? h + 'h ' : ''}${m}m`.trim(); }

  // Smart adaptive formatter based on total minutes
  function formatQuranTimeAdaptive(totalMinutes: number): string {
    if (!totalMinutes || totalMinutes <= 0) return '0m';

    const min = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const days = Math.floor(totalMinutes / 1440) % 30;
    const months = Math.floor(totalMinutes / 43200) % 12;
    const years = Math.floor(totalMinutes / 525600);

    const parts: string[] = [];
    if (years > 0) parts.push(`${years}Y`);
    if (months > 0) parts.push(`${months}M`);
    if (days > 0) parts.push(`${days}D`);
    if (hours > 0) parts.push(`${hours}h`);
    if (min > 0) parts.push(`${min}m`);

    // Take top 3 units for clarity and detail
    return parts.slice(0, 3).join(' ');
  }

  function formatQuranTimeStyledParts(totalMinutes: number): { primary: string; secondary: string } {
    const formatted = formatQuranTimeAdaptive(totalMinutes);
    const parts = formatted.split(' ');
    const primary = parts[0] || '';

    const secondary = parts.slice(1).join(' ');
    return { primary, secondary };
  }

  // Revision Goals
  // revisionSchedule, dailyRevisedVerses, etc. are already destructured at the top of the component
  const [revisionGoalType, setRevisionGoalType] = useState<'verses' | 'pages'>('verses');

  const { pageMarks } = useProgressStore();

  const dailyVersesTarget = revisionSchedule?.versesPerDay || 5;
  const weeklySurahsTarget = revisionSchedule?.surahsPerWeek?.length || 0;

  const dailyPagesTarget = revisionSchedule?.pagesPerDay || 1;
  const weeklyPagesTarget = revisionSchedule?.pagesPerWeek || 5;

  // Calculate Daily Verses Progress (unique verses only)
  // progressStore uses formatDate(...) which produces DD-MM-YYYY strings
  const todayStr = formatDate(new Date());
  const dailyVersesProgress = useMemo(() => {
    try {
      const today = todayStr;
      // Ensure we count unique verseIds revised today
      const ids = dailyRevisedVerses
        .filter(rv => rv?.date === today && typeof rv?.verseId === 'number')
        .map(rv => rv.verseId);

      return new Set(ids).size;
    } catch (e) {
      console.error('[dailyVersesProgress] compute failed', e);
      return 0;
    }
  }, [dailyRevisedVerses, todayStr]);

  // Calculate Weekly Surahs Progress
  // Require 100% of verses in target surah to be revised this week to count as completed
  const weeklySurahsProgress = useMemo(() => {
    const targetSurahs = revisionSchedule?.surahsPerWeek || [];
    if (!targetSurahs || targetSurahs.length === 0) return 0;

    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      // parseYmd: parse YYYY-MM-DD (progress store uses ISO-style YYYY-MM-DD)
      const parseYmd = (d?: string | null) => {
        if (!d) return null;
        const parts = d.split('-');
        if (parts.length !== 3) return null;
        const [yyyy, mm, dd] = parts.map(p => Number(p));
        if (!dd || !mm || !yyyy) return null;
        return new Date(yyyy, mm - 1, dd);
      };

      // Filter weeklyRevisedVerses to only include entries within the current week
      const thisWeekRevised = weeklyRevisedVerses.filter(rv => {
        if (!rv || !rv.date) return false;
        const d = parseYmd(rv.date);
        if (!d) return false;
        const isThisWeek = d >= weekStart;
        if (__DEV__) console.log(`rv: verseId=${rv.verseId} date=${rv.date} => ${d} isThisWeek=${isThisWeek}`);
        return isThisWeek;
      });

      if (__DEV__) console.log('Verses revised this week (count):', thisWeekRevised.length, 'list:', thisWeekRevised.map(r => `${r.verseId}@${r.date}`));

      // Build a Set of verseIds revised this week for quick lookup
      const revisedVerseIdsThisWeek = new Set<number>(thisWeekRevised.map(r => r.verseId));

      // Helper to compute global start id for a given surah
      const getSurahStartId = (surahId: number) => {
        let acc = 0;
        for (let i = 1; i < surahId; i++) acc += surahVerseCounts[i - 1] || 0;
        return acc + 1;
      };

      let completedCount = 0;
      for (const surahId of targetSurahs) {
        const versesCount = surahVerseCounts[(surahId - 1)];
        if (!versesCount) continue;

        const startId = getSurahStartId(surahId);
        const endId = startId + versesCount - 1;

        // Check if all verseIds for this surah are in the this-week set
        let allRevised = true;
        for (let v = startId; v <= endId; v++) {
          if (!revisedVerseIdsThisWeek.has(v)) {
            allRevised = false;
            break;
          }
        }

        if (allRevised) completedCount++;
        if (__DEV__) {
          // Count how many verses from this surah were revised this week for logging
          let revisedInCount = 0;
          for (let v = startId; v <= endId; v++) if (revisedVerseIdsThisWeek.has(v)) revisedInCount++;
          if (__DEV__) console.log(`Surah ${surahId} allRevised=${allRevised} (${revisedInCount}/${versesCount})`);
        }
      }

      return completedCount;
    } catch (e) {
      console.error('[weeklySurahsProgress] compute failed', e);
      return 0;
    }
  }, [weeklyRevisedVerses, revisionSchedule?.surahsPerWeek]);

  // Calculate Page Progress from pageMarks
  const dailyPagesProgress = useMemo(() => {
    try {
      return pageMarks.filter(m => m?.type === 'revised' && m?.markedDate === todayStr).length;
    } catch (e) {
      console.error('[dailyPagesProgress] compute failed', e);
      return 0;
    }
  }, [pageMarks, todayStr]);

  const weeklyPagesProgress = useMemo(() => {
    try {
      if (__DEV__) {
        console.log('=== WEEKLY PAGES DEBUG ===');
        console.log('pageMarks (raw):', pageMarks);
      }
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      // pageMarks.markedDate is formatted as YYYY-MM-DD (formatDate) — parse it safely
      const parseYmd = (d?: string | null) => {
        if (!d) return null;
        const parts = d.split('-');
        if (parts.length !== 3) return null;
        const [yyyy, mm, dd] = parts.map(p => Number(p));
        if (!dd || !mm || !yyyy) return null;
        return new Date(yyyy, mm - 1, dd);
      };

      const revised = pageMarks.filter(m => {
        if (!m || m.type !== 'revised' || !m.markedDate) return false;
        const marked = parseYmd(m.markedDate);
        if (!marked) return false;
        const isThisWeek = marked >= weekStart;
        if (__DEV__) console.log(`page ${m.scope}-${m.entityId}-${m.pageIndex} date=${m.markedDate} => ${marked} isThisWeek=${isThisWeek}`);
        return isThisWeek;
      }).length;
      if (__DEV__) console.log('Pages revised this week:', revised);
      return revised;
    } catch (e) {
      console.error('[weeklyPagesProgress] compute failed', e);
      return 0;
    }
  }, [pageMarks]);

  const dailyVersesPercentage = dailyVersesTarget > 0 ? Math.min(100, (dailyVersesProgress / dailyVersesTarget) * 100) : 0;
  const weeklySurahsPercentage = weeklySurahsTarget > 0 ? Math.min(100, (weeklySurahsProgress / weeklySurahsTarget) * 100) : 0;

  const dailyPagesPercentage = dailyPagesTarget > 0 ? Math.min(100, (dailyPagesProgress / dailyPagesTarget) * 100) : 0;
  const weeklyPagesPercentage = weeklyPagesTarget > 0 ? Math.min(100, (weeklyPagesProgress / weeklyPagesTarget) * 100) : 0;

  // Get deep-link params (e.g. highlightAyah when navigating from Ayah notification)
  const params = useLocalSearchParams() as { highlightAyah?: string; surahId?: string; verseId?: string };

  const scrollRef = useRef<ScrollView | null>(null);
  const ayahCardLayoutY = useRef<number | null>(null);
  const [ayahHighlight, setAyahHighlight] = useState(false);

  useEffect(() => {
    // If notification requested highlight, scroll to card and trigger highlight animation
    const highlightRequested = params?.highlightAyah === '1' || params?.highlightAyah === 'true';
    if (highlightRequested) {
      setTimeout(() => {
        if (typeof ayahCardLayoutY.current === 'number') {
          scrollRef.current?.scrollTo({ y: Math.max(0, ayahCardLayoutY.current - 24), animated: true });
        }
        setAyahHighlight(true);
        // Turn off highlight after a short interval so it can be replayed later
        setTimeout(() => setAyahHighlight(false), 2500);
      }, 300); // small delay to allow container layout
    }
    // We want this effect to run when the component mounts and when params change
  }, [params?.highlightAyah]);

  return (
    <>
      <ScrollView ref={scrollRef} style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <MinimalTopStrip style={{}} />
          <Text style={styles.greeting}>Assalamu Alaikkum{userName ? `, ${userName} ` : ''}</Text>
          <Text style={styles.welcomeText}>Welcome back to your Quran journey</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Progress</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <ProgressCard title="Verses" data={stats.verses} cardWidth={cardWidth} minHeight={computedMinHeight} />
            <ProgressCard title="Surahs" data={stats.surahs} cardWidth={cardWidth} minHeight={computedMinHeight} />
            <ProgressCard title="Juz" data={stats.juz as any} cardWidth={cardWidth} minHeight={computedMinHeight} showJuzCompletedLabel={true} />
          </View>
        </View>

        {/* Ayah of the Day */}
        <View
          style={styles.section}
          onLayout={(e) => { ayahCardLayoutY.current = e.nativeEvent.layout.y; }}
        >
          {/* pass highlight flag to AyahOfTheDayCard so it shows the visual indicator */}
          <AyahOfTheDayCard highlight={ayahHighlight} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Revision Goals</Text>
            <View style={styles.toggleContainer}>
              <Pressable
                onPress={() => setRevisionGoalType('verses')}
                style={[
                  styles.toggleButton,
                  revisionGoalType === 'verses' && styles.toggleButtonActive
                ]}
              >
                <Text style={[
                  styles.toggleText,
                  revisionGoalType === 'verses' ? styles.toggleTextActive : styles.toggleTextInactive
                ]}>Verses</Text>
              </Pressable>
              <Pressable
                onPress={() => setRevisionGoalType('pages')}
                style={[
                  styles.toggleButton,
                  revisionGoalType === 'pages' && styles.toggleButtonActive
                ]}
              >
                <Text style={[
                  styles.toggleText,
                  revisionGoalType === 'pages' ? styles.toggleTextActive : styles.toggleTextInactive
                ]}>Pages</Text>
              </Pressable>
            </View>
          </View>

          {revisionGoalType === 'verses' ? (
            <>
              <View style={styles.revisionItem}>
                <View style={styles.revisionHeader}>
                  <Text style={styles.revisionTitle}>Daily Verses</Text>
                  {dailyVersesTarget > 0 && dailyVersesProgress >= dailyVersesTarget ? <CheckCircle size={16} color="#4CAF50" /> : <XCircle size={16} color="#F44336" />}
                </View>
                <Text style={styles.revisionProgress}>{dailyVersesProgress} / {dailyVersesTarget} verses</Text>
                <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${dailyVersesPercentage}%`, backgroundColor: dailyVersesProgress >= dailyVersesTarget ? '#4CAF50' : '#2196F3' }]} /></View>
              </View>
              <View style={styles.revisionItem}>
                <View style={styles.revisionHeader}>
                  <Text style={styles.revisionTitle}>Weekly Surahs</Text>
                  {weeklySurahsTarget > 0 && weeklySurahsProgress >= weeklySurahsTarget ? <CheckCircle size={16} color="#4CAF50" /> : <XCircle size={16} color="#F44336" />}
                </View>
                <Text style={styles.revisionProgress}>{weeklySurahsProgress} / {weeklySurahsTarget} surahs</Text>
                <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${weeklySurahsPercentage}%`, backgroundColor: weeklySurahsProgress >= weeklySurahsTarget ? '#4CAF50' : '#2196F3' }]} /></View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.revisionItem}>
                <View style={styles.revisionHeader}>
                  <Text style={styles.revisionTitle}>Daily Pages</Text>
                  {dailyPagesTarget > 0 && dailyPagesProgress >= dailyPagesTarget ? <CheckCircle size={16} color="#4CAF50" /> : <XCircle size={16} color="#F44336" />}
                </View>
                <Text style={styles.revisionProgress}>{dailyPagesProgress} / {dailyPagesTarget} pages</Text>
                <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${dailyPagesPercentage}%`, backgroundColor: dailyPagesProgress >= dailyPagesTarget ? '#4CAF50' : '#2196F3' }]} /></View>
              </View>
              <View style={styles.revisionItem}>
                <View style={styles.revisionHeader}>
                  <Text style={styles.revisionTitle}>Weekly Pages</Text>
                  {weeklyPagesTarget > 0 && weeklyPagesProgress >= weeklyPagesTarget ? <CheckCircle size={16} color="#4CAF50" /> : <XCircle size={16} color="#F44336" />}
                </View>
                <Text style={styles.revisionProgress}>{weeklyPagesProgress} / {weeklyPagesTarget} pages</Text>
                <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${weeklyPagesPercentage}%`, backgroundColor: weeklyPagesProgress >= weeklyPagesTarget ? '#4CAF50' : '#2196F3' }]} /></View>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsContainer}>
            {/* Hifdh Planner monthly summary - moved here as first quick action */}
            <Pressable onPress={() => router.push('/(tabs)/revision')} style={({ pressed }) => [styles.plannerCard, pressed && { opacity: 0.9 }]}>
              <View style={styles.plannerHeader}>
                <View style={styles.plannerTitleRow}>
                  <View style={styles.plannerIconWrap}><Calendar size={16} color="#a855f7" /></View>
                  <Text style={styles.plannerTitle}>Hifdh Planner for {plannerSummary.monthName}</Text>
                </View>
                <Pressable onPress={() => setShowPlannerInfo(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Info size={18} color="#a855f7" />
                </Pressable>
              </View>
              <>
                <Text style={styles.plannerSubtitle}>{plannerSummary.completedPlannedVerses} of {plannerSummary.totalPlannedVerses} verses completed</Text>
                <View style={styles.plannerProgressBar}>
                  <View style={[styles.plannerProgressFill, { width: `${plannerSummary.percent}%` }]} />
                </View>
                <View style={styles.plannerStatsRow}>
                  <Text style={styles.plannerStatText}>{plannerSummary.inProgressSurahs} surahs in progress</Text>
                  <Text style={styles.plannerStatText}>{plannerSummary.totalPlannedSurahs} planned</Text>
                </View>
                {plannerSummary.totalPlannedVerses === 0 && (
                  <Text style={styles.plannerEmptyText}>No plans yet for {plannerSummary.monthName}. Add your Hifdh plans in Revision.</Text>
                )}
              </>
            </Pressable>

            {/* Mushaf Card - added below Hifdh Planner */}
            <View style={styles.quickActionItem}>
              <MushafDownloadCard />
            </View>

            {quickActions.map((a, i) => <ActionCard key={i} {...a} />)}

            {/* Badges Card */}
            <Pressable
              style={styles.badgeCard}
              onPress={() => router.push('/(tabs)/badges')}
            >
              <View style={styles.badgeIcon}>
                <Award size={24} color="#fff" />
              </View>
              <View style={styles.badgeContent}>
                <Text style={styles.badgeTitle}>Badges</Text>
                <Text style={styles.badgeSubtitle}>{currentBadge.name}</Text>
              </View>
            </Pressable>

            {/* Quiz Card */}
            <Pressable
              style={styles.quizCard}
              onPress={() => router.push('/quiz')}
              disabled={memorizedVerses.length === 0}
            >
              <View style={styles.quizIcon}>
                <Target size={24} color="#fff" />
              </View>
              <View style={styles.quizContent}>
                <Text style={styles.quizTitle}>Take Quiz</Text>
                <Text style={styles.quizSubtitle}>
                  {memorizedVerses.length > 0 ? "Test your knowledge" : "Memorize verses first"}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage Overview</Text>
          <View style={styles.statsGrid}>
            {/* Show smart adaptive time with styled primary/secondary parts - activeReadingTime is seconds */}
            {(() => {
              const minutes = Math.floor((activeReadingTime || 0) / 60);
              const parts = formatQuranTimeStyledParts(minutes);
              const qcolor = '#4CAF50';
              // slightly lighter secondary color derived from primary for visual hierarchy
              const secondaryColor = '#b2dfbb';
              const timeValue = (
                <>
                  <Text style={[styles.timePrimary, { color: qcolor }]}>{parts.primary}</Text>
                  {parts.secondary ? <Text style={[styles.timeSecondary, { color: secondaryColor }]}>{' ' + parts.secondary}</Text> : null}
                </>
              );
              return <StatCard title="Quran Time" value={timeValue} subtitle="Active time spent" icon={Clock} color={qcolor} />;
            })()}
            <StreakCard title="Streak" value={stats.currentStreak} subtitle="Day streak" icon={FireStreakIcon} color={getStreakColor(stats.currentStreak)} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>As-Suwar Al Mustahabbah</Text>
          <LinearGradient colors={['#2a2a2a', '#1f1f1f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mustahabbahCard}>
            <MustahabbahGrid
              items={mustahabbahItems.map(it => ({ key: it.key, label: it.label, status: getSurahStatus(it) }))}
              onItemPress={(item) => {
                try {
                  const surahId = parseInt(item.key, 10);
                  if (isNaN(surahId) || surahId < 1 || surahId > 114) {
                    console.warn('[Mustahabbah] Invalid surahId:', surahId);
                    return;
                  }

                  // light haptic feedback
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

                  useQuranStore.getState().setLastViewedSurahId(surahId);

                  // persist last read (best-effort)
                  saveLastRead(surahId, 1).catch(err => {
                    console.warn('[Mustahabbah] Failed to save last read:', err);
                  });

                  // Use replace for clean navigation
                  safeNavigation.replace({
                    pathname: '/(tabs)/read',
                    params: {
                      surahId: surahId.toString(),
                      verseItem: '1',
                      source: 'mustahabbah',
                    },
                  });
                } catch (error) {
                  console.error('[Mustahabbah] Navigation error:', error);
                }
              }}
            />
            <View style={styles.progressSummary}>
              <View style={styles.progressItem}><View style={styles.memorizedDot} /><Text style={styles.progressText}>{mustahabbahMemorized} Memorized</Text></View>
              <View style={styles.progressItem}><View style={styles.remainingDot} /><Text style={styles.progressText}>{mustahabbahRemaining} Remaining</Text></View>
            </View>
          </LinearGradient>
        </View>

        {/* Hifdh Planner monthly summary moved above into Quick Actions */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityContainer}>
            {recentActivity.map(act => (
              <View key={act.id} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  {act.type === 'memorized' && <BookOpen size={16} color={primary} />}
                  {act.type === 'revised' && <RotateCcw size={16} color={primary} />}
                  {act.type === 'quiz' && <Award size={16} color={primary} />}
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>
                    {act.type === 'memorized' && 'surah' in act && `Memorized ${act.surah.englishName} (${act.surah.arabicName})`}
                    {act.type === 'revised' && 'surah' in act && `Revised ${act.surah.englishName} (${act.surah.arabicName})`}
                    {act.type === 'quiz' && 'score' in act && `Quiz completed with ${act.score}% score`}
                  </Text>
                  <Text style={styles.activityTime}>{act.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Streak Tooltip Modal */}
      <Modal
        visible={showStreakTooltip}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStreakTooltip(false)}
      >
        <Pressable
          style={styles.tooltipOverlay}
          onPress={() => setShowStreakTooltip(false)}
        >
          <View style={styles.tooltipContainer}>
            <View style={styles.tooltipHeader}>
              <FireStreakIcon size={24} />
              <Text style={styles.tooltipTitle}>Daily Streak</Text>
            </View>
            <Text style={styles.tooltipText}>
              Your streak counts consecutive days of opening iHafidh.
            </Text>
            <Text style={styles.tooltipText}>
              📅 <Text style={styles.tooltipBold}>Day 1:</Text> Open app → Streak = 1{"\n"}
              📅 <Text style={styles.tooltipBold}>Day 2:</Text> Open app → Streak = 2{"\n"}
              📅 <Text style={styles.tooltipBold}>Day 3:</Text> Skip day{"\n"}
              📅 <Text style={styles.tooltipBold}>Day 4:</Text> Open app → Streak = 1 (resets)
            </Text>
            <View style={styles.tooltipNote}>
              <Info size={16} color="#FFD700" />
              <Text style={styles.tooltipNoteText}>
                Streak resets to 1 when you miss a day to open iHafidh
              </Text>
            </View>
            <Pressable
              style={styles.tooltipCloseButton}
              onPress={() => setShowStreakTooltip(false)}
            >
              <Text style={styles.tooltipCloseText}>Got it!</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Planner Info Modal */}
      <Modal
        visible={showPlannerInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPlannerInfo(false)}
      >
        <Pressable style={styles.tooltipOverlay} onPress={() => setShowPlannerInfo(false)}>
          <View style={styles.tooltipContainer}>
            <View style={styles.tooltipHeader}>
              <Calendar size={24} color="#a855f7" />
              <Text style={styles.tooltipTitle}>Hifdh Planner</Text>
            </View>
            <Text style={styles.tooltipText}>
              Plan your Hifdh by adding surahs or verse ranges to any day of the month. Your progress updates automatically when you memorize or revise. Overlapping plans are de-duplicated—no double counting.
            </Text>
            <View style={styles.tooltipNote}>
              <Info size={16} color="#a855f7" />
              <Text style={styles.tooltipNoteText}>
                Use the Hifdh Planner in the Revision tab to add or edit your plans.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable style={[styles.tooltipCloseButton, { backgroundColor: '#111827', borderWidth: 1, borderColor: '#a855f7' }]} onPress={() => setShowPlannerInfo(false)}>
                <Text style={styles.tooltipCloseText}>Close</Text>
              </Pressable>
              <Pressable style={[styles.tooltipCloseButton, { backgroundColor: '#a855f7' }]} onPress={() => { setShowPlannerInfo(false); router.push('/(tabs)/revision'); }}>
                <Text style={styles.tooltipCloseText}>Open Planner</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  header: { paddingTop: 16, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#333' },
  greeting: { fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 8 },
  welcomeText: { fontSize: 14, color: '#ccc', marginTop: 4 },
  section: { paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  progressCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    justifyContent: 'space-between', // distribute circle and legend evenly
  },
  progressCardTitle: { color: '#fff', fontSize: 14, marginBottom: 8 },
  progressCircleContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  progressLegend: { flexDirection: 'column', alignItems: 'flex-start', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { color: '#888', fontSize: 13 },
  revisionItem: { backgroundColor: '#222', borderRadius: 12, padding: 12, marginBottom: 12 },
  revisionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  revisionTitle: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#fff' },
  revisionProgress: { fontSize: 14, color: '#888' },
  progressBar: { height: 6, backgroundColor: '#555', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', backgroundColor: '#2196F3' },
  actionsContainer: { gap: 12, marginVertical: 8 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', borderRadius: 12, padding: 16, borderWidth: 2 },
  actionIconWrap: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', marginRight: 12 },
  actionCardText: { flex: 1 },
  actionCardTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  actionCardSubtitle: { fontSize: 14, color: '#888' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: (width - 50) / 2, backgroundColor: '#333', borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  statTitle: { fontSize: 14, fontWeight: '600', color: '#fff', textAlign: 'center', marginBottom: 2 },
  statValue: { fontSize: 28, fontWeight: 'bold', marginBottom: 2 },
  timePrimary: { fontSize: 28, fontWeight: '700' },
  timeSecondary: { fontSize: 20, fontWeight: '600' },
  statSubtitle: { fontSize: 13, color: '#aaa', textAlign: 'center' },
  mustahabbahCard: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 12 },
  mustahabbahGrid: { marginTop: 8 },
  mustahabbahRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', marginBottom: 10 },
  cardWrapper: {
    flexBasis: '30%',
    maxWidth: '32%',
    marginHorizontal: '1%',
  },
  cardWrapperSmall: {},
  card: {
    backgroundColor: '#2b2b2b',
    borderRadius: 12,
    padding: 12,
    position: 'relative',
    minHeight: 85,
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8, // Space for icon
    paddingTop: 8, // Space for top icon
  },
  compactCard: { paddingVertical: 8, paddingHorizontal: 8 },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  compactCardTitle: { fontSize: 13, fontWeight: '600' },
  cardTitleSmall: { fontSize: 12 },
  iconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 8,
    right: 8
  },
  progressTextContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  progressPercentage: { color: '#fff', fontSize: 12, fontWeight: '700' },
  notStartedBorder: { borderWidth: 1, borderColor: '#d64545' },
  compactIconContainer: { width: 18, height: 18, borderRadius: 9 },
  iconContainerSmall: { width: 16, height: 16, borderRadius: 8 },
  iconText: { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 11 },
  compactIconText: { fontSize: 9, lineHeight: 11 },
  iconTextSmall: { fontSize: 8, lineHeight: 10 },
  progressSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#3a3a3a', marginTop: 8 },
  progressItem: { flexDirection: 'row', alignItems: 'center' },
  memorizedDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8, backgroundColor: '#2D5A27' },
  remainingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4a4a4a', borderWidth: 2, borderColor: '#6a6a6a', marginRight: 8 },
  progressText: { fontSize: 14, fontWeight: '500', color: '#fff' },
  activityContainer: { gap: 12, marginTop: 12 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', borderRadius: 12, padding: 16, marginBottom: 12 },
  activityIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(33,150,243,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityText: { color: '#fff', fontSize: 14, marginBottom: 4 },
  activityTime: { color: '#888', fontSize: 12 },
  badgesContainer: { gap: 12 },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  badgeContent: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  badgeSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  quizIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quizContent: {
    flex: 1,
  },
  quizTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  quizSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  infoButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    padding: 4,
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    maxWidth: '90%',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  tooltipText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 12,
  },
  tooltipBold: {
    fontWeight: '600',
    color: '#fff',
  },
  tooltipNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  tooltipNoteText: {
    fontSize: 13,
    color: '#FFD700',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  tooltipCloseButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  tooltipCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Planner styles
  plannerCard: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 12, borderWidth: 2, borderColor: '#a855f7' },
  plannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  plannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  plannerIconWrap: { width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(168,85,247,0.12)', alignItems: 'center', justifyContent: 'center' },
  plannerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  plannerSubtitle: { fontSize: 13, color: '#ccc', marginBottom: 6 },
  plannerProgressBar: { height: 6, backgroundColor: '#4b5563', borderRadius: 999, overflow: 'hidden' },
  plannerProgressFill: { height: '100%', backgroundColor: '#a855f7' },
  plannerStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  plannerStatText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  plannerEmptyText: { color: '#94a3b8', fontSize: 12 },
  quickActionItem: {
    marginHorizontal: 0,
    paddingHorizontal: 0,
    width: '100%',
  },
  // Mushaf card styles
  // removed old mushaf styles - replaced by MushafDownloadCard component
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#4ECDC4',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#1a1a1a',
  },
  toggleTextInactive: {
    color: '#888',
  },
});