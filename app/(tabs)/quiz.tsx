/**
 * quiz.tsx
 * Quran memorization quiz screen.
 *
 * UX Redesign:
 *  - Mode picker (AI / Manual) shown before quiz starts — no mid-quiz switching
 *  - No translations shown during quiz (memory test)
 *  - Arabic text hidden until user recites (revealed per-verse)
 *  - AI Mode: 4-state machine per verse (idle → recording → processing → done)
 *  - AI Mode: auto-corrects verse if accuracy ≥ 80 — user can still override
 *  - Manual Mode: 2-state per verse (hidden → revealed)
 *  - Try Again resets both ASR state AND verseAnswer (un-marks from progress)
 *  - getASRSuggestion threshold raised 75 → 80 (in sync with auto-correct)
 *  - useEffect cleanup clears all recording timers on unmount
 *  - Mode picker outside-tap cancels pending quiz
 */

import MinimalTopStrip from '@/components/MinimalTopStrip';
import QuranQuizCelebration from '@/components/QuranQuizCelebration';
import TajweedText from '@/components/TajweedText';
import { surahsData } from '@/data/surahs';
import { useProgressStore } from '@/store/progressStore';
import { useQuranStore } from '@/store/quranStore';
import { useSettingsStore } from '@/store/settingsStore';
import { logAnalyticsEvent, getMemorizationLevel } from '@/utils/analyticsHelper';
import { shouldShowReviewPrompt } from '@/utils/reviewPrompt';
import { getArabicFontFamily, getArabicTypographySizing, normalizeArabicForRendering } from '@/utils/fontUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Brain, CheckCircle, Eye, Target, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { evaluateRecitation, getASRSuggestion, normalizeArabic, ScorecardResult } from '@/utils/asrEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type QuizMode = 'ai' | 'manual';

interface QuizVerse {
  verseId: number;
  verseNumber: number;
  surahId: number;
  surahName: string;
  surahArabicName: string;
  arabicText: string;
  translation: string;
}

interface Quiz {
  surahName: string;
  surahArabicName: string;
  surahId: number;
  quizCategory: 'random' | 'specific';
  verses: QuizVerse[];
  verseAnswers: Record<number, 'correct' | 'incorrect' | null>;
  startTime: Date;
  mode: QuizMode;
  isFinished?: boolean;
}

interface QuizResult {
  date: string;
  score: number;
  surahId: number;
  surahName: string;
  totalVerses: number;
  correctVerses: number;
}

interface QuizState {
  results: QuizResult[];
  stats: {
    totalQuizzes: number;
    perfectQuizzes: number;
    averageScore: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getVerseId = (surahId: number, verseNumber: number): number => {
  let verseId = 0;
  for (let i = 1; i < surahId; i++) {
    const surah = surahsData.find(s => s.id === i);
    if (surah) verseId += surah.versesCount;
  }
  return verseId + verseNumber;
};

const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// PulsingDot — self-contained animated recording indicator
// ─────────────────────────────────────────────────────────────────────────────

function PulsingDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 550, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef5350', opacity: anim }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuizScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function QuizScreen() {
  const { primary } = useThemeColor();
  const { memorizedVerses } = useProgressStore();
  const { arabicFont, fontSizeArabic } = useSettingsStore();

  // ── Core quiz state ──────────────────────────────────────────────────────
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const currentQuizRef = useRef<any>(null);

  // Update ref whenever currentQuiz changes
  useEffect(() => {
    currentQuizRef.current = currentQuiz;
  }, [currentQuiz]);

  // Track abandonment on unmount
  useEffect(() => {
    return () => {
      if (currentQuizRef.current && !currentQuizRef.current.isFinished) {
        const q = currentQuizRef.current;
        logAnalyticsEvent('quiz_abandoned', {
          quiz_type: q.mode,
          questions_answered: Object.keys(q.verseAnswers || {}).filter(k => q.verseAnswers[k] !== null).length,
          total_questions: q.verses.length,
          surah_id: q.surahId,
        });
      }
    };
  }, []);
  const [loading, setLoading] = useState(false);
  const triggerSadaqahPrompt = useSettingsStore(s => s.triggerSadaqahPrompt);
  const reviewPromptState = useSettingsStore(s => s.reviewPromptState);
  const reviewPromptSessionShown = useSettingsStore(s => s.reviewPromptSessionShown);
  const [quizState, setQuizState] = useState<QuizState>({
    results: [],
    stats: { totalQuizzes: 0, perfectQuizzes: 0, averageScore: 0 },
  });
  const [showCelebration, setShowCelebration] = useState(false);
  const [showSpecificModal, setShowSpecificModal] = useState(false);

  // ── Mode picker ──────────────────────────────────────────────────────────
  const [quizMode, setQuizMode] = useState<QuizMode>('manual');
  const [showModePicker, setShowModePicker] = useState(false);
  const [pendingQuizType, setPendingQuizType] = useState<'random' | number | null>(null);

  // ── ASR / AI state ───────────────────────────────────────────────────────
  const [verseASRState, setVerseASRState] = useState<
    Record<number, { phase: 'idle' | 'recording' | 'processing' | 'done'; accuracy: number | null; transcription: string | null; scorecard?: ScorecardResult }>
  >({});
  const [scorecardExpanded, setScorecardExpanded] = useState<Record<number, boolean>>({});
  // Tracks which verses were auto-marked by AI (accuracy ≥ 80)
  const [aiAutoMarked, setAiAutoMarked] = useState<Record<number, boolean>>({});

  // ── Manual mode per-verse reveal ─────────────────────────────────────────
  const [verseRevealed, setVerseRevealed] = useState<Record<number, boolean>>({});

  // ── Recording elapsed timer ──────────────────────────────────────────────
  const [recordingElapsed, setRecordingElapsed] = useState<Record<number, number>>({});

  // ── Refs ─────────────────────────────────────────────────────────────────
  const recordingRef = useRef<Map<number, { recording: Audio.Recording; expectedText: string }>>(new Map());
  const timerRefs = useRef<Record<number, ReturnType<typeof setInterval>>>({});
  // Holds latest markVerse so stopAndEvaluate can call it without stale closure
  const markVerseRef = useRef<((verseId: string, status: 'correct' | 'incorrect') => void) | null>(null);

  const router = useRouter();
  const quranStore = useQuranStore();
  const arabicTypography = getArabicTypographySizing(fontSizeArabic, arabicFont);

  // Derived arabic text style (avoids repeating inline)
  const arabicStyle = {
    fontFamily: getArabicFontFamily(arabicFont),
    includeFontPadding: false as const,
    ...arabicTypography,
    lineHeight: arabicTypography.lineHeight || Math.round((arabicTypography.fontSize || 20) * 2.0),
  };

  // ── Cleanup all timers on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach(clearInterval);
    };
  }, []);

  // ── Load quiz history on mount ───────────────────────────────────────────
  useEffect(() => {
    const loadQuizResults = async () => {
      try {
        const stored = await AsyncStorage.getItem('quizResults');
        if (stored) {
          const parsedResults = JSON.parse(stored) as QuizResult[];
          const totalQuizzes = parsedResults.length;
          const perfectQuizzes = parsedResults.filter(r => r.score === 100).length;
          const averageScore = totalQuizzes > 0
            ? Math.round(parsedResults.reduce((sum, r) => sum + r.score, 0) / totalQuizzes)
            : 0;
          setQuizState({ results: parsedResults, stats: { totalQuizzes, perfectQuizzes, averageScore } });
        }
      } catch (error) {
        console.error('Error loading quiz results:', error);
      }
    };
    loadQuizResults();
  }, []);

  // ── Fully memorized surahs ───────────────────────────────────────────────
  const fullyMemorizedSurahs = useMemo(() => {
    const memorizedSurahs: { surahId: number; surahName: string; surahArabicName: string; versesCount: number }[] = [];
    for (const surah of surahsData) {
      let allMemorized = true;
      for (let vn = 1; vn <= surah.versesCount; vn++) {
        if (!memorizedVerses.includes(getVerseId(surah.id, vn))) { allMemorized = false; break; }
      }
      if (allMemorized) {
        memorizedSurahs.push({
          surahId: surah.id,
          surahName: surah.name,
          surahArabicName: surah.arabicName,
          versesCount: surah.versesCount,
        });
      }
    }
    return memorizedSurahs;
  }, [memorizedVerses]);

  // ── Failed surahs (Recent Challenges) ───────────────────────────────────
  const { verseStatus } = useProgressStore();
  const failedSurahs = useMemo(() => {
    const failed: { surahId: number; surahName: string; date: Date }[] = [];
    const processedSurahIds = new Set<number>();
    [...quizState.results].reverse().forEach(result => {
      if (processedSurahIds.has(result.surahId)) return;
      processedSurahIds.add(result.surahId);
      if (result.score !== 100) {
        const surah = surahsData.find(s => s.id === result.surahId);
        if (surah) {
          const quizTime = new Date(result.date).getTime();
          let hasRecentPractice = false;
          let startId = 0;
          for (let i = 1; i < surah.id; i++) {
            const s = surahsData.find(sd => sd.id === i);
            if (s) startId += s.versesCount;
          }
          for (let vn = 1; vn <= surah.versesCount; vn++) {
            const status = verseStatus[startId + vn];
            if (status?.last_updated && new Date(status.last_updated).getTime() > quizTime) {
              hasRecentPractice = true; break;
            }
          }
          if (!hasRecentPractice) {
            failed.push({ surahId: result.surahId, surahName: surah.name, date: new Date(result.date) });
          }
        }
      }
    });
    return failed.slice(0, 15);
  }, [quizState.results, verseStatus]);

  // ── Save quiz result ─────────────────────────────────────────────────────
  const saveQuizResult = async (result: QuizResult, isAiMode?: boolean, verseIds?: number[]) => {
    try {
      try {
        const { useProgressStore } = require('@/store/progressStore');
        const store = useProgressStore.getState();
        if (typeof store.addQuizResult === 'function') {
          store.addQuizResult({
            verseIds: verseIds || [],
            score: result.score,
            totalQuestions: result.totalVerses,
            correct: result.correctVerses,
            surahId: result.surahId,
            isAiMode: isAiMode !== undefined ? isAiMode : false,
          });
        }
      } catch (storeErr) {
        console.error('Error recording quiz to progressStore:', storeErr);
      }

      const newResults = [...quizState.results, result];
      const totalQuizzes = newResults.length;
      const perfectQuizzes = newResults.filter(r => r.score === 100).length;
      const averageScore = Math.round(newResults.reduce((sum, r) => sum + r.score, 0) / totalQuizzes);
      setQuizState({ results: newResults, stats: { totalQuizzes, perfectQuizzes, averageScore } });
      await AsyncStorage.setItem('quizResults', JSON.stringify(newResults));
      
      if ([1, 5, 10, 20].includes(totalQuizzes)) {
        if (shouldShowReviewPrompt(reviewPromptState, reviewPromptSessionShown)) {
          let trigger: any = 'first_quiz';
          if (totalQuizzes === 5) trigger = 'fifth_quiz';
          if (totalQuizzes === 10) trigger = 'tenth_quiz';
          if (totalQuizzes === 20) trigger = 'twentieth_quiz';
          
          const { useSettingsStore } = require('@/store/settingsStore');
          useSettingsStore.getState().queueSadaqahPrompt(trigger);
        }
      }
    } catch (error) {
      console.error('Error saving quiz result:', error);
    }
  };

  // ─── ASR helpers ─────────────────────────────────────────────────────────

  const stopAllActiveRecordings = useCallback(async () => {
    // Clear all elapsed timers
    Object.values(timerRefs.current).forEach(clearInterval);
    timerRefs.current = {};
    setRecordingElapsed({});

    for (const [vn, entry] of recordingRef.current) {
      try { await entry.recording.stopAndUnloadAsync(); } catch (e) {
        console.error(`Error stopping recording for verse ${vn}:`, e);
      }
    }
    recordingRef.current.clear();
  }, []);

  const resetQuiz = useCallback(async () => {
    if (currentQuiz && !currentQuiz.isFinished) {
      logAnalyticsEvent('quiz_abandoned', {
        quiz_type: currentQuiz.mode,
        questions_answered: Object.keys(currentQuiz.verseAnswers || {}).filter(k => currentQuiz.verseAnswers[Number(k)] !== null).length,
        total_questions: currentQuiz.verses.length,
        surah_id: currentQuiz.surahId,
        reason: 'manual_reset'
      });
    }
    await stopAllActiveRecordings();
    setVerseASRState({});
    setVerseRevealed({});
    setAiAutoMarked({});
    setScorecardExpanded({});
    setCurrentQuiz(null);
  }, [stopAllActiveRecordings, currentQuiz]);

  /** Un-marks a verse answer back to null (used by Try Again) */
  const unmarkVerse = useCallback((verseNumber: number) => {
    setCurrentQuiz(prev => {
      if (!prev) return prev;
      return { ...prev, verseAnswers: { ...prev.verseAnswers, [verseNumber]: null } };
    });
  }, []);

  const startRecording = useCallback(async (verseNumber: number, expectedText: string) => {
    if (recordingRef.current.has(verseNumber)) return;
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed for AI recitation check.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current.set(verseNumber, { recording, expectedText });

      // Start elapsed timer
      setRecordingElapsed(prev => ({ ...prev, [verseNumber]: 0 }));
      timerRefs.current[verseNumber] = setInterval(() => {
        setRecordingElapsed(prev => ({ ...prev, [verseNumber]: (prev[verseNumber] ?? 0) + 1 }));
      }, 1000);

      setVerseASRState(prev => ({
        ...prev,
        [verseNumber]: { phase: 'recording', accuracy: null, transcription: null },
      }));
    } catch (err) {
      console.error('ASR startRecording error:', err);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  }, []);

  const stopAndEvaluate = useCallback(async (verseNumber: number) => {
    const entry = recordingRef.current.get(verseNumber);
    if (!entry) return;
    const { recording, expectedText } = entry;

    // Clear elapsed timer
    if (timerRefs.current[verseNumber]) {
      clearInterval(timerRefs.current[verseNumber]);
      delete timerRefs.current[verseNumber];
    }
    setRecordingElapsed(prev => { const n = { ...prev }; delete n[verseNumber]; return n; });

    try {
      setVerseASRState(prev => ({
        ...prev,
        [verseNumber]: { phase: 'processing', accuracy: null, transcription: null },
      }));
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current.delete(verseNumber);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) throw new Error('No recording URI returned');

      const result = await evaluateRecitation(uri, expectedText);
      setVerseASRState(prev => ({
        ...prev,
        [verseNumber]: { phase: 'done', accuracy: result.accuracy, transcription: result.transcription, scorecard: result.scorecard },
      }));

      // Auto-correct if accuracy ≥ 80
      if (result.accuracy >= 80) {
        setAiAutoMarked(prev => ({ ...prev, [verseNumber]: true }));
        markVerseRef.current?.(String(verseNumber), 'correct');
      }
    } catch (err) {
      console.error('ASR stopAndEvaluate error:', err);
      setVerseASRState(prev => ({
        ...prev,
        [verseNumber]: { phase: 'idle', accuracy: null, transcription: null },
      }));
      Alert.alert('Evaluation Failed', 'Could not evaluate recitation. Please try again.');
    }
  }, []);

  const cancelRecording = useCallback(async (verseNumber: number) => {
    const entry = recordingRef.current.get(verseNumber);
    if (!entry) return;
    const { recording } = entry;

    // Clear elapsed timer
    if (timerRefs.current[verseNumber]) {
      clearInterval(timerRefs.current[verseNumber]);
      delete timerRefs.current[verseNumber];
    }
    setRecordingElapsed(prev => { const n = { ...prev }; delete n[verseNumber]; return n; });

    try {
      await recording.stopAndUnloadAsync();
      recordingRef.current.delete(verseNumber);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      
      setVerseASRState(prev => ({
        ...prev,
        [verseNumber]: { phase: 'idle', accuracy: null, transcription: null },
      }));
    } catch (err) {
      console.error('ASR cancelRecording error:', err);
      // Even if it fails, reset state to idle
      setVerseASRState(prev => ({
        ...prev,
        [verseNumber]: { phase: 'idle', accuracy: null, transcription: null },
      }));
    }
  }, []);

  // ── Mark verse (unchanged logic) ─────────────────────────────────────────
  const markVerse = (verseId: string, status: 'correct' | 'incorrect') => {
    setCurrentQuiz(prev => {
      if (!prev) return prev;
      try {
        const updatedAnswers = { ...prev.verseAnswers, [verseId]: status };
        const referenceVerse = String(prev.verses[0].verseNumber);
        const answerKeys = Object.keys(updatedAnswers).filter(k => k !== referenceVerse);
        const answers = answerKeys.map(k => updatedAnswers[k as keyof typeof updatedAnswers]);
        const totalToAnswer = answerKeys.length;
        const answeredCount = answers.filter(a => a !== null).length;
        const allCorrect = answers.every(answer => answer === 'correct');

        if (answeredCount === totalToAnswer) {
          const correctAnswers = answers.filter(a => a === 'correct').length;
          const score = Math.round((correctAnswers / totalToAnswer) * 100);
          const result: QuizResult = {
            date: new Date().toISOString(),
            score,
            surahId: prev.surahId,
            surahName: prev.surahName,
            totalVerses: totalToAnswer,
            correctVerses: correctAnswers,
          };
          saveQuizResult(result, prev.mode === 'ai', prev.verses.map(v => v.verseId));

          const timeTakenSeconds = Math.round((new Date().getTime() - prev.startTime.getTime()) / 1000);
          const memLevel = getMemorizationLevel(memorizedVerses.length);
          
          // Mark as finished for abandonment tracking
          setCurrentQuiz(prev => prev ? { ...prev, isFinished: true } : null);

          // ANALYTICS: quiz_completed (P1)
          logAnalyticsEvent('quiz_completed', {
            quiz_type: prev.mode,
            quiz_category: prev.quizCategory,
            surah_number: prev.surahId,
            surah_name: prev.surahName,
            quiz_score: result.score,
            total_questions: totalToAnswer,
            correct_answers: correctAnswers,
            percentage: result.score,
            passed: result.score >= 70,
            quiz_level: memLevel,
            time_taken_seconds: timeTakenSeconds,
          });

          if (allCorrect) {
            setShowCelebration(prev2 => {
              if (prev2) return prev2;
              stopAllActiveRecordings();
              setVerseASRState({});
              return true;
            });
          } else {
            setTimeout(async () => {
              try { await resetQuiz(); } catch (e) { console.error('Error closing quiz:', e); }
            }, 0);
          }
        }
        return { ...prev, verseAnswers: updatedAnswers };
      } catch (error) {
        console.error('Error in markVerse:', error);
        return prev;
      }
    });
  };

  // Keep ref in sync so stopAndEvaluate can call markVerse without stale closure
  markVerseRef.current = markVerse;

  // ── Mode picker handlers ──────────────────────────────────────────────────
  const dismissModePicker = () => {
    setShowModePicker(false);
    setPendingQuizType(null); // cancel pending quiz
  };

  const handleStartRandom = () => {
    setPendingQuizType('random');
    setShowModePicker(true);
  };

  const handleStartSpecific = () => {
    setShowSpecificModal(true);
  };

  const handleSurahPicked = (sid: number) => {
    setShowSpecificModal(false);
    setPendingQuizType(sid);
    setShowModePicker(true);
  };

  const handleModePicked = (mode: QuizMode) => {
    setQuizMode(mode);
    setShowModePicker(false);
    const type = pendingQuizType;
    setPendingQuizType(null);
    if (type === 'random') {
      generateQuiz(mode);
    } else if (typeof type === 'number') {
      generateQuizForSurah(type, mode);
    }
  };

  // ── Generate quiz (random) ────────────────────────────────────────────────
  const generateQuiz = async (selectedMode: QuizMode) => {
    if (fullyMemorizedSurahs.length === 0) {
      Alert.alert('No Quiz Available', 'Fully memorize at least one surah to take a quiz.');
      return;
    }
    setLoading(true);
    await stopAllActiveRecordings();
    setVerseASRState({});
    setVerseRevealed({});
    setAiAutoMarked({});
    try {
      const randomSurah = fullyMemorizedSurahs[Math.floor(Math.random() * fullyMemorizedSurahs.length)];
      const minVerses = 3;
      const baseMaxVerses = randomSurah.versesCount >= 50 ? 50 : 25;
      const maxVerses = Math.min(baseMaxVerses, randomSurah.versesCount);
      const numVersesToQuiz = Math.floor(Math.random() * (maxVerses - minVerses + 1)) + minVerses;
      const maxStartPoint = randomSurah.versesCount - numVersesToQuiz + 1;
      const startVerse = Math.floor(Math.random() * maxStartPoint) + 1;
      const selectedVerseNumbers = Array.from({ length: numVersesToQuiz }, (_, i) => startVerse + i);

      const verses: QuizVerse[] = [];
      for (const verseNumber of selectedVerseNumbers) {
        try {
          const page = Math.ceil(verseNumber / 10);
          const verseData = await quranStore.fetchVersesBySurah(randomSurah.surahId, page, 10);
          const verse = verseData.find((v: any) => v.verseNumber === verseNumber);
          if (verse) {
            verses.push({
              verseId: getVerseId(randomSurah.surahId, verseNumber),
              verseNumber,
              surahId: randomSurah.surahId,
              surahName: randomSurah.surahName,
              surahArabicName: randomSurah.surahArabicName,
              arabicText: normalizeArabicForRendering(verse.arabicText),
              translation: verse.translation,
            });
          }
        } catch (error) {
          console.error(`Error fetching verse ${verseNumber}:`, error);
        }
      }

      if (verses.length === 0) {
        Alert.alert('Error', 'Failed to load verses. Please try again.', [{ text: 'OK' }]);
        return;
      }

      const verseAnswers: Record<number, 'correct' | 'incorrect' | null> = {};
      verses.forEach(v => { verseAnswers[v.verseNumber] = null; });

      setCurrentQuiz({
        surahName: randomSurah.surahName,
        surahArabicName: randomSurah.surahArabicName,
        surahId: randomSurah.surahId,
        quizCategory: 'random',
        verses,
        verseAnswers,
        startTime: new Date(),
        mode: selectedMode,
      });

      // ANALYTICS: quiz_started (Event 12 — P2)
      try {
        logAnalyticsEvent('quiz_started', {
          surah_number: randomSurah.surahId ?? 0,
          surah_name: (randomSurah.surahName ?? 'unknown').toLowerCase().replace(/\s+/g, '_'),
          quiz_type: 'random',
          verse_count: verses.length ?? 0,
        });
      } catch { /* analytics must never crash */ }
    } catch (error) {
      console.error('Error generating quiz:', error);
      Alert.alert('Error', 'Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Generate quiz (specific surah) ────────────────────────────────────────
  const generateQuizForSurah = async (surahId: number, selectedMode: QuizMode) => {
    try {
      const surah = surahsData.find(s => s.id === surahId);
      if (!surah) { Alert.alert('Invalid Surah', 'Please choose a valid surah.'); return; }

      setLoading(true);
      await stopAllActiveRecordings();
      setVerseASRState({});
      setVerseRevealed({});
      setAiAutoMarked({});

      const minVerses = 3;
      const baseMaxVerses = surah.versesCount >= 50 ? 50 : 25;
      const maxVerses = Math.min(baseMaxVerses, surah.versesCount);
      const numVersesToQuiz = Math.max(minVerses, Math.floor(Math.random() * (maxVerses - minVerses + 1)) + minVerses);
      const boundedNum = Math.min(numVersesToQuiz, surah.versesCount);
      const maxStartPoint = Math.max(1, surah.versesCount - boundedNum + 1);
      const startVerse = Math.floor(Math.random() * maxStartPoint) + 1;
      const selectedVerseNumbers = Array.from({ length: boundedNum }, (_, i) => startVerse + i);

      const verses: QuizVerse[] = [];
      for (const verseNumber of selectedVerseNumbers) {
        try {
          const page = Math.ceil(verseNumber / 10);
          const verseData = await quranStore.fetchVersesBySurah(surah.id, page, 10);
          const verse = verseData.find((v: any) => v.verseNumber === verseNumber);
          if (verse) {
            verses.push({
              verseId: getVerseId(surah.id, verseNumber),
              verseNumber,
              surahId: surah.id,
              surahName: surah.name,
              surahArabicName: surah.arabicName,
              arabicText: normalizeArabicForRendering(verse.arabicText),
              translation: verse.translation,
            });
          }
        } catch (e) {
          console.error(`Error fetching verse ${verseNumber}:`, e);
        }
      }

      if (verses.length === 0) {
        Alert.alert('Error', 'Failed to load verses. Please try again.');
        return;
      }

      const verseAnswers: Record<number, 'correct' | 'incorrect' | null> = {};
      verses.forEach(v => { verseAnswers[v.verseNumber] = null; });

      setCurrentQuiz({
        surahName: surah.name,
        surahArabicName: surah.arabicName,
        surahId: surah.id,
        quizCategory: 'specific',
        verses,
        verseAnswers,
        startTime: new Date(),
        mode: selectedMode,
      });

      // ANALYTICS: quiz_started (Event 12 — P2)
      try {
        logAnalyticsEvent('quiz_started', {
          surah_number: surah.id ?? 0,
          surah_name: (surah.name || surah.englishName || `surah_${surah.id}`).toLowerCase().replace(/\s+/g, '_'),
          quiz_type: 'specific',
          verse_count: verses.length ?? 0,
        });
      } catch { /* analytics must never crash */ }
    } catch (error) {
      console.error('Error generating specific quiz:', error);
      Alert.alert('Error', 'Failed to generate specific quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>

      {/* ── Specific Surah Picker ── */}
      <SpecificSurahPicker
        visible={showSpecificModal}
        onClose={() => setShowSpecificModal(false)}
        onPick={handleSurahPicked}
      />

      {/* ── Mode Picker Bottom Sheet ── */}
      <Modal
        visible={showModePicker}
        transparent
        animationType="slide"
        onRequestClose={dismissModePicker}
      >
        <View style={styles.modePickerWrapper}>
          {/* Transparent backdrop — tap cancels pending quiz */}
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissModePicker} />
          {/* Sheet — Pressable swallows touches so backdrop doesn't fire inside it */}
          <Pressable style={styles.modePickerSheet} onPress={() => {}}>
            <View style={styles.modePickerHandle} />
            <Text style={styles.modePickerTitle}>Choose Quiz Mode</Text>
            <Text style={styles.modePickerSubtitle}>
              Select how you'll be evaluated. You cannot switch mid-quiz.
            </Text>
            <View style={styles.modePickerCards}>
              <Pressable style={styles.modeCardAI} onPress={() => handleModePicked('ai')}>
                <Text style={styles.modeCardIcon}>🎙</Text>
                <Text style={styles.modeCardTitle}>AI Mode</Text>
                <Text style={styles.modeCardDesc}>
                  Recite aloud — AI evaluates your accuracy verse by verse
                </Text>
              </Pressable>
              <Pressable style={styles.modeCardManual} onPress={() => handleModePicked('manual')}>
                <Text style={styles.modeCardIcon}>✋</Text>
                <Text style={styles.modeCardTitle}>Manual Mode</Text>
                <Text style={styles.modeCardDesc}>
                  Recite silently — self-mark each verse yourself
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Modal>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Preparing your quiz…</Text>
        </View>

      ) : currentQuiz ? (
        // ─── Active Quiz ────────────────────────────────────────────────────
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Intelligent Quiz</Text>
            <MinimalTopStrip style={{ marginBottom: 0 }} />
            <Text style={styles.subtitle}>Test your memorization with smart recall challenges</Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quiz Header */}
            <View style={styles.quizHeader}>
              <View style={styles.quizInfo}>
                <Text style={styles.quizTitle}>
                  Verses {currentQuiz.verses[0].verseNumber}–{currentQuiz.verses[currentQuiz.verses.length - 1].verseNumber} · {currentQuiz.surahName}
                </Text>
                <Text style={styles.quizInstruction}>
                  {currentQuiz.mode === 'ai' ? '🎙 AI Mode — recite aloud into mic' : '✋ Manual Mode — self-mark each verse'}
                </Text>
              </View>
              <Pressable style={styles.resetButton} onPress={resetQuiz}>
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            {/* Reference Verse — cue card, Arabic always visible */}
            <View style={[styles.verseCard, styles.referenceCard]}>
              <View style={styles.verseHeader}>
                <Text style={[styles.verseNumber, { color: '#2196F3' }]}>
                  Start from Verse {currentQuiz.verses[0].verseNumber}
                </Text>
                <View style={styles.referenceBadge}>
                  <Text style={styles.referenceBadgeText}>REFERENCE</Text>
                </View>
              </View>
              <TajweedText
                text={currentQuiz.verses[0].arabicText}
                style={[styles.arabicText, arabicStyle]}
                surahNumber={currentQuiz.verses[0].surahId}
                verseNumber={currentQuiz.verses[0].verseNumber}
                enableStopRules={false}
              />
            </View>

            {/* Recall Verses */}
            <View style={styles.versesContainer}>
              {currentQuiz.verses.slice(1).map((verse) => {
                const currentAnswer = currentQuiz.verseAnswers[verse.verseNumber];
                const wasAiMarked = aiAutoMarked[verse.verseNumber] ?? false;

                if (currentQuiz.mode === 'ai') {
                  // ── AI Mode Verse Card ──────────────────────────────────
                  const asrEntry = verseASRState[verse.verseNumber];
                  const phase = asrEntry?.phase ?? 'idle';
                  const aiAccuracy = phase === 'done' ? (asrEntry?.accuracy ?? null) : null;
                  const suggestion = aiAccuracy !== null ? getASRSuggestion(aiAccuracy) : null;
                  const elapsed = recordingElapsed[verse.verseNumber] ?? 0;

                  return (
                    <View
                      key={verse.verseNumber}
                      style={[
                        styles.verseCard,
                        currentAnswer === 'correct' && styles.verseCardCorrect,
                        currentAnswer === 'incorrect' && styles.verseCardIncorrect,
                      ]}
                    >
                      {/* Header */}
                      <View style={styles.verseHeader}>
                        <Text style={[styles.verseNumber, { color: primary }]}>
                          Verse {verse.verseNumber}
                        </Text>
                        {phase === 'recording' && (
                          <View style={styles.recordingBadge}>
                            <PulsingDot />
                            <Text style={styles.recordingTimer}>{formatElapsed(elapsed)}</Text>
                          </View>
                        )}
                      </View>

                      {/* Arabic — revealed only after AI is done */}
                      {phase === 'done' && (
                        <TajweedText
                          text={verse.arabicText}
                          style={[styles.arabicText, arabicStyle]}
                          surahNumber={verse.surahId}
                          verseNumber={verse.verseNumber}
                          enableStopRules={false}
                        />
                      )}

                      {/* State 1 — Idle */}
                      {phase === 'idle' && (
                        <Pressable
                          style={styles.recordButton}
                          onPress={() => startRecording(verse.verseNumber, verse.arabicText)}
                        >
                          <Text style={styles.recordButtonText}>🎙  Record Recitation</Text>
                        </Pressable>
                      )}

                      {/* State 2 — Recording */}
                      {phase === 'recording' && (
                        <View style={{ gap: 8 }}>
                          <Pressable
                            style={styles.stopButton}
                            onPress={() => stopAndEvaluate(verse.verseNumber)}
                          >
                            <Text style={styles.stopButtonText}>⏹  Submit</Text>
                          </Pressable>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => cancelRecording(verse.verseNumber)}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* State 3 — Processing */}
                      {phase === 'processing' && (
                        <View style={styles.processingRow}>
                          <ActivityIndicator size="small" color="#2196F3" />
                          <Text style={styles.processingText}>Evaluating…</Text>
                        </View>
                      )}

                      {/* State 4 — Done: AI result badge + mark buttons */}
                      {phase === 'done' && aiAccuracy !== null && (
                        <>
                          <View style={styles.aiResultRow}>
                            <View style={styles.aiResultHeader}>
                              {suggestion === 'correct' && (
                                <Text style={[styles.aiResultText, { color: '#4CAF50' }]}>
                                  ✅  AI Confidence: {aiAccuracy}%
                                </Text>
                              )}
                              {suggestion === 'retry' && (
                                <Text style={[styles.aiResultText, { color: '#42A5F5' }]}>
                                  🔄  Suggest retry ({aiAccuracy}%)
                                </Text>
                              )}
                              {suggestion === 'incorrect' && (
                                <Text style={[styles.aiResultText, { color: '#FFA726' }]}>
                                  ⚠️  Low match ({aiAccuracy}%)
                                </Text>
                              )}
                              {/* Try Again — resets ASR state AND un-marks verse */}
                              <TouchableOpacity
                                onPress={() => {
                                  unmarkVerse(verse.verseNumber);
                                  setVerseASRState(prev => ({
                                    ...prev,
                                    [verse.verseNumber]: { phase: 'idle', accuracy: null, transcription: null },
                                  }));
                                  setAiAutoMarked(prev => {
                                    const n = { ...prev };
                                    delete n[verse.verseNumber];
                                    return n;
                                  });
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Text style={styles.tryAgainText}>Try Again</Text>
                              </TouchableOpacity>
                            </View>

                            {suggestion !== 'correct' && asrEntry?.transcription && !asrEntry.scorecard ? (
                              <Text style={styles.aiTranscriptionText}>
                                AI heard: "{normalizeArabic(asrEntry.transcription)}"
                              </Text>
                            ) : null}
                          </View>

                          {/* Scorecard UI */}
                          {asrEntry?.scorecard && (
                            <View style={styles.scorecardContainer}>
                              <Pressable 
                                style={styles.scorecardToggle}
                                onPress={() => setScorecardExpanded(prev => ({...prev, [verse.verseNumber]: !prev[verse.verseNumber]}))}
                              >
                                <Text style={styles.scorecardToggleText}>
                                  {scorecardExpanded[verse.verseNumber] ? '▾ Hide Scorecard' : '✨ View Scorecard'}
                                </Text>
                              </Pressable>
                              
                              {scorecardExpanded[verse.verseNumber] && (
                                <View style={styles.scorecardDetails}>
                                  <View style={styles.scorecardStatsRow}>
                                    <View style={styles.scorecardStatItem}>
                                      <Text style={styles.scorecardStatLabel}>Accuracy</Text>
                                      <Text style={styles.scorecardStatValue}>{asrEntry.scorecard.overallAccuracy}%</Text>
                                    </View>
                                    <View style={styles.scorecardStatItem}>
                                      <Text style={styles.scorecardStatLabel}>Words</Text>
                                      <Text style={styles.scorecardStatValue}>{asrEntry.scorecard.wordsCorrect}/{asrEntry.scorecard.wordsTotal}</Text>
                                    </View>
                                    <View style={styles.scorecardStatItem}>
                                      <Text style={styles.scorecardStatLabel}>Pace</Text>
                                      <Text style={[styles.scorecardStatValue, {fontSize: 12}]}>{asrEntry.scorecard.fluency}</Text>
                                    </View>
                                  </View>
                                  
                                  <Text style={styles.scorecardWordTitle}>Word Breakdown:</Text>
                                  <View style={styles.scorecardWordFlow}>
                                    {asrEntry.scorecard.wordBreakdown.map((wb, idx) => {
                                      let bgColor = '#333';
                                      let textColor = '#EEE';
                                      let borderColor = '#555';
                                      
                                      if (wb.status === 'correct') { 
                                        bgColor = 'rgba(76, 175, 80, 0.15)'; textColor = '#81C784'; borderColor = 'rgba(76, 175, 80, 0.3)';
                                      } else if (wb.status === 'hesitant') { 
                                        bgColor = 'rgba(255, 152, 0, 0.15)'; textColor = '#FFB74D'; borderColor = 'rgba(255, 152, 0, 0.3)';
                                      } else if (wb.status === 'missed' || wb.status === 'wrong') { 
                                        bgColor = 'rgba(244, 67, 54, 0.15)'; textColor = '#E57373'; borderColor = 'rgba(244, 67, 54, 0.3)';
                                      }
                                      
                                      return (
                                        <View key={idx} style={[styles.scorecardWordChip, { backgroundColor: bgColor, borderColor }]}>
                                          <Text style={[styles.scorecardWordText, { color: textColor }]}>
                                            {wb.word}
                                          </Text>
                                          {wb.status !== 'missed' && (
                                            <Text style={[styles.scorecardWordConf, { color: textColor }]}>
                                              {Math.round(wb.confidence * 100)}%
                                            </Text>
                                          )}
                                        </View>
                                      );
                                    })}
                                  </View>
                                </View>
                              )}
                            </View>
                          )}

                          {/* Mark buttons — always visible in done state */}
                          <View style={styles.answerButtons}>
                            {/* Correct */}
                            <Pressable
                              style={[
                                styles.answerButton,
                                currentAnswer === 'correct' && styles.correctButton,
                                currentAnswer === 'incorrect' && styles.answerButtonDimmed,
                              ]}
                              onPress={() => markVerse(String(verse.verseNumber), 'correct')}
                            >
                              <CheckCircle size={18} color="#ffffff" />
                              <View style={{ alignItems: 'center', marginLeft: 8 }}>
                                <Text style={styles.answerButtonText}>Correct</Text>
                                {wasAiMarked && currentAnswer === 'correct' && (
                                  <Text style={styles.aiAutoLabel}>AI ✓</Text>
                                )}
                              </View>
                            </Pressable>

                            {/* Incorrect — always tappable to override AI */}
                            <Pressable
                              style={[
                                styles.answerButton,
                                currentAnswer === 'incorrect' && styles.incorrectButton,
                                currentAnswer === 'correct' && styles.answerButtonDimmed,
                              ]}
                              onPress={() => {
                                // Clear AI auto-mark on manual override
                                setAiAutoMarked(prev => {
                                  const n = { ...prev };
                                  delete n[verse.verseNumber];
                                  return n;
                                });
                                markVerse(String(verse.verseNumber), 'incorrect');
                              }}
                            >
                              <X size={18} color="#ffffff" />
                              <Text style={[styles.answerButtonText, { marginLeft: 8 }]}>Incorrect</Text>
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  );

                } else {
                  // ── Manual Mode Verse Card ─────────────────────────────
                  const isRevealed = verseRevealed[verse.verseNumber] ?? false;

                  return (
                    <View
                      key={verse.verseNumber}
                      style={[
                        styles.verseCard,
                        currentAnswer === 'correct' && styles.verseCardCorrect,
                        currentAnswer === 'incorrect' && styles.verseCardIncorrect,
                      ]}
                    >
                      <View style={styles.verseHeader}>
                        <Text style={[styles.verseNumber, { color: primary }]}>
                          Verse {verse.verseNumber}
                        </Text>
                        {isRevealed && (
                          <TouchableOpacity
                            onPress={() => setVerseRevealed(prev => ({ ...prev, [verse.verseNumber]: false }))}
                            hitSlop={8}
                          >
                            <Text style={styles.hideText}>Hide</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Arabic — shown only after reveal */}
                      {isRevealed && (
                        <TajweedText
                          text={verse.arabicText}
                          style={[styles.arabicText, arabicStyle]}
                          surahNumber={verse.surahId}
                          verseNumber={verse.verseNumber}
                          enableStopRules={false}
                        />
                      )}

                      {/* Reveal touch target — small and deliberate */}
                      {!isRevealed && (
                        <Pressable
                          style={styles.revealButton}
                          onPress={() => setVerseRevealed(prev => ({ ...prev, [verse.verseNumber]: true }))}
                        >
                          <Eye size={15} color="#777" />
                          <Text style={styles.revealButtonText}>Tap to reveal after reciting</Text>
                        </Pressable>
                      )}

                      {/* Mark buttons — non-interactive until revealed */}
                      <View style={styles.answerButtons}>
                        <Pressable
                          style={[
                            styles.answerButton,
                            !isRevealed && styles.answerButtonDisabled,
                            currentAnswer === 'correct' && styles.correctButton,
                            currentAnswer === 'incorrect' && isRevealed && styles.answerButtonDimmed,
                          ]}
                          onPress={() => { if (isRevealed) markVerse(String(verse.verseNumber), 'correct'); }}
                        >
                          <CheckCircle size={18} color="#ffffff" />
                          <Text style={[styles.answerButtonText, { marginLeft: 8 }]}>Correct</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.answerButton,
                            !isRevealed && styles.answerButtonDisabled,
                            currentAnswer === 'incorrect' && styles.incorrectButton,
                            currentAnswer === 'correct' && isRevealed && styles.answerButtonDimmed,
                          ]}
                          onPress={() => { if (isRevealed) markVerse(String(verse.verseNumber), 'incorrect'); }}
                        >
                          <X size={18} color="#ffffff" />
                          <Text style={[styles.answerButtonText, { marginLeft: 8 }]}>Incorrect</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }
              })}
            </View>

            {/* Progress Bar */}
            {(() => {
              const referenceVerseNumber = currentQuiz.verses[0].verseNumber;
              const answeredCount = Object.entries(currentQuiz.verseAnswers)
                .filter(([k, v]) => Number(k) !== referenceVerseNumber && v !== null)
                .length;
              const totalToAnswer = currentQuiz.verses.length - 1;

              return (
                <View style={styles.quizProgress}>
                  <Text style={styles.progressTitle}>Progress</Text>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${(answeredCount / totalToAnswer) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {answeredCount} / {totalToAnswer} answered
                  </Text>
                </View>
              );
            })()}
          </ScrollView>
        </View>

      ) : (
        // ─── Home Screen ────────────────────────────────────────────────────
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Intelligent Quiz</Text>
            <MinimalTopStrip style={{ marginBottom: 0 }} />
            <Text style={styles.subtitle}>Test your memorization with smart recall challenges</Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Statistics */}
            <View style={styles.statsContainer}>
              <Text style={styles.sectionTitle}>Quiz Statistics</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{quizState.stats.totalQuizzes}</Text>
                  </View>
                  <Text style={styles.statLabel}>Total Quizzes</Text>
                </View>
                <View style={styles.statItem}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{quizState.stats.perfectQuizzes}</Text>
                  </View>
                  <Text style={styles.statLabel}>Perfect Scores</Text>
                </View>
                <View style={styles.statItem}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{quizState.stats.averageScore}%</Text>
                  </View>
                  <Text style={styles.statLabel}>Average Score</Text>
                </View>
              </View>
            </View>

            {/* Recent Challenges */}
            {failedSurahs.length > 0 ? (
              <View style={styles.streakContainer}>
                <Text style={styles.sectionTitle}>Recent Challenges</Text>
                <Text style={styles.sectionSubtitle}>
                  Last {failedSurahs.length} surahs that need more practice
                </Text>
                <View style={styles.streakList}>
                  {failedSurahs.map((failedSurah, index) => (
                    <View key={failedSurah.surahId} style={styles.streakItem}>
                      <View style={styles.streakNumber}>
                        <Text style={styles.streakNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.streakInfo}>
                        <Text style={styles.streakSurahName}>{failedSurah.surahName}</Text>
                        <Text style={styles.streakDate}>
                          {failedSurah.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.practiceButton}
                        onPress={() => {
                          try { router.replace(`/(tabs)/read?surahId=${failedSurah.surahId}`); }
                          catch { router.push(`/(tabs)/read?surahId=${failedSurah.surahId}`); }
                        }}
                      >
                        <Text style={styles.practiceButtonText}>Practice</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.streakContainer}>
                <Text style={styles.sectionTitle}>Recent Challenges</Text>
                <Text style={styles.sectionSubtitle}>No recent surahs that need more practice</Text>
              </View>
            )}

            {/* Start Buttons */}
            <View style={styles.availableQuizzesContainer}>
              <Text style={styles.sectionTitle}>Available Quizzes</Text>
              <Text style={styles.sectionSubtitle}>
                {fullyMemorizedSurahs.length} fully memorized {fullyMemorizedSurahs.length === 1 ? 'surah' : 'surahs'} available
              </Text>

              {fullyMemorizedSurahs.length > 0 ? (
                <Pressable
                  style={[styles.startQuizButton, { backgroundColor: primary }]}
                  onPress={handleStartRandom}
                >
                  <Target size={24} color="#ffffff" />
                  <Text style={styles.startQuizText}>Start Random Quiz</Text>
                </Pressable>
              ) : (
                <View style={styles.noQuizzesCard}>
                  <Text style={styles.noQuizzesText}>
                    Fully memorize at least one surah to unlock random quizzes.
                  </Text>
                </View>
              )}

              <Pressable
                style={[styles.startQuizButton, { backgroundColor: '#6A5ACD', marginTop: 12 }]}
                onPress={handleStartSpecific}
              >
                <Target size={24} color="#ffffff" />
                <Text style={styles.startQuizText}>Start Specific Quiz</Text>
              </Pressable>
            </View>

            {/* How It Works — placed last as contextual reference */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Brain size={20} color={primary} />
                <Text style={styles.infoTitle}>How It Works</Text>
              </View>
              <Text style={styles.infoText}>• The quiz selects random continuous verses from memorized surahs</Text>
              <Text style={styles.infoText}>• Recite from memory before the Arabic text is revealed</Text>
              <Text style={styles.infoText}>• Choose AI Mode for mic evaluation or Manual Mode to self-mark</Text>
              <Text style={styles.infoText}>• Only fully memorized surahs (all green blocks) are included</Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Celebration Confetti */}
      {showCelebration && (
        <QuranQuizCelebration
          visible={showCelebration}
          onComplete={() => {
            try {
              if (__DEV__) {
                console.log('Celebration completion callback triggered');
              }
              setShowCelebration(false);
              resetQuiz();
              if (__DEV__) {
                console.log('Quiz state reset completed');
              }
            } catch (error) {
              console.error('Error in celebration completion:', error);
              setShowCelebration(false);
              resetQuiz();
            }
          }}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout ────────────────────────────────────────────────────────────────
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#ffffff' },
  header: { padding: 20, paddingTop: 12 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888888' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 0 },

  // ── Mode Picker ───────────────────────────────────────────────────────────
  modePickerWrapper: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modePickerSheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 24,
    paddingBottom: 44,
  },
  modePickerHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 22,
  },
  modePickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  modePickerSubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 19,
  },
  modePickerCards: { flexDirection: 'row', gap: 12 },
  modeCardAI: {
    flex: 1,
    backgroundColor: '#1565C0',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  modeCardManual: {
    flex: 1,
    backgroundColor: '#2e7d32',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  modeCardIcon: { fontSize: 32, marginBottom: 10 },
  modeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modeCardDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Home: Stats ───────────────────────────────────────────────────────────
  statsContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff', marginBottom: 8 },
  sectionSubtitle: { fontSize: 14, color: '#888888', marginBottom: 16 },
  // Each statItem takes exactly 1/3 of the row width, no gap needed
  statsGrid: { flexDirection: 'row', alignItems: 'stretch' },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  statLabel: { fontSize: 11, color: '#888888', textAlign: 'center', lineHeight: 15 },

  // ── Home: Recent Challenges ───────────────────────────────────────────────
  streakContainer: { marginBottom: 24 },
  streakList: { gap: 8 },
  streakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
  },
  streakNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  streakNumberText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  streakInfo: { flex: 1 },
  streakSurahName: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 2 },
  streakDate: { fontSize: 12, color: '#888888' },
  practiceButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  practiceButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },

  // ── Home: Info Card ───────────────────────────────────────────────────────
  infoCard: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 16, marginBottom: 24 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginLeft: 8 },
  infoText: { fontSize: 14, color: '#888888', marginBottom: 8 },

  // ── Home: Start Buttons ───────────────────────────────────────────────────
  availableQuizzesContainer: { marginBottom: 24 },
  startQuizButton: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startQuizText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  noQuizzesCard: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 16, alignItems: 'center' },
  noQuizzesText: { color: '#888888', fontSize: 14, textAlign: 'center' },

  // ── Quiz Session: Header ──────────────────────────────────────────────────
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 12,
  },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 17, color: '#ffffff', marginBottom: 4, fontWeight: '600' },
  quizInstruction: { fontSize: 13, color: '#bbbbbb' },
  resetButton: { backgroundColor: '#2a2a2a', padding: 8, borderRadius: 8, marginLeft: 12 },

  // ── Quiz Session: Verse Cards ─────────────────────────────────────────────
  versesContainer: { marginBottom: 16 },
  verseCard: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 16, marginBottom: 12 },
  verseCardCorrect: { borderLeftWidth: 3, borderLeftColor: '#4CAF50' },
  verseCardIncorrect: { borderLeftWidth: 3, borderLeftColor: '#f44336' },
  referenceCard: {
    backgroundColor: '#232323',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    marginBottom: 16,
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  verseNumber: { fontSize: 16, fontWeight: '600' },
  referenceBadge: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  referenceBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // ── Arabic Text ───────────────────────────────────────────────────────────
  arabicText: {
    color: '#ffffff',
    textAlign: 'right',
    marginVertical: 8,
    paddingHorizontal: 4,
    letterSpacing: -0.2,
  },

  // ── Recording Indicator ───────────────────────────────────────────────────
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,83,80,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  recordingTimer: { color: '#ef5350', fontSize: 13, fontWeight: '600' },

  // ── AI Mode: Action Buttons ───────────────────────────────────────────────
  recordButton: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  recordButtonText: { color: '#cccccc', fontSize: 15, fontWeight: '500' },
  stopButton: {
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#b71c1c',
    marginTop: 4,
  },
  stopButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#888', fontSize: 14, fontWeight: '500' },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, marginTop: 4 },
  processingText: { color: '#2196F3', fontSize: 14 },

  // ── AI Mode: Result Row ───────────────────────────────────────────────────
  aiResultRow: { paddingVertical: 8, marginTop: 4 },
  aiResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiResultText: { fontSize: 14, fontWeight: '600', flex: 1 },
  tryAgainText: { color: '#2196F3', fontSize: 12, fontWeight: '600' },
  aiTranscriptionText: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
    marginTop: 6,
  },
  aiAutoLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },

  // ── Manual Mode ───────────────────────────────────────────────────────────
  revealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  revealButtonText: { color: '#777777', fontSize: 13 },
  hideText: { color: '#777', fontSize: 12 },

  // ── Answer Buttons ────────────────────────────────────────────────────────
  answerButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, gap: 8 },
  answerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
  },
  answerButtonText: { fontSize: 15, color: '#ffffff', fontWeight: '500' },
  answerButtonDimmed: { opacity: 0.4 },
  answerButtonDisabled: { opacity: 0.3 },
  correctButton: { backgroundColor: '#388E3C' },
  incorrectButton: { backgroundColor: '#c62828' },

  // ── Progress Bar ──────────────────────────────────────────────────────────
  quizProgress: { marginTop: 24, marginBottom: 32 },
  progressTitle: { fontSize: 18, color: '#ffffff', marginBottom: 12, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2196F3', borderRadius: 4 },
  progressText: { fontSize: 14, color: '#bbbbbb', marginTop: 8, textAlign: 'center' },
  
  // ── Scorecard UI ──────────────────────────────────────────────────────────
  scorecardContainer: {
    marginTop: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  scorecardToggle: {
    padding: 10,
    backgroundColor: '#333333',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  scorecardToggleText: {
    fontSize: 13,
    color: '#bbb',
    fontWeight: '600',
  },
  scorecardDetails: {
    padding: 12,
  },
  scorecardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingBottom: 12,
  },
  scorecardStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  scorecardStatLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  scorecardStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E0E0E0',
  },
  scorecardWordTitle: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 8,
    fontWeight: '600',
  },
  scorecardWordFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end', // RTL flow
    gap: 6,
  },
  scorecardWordChip: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
  },
  scorecardWordText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scorecardWordConf: {
    fontSize: 9,
    marginTop: 3,
    opacity: 0.8,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SpecificSurahPicker Modal (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function SpecificSurahPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (surahId: number) => void;
}) {
  const { primary } = useThemeColor();
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahsData;
    return surahsData.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.englishName.toLowerCase().includes(q)
    );
  }, [query]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#333' }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Choose a Surah</Text>
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <X size={20} color="#fff" />
            </Pressable>
          </View>
          {/* Search Input */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={{ color: '#bbb', fontSize: 12, marginBottom: 6 }}>Surah Name</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Type to filter…"
                placeholderTextColor="#777"
                style={{ flex: 1, color: '#fff', fontSize: 14 }}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8} style={{ marginLeft: 8 }}>
                  <X size={16} color="#aaa" />
                </Pressable>
              )}
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 8 }}>
            {filtered.length === 0 && (
              <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>No matching surahs</Text>
            )}
            {filtered.map(s => (
              <TouchableOpacity
                key={s.id}
                onPress={() => onPick(s.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: '#2a2a2a',
                  marginBottom: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: primary, fontWeight: '700', width: 28 }}>{s.id}</Text>
                  <View style={{ marginLeft: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{s.name}</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>{s.englishName}</Text>
                  </View>
                </View>
                <Text style={{ color: '#888', fontSize: 12 }}>{s.versesCount} verses</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}