import { useThemeColor } from '@/utils/useThemeColor';
import React from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  currentValue: number;
  onSelect: (v: number) => void;
  onClose: () => void;
}

// Preset options required by product: 3, 5, 10, 15 + custom
const OPTIONS = [3, 5, 10, 15];

export default function PageSettings({ visible, currentValue, onSelect, onClose }: Props) {
  const { primary } = useThemeColor();
  const [customValue, setCustomValue] = React.useState<string>('');
  const [showCustom, setShowCustom] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { borderColor: primary }]}>
          <Text style={styles.title}>Verses per page</Text>
          <View style={styles.optionsRow}>
            {OPTIONS.map((o) => (
              <TouchableOpacity
                key={o}
                onPress={() => {
                  setShowCustom(false);
                  setError(null);
                  onSelect(o);
                }}
                style={[
                  styles.option,
                  o === currentValue ? { backgroundColor: primary } : { backgroundColor: '#333' },
                ]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{o}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => {
                setShowCustom(true);
                setError(null);
                setCustomValue(String(currentValue >= 3 && currentValue <= 20 ? currentValue : ''));
              }}
              style={[styles.option, showCustom ? { backgroundColor: primary } : { backgroundColor: '#333' }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Custom</Text>
            </TouchableOpacity>
          </View>

          {showCustom && (
            <View style={{ marginTop: 10, alignItems: 'center' }}>
              <Text style={{ color: '#aaa', marginBottom: 6, fontSize: 13 }}>Enter a number between 3 and 20</Text>
              <TextInput
                keyboardType="numeric"
                placeholder="e.g., 3"
                placeholderTextColor="#888"
                value={customValue}
                onChangeText={(v) => setCustomValue(v.replace(/[^0-9]/g, ''))}
                style={{ width: 120, textAlign: 'center', color: '#fff', paddingVertical: 6, backgroundColor: '#333', borderRadius: 8 }}
              />
              {error && <Text style={{ color: '#ff5252', marginTop: 6 }}>{error}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowCustom(false);
                    setError(null);
                  }}
                  style={[styles.smallButton, { backgroundColor: '#555' }]}
                >
                  <Text style={{ color: '#fff' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const num = parseInt(customValue || '', 10);
                    if (Number.isNaN(num)) { setError('Enter a valid number'); return; }
                    if (num < 3 || num > 20) { setError('Value must be between 3 and 20'); return; }
                    setError(null);
                    setShowCustom(false);
                    onSelect(num);
                  }}
                  style={[styles.smallButton, { backgroundColor: primary }]}
                >
                  <Text style={{ color: '#111', fontWeight: '700' }}>Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={[styles.doneButton, { backgroundColor: primary }]}>
            <Text style={{ color: '#111', fontWeight: '700' }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '88%', padding: 18, borderRadius: 12, backgroundColor: '#222', borderWidth: 1 },
  title: { color: '#FFD700', fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  option: { padding: 12, borderRadius: 10, margin: 6, minWidth: 48, alignItems: 'center' },
  doneButton: { marginTop: 12, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
});
