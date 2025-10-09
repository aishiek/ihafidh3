import MonthlyHifdhCalendar from '@/components/MonthlyHifdhCalendar';
import { surahsData } from '@/data/surahs';
import { useProgressStore } from '@/store/progressStore';
import { useThemeColor } from '@/utils/useThemeColor';
import { useRouter } from 'expo-router';
import { BookOpen, Check, CheckCircle, ChevronDown, Settings, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const DAILY_GOALS = [3, 5, 10, 20, 'custom'];

export default function RevisionScreen() {
  const { primary } = useThemeColor();
  const router = useRouter();
  const { 
    memorizedVerses, 
    dailyRevisedVerses, 
    weeklyRevisedVerses,
    revisionSchedule, 
    markVerseAsRevised,
    updateDailyRevisedVerses,
    updateWeeklyRevisedVerses,
    setDailyRevisionTarget,
    setWeeklyRevisionSurahs
  } = useProgressStore();

  const [selectedGoal, setSelectedGoal] = useState(revisionSchedule.versesPerDay || 5);
  const [customGoal, setCustomGoal] = useState('');
  const [isCustomGoalSelected, setIsCustomGoalSelected] = useState(false);
  const [selectedSurahs, setSelectedSurahs] = useState<number[]>(revisionSchedule.surahsPerWeek || []);
  const [showSurahModal, setShowSurahModal] = useState(false);
  const [currentRevisionVerse, setCurrentRevisionVerse] = useState<{
    verseId: number;
    surahName: string;
    verseNumber: number;
  } | null>(null);

  // Get today's date for tracking
  const today = new Date().toISOString().split('T')[0];
  
  // Calculate today's progress
  const todayRevisedCount = useMemo(() => {
    return dailyRevisedVerses.filter(rv => rv.date === today).length;
  }, [dailyRevisedVerses, today]);

  const isGoalAchieved = todayRevisedCount >= selectedGoal;
  const progressPercentage = Math.min((todayRevisedCount / selectedGoal) * 100, 100);

  // Helper function to find surah and verse number from verse ID
  const findVerseDetails = (verseId: number) => {
    let currentVerseId = 0;
    for (const surah of surahsData) {
      const surahStartId = currentVerseId + 1;
      const surahEndId = currentVerseId + surah.versesCount;
      
      if (verseId >= surahStartId && verseId <= surahEndId) {
        return {
          surahName: surah.englishName,
          verseNumber: verseId - currentVerseId,
          surahId: surah.id
        };
      }
      currentVerseId += surah.versesCount;
    }
    return { surahName: 'Unknown', verseNumber: 0, surahId: 0 };
  };

  // Calculate weekly progress
  const weeklyProgress = useMemo(() => {
    if (selectedSurahs.length === 0) {
      return { completedSurahs: 0, totalSurahs: 0, percentage: 0, isGoalAchieved: false };
    }

    // Get current week's start (Sunday)
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    // Filter weekly revised verses for current week
    const thisWeekRevisedVerses = weeklyRevisedVerses.filter(rv => {
      const revisionDate = new Date(rv.date);
      return revisionDate >= currentWeekStart;
    });

    let completedSurahs = 0;

    // Check each selected surah
    for (const surahId of selectedSurahs) {
      const surah = surahsData.find(s => s.id === surahId);
      if (!surah) continue;

      // Calculate verse range for this surah
      let verseStart = 0;
      for (let i = 1; i < surahId; i++) {
        const prevSurah = surahsData.find(s => s.id === i);
        if (prevSurah) verseStart += prevSurah.versesCount;
      }
      verseStart += 1; // Convert to 1-based indexing

      // Check if all verses in this surah are revised this week
      const surahRevisedVerses = thisWeekRevisedVerses.filter(rv => {
        const verseDetails = findVerseDetails(rv.verseId);
        return verseDetails.surahId === surahId;
      });

      // Check if all verses in the surah are revised
      const allVersesRevised = Array.from({ length: surah.versesCount }, (_, i) => verseStart + i)
        .every(verseId => surahRevisedVerses.some(rv => rv.verseId === verseId));

      if (allVersesRevised) {
        completedSurahs++;
      }
    }

    const percentage = selectedSurahs.length > 0 ? (completedSurahs / selectedSurahs.length) * 100 : 0;
    const isGoalAchieved = completedSurahs === selectedSurahs.length && selectedSurahs.length > 0;

    return { completedSurahs, totalSurahs: selectedSurahs.length, percentage, isGoalAchieved };
  }, [selectedSurahs, weeklyRevisedVerses, today]);

  // Generate random verse for revision from memorized verses
  const generateRandomRevisionVerse = () => {
    if (memorizedVerses.length === 0) {
      Alert.alert('No Memorized Verses', 'You need to memorize some verses first before you can revise them.');
      return;
    }

    // Get a random verse from memorized verses
    const randomIndex = Math.floor(Math.random() * memorizedVerses.length);
    const verseId = memorizedVerses[randomIndex];
    const details = findVerseDetails(verseId);
    
    setCurrentRevisionVerse({
      verseId,
      surahName: details.surahName,
      verseNumber: details.verseNumber
    });
  };

  // Mark current verse as revised
  const markCurrentVerseAsRevised = () => {
    if (!currentRevisionVerse) return;
    
    markVerseAsRevised(currentRevisionVerse.verseId);
    updateDailyRevisedVerses(currentRevisionVerse.verseId);
    updateWeeklyRevisedVerses(currentRevisionVerse.verseId);
    setCurrentRevisionVerse(null);
    
    Alert.alert(
      'Revision Completed!', 
      `You have revised ${todayRevisedCount + 1} verses today.`,
      [{ text: 'Continue', style: 'default' }]
    );
  };

  // Update goal when changed
  const handleGoalChange = (goal: number | string) => {
    if (goal === 'custom') {
      setIsCustomGoalSelected(true);
      // Don't change selectedGoal yet, wait for custom input
    } else {
      setSelectedGoal(goal as number);
      setIsCustomGoalSelected(false);
      setCustomGoal('');
      // Only update store if value actually changed
      if (revisionSchedule.versesPerDay !== goal) {
        setDailyRevisionTarget(goal as number);
      }
    }
  };

  // Handle custom goal input
  const handleCustomGoalSubmit = () => {
    const customValue = parseInt(customGoal);
    if (isNaN(customValue) || customValue < 1 || customValue > 100) {
      Alert.alert('Invalid Input', 'Please enter a number between 1 and 100.');
      return;
    }
    setSelectedGoal(customValue);
    setIsCustomGoalSelected(false);
    if (revisionSchedule.versesPerDay !== customValue) {
      setDailyRevisionTarget(customValue);
    }
  };

  // Handle surah selection
  const handleSurahToggle = (surahId: number) => {
    setSelectedSurahs(prev => {
      const newSelection = prev.includes(surahId) 
        ? prev.filter(id => id !== surahId)
        : [...prev, surahId];
      // Only update store if value actually changed
      if (JSON.stringify(revisionSchedule.surahsPerWeek) !== JSON.stringify(newSelection)) {
        setWeeklyRevisionSurahs(newSelection);
      }
      return newSelection;
    });
  };

  // Initialize goals from store (do NOT update store here)
  useEffect(() => {
    if (revisionSchedule.versesPerDay !== selectedGoal) {
      const currentGoal = revisionSchedule.versesPerDay;
      setSelectedGoal(currentGoal);
      // Check if current goal is a custom value (not in predefined goals)
      if (!DAILY_GOALS.slice(0, -1).includes(currentGoal)) {
        setIsCustomGoalSelected(false); // Don't show custom input, just display the value
      }
    }
    if (JSON.stringify(revisionSchedule.surahsPerWeek) !== JSON.stringify(selectedSurahs)) {
      setSelectedSurahs(revisionSchedule.surahsPerWeek || []);
    }
  }, [revisionSchedule.versesPerDay, revisionSchedule.surahsPerWeek]);
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tarteel & Tartheeb</Text>
        <Text style={styles.subtitle}>Review your memorized verses daily</Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Daily Goal Selection */}
        <View style={styles.goalSelectionCard}>
          <View style={styles.goalHeader}>
            <Settings size={20} color={primary} />
            <Text style={styles.goalTitle}>Daily Revision Goal</Text>
          </View>
          <Text style={styles.goalDescription}>Choose how many verses to revise daily</Text>
          <View style={styles.goalOptionsContainer}>
            {DAILY_GOALS.map((goal) => {
              const isSelected = goal === 'custom' ? isCustomGoalSelected : selectedGoal === goal;
              return (
                <Pressable
                  key={goal}
                  style={[
                    styles.goalOption,
                    isSelected && [styles.goalOptionSelected, { backgroundColor: primary, borderColor: primary }]
                  ]}
                  onPress={() => handleGoalChange(goal)}
                >
                  <Text style={[
                    styles.goalOptionText,
                    isSelected && styles.goalOptionTextSelected
                  ]}>
                    {goal === 'custom' ? 'Custom' : `${goal} verses`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          
          {/* Custom Goal Input */}
          {isCustomGoalSelected && (
            <View style={styles.customGoalContainer}>
              <Text style={styles.customGoalLabel}>Enter custom verse count:</Text>
              <View style={styles.customGoalInputContainer}>
                <TextInput
                  style={[styles.customGoalInput, { borderColor: primary }]}
                  placeholder="e.g. 15"
                  placeholderTextColor="#666666"
                  value={customGoal}
                  onChangeText={setCustomGoal}
                  keyboardType="numeric"
                  maxLength={3}
                  autoFocus
                />
                <Pressable
                  style={[styles.customGoalSubmit, { backgroundColor: primary }]}
                  onPress={handleCustomGoalSubmit}
                >
                  <Check size={20} color="#ffffff" />
                </Pressable>
              </View>
              <Text style={styles.customGoalHint}>Enter a number between 1 and 100</Text>
            </View>
          )}
          
          {/* Show current custom goal if it's not a predefined value */}
          {!isCustomGoalSelected && !DAILY_GOALS.slice(0, -1).includes(selectedGoal) && (
            <View style={styles.currentCustomGoal}>
              <Text style={styles.currentCustomGoalText}>
                Current custom goal: {selectedGoal} verses
              </Text>
            </View>
          )}
        </View>
        
        {/* Weekly Goal Selection */}
        <View style={styles.goalSelectionCard}>
          <View style={styles.goalHeader}>
            <BookOpen size={20} color="#FF9800" />
            <Text style={styles.goalTitle}>Weekly Revision Goal</Text>
          </View>
          <Text style={styles.goalDescription}>Select surahs to revise completely this week</Text>
          
          <Pressable 
            style={[styles.surahSelector, { backgroundColor: primary }]}
            onPress={() => setShowSurahModal(true)}
          >
            <Text style={styles.surahSelectorText}>
              {selectedSurahs.length === 0 
                ? 'Select Surahs' 
                : `${selectedSurahs.length} Surah${selectedSurahs.length !== 1 ? 's' : ''} selected`
              }
            </Text>
            <ChevronDown size={20} color="#ffffff" />
          </Pressable>
          
          {selectedSurahs.length > 0 && (
            <View style={styles.selectedSurahsContainer}>
              <Text style={styles.selectedSurahsTitle}>Selected Surahs:</Text>
              <View style={styles.selectedSurahsList}>
                {selectedSurahs.map(surahId => {
                  const surah = surahsData.find(s => s.id === surahId);
                  return surah ? (
                    <View key={surahId} style={[styles.selectedSurahChip, { backgroundColor: primary }]}>
                      <Text style={styles.selectedSurahText}>
                        {surah.id}. {surah.name}
                      </Text>
                    </View>
                  ) : null;
                })}
              </View>
            </View>
          )}
        </View>

  {/* Hifdh Planner - Monthly Calendar */}
  <MonthlyHifdhCalendar />

        {/* Daily Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View style={styles.progressIconContainer}>
              {isGoalAchieved ? (
                <CheckCircle size={24} color="#4CAF50" />
              ) : (
                <X size={24} color="#F44336" />
              )}
            </View>
            <View style={styles.progressInfo}>
              <Text style={styles.progressTitle}>Today's Progress</Text>
              <Text style={[
                styles.progressStatus,
                { color: isGoalAchieved ? '#4CAF50' : '#F44336' }
              ]}>
                {isGoalAchieved ? 'Goal Achieved!' : 'Goal Not Achieved'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.progressText}>
            {todayRevisedCount} / {selectedGoal} verses revised today
          </Text>
          
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { backgroundColor: '#333333' }]}>
              <View style={[
                styles.progressFill, 
                { 
                  width: `${progressPercentage}%`,
                  backgroundColor: isGoalAchieved ? '#4CAF50' : primary
                }
              ]} />
            </View>
            <Text style={styles.progressPercentage}>{Math.round(progressPercentage)}%</Text>
          </View>
        </View>

        {/* Weekly Progress */}
        {selectedSurahs.length > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View style={styles.progressIconContainer}>
                {weeklyProgress.isGoalAchieved ? (
                  <CheckCircle size={24} color="#4CAF50" />
                ) : (
                  <X size={24} color="#F44336" />
                )}
              </View>
              <View style={styles.progressInfo}>
                <Text style={styles.progressTitle}>Weekly Progress</Text>
                <Text style={[
                  styles.progressStatus,
                  { color: weeklyProgress.isGoalAchieved ? '#4CAF50' : '#F44336' }
                ]}>
                  {weeklyProgress.isGoalAchieved ? 'Goal Achieved!' : 'Goal Not Achieved'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.progressText}>
              {weeklyProgress.completedSurahs} out of {weeklyProgress.totalSurahs} selected surahs revised
            </Text>
            
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { backgroundColor: '#333333' }]}>
                <View style={[
                  styles.progressFill, 
                  { 
                    width: `${weeklyProgress.percentage}%`,
                    backgroundColor: weeklyProgress.isGoalAchieved ? '#4CAF50' : '#FF9800'
                  }
                ]} />
              </View>
              <Text style={styles.progressPercentage}>{Math.round(weeklyProgress.percentage)}%</Text>
            </View>
          </View>
        )}

        {/* Current Revision Verse */}
        {currentRevisionVerse && (
          <View style={styles.revisionCard}>
            <View style={styles.revisionHeader}>
              <BookOpen size={20} color="#FF9800" />
              <Text style={styles.revisionTitle}>Current Revision</Text>
            </View>
            <View style={styles.revisionContent}>
              <Text style={styles.revisionVerseInfo}>
                Surah: {currentRevisionVerse.surahName}
              </Text>
              <Text style={styles.revisionVerseInfo}>
                Verse: {currentRevisionVerse.verseNumber}
              </Text>
              <Text style={styles.revisionInstruction}>
                Recite this verse from memory and tap "Mark as Revised" when done.
              </Text>
            </View>
            <View style={styles.revisionActions}>
              <Pressable 
                style={[styles.revisionButton, styles.cancelButton]}
                onPress={() => setCurrentRevisionVerse(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
          <Pressable 
                style={[styles.revisionButton, styles.completeButton]}
                onPress={markCurrentVerseAsRevised}
          >
                <Text style={styles.completeButtonText}>Mark as Revised</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{memorizedVerses.length}</Text>
              <Text style={styles.statLabel}>Total Memorized</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{todayRevisedCount}</Text>
              <Text style={styles.statLabel}>Revised Today</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Surah Selection Modal */}
      <Modal
        visible={showSurahModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSurahModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Surahs for Weekly Revision</Text>
            <Pressable 
              onPress={() => setShowSurahModal(false)}
              style={styles.modalCloseButton}
            >
              <X size={24} color="#ffffff" />
            </Pressable>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {surahsData.map((surah) => (
              <TouchableOpacity
                key={surah.id}
                style={styles.surahItem}
                onPress={() => handleSurahToggle(surah.id)}
              >
                <View style={styles.surahInfo}>
                  <Text style={[styles.surahNumber, { color: primary }]}>{surah.id}</Text>
                  <View style={styles.surahNames}>
                    <Text style={styles.surahName}>{surah.name}</Text>
                    <Text style={styles.surahEnglishName}>{surah.englishName}</Text>
                  </View>
                  <Text style={styles.surahVerses}>{surah.versesCount} verses</Text>
                </View>
                {selectedSurahs.includes(surah.id) && (
                  <Check size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
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
  goalSelectionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  goalDescription: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 16,
  },
  goalOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalOption: {
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalOptionSelected: {
  },
  goalOptionText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  goalOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  surahSelector: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  surahSelectorText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  selectedSurahsContainer: {
    marginTop: 8,
  },
  selectedSurahsTitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 8,
  },
  selectedSurahsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedSurahChip: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selectedSurahText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  progressCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressIconContainer: {
    marginRight: 12,
  },
  progressInfo: {
    flex: 1,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  progressStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressText: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    minWidth: 40,
  },
  revisionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  revisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  revisionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  revisionContent: {
    marginBottom: 16,
  },
  revisionVerseInfo: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 4,
    fontWeight: '500',
  },
  revisionInstruction: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
    fontStyle: 'italic',
  },
  revisionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  revisionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333333',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 8,
  },
  surahInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  surahNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 30,
  },
  surahNames: {
    flex: 1,
    marginLeft: 12,
  },
  surahName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  surahEnglishName: {
    fontSize: 14,
    color: '#888888',
  },
  surahVerses: {
    fontSize: 12,
    color: '#888888',
    marginRight: 12,
  },
  customGoalContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#333333',
    borderRadius: 8,
  },
  customGoalLabel: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
    fontWeight: '500',
  },
  customGoalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customGoalInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#ffffff',
  },
  customGoalSubmit: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customGoalHint: {
    fontSize: 12,
    color: '#888888',
    marginTop: 8,
  },
  currentCustomGoal: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#333333',
    borderRadius: 8,
  },
  currentCustomGoalText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '500',
  },
});
