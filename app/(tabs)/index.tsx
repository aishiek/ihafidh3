import React, { useEffect, useState, useMemo } from 'react';
import { 
  ScrollView, 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity,
  Dimensions,
  AppState,
  Platform,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  BookOpen, 
  Target, 
  Clock, 
  Award, 
  TrendingUp,
  Play,
  RotateCcw,
  CheckCircle,
  XCircle,
  X,
  Calendar,
  Moon,
  MapPin
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Circle, Path, Ellipse, G, Defs, LinearGradient as SvgLinearGradient, Stop, RadialGradient } from 'react-native-svg';
import { useProgressStore } from '@/store/progressStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useActivityStore } from '@/store/activityStore';
import { surahsData } from '@/data/surahs';
import { calculateOverallJuzStats, calculateJuzProgress } from '@/utils/juzCalculator';
import { QuranProgressTracker } from '@/data/quranProgress';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findVerseById } from '@/utils/verseUtils';
import { calculateCurrentBadge } from '@/utils/badgeUtils';
import { getJuzProgress } from '@/database/QuranDatabase';
import MinimalTopStrip from '@/components/MinimalTopStrip';
import { useQuranStore } from '@/store/quranStore';
import { useThemeColor } from '@/hooks/use-theme-color';

const { width } = Dimensions.get('window');

interface ProgressData {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
}

const USER_NAME_KEY = 'user_name';

interface SurahActivity {
  id: string;
  type: 'memorized' | 'revised';
  surah: {
    englishName: string;
    arabicName: string;
  };
  time: string;
}

interface QuizActivity {
  id: string;
  type: 'quiz';
  score: number;
  time: string;
}

type Activity = SurahActivity | QuizActivity;

// Verse counts for each surah
const surahVerseCounts = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, // 1-10
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135, // 11-20
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, // 21-30
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85, // 31-40
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, // 41-50
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13, // 51-60
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, // 61-70
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42, // 71-80
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, // 81-90
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11, // 91-100
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, // 101-110
  5, 4, 5, 6 // 111-114
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
        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
        <Stop offset="50%" stopColor="#FFD700" stopOpacity="0.6" />
        <Stop offset="100%" stopColor="#FF8C00" stopOpacity="0.2" />
      </RadialGradient>
      <SvgLinearGradient id="streakTrail" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
        <Stop offset="0%" stopColor="#FF4500" stopOpacity="0.8" />
        <Stop offset="50%" stopColor="#FF8C00" stopOpacity="0.4" />
        <Stop offset="100%" stopColor="#FFD700" stopOpacity="0.1" />
      </SvgLinearGradient>
    </Defs>
    {/* Streak trails */}
    <G opacity="0.7">
      <Path
        d="M20 50 Q60 45 85 40 Q75 50 70 55 Q50 52 20 50 Z"
        fill="url(#streakTrail)"
      />
      <Path
        d="M25 58 Q55 55 75 50 Q70 58 65 62 Q50 60 25 58 Z"
        fill="url(#streakTrail)"
        opacity="0.6"
      />
    </G>
    {/* Main fire body */}
    <Path
      d="M45 85 C35 80, 30 70, 32 60 C34 45, 40 35, 48 25 C50 20, 52 15, 55 12 C58 15, 60 20, 62 25 C70 35, 76 45, 78 60 C80 70, 75 80, 65 85 C60 88, 50 88, 45 85 Z"
      fill="url(#fireGradient)"
    />
    {/* Inner flame */}
    <Path
      d="M48 80 C42 76, 38 68, 40 60 C42 50, 46 42, 52 35 C54 32, 56 28, 58 26 C60 28, 62 32, 64 35 C70 42, 74 50, 76 60 C78 68, 74 76, 68 80 C65 82, 52 82, 48 80 Z"
      fill="url(#innerFire)"
      opacity="0.8"
    />
    {/* Hot core */}
    <Ellipse
      cx="58"
      cy="65"
      rx="8"
      ry="12"
      fill="url(#hotCore)"
    />
    {/* Sparks (static, no animation) */}
    <Circle cx="35" cy="45" r="1.5" fill="#FFD700" opacity="0.7" />
    <Circle cx="72" cy="38" r="1" fill="#FF8C00" opacity="0.7" />
  </Svg>
);

export default function HomeScreen() {
  const primary = useThemeColor({}, 'tint');
  const { 
    memorizedVerses, 
    revisedVerses, 
    dailyStreak, 
    quizResults, 
    lastReadVerse,
    dailyRevisedVerses,
    weeklyRevisedVerses,
    revisionSchedule,
    updateDailyStreak
  } = useProgressStore();
  
  const { userName, reminderTime } = useSettingsStore();
  const { 
    startSession, 
    endSession, 
    getTimeSpentToday,
    sessionStartTime,
    timeSpent, // <-- add this
    initializeActiveTimeManager,
    activeTimeManager
  } = useActivityStore();
  const quranStore = useQuranStore.getState();

  // 🍔 Hamburger Menu State
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [activeReadingTime, setActiveReadingTime] = useState(0);

  // 🍔 Menu Items Configuration
  const menuItems = [
    {
      id: 'fasting-calendar',
      title: 'Sunnah Fastings Calendar',
      subtitle: 'Sunnah Fastings Notification',
      icon: Calendar,
      color: '#059669',
      onPress: () => {
        setIsMenuVisible(false);
        router.push('/fasting/calendar');
      }
    },
    {
      id: 'moon-phases',
      title: 'Moon Phases',
      subtitle: 'Lunar cycle today', // updated from Coming soon
      icon: Moon,
      color: '#6366f1',
      onPress: () => {
        setIsMenuVisible(false);
        router.push('/moon-phases');
      }
    },
    {
      id: 'qibla-finder',
      title: 'Qibla Finder',
      subtitle: 'Find prayer direction',
      icon: MapPin,
      color: '#dc2626',
      onPress: () => {
        setIsMenuVisible(false);
        router.push('/qibla');
      }
    }
  ];

  // Handle app state changes for time tracking
  useEffect(() => {
    // Initialize active time manager first
    initializeActiveTimeManager();
    
    // Start session when component mounts
    if (!sessionStartTime) {
      startSession();
    }

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !sessionStartTime) {
        // App came to foreground without an active session
        startSession();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background, end current session
        endSession();
      }
    });

    // Cleanup function
    return () => {
      subscription.remove();
      // End session when component unmounts
      if (sessionStartTime) {
        endSession();
      }
      // Cleanup active time manager
      if (activeTimeManager) {
        activeTimeManager.cleanup();
      }
    };
  }, [sessionStartTime, startSession, endSession, initializeActiveTimeManager, activeTimeManager]);

  // Function to get current active time
  const getCurrentActiveTime = () => {
    let currentActiveTime = 0;
    
    if (activeTimeManager) {
      const stats = activeTimeManager.getStats();
      currentActiveTime = stats.totalTimeSeconds;
    } else if (sessionStartTime) {
      // Fallback to session time if active time manager not available
      currentActiveTime = Math.floor((Date.now() - sessionStartTime) / 1000);
    }
    
    return timeSpent.total + currentActiveTime;
  };

  // Update active reading time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveReadingTime(getCurrentActiveTime());
    }, 1000);

    // Set initial value
    setActiveReadingTime(getCurrentActiveTime());

    return () => clearInterval(interval);
  }, [sessionStartTime, activeTimeManager, timeSpent.total]);

  // Ensure daily streak is updated on every home page mount
  useEffect(() => {
    updateDailyStreak();
  }, []);

  // Calculate dynamic progress data
  const progressTracker = useMemo(() => {
    return new QuranProgressTracker({
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
      }).filter(Boolean)
    });
  }, [memorizedVerses]);

  const progress = progressTracker.calculateProgress();

  // Helper functions - moved before stats useMemo
  const calculateSurahProgress = (surahId: number) => {
    let startVerseId = 0;
    for (let i = 1; i < surahId; i++) {
      const prevSurah = surahsData.find(s => s.id === i);
      if (prevSurah) startVerseId += prevSurah.versesCount;
    }
    
    const surah = surahsData.find(s => s.id === surahId);
    if (!surah) return { memorized: 0, progress: 0 };
    
    const startVerse = startVerseId + 1;
    const endVerse = startVerseId + surah.versesCount;
    
    const memorizedInSurah = memorizedVerses.filter(id => id >= startVerse && id <= endVerse).length;
    const progressPercentage = (memorizedInSurah / surah.versesCount) * 100;
    
    return { memorized: memorizedInSurah, progress: progressPercentage };
  };

  const calculateInProgressVerses = () => {
    let inProgress = 0;
    surahsData.forEach(surah => {
      const surahProgress = calculateSurahProgress(surah.id);
      if (surahProgress.memorized > 0 && surahProgress.memorized < surah.versesCount) {
        inProgress += surahProgress.memorized;
      }
    });
    return inProgress;
  };

  const calculateInProgressSurahs = () => {
    let inProgress = 0;
    surahsData.forEach(surah => {
      const surahProgress = calculateSurahProgress(surah.id);
      if (surahProgress.memorized > 0 && surahProgress.memorized < surah.versesCount) {
        inProgress++;
      }
    });
    return inProgress;
  };

  const calculateInProgressJuz = () => {
    // This would need more complex calculation based on juz boundaries
    // For now, return a simple estimate
    return Math.floor(calculateInProgressSurahs() / 4);
  };

  // --- As Suwar Al Mustahabbah helpers ---
  // Determine if a surah is fully memorized based on memorizedVerses list
  const isSurahFullyMemorized = (surahId: number) => {
    let startVerseId = 0;
    for (let i = 1; i < surahId; i++) {
      const prev = surahsData.find(s => s.id === i);
      if (prev) startVerseId += prev.versesCount;
    }
    const surah = surahsData.find(s => s.id === surahId);
    if (!surah) return false;
    const start = startVerseId + 1;
    const end = startVerseId + surah.versesCount;
    const count = memorizedVerses.filter(id => id >= start && id <= end).length;
    return count === surah.versesCount;
  };

  // Check a specific ayah (for Ayat al Kursi 2:255)
  const isAyahMemorized = (surahId: number, verseNumber: number) => {
    let id = 0;
    for (let i = 0; i < surahId - 1; i++) id += surahVerseCounts[i];
    const globalId = id + verseNumber;
    return memorizedVerses.includes(globalId);
  };

  // Helper to check if a surah has any memorized verses
  const hasSurahProgress = (surahNumber: number) => {
    let startVerseId = 0;
    for (let i = 1; i < surahNumber; i++) {
      const prev = surahsData.find(s => s.id === i);
      if (prev) startVerseId += prev.versesCount;
    }
    const surah = surahsData.find(s => s.id === surahNumber);
    if (!surah) return false;
    const start = startVerseId + 1;
    const end = startVerseId + surah.versesCount;
    return memorizedVerses.some(id => id >= start && id <= end);
  };

  const mustahabbahItems: { key: string; label: string; isMemorized: boolean; inProgress: boolean }[] = [
    { key: '36', label: 'Ya Seen', isMemorized: isSurahFullyMemorized(36), inProgress: !isSurahFullyMemorized(36) && hasSurahProgress(36) },
    { key: '32', label: 'As Sajdah', isMemorized: isSurahFullyMemorized(32), inProgress: !isSurahFullyMemorized(32) && hasSurahProgress(32) },
    { key: '73', label: 'Al Muzzammil', isMemorized: isSurahFullyMemorized(73), inProgress: !isSurahFullyMemorized(73) && hasSurahProgress(73) },
    { key: '18', label: 'Al Kahf', isMemorized: isSurahFullyMemorized(18), inProgress: !isSurahFullyMemorized(18) && hasSurahProgress(18) },
    { key: '55', label: 'Ar Rahman', isMemorized: isSurahFullyMemorized(55), inProgress: !isSurahFullyMemorized(55) && hasSurahProgress(55) },
    { key: '67', label: 'Al Mulk', isMemorized: isSurahFullyMemorized(67), inProgress: !isSurahFullyMemorized(67) && hasSurahProgress(67) },
    { key: '56', label: 'Al Waqi\'ah', isMemorized: isSurahFullyMemorized(56), inProgress: !isSurahFullyMemorized(56) && hasSurahProgress(56) },
    { key: '62', label: 'Al Jumu\'ah', isMemorized: isSurahFullyMemorized(62), inProgress: !isSurahFullyMemorized(62) && hasSurahProgress(62) },
    { key: '76', label: 'Al Insan', isMemorized: isSurahFullyMemorized(76), inProgress: !isSurahFullyMemorized(76) && hasSurahProgress(76) },
  ];

  const mustahabbahMemorized = mustahabbahItems.filter(i => i.isMemorized).length;
  const mustahabbahRemaining = mustahabbahItems.length - mustahabbahMemorized;

  const getSurahStatus = (item: typeof mustahabbahItems[0]) => {
    if (item.isMemorized) return 'memorized';
    if (item.inProgress) return 'in-progress';
    return 'not-started';
  };

const getBackgroundColors = (status: string) => {
  switch (status) {
    case 'memorized':
      return ['#16a34a', '#15803d'];
    case 'in-progress':
      return ['#f59e0b', '#d97706'];
    default:
      return ['#374151', '#4b5563'];
  }
};

  const getIconColor = (status: string) => {
    switch (status) {
      case 'memorized':
        return '#ffffff';
      case 'in-progress':
        return '#000000';
      default:
        return '#ef4444';
    }
  };

const getTextColor = (status: string) => {
  switch (status) {
    case 'memorized':
      return '#ffffff';
    case 'in-progress':
      return '#000000';
    default:
      return '#d1d5db';
  }
};

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return `${Math.floor(diffDays / 7)} weeks ago`;
  };

  // Replace getJuzProgressList with DB-based version
  const [juzProgressList, setJuzProgressList] = useState<{juz: number, memorized: number, total: number, progress: number}[]>([]);

  useEffect(() => {
    const fetchJuzProgress = async () => {
      const list = [];
      for (let i = 1; i <= 30; i++) {
        const progress = await getJuzProgress(i);
        list.push({ juz: i, ...progress });
      }
      setJuzProgressList(list);
    };
    fetchJuzProgress();
  }, [/* add dependencies if needed, e.g. memorizedVerses */]);

  // Add a helper to get Juz info for all 30 Juz using centralized calculator
  const getAllJuzInfo = (memorizedVerses: number[]) => {
    const result = [] as Array<{ juz: number; versesInJuz: number; memorizedInJuz: number; completed: boolean; inProgress: boolean; notStarted: boolean }>;
    for (let juz = 1; juz <= 30; juz++) {
      const progress = calculateJuzProgress(juz, memorizedVerses);
      result.push({
        juz,
        versesInJuz: progress.total,
        memorizedInJuz: progress.memorized,
        completed: progress.memorized === progress.total && progress.total > 0,
        inProgress: progress.memorized > 0 && progress.memorized < progress.total,
        notStarted: progress.memorized === 0
      });
    }
    return result;
  };

  // Memoize all Juz info for performance
  const allJuzInfo = useMemo(() => getAllJuzInfo(memorizedVerses), [memorizedVerses]);

  // Calculate dynamic stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's time spent in minutes from the activity store
    const todayTimeSpent = Math.max(1, Math.round(getTimeSpentToday() / 60));

    // Use streak as-is, starting from zero
    const currentStreak = dailyStreak;
    
    // Calculate today's revised verses
    const todayRevisedCount = dailyRevisedVerses.filter(rv => rv.date === today).length;
    
    // Calculate this week's revised surahs
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weekStart = startOfWeek.toISOString().split('T')[0];
    
    const thisWeekRevisedCount = weeklyRevisedVerses.filter(rv => rv.date >= weekStart).length;
    const weeklyTarget = revisionSchedule.surahsPerWeek.length || 2;

    // Calculate in-progress counts
    const versesInProgress = calculateInProgressVerses();
    const surahsInProgress = calculateInProgressSurahs();
    const juzInProgress = calculateInProgressJuz();

    // Use proper Juz calculation
    const { completed: completedJuz, inProgress: inProgressJuz, notStarted: notStartedJuz } = calculateOverallJuzStats(memorizedVerses);

    return {
      verses: { 
        total: 6236, 
        completed: progress.verses.completed, 
        inProgress: versesInProgress, 
        notStarted: 6236 - progress.verses.completed - versesInProgress 
      },
      surahs: { 
        total: 114, 
        completed: progress.surahs.completed, 
        inProgress: surahsInProgress, 
        notStarted: 114 - progress.surahs.completed - surahsInProgress 
      },
      juz: { total: 30, completed: completedJuz, inProgress: inProgressJuz, notStarted: notStartedJuz },
      currentStreak,
      totalStudyTime: todayTimeSpent,
      dailyRevisionTarget: revisionSchedule.versesPerDay || 5,
      dailyRevisionCompleted: todayRevisedCount,
      weeklyRevisionTarget: weeklyTarget,
      weeklyRevisionCompleted: Math.min(thisWeekRevisedCount, weeklyTarget)
    };
  }, [memorizedVerses, dailyStreak, getTimeSpentToday, dailyRevisedVerses, weeklyRevisedVerses, revisionSchedule, progress, juzProgressList]);

  // Calculate recent activity from real data
  const recentActivity = useMemo(() => {
    const activities: Activity[] = [];
    const seenActivities = new Set<string>();
    
    // Helper function to add unique activities
    const addUniqueActivity = (activity: Activity) => {
      const key = `${activity.type}-${activity.type === 'quiz' ? activity.score : 'surah' in activity ? activity.surah.englishName : ''}`;
      if (!seenActivities.has(key)) {
        seenActivities.add(key);
        activities.push(activity);
      }
    };
    
    // Add recent quiz results
    quizResults
      .slice(-5)
      .map(quiz => ({
        id: `quiz-${quiz.id}`,
        type: 'quiz' as const,
        score: Math.round((quiz.correct / quiz.totalQuestions) * 100),
        time: getRelativeTime(quiz.date)
      }))
      .forEach(addUniqueActivity);
    
    // Add recent revisions
    revisedVerses
      .slice(-10)
      .map(rv => {
        const verse = findVerseById(rv.verseId);
        return {
          id: `revision-${rv.verseId}`,
          type: 'revised' as const,
          surah: {
            englishName: surahsData.find(s => s.id === verse.surahId)?.name || '',
            arabicName: surahsData.find(s => s.id === verse.surahId)?.arabicName || ''
          },
          time: getRelativeTime(rv.revisionDate)
        };
      })
      .forEach(addUniqueActivity);
    
    // Add recent memorizations
    memorizedVerses
      .slice(-10)
      .map(verseId => {
        const verse = findVerseById(verseId);
        return {
          id: `memo-${verseId}`,
          type: 'memorized' as const,
          surah: {
            englishName: surahsData.find(s => s.id === verse.surahId)?.name || '',
            arabicName: surahsData.find(s => s.id === verse.surahId)?.arabicName || ''
          },
          time: 'Recently'
        };
      })
      .forEach(addUniqueActivity);

    // Return only the 3 most recent unique activities
    return activities.slice(0, 3);
  }, [quizResults, revisedVerses, memorizedVerses]);

  // Remove the useMemo for calculateCurrentBadge and instead use the shared function:
  const currentBadge = useMemo(() => calculateCurrentBadge(memorizedVerses, progress.juz.completed), [memorizedVerses, progress.juz.completed]);

  // Quick actions based on user's current state
  const quickActions = useMemo(() => {
    const actions = [];
    
    // Continue reading action
    if (lastReadVerse) {
      const verseDetails = findVerseById(lastReadVerse.id);
      const surah = surahsData.find(s => s.id === verseDetails.surahId);
      if (surah) {
        actions.push({
          title: 'Continue Reading',
          subtitle: `${surah.name} (${surah.arabicName})`,
          icon: Play,
          color: '#4CAF50',
          action: () => {
            // Set the last viewed surah in the Read screen and navigate directly to it
            if (verseDetails && surah) {
              quranStore.setLastViewedSurahId(surah.id);
              router.push('/(tabs)/read');
            } else {
              router.push('/(tabs)/read');
            }
          }
        });
      }
    } else {
      actions.push({
        title: 'Start Reading',
        subtitle: 'Begin your journey',
        icon: Play,
        color: '#4CAF50',
        action: () => router.push('/(tabs)/read')
      });
    }

    // Revision action
    const pendingRevisions = revisionSchedule.versesPerDay - stats.dailyRevisionCompleted;
    if (pendingRevisions > 0) {
      actions.push({
        title: 'Revision Due',
        subtitle: `${pendingRevisions} verses pending`,
        icon: RotateCcw,
        color: '#FF9800',
        action: () => router.push('/(tabs)/revision')
      });
    } else {
      actions.push({
        title: 'Daily Goal Complete',
        subtitle: 'Well done!',
        icon: CheckCircle,
        color: '#4CAF50',
        action: () => router.push('/(tabs)/revision')
      });
    }

    // Badges action
    actions.push({
      title: 'Badges',
      subtitle: currentBadge.name,
      icon: Award,
      color: '#9C27B0',
      action: () => router.push('/(tabs)/badges')
    });

    // Quiz action
    actions.push({
      title: 'Take Quiz',
      subtitle: 'Test your knowledge',
      icon: Target,
      color: '#E91E63',
      action: () => router.push('/(tabs)/quiz')
    });

    return actions;
  }, [lastReadVerse, revisionSchedule.versesPerDay, stats.dailyRevisionCompleted, currentBadge.name]);

  const CircularProgress = ({ 
    progress, 
    size = 100, 
    strokeWidth = 8,
    progressColor = '#2196F3',
    inProgressColor = '#FF9800',
    notStartedColor = '#666666',
    completed = 0,
    inProgress = 0,
    total = 100
  }: {
    progress: number;
    size?: number;
    strokeWidth?: number;
    progressColor?: string;
    inProgressColor?: string;
    notStartedColor?: string;
    completed?: number;
    inProgress?: number;
    total?: number;
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const completedOffset = circumference - (completed / total) * circumference;
    const inProgressOffset = circumference - ((completed + inProgress) / total) * circumference;

  return (
      <>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Background circle */}
          <Circle
            stroke={notStartedColor}
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          {/* In Progress circle */}
          {inProgress > 0 && (
            <Circle
              stroke={inProgressColor}
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={inProgressOffset}
              strokeLinecap="round"
            />
          )}
          {/* Completed circle */}
          <Circle
            stroke={progressColor}
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={completedOffset}
            strokeLinecap="round"
          />
        </Svg>
        <View style={[styles.progressTextContainer, { width: size, height: size, position: 'absolute' }]}>
          <Text style={styles.progressPercentage}>
            {Math.round((completed / total) * 100)}%
          </Text>
        </View>
      </>
    );
  };

  const ProgressCard = ({ 
    title, 
    data,
    size
  }: { 
    title: string; 
    data: ProgressData;
    size?: number;
  }) => {
    const isSmall = width < 420; // treat small phones as compact
    const cardWidth = isSmall ? 150 : 220;
    const circleSize = size ?? (isSmall ? 64 : 80);

    return (
      <View style={[styles.progressCard, { width: cardWidth }]}>
        <Text style={styles.progressCardTitle}>{title}</Text>
        <View style={styles.progressCircleContainer}>
          <CircularProgress
            progress={(data.completed / data.total) * 100}
            size={circleSize}
            completed={data.completed}
            inProgress={data.inProgress}
            total={data.total}
          />
        </View>
        <View style={styles.progressLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
            <Text style={[styles.legendText, isSmall && { fontSize: 11 }]}>{data.completed} Completed</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
            <Text style={[styles.legendText, isSmall && { fontSize: 11 }]}>{data.inProgress} In Progress</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#666666' }]} />
            <Text style={[styles.legendText, isSmall && { fontSize: 11 }]}>{data.notStarted} Not Started</Text>
          </View>
        </View>
      </View>
    );
  };

  // Helper to format total time spent as d h m
  function formatTotalTime(totalSeconds: number) {
    if (!totalSeconds || totalSeconds < 0) return '0m';
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0 || days > 0) result += `${hours}h `;
    result += `${minutes}m`;
    return result.trim();
  }

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    color = '#2196F3' 
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: any;
    color?: string;
  }) => (
    <View style={{
      flex: 1,
      minWidth: 120,
      maxWidth: 180,
      backgroundColor: '#232323',
      borderRadius: 16,
      padding: 16,
      margin: 8,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
    }}>
      <Icon size={28} color={color} style={{ marginBottom: 8 }} />
      <Text style={{
        fontSize: String(value).length > 8 ? 20 : 28,
        fontWeight: 'bold',
        color: color,
        marginBottom: 2,
        textAlign: 'center',
      }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {subtitle && (
        <Text style={{ fontSize: 13, color: '#aaa', textAlign: 'center' }}>{subtitle}</Text>
      )}
    </View>
  );

  const ActionCard = ({ 
    title, 
    subtitle, 
    icon: Icon, 
    color, 
    action 
  }: {
    title: string;
    subtitle: string;
    icon: any;
    color: string;
    action: () => void;
  }) => (
    <TouchableOpacity 
      style={[styles.actionCard, { borderColor: color }]} 
      onPress={action}
    >
      <View style={styles.actionCardContent}>
        <Icon size={24} color={color} />
        <View style={styles.actionCardText}>
          <Text style={styles.actionCardTitle}>{title}</Text>
          <Text style={styles.actionCardSubtitle}>{subtitle}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const MustahabbahCard = ({ item, onPress, wrapperStyle }: { item: { label: string; status: 'memorized'|'in-progress'|'not-started' }, onPress?: (it: any) => void, wrapperStyle?: any }) => {
    const backgroundColors = getBackgroundColors(item.status);
    const textColor = getTextColor(item.status);
    const icon = item.status === 'memorized' 
      ? { symbol: '✓', color: '#ffffff' } 
      : item.status === 'in-progress' 
      ? { symbol: '◐', color: '#000000' } 
      : { symbol: '✕', color: '#ef4444' };

    // Dynamic base font size with auto-fit to guarantee full name visibility within two lines
    const getFontSize = (label: string) => {
      return 15;
    };

    return (
      <TouchableOpacity 
        style={[styles.cardWrapper, wrapperStyle]}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={backgroundColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.card,
            item.status === 'not-started' && styles.notStartedBorder
          ]}
        >
          <Text 
            style={[
              styles.cardTitle, 
              { 
                color: textColor,
                fontSize: getFontSize(item.label),
                lineHeight: getFontSize(item.label) + 3
              }
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {item.label}
          </Text>
          
          <View style={[
            styles.iconContainer,
            {
              backgroundColor: item.status === 'memorized' 
                ? 'rgba(255, 255, 255, 0.2)'
                : item.status === 'in-progress'
                ? 'rgba(0, 0, 0, 0.2)'
                : 'rgba(239, 68, 68, 0.2)',
              borderColor: item.status === 'not-started' ? '#ef4444' : 'transparent',
              borderWidth: item.status === 'not-started' ? 1.5 : 0,
            }
          ]}>
            <Text style={[styles.iconText, { color: icon.color }]}>{icon.symbol}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const MustahabbahGrid = ({ items, onItemPress }: { items: any[], onItemPress: (item: any) => void }) => {
    // Organize items into rows of 3
    const rows = [];
    for (let i = 0; i < items.length; i += 3) {
      rows.push(items.slice(i, i + 3));
    }
    return (
      <View style={styles.mustahabbahGrid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.mustahabbahRow}>
            {row.map((item, itemIndex) => {
              const extra = itemIndex % 3 !== 2 ? styles.cardWrapperSpacing : null;
              return (
                <MustahabbahCard 
                  key={item.key}
                  item={item}
                  onPress={onItemPress}
                  wrapperStyle={extra}
                />
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <>
    {/* Note: Hamburger icon moved to global layout to ensure consistency across tabs */}
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <MinimalTopStrip style={{ flex: 1 }} />
        </View>
        <Text style={styles.greeting}>
          Assalamu Alaikkum{userName ? `, ${userName}` : ''}
        </Text>
        <Text style={styles.welcomeText}>Welcome back to your Quran journey</Text>
      </View>

      {/* Circular Progress Indicators */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Progress</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ProgressCard title="Verses" data={stats.verses} />
          <ProgressCard title="Surahs" data={stats.surahs} />
          <ProgressCard title="Juz" data={stats.juz} />
        </ScrollView>
      </View>

      {/* Revision Goals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revision Goals</Text>
        <View style={styles.revisionContainer}>
          <View style={styles.revisionItem}>
            <View style={styles.revisionHeader}>
              <Text style={styles.revisionTitle}>Daily Verses</Text>
              {stats.dailyRevisionCompleted >= stats.dailyRevisionTarget ? (
                <CheckCircle size={16} color="#4CAF50" />
              ) : (
                <XCircle size={16} color="#F44336" />
              )}
            </View>
            <Text style={styles.revisionProgress}>
              {stats.dailyRevisionCompleted} / {stats.dailyRevisionTarget} verses
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min((stats.dailyRevisionCompleted / stats.dailyRevisionTarget) * 100, 100)}%`,
                    backgroundColor: stats.dailyRevisionCompleted >= stats.dailyRevisionTarget ? '#4CAF50' : '#2196F3'
                  }
                ]} 
              />
            </View>
          </View>
          
          <View style={styles.revisionItem}>
            <View style={styles.revisionHeader}>
              <Text style={styles.revisionTitle}>Weekly Surahs</Text>
              {stats.weeklyRevisionCompleted >= stats.weeklyRevisionTarget ? (
                <CheckCircle size={16} color="#4CAF50" />
              ) : (
                <XCircle size={16} color="#F44336" />
              )}
            </View>
            <Text style={styles.revisionProgress}>
              {stats.weeklyRevisionCompleted} / {stats.weeklyRevisionTarget} surahs
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min((stats.weeklyRevisionCompleted / stats.weeklyRevisionTarget) * 100, 100)}%`,
                    backgroundColor: stats.weeklyRevisionCompleted >= stats.weeklyRevisionTarget ? '#4CAF50' : '#2196F3'
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          {quickActions.map((action, index) => (
            <ActionCard key={index} {...action} />
          ))}
        </View>
      </View>

      {/* Statistics Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Usage Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard 
            title="Quran Time" 
            value={formatTotalTime(activeReadingTime)}
            subtitle="Active time spent"
            icon={Clock}
            color="#4CAF50"
          />
          <StatCard 
            title="Streak" 
            value={stats.currentStreak} 
            subtitle="Streak"
            icon={FireStreakIcon}
            color="#FF9800"
          />
        </View>
      </View>

      {/* As Suwar Al Mustahabbah */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>As-Suwar Al Mustahabbah</Text>
        <LinearGradient
          colors={['#2a2a2a', '#1f1f1f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mustahabbahCard}
        >
          <MustahabbahGrid 
            items={mustahabbahItems.map(item => ({
              key: item.key,
              label: item.label,
              status: getSurahStatus(item)
            }))}
            onItemPress={(item) => {
              const surahId = parseInt(item.key);
              // Set last viewed surah so Read tab opens it in-place
              useQuranStore.getState().setLastViewedSurahId(surahId);
              router.push('/(tabs)/read');
            }}
          />

          {/* Progress summary */}
          <View style={styles.progressSummary}>
            <View style={styles.progressItem}>
              <LinearGradient
                colors={['#2D5A27', '#4A9B8E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.memorizedDot}
              />
              <Text style={styles.progressText}>{mustahabbahMemorized} Memorized</Text>
            </View>
            <View style={styles.progressItem}>
              <View style={styles.remainingDot} />
              <Text style={styles.progressText}>{mustahabbahRemaining} Remaining</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityContainer}>
          {recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <BookOpen size={16} color={primary} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  {activity.type === 'memorized' && 'surah' in activity && `Memorized ${activity.surah.englishName} (${activity.surah.arabicName})`}
                  {activity.type === 'revised' && 'surah' in activity && `Revised ${activity.surah.englishName} (${activity.surah.arabicName})`}
                  {activity.type === 'quiz' && 'score' in activity && `Quiz completed with ${activity.score}% score`}
                </Text>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>

    {/* 🍔 Hamburger Menu Modal */}
    <Modal
      visible={isMenuVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setIsMenuVisible(false)}
    >
      <View style={styles.menuOverlay}>
        <TouchableOpacity 
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setIsMenuVisible(false)}
        />
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>More Features</Text>
            <TouchableOpacity 
              style={styles.menuCloseButton}
              onPress={() => setIsMenuVisible(false)}
            >
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.menuContent}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.8}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: `${item.color}20` }]}>
                  <item.icon size={24} color={item.color} />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.menuFooter}>
            <Text style={styles.menuFooterText}>More features coming soon...</Text>
          </View>
        </View>        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },

  /* Header */
  header: {
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTopWithMenu: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerHamburgerButton: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  hamburgerButton: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },

  /* Navigation overlay for hamburger */
  navigationHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  navigationHamburgerButton: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },

  /* Greeting */
  greeting: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginTop: 8 },
  welcomeText: { fontSize: 14, color: '#cccccc', marginTop: 4 },

  /* Sections */
  section: { paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 12 },

  /* Revision */
  revisionContainer: {},
  revisionItem: { backgroundColor: '#222222', borderRadius: 12, padding: 12, marginBottom: 12 },
  revisionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  revisionTitle: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#ffffff' },
  revisionProgress: { fontSize: 14, color: '#888888' },

  /* Progress bar */
  progressBar: { height: 6, backgroundColor: '#555555', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', backgroundColor: '#2196F3' },

  /* Small progress card */
  progressCard: { backgroundColor: '#222', borderRadius: 12, padding: 12, marginRight: 12, width: 220 },
  progressCardTitle: { color: '#fff', fontSize: 14, marginBottom: 8 },
  progressCircleContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  progressLegend: { flexDirection: 'column', alignItems: 'flex-start', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { color: '#888888', fontSize: 13 },

  /* Action cards */
  actionsContainer: { gap: 12, marginVertical: 8 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333333', borderRadius: 12, padding: 16, borderColor: '#2196F3', borderWidth: 0 },
  actionCardContent: { flexDirection: 'row', alignItems: 'center' },
  actionCardText: { flex: 1, marginLeft: 12 },
  actionCardTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 2 },
  actionCardSubtitle: { fontSize: 14, color: '#888888' },

  /* Mustahabbah grid */
  mustahabbahGrid: { marginTop: 8 },
  mustahabbahRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  mustahabbahCard: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 12, flex: 1, marginRight: 8 },

  /* Cards */
  cardWrapper: { width: (width - 60) / 3 },
  cardWrapperSpacing: { marginRight: 8 },
  card: { backgroundColor: '#2b2b2b', borderRadius: 12, padding: 12, position: 'relative' },
  notStartedBorder: { borderLeftWidth: 4, borderLeftColor: '#666' },
  cardTitle: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  /* Icon */
  iconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 4,
    right: 4,
  },
  iconText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },

  /* Menu modal */
  menuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  menuContainer: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  menuTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  menuCloseButton: { padding: 8, borderRadius: 8, backgroundColor: '#222' },
  menuContent: { marginTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#222', marginBottom: 10 },
  menuItemIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuItemContent: { flex: 1 },
  menuItemTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  menuItemSubtitle: { color: '#aaa', fontSize: 13 },
  menuFooter: { marginTop: 12 },
  menuFooterText: { color: '#888', fontSize: 12 },

  /* Activity */
  activityContainer: { gap: 12, marginTop: 12 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333333', borderRadius: 12, padding: 16, marginBottom: 12 },
  activityIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(33,150,243,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityText: { color: '#ffffff', fontSize: 14, marginBottom: 4 },
  activityTime: { color: '#888888', fontSize: 12 },

  /* Stats */
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: (width - 50) / 2, backgroundColor: '#333333', borderRadius: 12, padding: 16, marginBottom: 12 },
  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statTitle: { fontSize: 12, color: '#888888', marginLeft: 8, textTransform: 'uppercase' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  statSubtitle: { fontSize: 12, color: '#888888' },

  /* Progress summary */
  progressSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#3a3a3a' },
  progressItem: { flexDirection: 'row', alignItems: 'center' },
  memorizedDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8, shadowColor: '#4A9B8E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  remainingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4a4a4a', borderWidth: 2, borderColor: '#6a6a6a', marginRight: 8 },
  progressText: { fontSize: 14, fontWeight: '500', color: '#ffffff' },

  /* Additional small helpers used by components */
  progressTextContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  progressPercentage: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // fallback defaults
  smallButton: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
});