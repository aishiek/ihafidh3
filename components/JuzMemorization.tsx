import JUZ_MAPPING from '@/data/juzMapping';
import { surahsData } from '@/data/surahs';
import { useProgressStore } from '@/store/progressStore';
import { calculateJuzProgress, getJuzVerseRange } from '@/utils/juzCalculator';
import { useCustomColors } from '@/utils/themeUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function getSurahIdByName(name: string): number | null {
  const surah = surahsData.find(s => s.name === name || s.englishName === name || s.arabicName === name);
  return surah ? surah.id : null;
}

// Remove old functions - now using juzCalculator utility

export default function JuzMemorization() {
  const { primary } = useThemeColor();
  const colors = useCustomColors();
  const { memorizedVerses, markVerseAsMemorized, unmarkVerseAsMemorized, updateMemorizedVerses, updateBadges } = useProgressStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalText, setModalText] = useState('');
  const [modalProgress, setModalProgress] = useState(0);
  const [modalTotal, setModalTotal] = useState(0);

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
    setModalText(enable ? `Marking Juz ${juz} memorized` : `Unmarking Juz ${juz}`);
    setModalVisible(true);
    setModalProgress(0);
    try {
      const range = getJuzVerseRange(juz);
      if (!range.totalVerses) {
        setModalVisible(false);
        return;
      }
      const startId = Math.max(1, range.startVerseId);
      const endId = Math.max(startId, range.endVerseId);

      // Build the list of verse IDs for this Juz
      const juzIds: number[] = [];
      for (let id = startId; id <= endId; id++) juzIds.push(id);

      // Determine which IDs actually need changing
      const idsToApply = enable
        ? juzIds.filter((id) => !memorizedSet.has(id))
        : juzIds.filter((id) => memorizedSet.has(id));

      if (idsToApply.length === 0) {
        setModalVisible(false);
        setModalProgress(0);
        setModalTotal(0);
        return;
      }

      // Simulate progress in ~10 smooth steps over ~1 second
      setModalTotal(idsToApply.length);
      const total = idsToApply.length;
      const steps = 10;
      const increment = Math.max(1, Math.ceil(total / steps));
      let timer: any = null;
      timer = setInterval(() => {
        setModalProgress((prev) => {
          const next = Math.min(total, prev + increment);
          if (next >= total && timer) {
            clearInterval(timer);
            timer = null;
          }
          return next;
        });
      }, 100);

      // Schedule heavy work slightly after modal render; jump to 100% just before applying
      setTimeout(() => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        setModalProgress(total);

        // Apply bulk change in a single store write
        const newSet = new Set(memorizedSet);
        if (enable) {
          idsToApply.forEach((id) => newSet.add(id));
        } else {
          idsToApply.forEach((id) => newSet.delete(id));
        }
        updateMemorizedVerses(Array.from(newSet));
        setTimeout(() => updateBadges(), 0);

        // Let user see 100% for a brief moment before closing
        setTimeout(() => {
          setModalVisible(false);
          setModalProgress(0);
          setModalTotal(0);
        }, 300);
      }, 50);
    } catch (e) {
      // On error, ensure modal is closed cleanly
      setModalVisible(false);
      setModalProgress(0);
      setModalTotal(0);
    }
  }, [memorizedSet, updateMemorizedVerses, updateBadges]);

  const renderItem = ({ item: juz }: { item: number }) => {
    const info = JUZ_MAPPING[juz];
    const { progress, total, memorized } = juzProgressData[juz] || { progress: 0, total: 0, memorized: 0 };
    const enabled = total > 0 && memorized === total;
    const startText = info.start.replace(':', ':');
    const endText = info.end.replace(':', ':');

    return (
      <View style={[styles.card, { backgroundColor: '#333333', borderColor: '#555555' }]}> 
        {/* Action Button - Top Right Corner */}
        <TouchableOpacity
          style={[
            styles.actionButtonTopRight,
            {
              backgroundColor: enabled ? '#4CAF50' : primary,
              borderColor: enabled ? '#4CAF50' : primary,
            }
          ]}
          onPress={() => bulkToggleJuz(juz, !enabled)}
        >
          <Text style={[
            styles.actionText,
            { color: enabled ? '#000000' : '#ffffff' }
          ]}>
            {enabled ? 'Unmark ❌' : 'Mark Memorized'}
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
          <Text style={[styles.progressText, { color: '#aaaaaa' }]}>
            {memorized}/{total} • {progress}%
          </Text>
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
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: '#333333' }]}> 
            <ActivityIndicator color={primary} style={{ marginBottom: 12 }} />
            <Text style={{ color: '#ffffff', fontWeight: '600', marginBottom: 16 }}>{modalText}</Text>
            
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarBackground, { backgroundColor: '#555555' }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      backgroundColor: primary,
                      width: `${modalTotal > 0 ? Math.max(5, Math.round((modalProgress / modalTotal) * 100)) : 5}%`
                    }
                  ]} 
                />
              </View>
            </View>
            <Text style={{ color: '#aaa', marginTop: 8, textAlign: 'center' }}>
              {modalTotal > 0 ? `${modalProgress} / ${modalTotal}` : ''}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  info: { flex: 1, marginLeft: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 14, marginTop: 2 },
  progressText: { fontSize: 12, marginTop: 2 },
  actionButtonTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { padding: 20, borderRadius: 12 },
  progressBarContainer: { marginTop: 8 },
  progressBarBackground: { 
    height: 6, 
    borderRadius: 3, 
    overflow: 'hidden' 
  },
  progressBarFill: { 
    height: '100%', 
    borderRadius: 3 
  },
});


