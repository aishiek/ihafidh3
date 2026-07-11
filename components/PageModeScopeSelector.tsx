import { logScreenView } from '@/utils/analyticsHelper';
import { useThemeColor } from '@/utils/useThemeColor';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  value: 'surah' | 'juz';
  onSelect: (v: 'surah' | 'juz') => void;
  onClose: () => void;
}

export default function PageModeScopeSelector({
  visible, value, onSelect, onClose }: Props) {
  React.useEffect(() => {
    if (visible) {
      logScreenView('modal_pagemodescopeselector').catch(() => {});
    }
  }, [visible]);
  const { primary } = useThemeColor();

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { borderColor: primary }]}>
          <Text style={styles.title}>Page mode scope</Text>
          <Text style={styles.subtitle}>Choose whether Page mode should paginate by Surah or by Juz</Text>

          <View style={styles.optionsRow}>
            <Pressable
              onPress={() => onSelect('surah')}
              style={[styles.option, value === 'surah' ? { backgroundColor: primary } : { backgroundColor: '#333' }]}
            >
              <Text style={styles.optionText}>Surah</Text>
            </Pressable>

            <Pressable
              onPress={() => onSelect('juz')}
              style={[styles.option, value === 'juz' ? { backgroundColor: primary } : { backgroundColor: '#333' }]}
            >
              <Text style={styles.optionText}>Juz</Text>
            </Pressable>
          </View>

          {/* Removed Done button - user can tap outside to close or just select an option */}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: '#222', borderRadius: 12, padding: 20, borderWidth: 1 },
  title: { color: '#FFD700', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#ccc', fontSize: 13, marginBottom: 12 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  option: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionText: { color: '#fff', fontWeight: '700' },
  doneButton: { alignSelf: 'stretch', marginTop: 8, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
});
