import { AVAILABLE_LAYOUTS } from '@/types/layout';
import { CheckCircle, Circle, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LayoutService from '../services/layoutService';

interface LayoutSelectorProps {
  visible: boolean;
  onClose: () => void;
  onLayoutSelected: (layoutId: string) => void;
}

export const LayoutSelector: React.FC<LayoutSelectorProps> = ({ visible, onClose, onLayoutSelected }) => {
  const [activeLayoutId, setActiveLayoutId] = useState<string>('madina_15');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) loadActiveLayout();
  }, [visible]);

  const loadActiveLayout = async () => {
    const layoutId = await LayoutService.getActiveLayoutId();
    setActiveLayoutId(layoutId);
  };

  const handleSelectLayout = async (layoutId: string) => {
    setLoading(true);
    try {
      const success = await LayoutService.setActiveLayout(layoutId);
      if (success) {
        setActiveLayoutId(layoutId);
        onLayoutSelected(layoutId);
        onClose();
      } else {
        alert('Failed to switch layout. Ensure it is downloaded.');
      }
    } catch (error) {
      console.error('Error selecting layout:', error);
      alert('Error switching layout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Mushaf Layout</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}><X size={24} color="#6b7280" /></TouchableOpacity>
        </View>
        <ScrollView style={styles.content}>
          {AVAILABLE_LAYOUTS.map((layout) => (
            <TouchableOpacity
              key={layout.layout_id}
              style={[styles.layoutCard, activeLayoutId === layout.layout_id && styles.layoutCardActive, !layout.downloaded && styles.layoutCardDisabled]}
              onPress={() => handleSelectLayout(layout.layout_id)}
              disabled={!layout.downloaded || loading}
            >
              <View style={styles.layoutCardContent}>
                <View style={styles.layoutInfo}>
                  <View style={styles.layoutHeader}>
                    <Text style={styles.layoutName}>{layout.layout_name}</Text>
                    {activeLayoutId === layout.layout_id ? <CheckCircle size={20} color="#10b981" /> : <Circle size={20} color="#d1d5db" />}
                  </View>
                  <Text style={styles.layoutDesc}>{layout.layout_name_ar}</Text>
                  <View style={styles.layoutMeta}>
                    <Text style={styles.metaItem}>📄 {layout.total_pages} pages</Text>
                    <Text style={styles.metaItem}>📏 {layout.lines_per_page} lines</Text>
                    <Text style={styles.metaItem}>🗣️ {layout.narration}</Text>
                  </View>
                  <Text style={styles.layoutRegion}>📍 {layout.region}</Text>
                  <Text style={styles.layoutDescription}>{layout.description}</Text>
                </View>
                {loading && activeLayoutId === layout.layout_id ? <ActivityIndicator color="#3b82f6" /> : !layout.downloaded ? (
                  <View style={styles.downloadNeeded}><Text style={styles.downloadText}>⬇️ Download needed</Text><Text style={styles.downloadSize}>({layout.fileSize}MB)</Text></View>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  closeButton: { padding: 8 },
  content: { flex: 1, padding: 16 },
  layoutCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#e5e7eb' },
  layoutCardActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  layoutCardDisabled: { opacity: 0.6 },
  layoutCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  layoutInfo: { flex: 1 },
  layoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  layoutName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  layoutDesc: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  layoutMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  metaItem: { fontSize: 12, color: '#374151' },
  layoutRegion: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 4 },
  layoutDescription: { fontSize: 11, color: '#6b7280', fontStyle: 'italic' },
  downloadNeeded: { alignItems: 'flex-end' },
  downloadText: { fontSize: 12, fontWeight: '600', color: '#f59e0b' },
  downloadSize: { fontSize: 11, color: '#9ca3af' },
});
