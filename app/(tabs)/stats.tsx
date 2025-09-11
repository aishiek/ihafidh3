import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Modal, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCustomColors } from '@/utils/themeUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { useProgressStore } from '@/store/progressStore';
import { useSettingsStore } from '@/store/settingsStore';
import { surahsData } from '@/data/surahs';
import { calculateOverallJuzStats, calculateJuzProgress } from '@/utils/juzCalculator';
// Remove unused import - now using calculateJuzProgress from juzCalculator
import CircularProgress from '@/components/CircularProgress';

interface ProgressTrackerData {
  memorizedVerses: string[];
}

interface ProgressResult {
  verses: {
    completed: number;
    total: number;
    percentage: number;
  };
  surahs: {
    completed: number;
    total: number;
    percentage: number;
  };
  juz: {
    completed: number;
    total: number;
    percentage: number;
  };
}

interface JuzProgressData {
  [key: number]: {
    memorized: number;
    total: number;
    progress: number;
  };
}

// Simple QuranProgressTracker implementation
class QuranProgressTracker {
  private memorizedVerses: string[];

  constructor(data: ProgressTrackerData) {
    this.memorizedVerses = data.memorizedVerses || [];
  }

  calculateProgress(): ProgressResult {
    const totalVerses = surahsData.reduce((sum, surah) => sum + surah.versesCount, 0);
    const totalSurahs = surahsData.length;
    const totalJuz = 30;

    // Calculate verse progress
    const memorizedVerseCount = this.memorizedVerses.length;
    const versePercentage = totalVerses > 0 ? (memorizedVerseCount / totalVerses) * 100 : 0;

    // Calculate surah progress (simplified - count surahs with any memorized verses)
    const memorizedSurahs = new Set<string>();
    this.memorizedVerses.forEach((verseRef: string) => {
      const surahId = verseRef.split(':')[0];
      memorizedSurahs.add(surahId);
    });

    const surahPercentage = totalSurahs > 0 ? (memorizedSurahs.size / totalSurahs) * 100 : 0;

    // Calculate juz progress (simplified - will be updated by actual juz data)
    // This is a placeholder - actual juz progress is calculated from database
    const juzPercentage = 0; // Will be calculated from juzProgressData

    return {
      verses: {
        completed: memorizedVerseCount,
        total: totalVerses,
        percentage: versePercentage
      },
      surahs: {
        completed: memorizedSurahs.size,
        total: totalSurahs,
        percentage: surahPercentage
      },
      juz: {
        completed: 0, // Will be calculated from actual juz data
        total: totalJuz,
        percentage: juzPercentage
      }
    };
  }
}

export default function StatsScreen() {
  const router = useRouter();
  const colors = useCustomColors();
  const { primary } = useThemeColor();
  const { userName } = useSettingsStore();
  
  const [viewMode, setViewMode] = useState('surah');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [juzProgressData, setJuzProgressData] = useState<JuzProgressData>({});
  
  const { memorizedVerses } = useProgressStore();
  
  // Load juz progress data using the same calculation as Juz Memorization page
  useEffect(() => {
    const loadJuzProgress = () => {
      const juzData: JuzProgressData = {};
      try {
        for (let i = 1; i <= 30; i++) {
          // Use the same calculation function as Juz Memorization page
          const progress = calculateJuzProgress(i, memorizedVerses);
          juzData[i] = {
            memorized: progress.memorized,
            total: progress.total,
            progress: progress.progress
          };
        }
        setJuzProgressData(juzData);
      } catch (error) {
        console.error('Error loading juz progress:', error);
        // Set default values on error for all juz
        for (let i = 1; i <= 30; i++) {
          juzData[i] = { memorized: 0, total: 0, progress: 0 };
        }
        setJuzProgressData(juzData);
      }
    };

    loadJuzProgress();
  }, [memorizedVerses]);
  
  // Initialize progress tracker with current memorized verses
  const progressTracker = useMemo(() => {
    return new QuranProgressTracker({
      memorizedVerses: memorizedVerses.map(verseId => {
        // Convert verseId to surah:verse format for the tracker
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
  
  // Use proper Juz calculation (sync with Home page)
  const calculateOverallJuzProgress = () => {
    const stats = calculateOverallJuzStats(memorizedVerses);
    return {
      completed: stats.completed,
      inProgress: stats.inProgress,
      total: stats.totalJuz,
      percentage: stats.percentage
    };
  };
  
  // Update progress with actual juz data
  const actualProgress = {
    ...progress,
    juz: calculateOverallJuzProgress()
  };
  
  // Calculate memorization for each surah
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
  
  // Get juz progress (now synchronous)
  const getJuzProgressSync = (juzNumber: number) => {
    const juzData = juzProgressData[juzNumber];
    if (juzData) {
      // Ensure we don't return NaN values
      const memorized = juzData.memorized || 0;
      const total = juzData.total || 0;
      const progress = total > 0 ? (memorized / total) * 100 : 0;
      
      return {
        memorized,
        total,
        progress: Math.round(progress)
      };
    }
    // Return default values if data not loaded yet
    return { memorized: 0, total: 0, progress: 0 };
  };
  
  const getProgressColor = (progress: number) => {
    // Handle NaN and invalid values
    if (isNaN(progress) || progress === 0) return '#666666'; // Grey for not started
    if (progress >= 100) return '#4CAF50'; // Green for completed
    return '#FF9800'; // Amber for in progress (even 1 verse)
  };
  
  const renderGreeting = () => {
    const name = userName?.trim();
    
    if (!name) {
      return 'Ahlan Wa Sahlan!';
    }
    
    return `Ahlan Wa Sahlan! Yaa, ${name}`;
  };
  
  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: '#1a1a1a' }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text 
          style={[
            styles.greeting, 
            { 
              color: '#ffffff',
              fontSize: userName && userName.length > 15 ? 20 : 24
            }
          ]} 
          numberOfLines={2}
        >
          {renderGreeting()}
        </Text>
        <Text style={[styles.subtitle, { color: '#ffffff' }]}>
          Your memorization progress
        </Text>
      </View>
      
      {/* Progress Overview with Circular Indicators */}
      <View style={[styles.progressCard, { backgroundColor: '#333333', borderColor: '#555555' }]}>
        <Text style={[styles.progressTitle, { color: '#ffffff' }]}>
          Memorization Progress
        </Text>
        
        <View style={styles.circularProgressContainer}>
          <CircularProgress
            size={100}
            strokeWidth={8}
            progress={actualProgress.verses.percentage}
            label="Verses"
            value={`${actualProgress.verses.completed}/${actualProgress.verses.total}`}
            progressColor="#2196F3"
            textColor="#ffffff"
          />
          <CircularProgress
            size={100}
            strokeWidth={8}
            progress={actualProgress.surahs.percentage}
            label="Surahs"
            value={`${actualProgress.surahs.completed}/${actualProgress.surahs.total}`}
            progressColor="#FFD700"
            textColor="#ffffff"
          />
          <CircularProgress
            size={100}
            strokeWidth={8}
            progress={actualProgress.juz.percentage}
            label="Juz"
            value={`${actualProgress.juz.completed}/${actualProgress.juz.total}`}
            progressColor="#4CAF50"
            textColor="#ffffff"
          />
        </View>
      </View>
      
      {/* 114 Surahs and 30 Juz Grid */}
      <View style={[styles.yourProgressSection, { backgroundColor: '#333333', borderColor: '#555555' }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
            Your Progress
          </Text>
          <View style={styles.toggleContainer}>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: viewMode === 'surah' ? primary : 'transparent' }
                ]}
                onPress={() => setViewMode('surah')}
              >
                <Text style={[styles.toggleText, { color: '#ffffff' }]}>
                  Surah
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: viewMode === 'juz' ? primary : 'transparent' }
                ]}
                onPress={() => setViewMode('juz')}
              >
                <Text style={[styles.toggleText, { color: '#ffffff' }]}>
                  Juz
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {viewMode === 'surah' ? (
          <View style={styles.gridContainer}>
            {surahsData.map((surah) => {
              const surahProgress = calculateSurahProgress(surah.id);
              const backgroundColor = getProgressColor(surahProgress.progress);
              
              return (
                <TouchableOpacity
                  key={surah.id}
                  style={[styles.gridItem, { backgroundColor }]}
                  onPress={() => setSelectedItem({
                    type: 'surah',
                    id: surah.id,
                    name: surah.name,
                    versesCount: surah.versesCount,
                    memorizedCount: surahProgress.memorized
                  })}
                >
                  <Text style={[styles.gridItemText, { color: '#ffffff' }]}>{surah.id}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {Array.from({ length: 30 }, (_, index) => {
              const juzNumber = index + 1;
              const progress = calculateJuzProgress(juzNumber, memorizedVerses);
              const backgroundColor = getProgressColor(progress.progress);

              return (
                <TouchableOpacity
                  key={juzNumber}
                  style={[styles.gridItem, { backgroundColor }]}
                  onPress={() => setSelectedItem({
                    type: 'juz',
                    id: juzNumber,
                    name: `Juz ${juzNumber}`,
                    versesCount: progress.total,
                    memorizedCount: progress.memorized
                  })}
                >
                  <Text style={[styles.gridItemText, { color: '#ffffff' }]}>{juzNumber}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Progress Details Modal */}
      <Modal
        visible={selectedItem !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setSelectedItem(null)}
        >
          <View style={[styles.modalContent, { backgroundColor: '#333333', borderColor: '#555555' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#ffffff' }]}>
                {selectedItem?.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            {selectedItem && (
              <>
                <View style={styles.modalStats}>
                  <View style={styles.modalStatItem}>
                    <Text style={[styles.modalStatLabel, { color: '#ffffff' }]}>
                      Total Verses
                    </Text>
                    <Text style={[styles.modalStatValue, { color: '#ffffff' }]}>
                      {selectedItem.versesCount}
                    </Text>
                  </View>
                  
                  <View style={styles.modalStatItem}>
                    <Text style={[styles.modalStatLabel, { color: '#ffffff' }]}>
                      Memorized
                    </Text>
                    <Text style={[styles.modalStatValue, { color: '#ffffff' }]}>
                      {selectedItem.memorizedCount}
                    </Text>
                  </View>
                  
                  <View style={styles.modalStatItem}>
                    <Text style={[styles.modalStatLabel, { color: '#ffffff' }]}>
                      Progress
                    </Text>
                    <Text style={[styles.modalStatValue, { color: '#ffffff' }]}>
                      {Math.round((selectedItem.memorizedCount / selectedItem.versesCount) * 100)}%
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.modalProgressBar, { backgroundColor: '#555555' }]}>
                  <View 
                    style={[
                      styles.modalProgressFill,
                      { 
                        width: `${(selectedItem.memorizedCount / selectedItem.versesCount) * 100}%`,
                        backgroundColor: getProgressColor((selectedItem.memorizedCount / selectedItem.versesCount) * 100)
                      }
                    ]}
                  />
                </View>
                
                {selectedItem.type === 'surah' && (
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#2196F3' }]}
                    onPress={() => {
                      setSelectedItem(null);
                      router.push(`/surah/${selectedItem.id}`);
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Open Surah</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
  },
  progressCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  circularProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    gap: 40,
  },
  yourProgressSection: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  progressHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  toggleContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    width: 160,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  gridItem: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItemText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  modalStats: {
    marginBottom: 20,
  },
  modalStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalStatLabel: {
    fontSize: 16,
    color: '#ffffff',
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalProgressBar: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    marginBottom: 20,
  },
  modalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});