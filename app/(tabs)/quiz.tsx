import MinimalTopStrip from '@/components/MinimalTopStrip';
import QuranQuizCelebration from '@/components/QuranQuizCelebration';
import { surahsData } from '@/data/surahs';
import { useProgressStore } from '@/store/progressStore';
import { useQuranStore } from '@/store/quranStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getArabicFontFamily, getArabicTypographySizing } from '@/utils/fontUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Brain, CheckCircle, Eye, Target, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
  verses: QuizVerse[];
  verseAnswers: Record<number, 'correct' | 'incorrect' | null>;
  showingAnswer: boolean;
  startTime: Date;
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

// Helper function to get verse ID from surah and verse number
const getVerseId = (surahId: number, verseNumber: number): number => {
  let verseId = 0;
  for (let i = 1; i < surahId; i++) {
    const surah = surahsData.find(s => s.id === i);
    if (surah) {
      verseId += surah.versesCount;
    }
  }
  return verseId + verseNumber;
};

// Helper function to get surah and verse number from verse ID
const getSurahAndVerseFromId = (verseId: number): { surahId: number; verseNumber: number } => {
  let currentVerseId = 0;
  for (const surah of surahsData) {
    if (verseId <= currentVerseId + surah.versesCount) {
      return {
        surahId: surah.id,
        verseNumber: verseId - currentVerseId
      };
    }
    currentVerseId += surah.versesCount;
  }
  return { surahId: 1, verseNumber: 1 };
};

export default function QuizScreen() {
  const { primary } = useThemeColor();
  const { memorizedVerses } = useProgressStore();
  const { arabicFont, fontSizeArabic } = useSettingsStore();
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quizState, setQuizState] = useState<QuizState>({
    results: [],
    stats: {
      totalQuizzes: 0,
      perfectQuizzes: 0,
      averageScore: 0
    }
  });
  const [showCelebration, setShowCelebration] = useState(false);
  const [showSpecificModal, setShowSpecificModal] = useState(false);

  const router = useRouter();
  const quranStore = useQuranStore();

  // Get proper Arabic typography settings
  const arabicTypography = getArabicTypographySizing(fontSizeArabic, arabicFont);

  // Load quiz results on mount
  useEffect(() => {
    const loadQuizResults = async () => {
      try {
        const results = await AsyncStorage.getItem('quizResults');
        if (results) {
          const parsedResults = JSON.parse(results) as QuizResult[];
          
          // Calculate stats
          const totalQuizzes = parsedResults.length;
          const perfectQuizzes = parsedResults.filter(r => r.score === 100).length;
          const averageScore = totalQuizzes > 0 ? Math.round(
            parsedResults.reduce((sum, r) => sum + r.score, 0) / totalQuizzes
          ) : 0;
          
          setQuizState(prevState => ({
            ...prevState,
            results: parsedResults,
            stats: {
              totalQuizzes,
              perfectQuizzes,
              averageScore
            }
          }));
        }
      } catch (error) {
        console.error('Error loading quiz results:', error);
      }
    };

    loadQuizResults();
  }, []); // Empty dependency array since we only want to load on mount

  // Calculate fully memorized surahs
  const fullyMemorizedSurahs = useMemo(() => {
    const memorizedSurahs: { surahId: number; surahName: string; surahArabicName: string; versesCount: number }[] = [];
    
    for (const surah of surahsData) {
      // Check if all verses in this surah are memorized
      let allMemorized = true;
      for (let verseNumber = 1; verseNumber <= surah.versesCount; verseNumber++) {
        const verseId = getVerseId(surah.id, verseNumber);
        if (!memorizedVerses.includes(verseId)) {
          allMemorized = false;
          break;
        }
      }
      
      if (allMemorized) {
        memorizedSurahs.push({
          surahId: surah.id,
          surahName: surah.name,
          surahArabicName: surah.arabicName,
          versesCount: surah.versesCount
        });
      }
    }
    
    return memorizedSurahs;
  }, [memorizedVerses]);

  // Memoize failed surahs calculation
  const failedSurahs = useMemo(() => {
    const failed: { surahId: number; surahName: string; date: Date }[] = [];
    const seenSurahs = new Set<number>();

    // Go through quiz results in reverse order (newest first)
    [...quizState.results].reverse().forEach(result => {
      // Only include results where at least one verse was marked incorrect
      const hasIncorrectVerses = result.correctVerses < result.totalVerses;
      if (hasIncorrectVerses && !seenSurahs.has(result.surahId)) {
        const surah = surahsData.find(s => s.id === result.surahId);
        if (surah) {
          failed.push({
            surahId: result.surahId,
            surahName: surah.name,
            date: new Date(result.date)
          });
          seenSurahs.add(result.surahId);
        }
      }
    });

    return failed.slice(0, 5); // Return only last 5 failed surahs
  }, [quizState.results]);

  // Save quiz result
  const saveQuizResult = async (result: QuizResult) => {
    try {
      const newResults = [...quizState.results, result];
      
      // Calculate stats
      const totalQuizzes = newResults.length;
      const perfectQuizzes = newResults.filter(r => r.score === 100).length;
      const averageScore = Math.round(
        newResults.reduce((sum, r) => sum + r.score, 0) / totalQuizzes
      );
      
      setQuizState({
        results: newResults,
        stats: {
          totalQuizzes,
          perfectQuizzes,
          averageScore
        }
      });
      
      await AsyncStorage.setItem('quizResults', JSON.stringify(newResults));
    } catch (error) {
      console.error('Error saving quiz result:', error);
    }
  };

  // Generate quiz
  const generateQuiz = async () => {
    if (fullyMemorizedSurahs.length === 0) {
      Alert.alert(
        'No Quiz Available', 
        'You need to fully memorize at least one surah to take a quiz.'
      );
      return;
    }

    setLoading(true);
    try {
      // Select a random fully memorized surah
      const randomSurah = fullyMemorizedSurahs[Math.floor(Math.random() * fullyMemorizedSurahs.length)];
      
      // Determine how many verses to quiz (3-25 for short surahs, 3-50 for long surahs 50+ verses)
      const minVerses = 3;
      const baseMaxVerses = randomSurah.versesCount >= 50 ? 50 : 25;
      const maxVerses = Math.min(baseMaxVerses, randomSurah.versesCount);
      const numVersesToQuiz = Math.floor(Math.random() * (maxVerses - minVerses + 1)) + minVerses;
      
      // Select a random starting point for continuous verses
      const maxStartPoint = randomSurah.versesCount - numVersesToQuiz + 1;
      const startVerse = Math.floor(Math.random() * maxStartPoint) + 1;
      
      // Get continuous verses starting from the random point
      const selectedVerseNumbers = Array.from(
        { length: numVersesToQuiz }, 
        (_, i) => startVerse + i
      );

      // Fetch verse data
      const verses: QuizVerse[] = [];
      
      for (const verseNumber of selectedVerseNumbers) {
        try {
          // Calculate which page this verse is on (assuming 10 verses per page)
          const page = Math.ceil(verseNumber / 10);
          const verseData = await quranStore.fetchVersesBySurah(randomSurah.surahId, page, 10);
          const verse = verseData.find(v => v.verseNumber === verseNumber);
          
          if (verse) {
            verses.push({
              verseId: getVerseId(randomSurah.surahId, verseNumber),
              verseNumber,
              surahId: randomSurah.surahId,
              surahName: randomSurah.surahName,
              surahArabicName: randomSurah.surahArabicName,
              arabicText: verse.arabicText,
              translation: verse.translation
            });
          }
        } catch (error) {
          console.error(`Error fetching verse ${verseNumber} for surah ${randomSurah.surahId}:`, error);
        }
      }

      if (verses.length === 0) {
        Alert.alert(
          'Error',
          'Failed to load verses. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Initialize quiz state with verse numbers as keys
      const verseAnswers: Record<number, 'correct' | 'incorrect' | null> = {};
      verses.forEach(verse => {
        verseAnswers[verse.verseNumber] = null;
      });

      setCurrentQuiz({
        surahName: randomSurah.surahName,
        surahArabicName: randomSurah.surahArabicName,
        surahId: randomSurah.surahId,
        verses,
        verseAnswers,
        showingAnswer: false,
        startTime: new Date()
      });
      setQuizCompleted(false);
    } catch (error) {
      console.error('Error generating quiz:', error);
      Alert.alert('Error', 'Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate quiz for a specific surah
  const generateQuizForSurah = async (surahId: number) => {
    try {
      const surah = surahsData.find(s => s.id === surahId);
      if (!surah) {
        Alert.alert('Invalid Surah', 'Please choose a valid surah.');
        return;
      }

      setLoading(true);
      setShowSpecificModal(false);

      // Decide how many verses to quiz
      const minVerses = 3;
      const baseMaxVerses = surah.versesCount >= 50 ? 50 : 25;
      const maxVerses = Math.min(baseMaxVerses, surah.versesCount);
      const numVersesToQuiz = Math.max(minVerses, Math.floor(Math.random() * (maxVerses - minVerses + 1)) + minVerses);
      const boundedNum = Math.min(numVersesToQuiz, surah.versesCount); // safety bound

      // Random start so that the segment is continuous
      const maxStartPoint = Math.max(1, surah.versesCount - boundedNum + 1);
      const startVerse = Math.floor(Math.random() * maxStartPoint) + 1;
      const selectedVerseNumbers = Array.from({ length: boundedNum }, (_, i) => startVerse + i);

      // Fetch verse data similar to random quiz
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
              arabicText: verse.arabicText,
              translation: verse.translation
            });
          }
        } catch (e) {
          console.error(`Error fetching verse ${verseNumber} for surah ${surah.id}:`, e);
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
        verses,
        verseAnswers,
        showingAnswer: false,
        startTime: new Date()
      });
      setQuizCompleted(false);
    } catch (error) {
      console.error('Error generating specific quiz:', error);
      Alert.alert('Error', 'Failed to generate specific quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const markVerse = (verseId: string, status: 'correct' | 'incorrect') => {
    setCurrentQuiz(prev => {
      if (!prev) return prev;

      try {
        const updatedAnswers = {
          ...prev.verseAnswers,
          [verseId]: status,
        };

        // Exclude the actual reference verse from checks
        const referenceVerse = String(prev.verses[0].verseNumber);
        const answerKeys = Object.keys(updatedAnswers).filter(k => k !== referenceVerse);
        const answers = answerKeys.map(k => updatedAnswers[k as keyof typeof updatedAnswers]);
        const totalToAnswer = answerKeys.length;
        const answeredCount = answers.filter(a => a !== null).length;
        const allCorrect = answers.every(answer => answer === 'correct');

        // If all answered, save result
        if (answeredCount === totalToAnswer) {
          const correctAnswers = answers.filter(a => a === 'correct').length;
          const score = Math.round((correctAnswers / totalToAnswer) * 100);
          const result: QuizResult = {
            date: new Date().toISOString(),
            score,
            surahId: prev.surahId,
            surahName: prev.surahName,
            totalVerses: totalToAnswer,
            correctVerses: correctAnswers
          };
          saveQuizResult(result);
          if (allCorrect) {
            // Ensure we're not already showing celebration to prevent duplicate triggers
            setShowCelebration(prev => {
              if (prev) {
                console.log('Celebration already showing, skipping duplicate trigger');
                return prev; // Already showing, don't change
              }
              console.log('Triggering celebration for perfect quiz score');
              return true;
            });
          } else {
            // Close quiz quietly when there are incorrect answers so Recent Challenges updates
            setTimeout(() => {
              try {
                setCurrentQuiz(null);
              } catch (e) {
                console.error('Error closing quiz after save:', e);
              }
            }, 0);
          }
        }

        return {
          ...prev,
          verseAnswers: updatedAnswers,
        };
      } catch (error) {
        console.error('Error in markVerse:', error);
        // Return unchanged state on error
        return prev;
      }
    });
  };

  // Remove duplicate celebration trigger - it's already handled in markVerse function

  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
      <SpecificSurahPicker
        visible={showSpecificModal}
        onClose={() => setShowSpecificModal(false)}
        onPick={(sid) => generateQuizForSurah(sid)}
      />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Preparing your quiz...</Text>
        </View>
      ) : currentQuiz ? (
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
                  Recall verses {currentQuiz.verses[0].verseNumber}-{currentQuiz.verses[currentQuiz.verses.length - 1].verseNumber} from Surah {currentQuiz.surahName}
                </Text>
                <Text style={styles.quizInstruction}>
                  Recite from memory, then tap "Show Answer" to verify
                </Text>
              </View>
              <Pressable style={styles.resetButton} onPress={() => setCurrentQuiz(null)}>
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            {/* Reference Verse: Always show above Show Answer button */}
            <View style={[styles.verseCard, { backgroundColor: '#232323', borderLeftWidth: 4, borderLeftColor: '#2196F3', marginBottom: 16 }]}> 
              <View style={styles.verseHeader}>
                <Text style={[styles.verseNumber, { color: primary }]}>Start from Verse {currentQuiz.verses[0].verseNumber}</Text>
              </View>
              <Text style={[styles.arabicText, {
                fontFamily: getArabicFontFamily(arabicFont),
                includeFontPadding: false,
                ...arabicTypography,
                lineHeight: arabicTypography.lineHeight || Math.round((arabicTypography.fontSize || 20) * 2.0),
              }]}>{currentQuiz.verses[0].arabicText}</Text>
              <Text style={styles.translationText}>{currentQuiz.verses[0].translation}</Text>
            </View>
            {/* Show Answer Button */}
            {!currentQuiz.showingAnswer && (
              <Pressable style={[styles.showAnswerButton, { backgroundColor: primary }]} onPress={() => setCurrentQuiz({
                ...currentQuiz,
                showingAnswer: true
              })}>
                <Eye size={20} color="#ffffff" />
                <Text style={styles.showAnswerText}>Show Answer</Text>
              </Pressable>
            )}

            {/* Quiz Verses */}
            {currentQuiz.showingAnswer && (
              <View style={styles.versesContainer}>
                {/* Render the rest of the verses for marking */}
                {currentQuiz.verses.slice(1).map((verse) => (
                  <View key={verse.verseNumber} style={styles.verseCard}>
                    <View style={styles.verseHeader}>
                      <Text style={[styles.verseNumber, { color: primary }]}>Verse {verse.verseNumber}</Text>
                    </View>
                    <Text style={[styles.arabicText, {
                      fontFamily: getArabicFontFamily(arabicFont),
                      includeFontPadding: false,
                      ...arabicTypography,
                      lineHeight: arabicTypography.lineHeight || Math.round((arabicTypography.fontSize || 20) * 2.0),
                    }]}>{verse.arabicText}</Text>
                    <Text style={styles.translationText}>{verse.translation}</Text>
                    <View style={styles.answerButtons}>
                      <Pressable
                        style={[
                          styles.answerButton,
                          currentQuiz.verseAnswers[verse.verseNumber] === 'correct' && styles.correctButton
                        ]}
                        onPress={() => {
                          markVerse(String(verse.verseNumber), 'correct');
                        }}
                      >
                        <CheckCircle size={20} color="#ffffff" />
                        <Text style={styles.answerButtonText}>Correct</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.answerButton,
                          currentQuiz.verseAnswers[verse.verseNumber] === 'incorrect' && styles.incorrectButton
                        ]}
                        onPress={() => {
                          markVerse(String(verse.verseNumber), 'incorrect');
                        }}
                      >
                        <X size={20} color="#ffffff" />
                        <Text style={styles.answerButtonText}>Incorrect</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Quiz Progress */}
            <View style={styles.quizProgress}>
              <Text style={styles.progressTitle}>Progress</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(Object.values(currentQuiz.verseAnswers).filter(a => a === 'correct').length / (currentQuiz.verses.length - 1)) * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {Object.values(currentQuiz.verseAnswers).filter(a => a === 'correct').length} / {currentQuiz.verses.length - 1} correct
              </Text>
            </View>
          </ScrollView>
        </View>
      ) : (
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
                    <Text style={styles.statValue}>{quizState.stats.totalQuizzes}</Text>
                  </View>
                  <Text style={styles.statLabel}>Total Quizzes</Text>
                </View>
                <View style={styles.statItem}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{quizState.stats.perfectQuizzes}</Text>
                  </View>
                  <Text style={styles.statLabel}>Perfect Scores</Text>
                </View>
                <View style={styles.statItem}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{quizState.stats.averageScore}%</Text>
                  </View>
                  <Text style={styles.statLabel}>Average Score</Text>
                </View>
              </View>
            </View>

            {/* Failed Surahs Streak */}
            {failedSurahs.length > 0 ? (
              <View style={styles.streakContainer}>
                <Text style={styles.sectionTitle}>Recent Challenges</Text>
                <Text style={styles.sectionSubtitle}>Last {failedSurahs.length} surahs that need more practice</Text>
                <View style={styles.streakList}>
                  {failedSurahs.map((failedSurah, index) => (
                    <View key={failedSurah.surahId} style={styles.streakItem}>
                      <View style={styles.streakNumber}>
                        <Text style={styles.streakNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.streakInfo}>
                        <Text style={styles.streakSurahName}>{failedSurah.surahName}</Text>
                        <Text style={styles.streakDate}>
                          {failedSurah.date.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                        <Pressable 
                        style={styles.practiceButton}
                        onPress={() => {
                          // Use replace to open the target surah in Read without stacking duplicates
                          try { router.replace(`/(tabs)/read?surahId=${failedSurah.surahId}`); } catch { router.push(`/(tabs)/read?surahId=${failedSurah.surahId}`); }
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

            {/* Available Quizzes Info */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Brain size={20} color={primary} />
                <Text style={styles.infoTitle}>How It Works</Text>
              </View>
              <Text style={styles.infoText}>
                • The quiz selects random verses from your fully memorized surahs
              </Text>
              <Text style={styles.infoText}>
                • You'll be asked to recall 3-50 verses from memory
              </Text>
              <Text style={styles.infoText}>
                • Mark each verse as correct or incorrect after reciting
              </Text>
              <Text style={styles.infoText}>
                • Only fully memorized surahs (all green blocks) are included
              </Text>
            </View>

            {/* Available Quizzes */}
            <View style={styles.availableQuizzesContainer}>
              <Text style={styles.sectionTitle}>Available Quizzes</Text>
              <Text style={styles.sectionSubtitle}>
                {fullyMemorizedSurahs.length} fully memorized surahs will be used for Quiz
              </Text>
              
              {fullyMemorizedSurahs.length > 0 ? (
                <Pressable style={[styles.startQuizButton, { backgroundColor: primary }]} onPress={generateQuiz}>
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

              {/* Start Specific Quiz (always available) */}
              <Pressable
                style={[styles.startQuizButton, { backgroundColor: '#6A5ACD', marginTop: 12 }]}
                onPress={() => setShowSpecificModal(true)}
              >
                <Target size={24} color="#ffffff" />
                <Text style={styles.startQuizText}>Start Specific Quiz</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Celebration Confetti */}
      {showCelebration && (
        <QuranQuizCelebration visible={showCelebration} onComplete={() => {
          try {
            console.log('Celebration completion callback triggered');
            setShowCelebration(false);
            setCurrentQuiz(null);
            console.log('Quiz state reset completed');
            // Don't use router.replace as it might cause navigation issues
            // Just reset the state and let the component re-render
          } catch (error) {
            console.error('Error in celebration completion:', error);
            // Fallback: force reset state
            setShowCelebration(false);
            setCurrentQuiz(null);
          }
        }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ffffff',
  },
  header: {
    padding: 20,
    paddingTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
  },
  streakContainer: {
    marginBottom: 24,
  },
  streakList: {
    gap: 8,
  },
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
  streakNumberText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  streakInfo: {
    flex: 1,
  },
  streakSurahName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  streakDate: {
    fontSize: 12,
    color: '#888888',
  },
  practiceButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  practiceButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 8,
  },
  availableQuizzesContainer: {
    marginBottom: 24,
  },
  startQuizButton: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startQuizText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  noQuizzesCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  noQuizzesText: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 12,
  },
  quizInfo: {
    flex: 1,
  },
  quizTitle: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 4,
    fontWeight: '600',
  },
  quizInstruction: {
    fontSize: 14,
    color: '#bbbbbb',
  },
  resetButton: {
    backgroundColor: '#2a2a2a',
    padding: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  showAnswerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  showAnswerText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '600',
  },
  versesContainer: {
    marginBottom: 16,
  },
  verseCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  verseNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  arabicText: {
    color: '#ffffff',
    textAlign: 'right',
    marginVertical: 8,
    paddingHorizontal: 4,
    letterSpacing: -0.2,
    // fontSize, fontFamily, and lineHeight will be applied via inline styles
    // to use the settings from useSettingsStore and getArabicTypographySizing
  },
  translationText: {
    fontSize: 16,
    color: '#bbbbbb',
    marginBottom: 12,
    lineHeight: 24,
  },
  answerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  answerButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  correctButton: {
    backgroundColor: '#4CAF50',
  },
  incorrectButton: {
    backgroundColor: '#f44336',
  },
  quizProgress: {
    marginTop: 24,
  },
  progressTitle: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 16,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  progressText: {
    fontSize: 14,
    color: '#bbbbbb',
    marginTop: 8,
    textAlign: 'center',
  },
});

// Specific Surah Picker Modal
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