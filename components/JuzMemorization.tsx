import JUZ_MAPPING from '@/data/juzMapping';
import { surahsData } from '@/data/surahs';
import { useProgressStore } from '@/store/progressStore';
import { calculateJuzProgress, getJuzVerseRange } from '@/utils/juzCalculator';
import { useCustomColors } from '@/utils/themeUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import React, { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BulkProgressModal from '@/components/BulkProgressModal';
import { useBulkProgressModal } from '@/hooks/useBulkProgressModal';

function getSurahIdByName(name: string): number | null {
  const surah = surahsData.find(s => s.name === name || s.englishName === name || s.arabicName === name);
  return surah ? surah.id : null;
}

type Props = {
  onOpenJuz: (juz: number) => void;
};

export default function JuzMemorization({ onOpenJuz }: Props) {
  const { primary } = useThemeColor();
  const colors = useCustomColors();
  const { memorizedVerses, bulkMarkVersesMemorized, updateBadges } = useProgressStore();

  const {
    modalVisible,
    modalText,
    modalProgress,
    modalTotal,
    isProcessing,
    startBulkOperation,
    animateProgress,
    closeModal,
    progressTimerRef,
  } = useBulkProgressModal();

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

    try {
      const range = getJuzVerseRange(juz);
      if (!range.totalVerses) return;

      const startId = Math.max(1, range.startVerseId);
      const endId = Math.max(startId, range.endVerseId);

      const juzIds: number[] = [];
      for (let id = startId; id <= endId; id++) juzIds.push(id);

      const idsToApply = enable ? juzIds.filter(id => !memorizedSet.has(id)) : juzIds.filter(id => memorizedSet.has(id));
      if (idsToApply.length === 0) return;

      startBulkOperation(enable ? `Marking Juz ${juz} as memorized...` : `Unmarking Juz ${juz}...`, idsToApply.length);

      // Animate progress via the hook
      let currentProgress = 0;
      const animationDuration = 1200;
      const updateInterval = 30;
      const steps = animationDuration / updateInterval;
      const increment = idsToApply.length / steps;

      progressTimerRef.current = setInterval(() => {
        currentProgress += increment;
        if (currentProgress >= idsToApply.length) {
          currentProgress = idsToApply.length;
          if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
        }
        animateProgress(Math.floor(currentProgress), idsToApply.length);
      }, updateInterval);

      await new Promise(resolve => setTimeout(resolve, 100));
      await bulkMarkVersesMemorized(idsToApply, enable);
      await new Promise(resolve => setTimeout(resolve, animationDuration + 100));

      if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
      animateProgress(idsToApply.length, idsToApply.length);
      updateBadges();
      await new Promise(resolve => setTimeout(resolve, 400));
      closeModal();
    } catch (e) {
      console.error('Error toggling Juz:', e);
      if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
      closeModal();
    }
  }, [memorizedSet, bulkMarkVersesMemorized, updateBadges, startBulkOperation, animateProgress, closeModal, progressTimerRef]);

  const renderItem = ({ item: juz }: { item: number }) => {
    const info = JUZ_MAPPING[juz];
    const { progress, total, memorized } = juzProgressData[juz] || { progress: 0, total: 0, memorized: 0 };
    const enabled = total > 0 && memorized === total;
    const startText = info.start.replace(':', ':');
    const endText = info.end.replace(':', ':');
    const inProgress = memorized > 0 && memorized < total;

    return (
      <TouchableOpacity
        onPress={() => onOpenJuz(juz)}
        style={[styles.card, { backgroundColor: '#2d2d2d', borderColor: 'rgba(59,130,246,0.08)' }]}
        activeOpacity={0.7}
        disabled={isProcessing}
      >
        {/* Top-right action button (Complete) */}
        {/* Action button (top-right) - toggles mark/unmark */}
        <TouchableOpacity
          style={[
            styles.completeBtn,
            {
              opacity: isProcessing ? 0.6 : 1,
              backgroundColor: enabled ? '#4CAF50' : primary,
            }
          ]}
          onPress={() => bulkToggleJuz(juz, !enabled)}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          <Text style={styles.completeBtnText}>{enabled ? '✓ Memorized' : inProgress ? 'Complete' : 'Mark All'}</Text>
        </TouchableOpacity>

        <View style={styles.leftContent}>
          <View style={[styles.juzLabel, { backgroundColor: primary }]}><Text style={styles.juzLabelText}>Juz {juz}</Text></View>

          {(() => {
            const [startSurah, startVerse] = (info.start || '').split(':');
            const [endSurah, endVerse] = (info.end || '').split(':');
            const showEndSurahName = (startSurah || '') !== (endSurah || '');
            return (
              <View style={styles.verseRange}>
                <View style={styles.verseGroup}>
                  {/* Always show start surah name */}
                  <Text style={styles.surahName}>{startSurah}</Text>
                  <Text style={styles.verseNumber}>{`:${startVerse || ''}`}</Text>
                  <View style={styles.startIndicator} />
                </View>

                <Text style={styles.arrow}>→</Text>

                <View style={styles.verseGroup}>
                  {showEndSurahName && <Text style={styles.surahName}>{endSurah}</Text>}
                  <Text style={styles.verseNumber}>{`:${endVerse || ''}`}</Text>
                  <View style={styles.endIndicator} />
                </View>
              </View>
            );
          })()}

          <View style={styles.statsRow}>
            <Text style={styles.verseCount}>{`📖 ${memorized}/${total} verses`}</Text>
            <Text style={[styles.percentage, { color: primary }]}>{`${progress}%`}</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${Math.max(2, progress)}%`, backgroundColor: primary }]} />
          </View>
        </View>
  </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {/* Juz verses are handled by parent via onOpenJuz */}
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

      <BulkProgressModal
        visible={modalVisible}
        text={modalText}
        progress={modalProgress}
        total={modalTotal}
        onClose={closeModal}
      />
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
  leftContent: {
    flex: 1,
  },
  completeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    elevation: 4,
  },
  completeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  juzLabel: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    elevation: 2,
  },
  juzLabelText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  verseRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  verseGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  startIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginLeft: 6,
  },
  endIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginLeft: 6,
  },
  surahName: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  verseNumber: {
    color: '#9ca3af',
    fontWeight: '500',
  },
  arrow: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: '300',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verseCount: {
    color: '#9ca3af',
    fontSize: 13,
  },
  percentage: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#404040',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
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