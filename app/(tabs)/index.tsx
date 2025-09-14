import MinimalTopStrip from '@/components/MinimalTopStrip';
import { QuranProgressTracker } from '@/data/quranProgress';
import { surahsData } from '@/data/surahs';
import { getJuzProgress } from '@/database/QuranDatabase';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useActivityStore } from '@/store/activityStore';
import { useProgressStore } from '@/store/progressStore';
import { useQuranStore } from '@/store/quranStore';
import { useSettingsStore } from '@/store/settingsStore';
import { calculateCurrentBadge } from '@/utils/badgeUtils';
import { calculateJuzProgress, calculateOverallJuzStats } from '@/utils/juzCalculator';
import { findVerseById } from '@/utils/verseUtils';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Moon,
  Play,
  RotateCcw,
  Target,
  XCircle
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

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

  const [activeReadingTime, setActiveReadingTime] = useState(0);

  // --- Time tracking lifecycle ---
  useEffect(() => {
    initializeActiveTimeManager();
    if (!sessionStartTime) startSession();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && !sessionStartTime) startSession();
      if (s !== 'active' && sessionStartTime) endSession();
    });
    return () => {
      sub.remove();
      if (sessionStartTime) endSession();
      activeTimeManager?.cleanup();
    };
  }, [sessionStartTime, startSession, endSession, initializeActiveTimeManager, activeTimeManager]);

  const getCurrentActiveTime = () => {
    if (activeTimeManager) return timeSpent.total + activeTimeManager.getStats().totalTimeSeconds;
    if (sessionStartTime) return timeSpent.total + Math.floor((Date.now() - sessionStartTime) / 1000);
    return timeSpent.total;
  };
  useEffect(() => {
    const i = setInterval(() => setActiveReadingTime(getCurrentActiveTime()), 1000);
    setActiveReadingTime(getCurrentActiveTime());
    return () => clearInterval(i);
  }, [sessionStartTime, activeTimeManager, timeSpent.total]);

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
    }).filter(Boolean)
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

  const getBackgroundColors = (status: string) => status === 'memorized' ? ['#16a34a', '#15803d'] : status === 'in-progress' ? ['#f59e0b', '#d97706'] : ['#374151', '#4b5563'];
  const getTextColor = (status: string) => status === 'memorized' ? '#fff' : status === 'in-progress' ? '#000' : '#d1d5db';

  // Juz info
  const [juzProgressList, setJuzProgressList] = useState<{juz:number, memorized:number, total:number, progress:number}[]>([]);
  useEffect(() => { (async () => { const list:any[] = []; for (let i=1;i<=30;i++){ const p = await getJuzProgress(i); list.push({juz:i, ...p}); } setJuzProgressList(list); })(); }, [memorizedVerses]);
  const allJuzInfo = useMemo(() => { const arr=[] as any[]; for (let j=1;j<=30;j++){ const p=calculateJuzProgress(j, memorizedVerses); arr.push({juz:j, ...p}); } return arr; }, [memorizedVerses]); // eslint-disable-line

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayTimeSpent = Math.max(1, Math.round(getTimeSpentToday() / 60));
    const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weekStart = startOfWeek.toISOString().split('T')[0];
    const todayRevised = dailyRevisedVerses.filter(r => r.date === today).length;
    const thisWeekRevised = weeklyRevisedVerses.filter(r => r.date >= weekStart).length;
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
    if (diffDays === 1) return 'Yesterday'; if (diffDays < 7) return `${diffDays} days ago`; return `${Math.floor(diffDays/7)} weeks ago`;
  };

  const recentActivity = useMemo(() => {
    const activities: Activity[] = []; const seen = new Set<string>();
    const add = (a:Activity) => { const k = a.id; if(!seen.has(k)){ seen.add(k); activities.push(a);} };
    quizResults.slice(-5).forEach(q => add({ id:`quiz-${q.id}`, type:'quiz', score: Math.round((q.correct / q.totalQuestions)*100), time: getRelativeTime(q.date) }));
    revisedVerses.slice(-10).forEach(rv => { const verse = findVerseById(rv.verseId); const surah = surahsData.find(s=>s.id===verse.surahId); add({ id:`rev-${rv.verseId}`, type:'revised', surah:{ englishName: surah?.name||'', arabicName: surah?.arabicName||''}, time: getRelativeTime(rv.revisionDate) }); });
    memorizedVerses.slice(-10).forEach(id => { const verse = findVerseById(id); const surah = surahsData.find(s=>s.id===verse.surahId); add({ id:`mem-${id}`, type:'memorized', surah:{ englishName: surah?.name||'', arabicName: surah?.arabicName||''}, time: 'Recently' }); });
    return activities.slice(0,3);
  }, [quizResults, revisedVerses, memorizedVerses]);

  const currentBadge = useMemo(() => calculateCurrentBadge(memorizedVerses, progress.juz.completed), [memorizedVerses, progress.juz.completed]);

  const quickActions = useMemo(() => {
    const actions: any[] = [];
    if (lastReadVerse) {
      const verseDetails = findVerseById(lastReadVerse.id);
      const surah = surahsData.find(s => s.id === verseDetails.surahId);
      actions.push({ title: 'Continue Reading', subtitle: surah ? `${surah.name} (${surah.arabicName})` : 'Resume', icon: Play, color: '#4CAF50', action: () => { if (surah) quranStore.setLastViewedSurahId(surah.id); router.push('/(tabs)/read'); } });
    } else {
      actions.push({ title: 'Start Reading', subtitle: 'Begin your journey', icon: Play, color: '#4CAF50', action: () => router.push('/(tabs)/read') });
    }
    const pending = revisionSchedule.versesPerDay - stats.dailyRevisionCompleted;
    actions.push(pending > 0 ? { title: 'Revision Due', subtitle: `${pending} verses pending`, icon: RotateCcw, color: '#FF9800', action: () => router.push('/(tabs)/revision') } : { title: 'Daily Goal Complete', subtitle: 'Well done!', icon: CheckCircle, color: '#4CAF50', action: () => router.push('/(tabs)/revision') });
    actions.push({ title: 'Badges', subtitle: currentBadge.name, icon: Award, color: '#9C27B0', action: () => router.push('/(tabs)/badges') });
    actions.push({ title: 'Take Quiz', subtitle: 'Test your knowledge', icon: Target, color: '#E91E63', action: () => router.push('/(tabs)/quiz') });
    return actions;
  }, [lastReadVerse, revisionSchedule.versesPerDay, stats.dailyRevisionCompleted, currentBadge.name, quranStore]);

  const CircularProgress = ({ progress, size=100, strokeWidth=8, progressColor='#2196F3', inProgressColor='#FF9800', notStartedColor='#666', completed=0, inProgress=0, total=100 }:{progress:number; size?:number; strokeWidth?:number; progressColor?:string; inProgressColor?:string; notStartedColor?:string; completed?:number; inProgress?:number; total?:number;}) => {
    const radius = (size - strokeWidth) / 2; const circumference = radius * 2 * Math.PI;
    const completedOffset = circumference - (completed/total) * circumference;
    const inProgressOffset = circumference - ((completed+inProgress)/total) * circumference;
    return (
      <View style={{ width:size, height:size }}>
        <Svg width={size} height={size} style={{ transform:[{ rotate: '-90deg'}] }}>
          <Circle stroke={notStartedColor} fill="none" cx={size/2} cy={size/2} r={radius} strokeWidth={strokeWidth} />
          {inProgress>0 && <Circle stroke={inProgressColor} fill="none" cx={size/2} cy={size/2} r={radius} strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={inProgressOffset} strokeLinecap="round" />}
          <Circle stroke={progressColor} fill="none" cx={size/2} cy={size/2} r={radius} strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={completedOffset} strokeLinecap="round" />
        </Svg>
        <View style={styles.progressTextContainer}><Text style={styles.progressPercentage}>{Math.round((completed/total)*100)}%</Text></View>
      </View>
    );
  };

  const ProgressCard = ({ title, data }:{title:string; data:ProgressData}) => {
    const isSmall = width < 420; const cardWidth = isSmall ? 150 : 220; const circleSize = isSmall ? 64 : 80;
    return (
      <View style={[styles.progressCard, { width: cardWidth }]}>
        <Text style={styles.progressCardTitle}>{title}</Text>
        <View style={styles.progressCircleContainer}>
          <CircularProgress progress={(data.completed/data.total)*100} size={circleSize} completed={data.completed} inProgress={data.inProgress} total={data.total} />
        </View>
        <View style={styles.progressLegend}>
          <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:'#2196F3'}]} /><Text style={[styles.legendText, isSmall && { fontSize:11 }]}>{data.completed} Completed</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:'#FF9800'}]} /><Text style={[styles.legendText, isSmall && { fontSize:11 }]}>{data.inProgress} In Progress</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:'#666'}]} /><Text style={[styles.legendText, isSmall && { fontSize:11 }]}>{data.notStarted} Not Started</Text></View>
        </View>
      </View>
    );
  };

  const StatCard = ({ title, value, subtitle, icon:Icon, color='#2196F3' }:{title:string; value:string|number; subtitle?:string; icon:any; color?:string;}) => (
    <View style={styles.statCard}>
      <Icon size={28} color={color} style={{ marginBottom:4 }} />
      <Text style={styles.statTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
    </View>
  );

  const ActionCard = ({ title, subtitle, icon:Icon, color, action }:{title:string; subtitle:string; icon:any; color:string; action:()=>void;}) => (
    <Pressable
      onPress={action}
      style={[styles.actionCard,{ borderColor:color }]}
      android_ripple={{ color: '#00000022' }}
    >
      <View style={styles.actionIconWrap}><Icon size={24} color={color} /></View>
      <View style={styles.actionCardText}> 
        <Text style={styles.actionCardTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
        <Text style={styles.actionCardSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
    </Pressable>
  );

  const MustahabbahCard = ({ item, onPress }:{ item:{ key:string; label:string; status:'memorized'|'in-progress'|'not-started'}; onPress:(it:any)=>void; }) => {
    const status = item.status; const colors = getBackgroundColors(status); const textColor = getTextColor(status);
    const icon = status === 'memorized' ? '✓' : status === 'in-progress' ? '◐' : '✕';
    const small = width < 360; const baseFont = small ? 12 : 13;
    return (
      <TouchableOpacity style={[styles.cardWrapper, small && styles.cardWrapperSmall]} onPress={() => onPress(item)} activeOpacity={0.85}>
        <LinearGradient
          colors={colors as any}
          start={{x:0,y:0}}
          end={{x:1,y:1}}
          style={[styles.card, styles.compactCard, status==='not-started' && styles.notStartedBorder]}
        >
          <Text
            style={[
              styles.cardTitle,
              styles.compactCardTitle,
              small && styles.cardTitleSmall,
              { color: textColor, fontSize: baseFont, lineHeight: baseFont+3 }
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {item.label}
          </Text>
          <View
            style={[
              styles.iconContainer,
              styles.compactIconContainer,
              small && styles.iconContainerSmall,
              {
                backgroundColor: status==='memorized'
                  ? 'rgba(255,255,255,0.18)'
                  : status==='in-progress'
                    ? 'rgba(0,0,0,0.18)'
                    : 'rgba(239,68,68,0.18)',
                borderColor: status==='not-started' ? '#ef4444' : 'transparent',
                borderWidth: status==='not-started' ? 1 : 0
              }
            ]}
          >
            <Text
              style={[
                styles.iconText,
                styles.compactIconText,
                small && styles.iconTextSmall,
                { color: status==='memorized' ? '#fff' : status==='in-progress' ? '#000' : '#ef4444' }
              ]}
            >
              {icon}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const MustahabbahGrid = ({ items, onItemPress }:{ items:any[]; onItemPress:(item:any)=>void; }) => {
    // maintain 3 columns; responsive sizing handled in card
    const rows: any[][] = [];
    for (let i=0;i<items.length;i+=3) rows.push(items.slice(i,i+3));
    return (
      <View style={styles.mustahabbahGrid}>
        {rows.map((row,ri) => (
          <View key={ri} style={styles.mustahabbahRow}>
            {row.map((it, idx) => <MustahabbahCard key={it.key} item={it} onPress={onItemPress} />)}
          </View>
        ))}
      </View>
    );
  };

  function formatTotalTime(totalSeconds:number){ if(!totalSeconds||totalSeconds<0) return '0m'; const d=Math.floor(totalSeconds/86400); const h=Math.floor((totalSeconds%86400)/3600); const m=Math.floor((totalSeconds%3600)/60); return `${d>0?d+'d ':''}${(h>0||d>0)?h+'h ':''}${m}m`.trim(); }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <MinimalTopStrip style={{}} />
        <Text style={styles.greeting}>Assalamu Alaikkum{userName ? `, ${userName}` : ''}</Text>
        <Text style={styles.welcomeText}>Welcome back to your Quran journey</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Progress</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ProgressCard title="Verses" data={stats.verses} />
          <ProgressCard title="Surahs" data={stats.surahs} />
            <ProgressCard title="Juz" data={stats.juz as any} />
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revision Goals</Text>
        <View style={styles.revisionItem}>
          <View style={styles.revisionHeader}>
            <Text style={styles.revisionTitle}>Daily Verses</Text>
            {stats.dailyRevisionCompleted >= stats.dailyRevisionTarget ? <CheckCircle size={16} color="#4CAF50" /> : <XCircle size={16} color="#F44336" />}
          </View>
          <Text style={styles.revisionProgress}>{stats.dailyRevisionCompleted} / {stats.dailyRevisionTarget} verses</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min((stats.dailyRevisionCompleted / stats.dailyRevisionTarget)*100,100)}%`, backgroundColor: stats.dailyRevisionCompleted >= stats.dailyRevisionTarget ? '#4CAF50' : '#2196F3' }]} /></View>
        </View>
        <View style={styles.revisionItem}>
          <View style={styles.revisionHeader}>
            <Text style={styles.revisionTitle}>Weekly Surahs</Text>
            {stats.weeklyRevisionCompleted >= stats.weeklyRevisionTarget ? <CheckCircle size={16} color="#4CAF50" /> : <XCircle size={16} color="#F44336" />}
          </View>
          <Text style={styles.revisionProgress}>{stats.weeklyRevisionCompleted} / {stats.weeklyRevisionTarget} surahs</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min((stats.weeklyRevisionCompleted / stats.weeklyRevisionTarget)*100,100)}%`, backgroundColor: stats.weeklyRevisionCompleted >= stats.weeklyRevisionTarget ? '#4CAF50' : '#2196F3' }]} /></View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          {quickActions.map((a,i) => <ActionCard key={i} {...a} />)}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Usage Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard title="Quran Time" value={formatTotalTime(activeReadingTime)} subtitle="Active time spent" icon={Clock} color="#4CAF50" />
          <StatCard title="Streak" value={stats.currentStreak} subtitle="Day streak" icon={FireStreakIcon} color="#FF9800" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>As-Suwar Al Mustahabbah</Text>
        <LinearGradient colors={['#2a2a2a','#1f1f1f']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.mustahabbahCard}>
          <MustahabbahGrid
            items={mustahabbahItems.map(it => ({ key: it.key, label: it.label, status: getSurahStatus(it) }))}
            onItemPress={(item) => { const surahId = parseInt(item.key,10); useQuranStore.getState().setLastViewedSurahId(surahId); router.push('/(tabs)/read'); }}
          />
          <View style={styles.progressSummary}>
            <View style={styles.progressItem}><View style={styles.memorizedDot} /><Text style={styles.progressText}>{mustahabbahMemorized} Memorized</Text></View>
            <View style={styles.progressItem}><View style={styles.remainingDot} /><Text style={styles.progressText}>{mustahabbahRemaining} Remaining</Text></View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityContainer}>
          {recentActivity.map(act => (
            <View key={act.id} style={styles.activityItem}>
              <View style={styles.activityIcon}><BookOpen size={16} color={primary} /></View>
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
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#1a1a1a' },
  header: { paddingTop:48, paddingBottom:24, paddingHorizontal:20, backgroundColor:'#1a1a1a', borderBottomWidth:1, borderBottomColor:'#333' },
  greeting: { fontSize:18, fontWeight:'600', color:'#fff', marginTop:8 },
  welcomeText: { fontSize:14, color:'#ccc', marginTop:4 },
  section: { paddingHorizontal:20, paddingVertical:16 },
  sectionTitle: { color:'#fff', fontSize:16, fontWeight:'600', marginBottom:12 },
  progressCard: { backgroundColor:'#222', borderRadius:12, padding:12, marginRight:12 },
  progressCardTitle: { color:'#fff', fontSize:14, marginBottom:8 },
  progressCircleContainer: { alignItems:'center', justifyContent:'center', marginBottom:8 },
  progressLegend: { flexDirection:'column', alignItems:'flex-start', marginTop:8 },
  legendItem: { flexDirection:'row', alignItems:'center', marginBottom:4 },
  legendDot: { width:8, height:8, borderRadius:4, marginRight:8 },
  legendText: { color:'#888', fontSize:13 },
  revisionItem: { backgroundColor:'#222', borderRadius:12, padding:12, marginBottom:12 },
  revisionHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  revisionTitle: { textAlign:'center', fontSize:16, fontWeight:'600', color:'#fff' },
  revisionProgress: { fontSize:14, color:'#888' },
  progressBar: { height:6, backgroundColor:'#555', borderRadius:3, overflow:'hidden', marginTop:8 },
  progressFill: { height:'100%', backgroundColor:'#2196F3' },
  actionsContainer: { gap:12, marginVertical:8 },
  actionCard: { flexDirection:'row', alignItems:'center', backgroundColor:'#333', borderRadius:12, padding:16, borderWidth:2 },
  actionIconWrap: { width:40, height:40, borderRadius:8, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(255,255,255,0.06)', marginRight:12 },
  actionCardText: { flex:1 },
  actionCardTitle: { fontSize:16, fontWeight:'600', color:'#fff', marginBottom:2 },
  actionCardSubtitle: { fontSize:14, color:'#888' },
  statsGrid: { flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between' },
  statCard: { width:(width-50)/2, backgroundColor:'#333', borderRadius:12, padding:16, marginBottom:12, alignItems:'center', justifyContent:'center' },
  statTitle: { fontSize:14, fontWeight:'600', color:'#fff', textAlign:'center', marginBottom:2 },
  statValue: { fontSize:28, fontWeight:'bold', marginBottom:2 },
  statSubtitle: { fontSize:13, color:'#aaa', textAlign:'center' },
  mustahabbahCard: { backgroundColor:'#2a2a2a', borderRadius:12, padding:12 },
  mustahabbahGrid: { marginTop:8 },
  mustahabbahRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  cardWrapper: { width:(width-56)/3 },
  cardWrapperSmall: { },
  card: { backgroundColor:'#2b2b2b', borderRadius:10, padding:10, position:'relative' },
  compactCard: { paddingVertical:8, paddingHorizontal:8 },
  cardTitle: { color:'#fff', fontSize:14, fontWeight:'600' },
  compactCardTitle: { fontSize:13, fontWeight:'600' },
  cardTitleSmall: { fontSize:12 },
  iconContainer: { width:20, height:20, borderRadius:10, justifyContent:'center', alignItems:'center', position:'absolute', top:4, right:4 },
  progressTextContainer: { position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center' },
  progressPercentage: { color:'#fff', fontSize:12, fontWeight:'700' },
  notStartedBorder: { borderLeftWidth:3, borderLeftColor:'#666' },
  compactIconContainer: { width:18, height:18, borderRadius:9 },
  iconContainerSmall: { width:16, height:16, borderRadius:8 },
  iconText: { color:'#fff', fontSize:10, fontWeight:'700', lineHeight:12 },
  compactIconText: { fontSize:9, lineHeight:11 },
  iconTextSmall: { fontSize:8, lineHeight:10 },
  progressSummary: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTopWidth:1, borderTopColor:'#3a3a3a', marginTop:8 },
  progressItem: { flexDirection:'row', alignItems:'center' },
  memorizedDot: { width:12, height:12, borderRadius:6, marginRight:8, backgroundColor:'#2D5A27' },
  remainingDot: { width:12, height:12, borderRadius:6, backgroundColor:'#4a4a4a', borderWidth:2, borderColor:'#6a6a6a', marginRight:8 },
  progressText: { fontSize:14, fontWeight:'500', color:'#fff' },
  activityContainer: { gap:12, marginTop:12 },
  activityItem: { flexDirection:'row', alignItems:'center', backgroundColor:'#333', borderRadius:12, padding:16, marginBottom:12 },
  activityIcon: { width:40, height:40, borderRadius:20, backgroundColor:'rgba(33,150,243,0.08)', justifyContent:'center', alignItems:'center', marginRight:12 },
  activityContent: { flex:1 },
  activityText: { color:'#fff', fontSize:14, marginBottom:4 },
  activityTime: { color:'#888', fontSize:12 },
});