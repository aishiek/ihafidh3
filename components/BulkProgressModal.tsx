import { logScreenView } from '@/utils/analyticsHelper';
import { useThemeColor } from '@/utils/useThemeColor';
import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

interface BulkProgressModalProps {
  visible: boolean;
  text: string;
  progress: number; // current progress (0..total)
  total: number;
  onClose?: () => void;
}

export default function BulkProgressModal({
  visible, text, progress, total, onClose }: BulkProgressModalProps) {
React.useEffect(() => {
    if (visible) {
      logScreenView('modal_bulkprogressmodal').catch(() => {});
    }
  }, [visible]);
 
  const { primary } = useThemeColor();
  const percent = useMemo(() => (total > 0 ? Math.round((progress / total) * 100) : 0), [progress, total]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: '#333333' }]}> 
          <ActivityIndicator size="large" color={primary} style={{ marginBottom: 16 }} />
          <Text style={[styles.modalTitle, { color: '#ffffff' }]}>{text}</Text>

          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarBackground, { backgroundColor: '#555555' }]}> 
              <View style={[styles.progressBarFill, { backgroundColor: primary, width: total > 0 ? `${percent}%` : '0%' }]} />
            </View>
          </View>

          <View style={styles.progressStats}>
            <Text style={[styles.progressLabel, { color: '#aaaaaa' }]}>{progress} / {total} verses</Text>
            <Text style={[styles.progressPercentLabel, { color: primary }]}>{total > 0 ? `${percent}%` : '0%'}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  progressBarContainer: { width: '100%', marginTop: 8 },
  progressBarBackground: { height: 8, borderRadius: 4, overflow: 'hidden', width: '100%' },
  progressBarFill: { height: '100%', borderRadius: 4, minWidth: 8 },
  progressStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 12 },
  progressLabel: { fontSize: 14, fontWeight: '500' },
  progressPercentLabel: { fontSize: 14, fontWeight: '700' },
});
