import JUZ_MAPPING from '@/data/juzMapping';
import { surahsData } from '@/data/surahs';
import { useProgressStore } from '@/store/progressStore';
import { calculateJuzProgress, getJuzVerseRange } from '@/utils/juzCalculator';
import { useCustomColors } from '@/utils/themeUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function getSurahIdByName(name: string): number | null {
  const surah = surahsData.find(s => s.name === name || s.englishName === name || s.arabicName === name);
  return surah ? surah.id : null;
}

export default function JuzMemorization() {
  const { primary } = useThemeColor();
  const colors = useCustomColors();
  const { memorizedVerses, bulkMarkVersesMemorized, updateBadges } = useProgressStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalText, setModalText] = useState('');
  const [modalProgress, setModalProgress] = useState(0);
  const [modalTotal, setModalTotal] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const progressTimerRef = useRef<any>(null);

  const memorizedSet = useMemo(() => new Set(memorizedVerses), [memorizedVerses]);

  const data = useMemo(() => Array.from({ length: 30 }, (_, i) => i + 1), []);

  // Precompute progress for all 30 Juz once per memorizedVerses change
  const juzProgressData = useMemo(() => {
    const map: Record<number, { progress: number; total: number; memorized: number }> = {};
    for (let j = 1; j <= 30; j++) {
      map[j] = calculateJuzProgress(j, memorizedVerses);
    }
    return map;
  }, [memorizedVerses]);

  const bulkToggleJuz = useCallback(async (juz: number, enable: boolean) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setModalText(enable ? `Marking Juz ${juz} as memorized...` : `Unmarking Juz ${juz}...`);
    setModalVisible(true);
    setModalProgress(0);
    
    try {
      const range = getJuzVerseRange(juz);
      if (!range.totalVerses) {
        setModalVisible(false);
        setIsProcessing(false);
        return;
      }
      
      const startId = Math.max(1, range.startVerseId);
      const endId = Math.max(startId, range.endVerseId);

      // Build the list of verse IDs for this Juz
      const juzIds: number[] = [];
      for (let id = startId; id <= endId; id++) {
        juzIds.push(id);
      }

      // Determine which IDs actually need changing
      const idsToApply = enable
        ? juzIds.filter((id) => !memorizedSet.has(id))
        : juzIds.filter((id) => memorizedSet.has(id));

      if (idsToApply.length === 0) {
        setModalVisible(false);
        setIsProcessing(false);
        setModalProgress(0);
        setModalTotal(0);
        return;
      }

      setModalTotal(idsToApply.length);
      const total = idsToApply.length;

      // Start smooth progress animation
      let currentProgress = 0;
      const animationDuration = 1200; // 1.2 seconds
      const updateInterval = 30;
      const steps = animationDuration / updateInterval;
      const increment = total / steps;

      progressTimerRef.current = setInterval(() => {
        currentProgress += increment;
        if (currentProgress >= total) {
          currentProgress = total;
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
        }
        setModalProgress(Math.floor(currentProgress));
      }, updateInterval);

      // Small delay to let modal render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use the optimized bulk operation - THIS IS THE KEY CHANGE
      await bulkMarkVersesMemorized(idsToApply, enable);

      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, animationDuration + 100));
      
      // Clear timer
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      
      // Ensure 100%
      setModalProgress(total);
      
      // Update badges (already called in bulkMarkVersesMemorized, but ensure it happens)
      updateBadges();

      // Show completion
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setModalVisible(false);
      setModalProgress(0);
      setModalTotal(0);
      setIsProcessing(false);
      
    } catch (e) {
      console.error('Error toggling Juz:', e);
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setModalVisible(false);
      setModalProgress(0);
      setModalTotal(0);
      setIsProcessing(false);
    }
  }, [memorizedSet, bulkMarkVersesMemorized, updateBadges, isProcessing]);

  const renderItem = ({ item: juz }: { item: number }) => {
    const info = JUZ_MAPPING[juz];
    const { progress, total, memorized } = juzProgressData[juz] || { progress: 0, total: 0, memorized: 0 };
    const enabled = total > 0 && memorized === total;
    const startText = info.start.replace(':', ':');
    const endText = info.end.replace(':', ':');
    const inProgress = memorized > 0 && memorized < total;

    return (
      <View style={[styles.card, { backgroundColor: '#333333', borderColor: '#555555' }]}> 
        {/* Action Button - Top Right Corner */}
        <TouchableOpacity
          style={[
            styles.actionButtonTopRight,
            {
              backgroundColor: enabled ? '#4CAF50' : primary,
              borderColor: enabled ? '#4CAF50' : primary,
              opacity: isProcessing ? 0.5 : 1,
            }
          ]}
          onPress={() => bulkToggleJuz(juz, !enabled)}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.actionText,
            { color: enabled ? '#ffffff' : '#ffffff' }
          ]}>
            {enabled ? '✓ Memorized' : inProgress ? 'Complete' : 'Mark All'}
          </Text>
        </TouchableOpacity>
        
        <View style={[styles.badge, { backgroundColor: primary }]}>
          <Text style={styles.badgeText}>{juz}</Text>
        </View>
        
        <View style={styles.info}>
          <Text style={[styles.title, { color: '#ffffff' }]}>Juz {juz}</Text>
          <Text style={[styles.subtitle, { color: '#cccccc' }]}>
            {startText} to {endText}
          </Text>
          <View style={styles.progressRow}>
            <Text style={[styles.progressText, { color: '#aaaaaa' }]}>
              {memorized}/{total} verses
            </Text>
            <Text style={[styles.progressPercent, { color: primary }]}>
              {progress}%
            </Text>
          </View>
          
          {/* Progress Bar */}
          {inProgress && (
            <View style={styles.miniProgressBar}>
              <View 
                style={[
                  styles.miniProgressFill, 
                  { 
                    width: `${progress}%`,
                    backgroundColor: primary 
                  }
                ]} 
              />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <FlatList
        data={data}
        keyExtractor={(n) => String(n)}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: '#333333' }]}> 
            <ActivityIndicator size="large" color={primary} style={{ marginBottom: 16 }} />
            <Text style={[styles.modalTitle, { color: '#ffffff' }]}>
              {modalText}
            </Text>
            
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarBackground, { backgroundColor: '#555555' }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      backgroundColor: primary,
                      width: modalTotal > 0 ? `${Math.round((modalProgress / modalTotal) * 100)}%` : '0%'
                    }
                  ]} 
                />
              </View>
            </View>
            
            <View style={styles.progressStats}>
              <Text style={[styles.progressLabel, { color: '#aaaaaa' }]}>
                {modalProgress} / {modalTotal} verses
              </Text>
              <Text style={[styles.progressPercentLabel, { color: primary }]}>
                {modalTotal > 0 ? Math.round((modalProgress / modalTotal) * 100) : 0}%
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 44,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badgeText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 18 
  },
  info: { 
    flex: 1,
  },
  title: { 
    fontSize: 18, 
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: { 
    fontSize: 14, 
    marginBottom: 6,
    opacity: 0.8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: { 
    fontSize: 13,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
  },
  miniProgressBar: {
    height: 4,
    backgroundColor: '#555555',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actionButtonTopRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { 
    padding: 28,
    borderRadius: 16,
    minWidth: 280,
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressBarContainer: { 
    width: '100%',
    marginTop: 8,
  },
  progressBarBackground: { 
    height: 8, 
    borderRadius: 4, 
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: { 
    height: '100%', 
    borderRadius: 4,
    minWidth: 8,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressPercentLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});