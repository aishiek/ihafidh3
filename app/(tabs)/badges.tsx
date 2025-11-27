import { QuranProgressTracker } from '@/data/quranProgress';
import { surahsData } from '@/data/surahs';
import { useProgressStore } from '@/store/progressStore';
import { calculateCurrentBadge, getBadgeStates } from '@/utils/badgeUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ArrowLeft, Award, CheckCircle, Lock } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';

export default function BadgesScreen() {
  const { memorizedVerses } = useProgressStore();
  const previousBadgeLevel = useRef<number>(0);
  
  // Load previous badge level on mount
  useEffect(() => {
    AsyncStorage.getItem('lastBadgeLevel').then(level => {
      if (level) {
        previousBadgeLevel.current = parseFloat(level);
        console.log('[BadgesScreen] Loaded previous badge level:', previousBadgeLevel.current);
      }
    });
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
      }).filter(Boolean),
      memorizedVerseIds: memorizedVerses // Pass cumulative verse IDs
    });
  }, [memorizedVerses]);

  const progress = progressTracker.calculateProgress();

  // Add detailed logging for debugging
  React.useEffect(() => {
    console.log('[BadgesScreen] Progress calculated:', {
      totalVerses: memorizedVerses.length,
      completedJuz: progress.juz.completed,
      juzDetails: progress.juz.details?.slice(0, 5), // Log first 5 Juz
      completedJuzNumbers: progress.juz.details?.filter(j => j.isComplete).map(j => j.juzNumber)
    });
  }, [progress, memorizedVerses.length]);

  // Track badge level for display purposes only (celebration handled by progressStore)
  useEffect(() => {
    if (memorizedVerses.length === 0) return;
    
    const completedJuz = progress.juz.completed;
    const currentBadge = calculateCurrentBadge(memorizedVerses, completedJuz);

    // Update stored badge level for persistence
    if (currentBadge.level > previousBadgeLevel.current) {
      console.log(`📊 [BadgesScreen] Badge level updated: ${currentBadge.name} (level ${currentBadge.level})`);
      previousBadgeLevel.current = currentBadge.level;
      AsyncStorage.setItem('lastBadgeLevel', currentBadge.level.toString());
    }
  }, [memorizedVerses, progress.juz.completed]);

  // Consolidate badge state from shared helper
  const badges = useMemo(() => getBadgeStates(memorizedVerses, progress.juz.completed), [memorizedVerses, progress.juz.completed]);

  const currentBadge = useMemo(() => calculateCurrentBadge(memorizedVerses, progress.juz.completed), [memorizedVerses, progress.juz.completed]);
  const nextBadge = badges.find(badge => !badge.isUnlocked);

  const BadgeCard = ({ badge, isCurrent = false, isNext = false }: { 
    badge: any; 
    isCurrent?: boolean; 
    isNext?: boolean; 
  }) => (
    <View style={[
      styles.badgeCard,
      isCurrent && styles.currentBadgeCard,
      isNext && styles.nextBadgeCard
    ]}>
      <View style={styles.badgeHeader}>
        <View style={styles.badgeIconContainer}>
          <Text style={styles.badgeIcon}>{badge.icon}</Text>
          {badge.isUnlocked ? (
            <CheckCircle size={16} color="#4CAF50" style={styles.badgeStatus} />
          ) : (
            <Lock size={16} color="#888888" style={styles.badgeStatus} />
          )}
        </View>
        <View style={styles.badgeInfo}>
          <Text style={[styles.badgeName, !badge.isUnlocked && styles.lockedText]}>
            {badge.name}
          </Text>
          <Text style={[styles.badgeDescription, !badge.isUnlocked && styles.lockedText]}>
            {badge.description}
          </Text>
        </View>
      </View>
      
      <Text style={[styles.badgeRequirement, !badge.isUnlocked && styles.lockedText]}>
        {badge.requirement}
      </Text>
      
      {badge.details && (
        <Text style={styles.badgeDetails}>{badge.details}</Text>
      )}
      
      {!badge.isUnlocked && badge.progress > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${badge.progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(badge.progress)}% Complete</Text>
        </View>
      )}
      
      {isCurrent && (
        <View style={styles.currentBadge}>
          <Award size={16} color="#FFD700" />
          <Text style={styles.currentBadgeText}>Current Badge</Text>
        </View>
      )}
      
      {isNext && (
        <View style={styles.nextBadge}>
          <Text style={styles.nextBadgeText}>Next Goal</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Custom header with back button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFC107" />
        </Pressable>
        <Text style={styles.headerTitle}>Achieve your Hifdh accolades!</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Your Memorization Journey</Text>
          <Text style={styles.subtitle}>
            Earn badges as you progress through your Quran memorization
          </Text>
        </View>

        {/* Current Badge Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Achievement</Text>
          <BadgeCard badge={currentBadge} isCurrent={true} />
        </View>

        {/* Next Badge Section */}
        {nextBadge && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Goal</Text>
            <BadgeCard badge={nextBadge} isNext={true} />
          </View>
        )}

        {/* All Badges Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Badges</Text>
          <Text style={styles.sectionSubtitle}>
            Complete the requirements to unlock each badge
          </Text>
          {badges.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} />
          ))}
        </View>

        {/* How Badges Work Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Badges Work</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              • Badges are awarded automatically when you complete the requirements
            </Text>
            <Text style={styles.infoText}>
              • Progress is tracked in real-time as you memorize verses
            </Text>
            <Text style={styles.infoText}>
              • Each badge represents a significant milestone in your journey
            </Text>
            <Text style={styles.infoText}>
              • Some badges can be earned in parallel (e.g., Juz completion + Juz Amma)
            </Text>
            <Text style={styles.infoText}>
              • The ultimate goal is achieving "Hafidh Al-Quran" by memorizing the entire Quran
            </Text>
          </View>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerRight: {
    width: 40, // Balance the header
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  titleSection: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    margin: 20,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 16,
  },
  badgeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  currentBadgeCard: {
    borderColor: '#FFD700',
    backgroundColor: '#2a2a1a',
  },
  nextBadgeCard: {
    borderColor: '#2196F3',
    backgroundColor: '#1a1a2a',
  },
  badgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeIconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  badgeIcon: {
    fontSize: 40,
  },
  badgeStatus: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  badgeDescription: {
    fontSize: 14,
    color: '#888888',
  },
  badgeRequirement: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
  },
  badgeDetails: {
    fontSize: 12,
    color: '#2196F3',
    marginBottom: 8,
  },
  lockedText: {
    opacity: 0.6,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'right',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333300',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  currentBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  nextBadge: {
    backgroundColor: '#003366',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  nextBadgeText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  infoText: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 100, // Space for the existing tab bar
  },
});