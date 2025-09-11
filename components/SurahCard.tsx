import React from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { Download, Check } from 'lucide-react-native';
import { Surah } from '@/types';
import { useCustomColors } from '@/utils/themeUtils';
import { useProgressStore } from '@/store/progressStore';

interface SurahCardProps {
  surah: Surah;
  onPress: () => void;
  onDownload?: () => void;
  isDownloading?: boolean;
  downloadProgress?: number;
  isCached?: boolean;
}

export default function SurahCard({ 
  surah, 
  onPress, 
  onDownload,
  isDownloading = false,
  downloadProgress = 0,
  isCached = false
}: SurahCardProps) {
  const colors = useCustomColors();
  const { memorizedVerses } = useProgressStore();
  
  // Calculate memorization progress for this surah
  const calculateSurahProgress = () => {
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
    
    // Get the starting verse ID for this surah
    let startVerseId = 0;
    for (let i = 1; i < surah.id; i++) {
      if (i <= surahVerseCounts.length) {
        startVerseId += surahVerseCounts[i - 1];
      }
    }
    
    const endVerseId = startVerseId + surah.versesCount;
    
    // Count memorized verses in this surah
    const memorizedInSurah = memorizedVerses.filter(id => 
      id > startVerseId && id <= endVerseId
    ).length;
    
    return (memorizedInSurah / surah.versesCount) * 100;
  };
  
  const surahProgress = calculateSurahProgress();
  const memorizedInSurah = Math.round((surahProgress / 100) * surah.versesCount);
  const isFullyMemorized = surahProgress === 100;
  
  return (
    <Pressable
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={[styles.surahNumber, { backgroundColor: colors.primary }]}>
          <Text style={styles.surahNumberText}>{surah.id}</Text>
        </View>
        
        <View style={styles.surahInfo}>
          <Text style={[styles.surahName, { color: colors.text }]}>
            {surah.name}
          </Text>
          <Text style={[styles.surahEnglishName, { color: colors.inactive }]}>
            {surah.englishName}
          </Text>
        </View>
        
        <View style={styles.surahMeta}>
          <Text style={[styles.surahMetaText, { color: colors.inactive }]}>
            {surah.versesCount} verses
          </Text>
          <Text style={[styles.surahMetaText, { color: colors.inactive }]}>
            {surah.revelationType}
          </Text>
        </View>
      </View>
      
      {/* Progress Counter Pill */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={[
            styles.progressText, 
            { color: isFullyMemorized ? colors.success : colors.inactive }
          ]}> 
            {isFullyMemorized ? 'Memorized' : `${memorizedInSurah}/${surah.versesCount} memorized`}
          </Text>
          <View style={[
            styles.progressPill, 
            { backgroundColor: isFullyMemorized ? colors.success + '40' : colors.primary + '22' }
          ]}> 
            <Text style={[
              styles.progressPillText, 
              { color: colors.primary }
            ]}> 
              {`${memorizedInSurah}/${surah.versesCount}`}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  surahNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  surahNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  surahInfo: {
    flex: 1,
  },
  surahName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  surahEnglishName: {
    fontSize: 14,
  },
  surahMeta: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  surahMetaText: {
    fontSize: 12,
    marginBottom: 2,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
  },
  progressPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  progressPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
});