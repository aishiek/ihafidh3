import { useThemeColor } from '@/utils/useThemeColor';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface Props {
  visible: boolean;
  initialScope: 'surah' | 'juz';
  initialVersesPerPage: number;
  onCancel: () => void;
  onStart: (scope: 'surah' | 'juz', versesPerPage: number) => void;
}

const PRESETS = [3, 5, 10, 15];

export default function PageModeConfig({ visible, initialScope, initialVersesPerPage, onCancel, onStart }: Props) {
  const { primary } = useThemeColor();
  const [scope, setScope] = React.useState<'surah' | 'juz'>(initialScope);
  const [vpp, setVpp] = React.useState<string>(String(initialVersesPerPage ?? 15));
  const [showError, setShowError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setScope(initialScope);
    setVpp(String(initialVersesPerPage ?? 15));
    setShowError(null);
  }, [initialScope, initialVersesPerPage, visible]);

  const onPressStart = () => {
    const num = parseInt(String(vpp || ''), 10);
    if (Number.isNaN(num)) return setShowError('Enter a number');
    if (num < 3 || num > 20) return setShowError('Enter a value between 3 and 20');
    setShowError(null);
    onStart(scope, num);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { borderColor: primary }]}> 
          <Text style={styles.title}>Configure Page Mode</Text>
          <Text style={styles.subtitle}>Choose how you want to navigate</Text>

          <Text style={styles.sectionTitle}>Select Mode</Text>
          <View style={styles.modeRow}>
            <Pressable onPress={() => setScope('surah')} style={[styles.modeCard, scope === 'surah' ? { borderColor: primary, borderWidth: 2 } : { borderColor: '#333' }]}> 
              <Text style={styles.modeCardLabel}>By Surah</Text>
              <Text style={styles.modeCardDesc}>Navigate by chapters</Text>
            </Pressable>

            <Pressable onPress={() => setScope('juz')} style={[styles.modeCard, scope === 'juz' ? { borderColor: primary, borderWidth: 2 } : { borderColor: '#333' }]}> 
              <Text style={styles.modeCardLabel}>By Juz</Text>
              <Text style={styles.modeCardDesc}>Navigate by parts</Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Verses per page</Text>
          <View style={styles.presetRow}>
            {PRESETS.map(p => (
              <Pressable key={p} onPress={() => setVpp(String(p))} style={[styles.preset, String(p) === vpp ? { backgroundColor: primary } : { backgroundColor: '#333' }]}> 
                <Text style={{ color: '#fff', fontWeight: '700' }}>{p}</Text>
              </Pressable>
            ))}
            <View style={{ width: 8 }} />
            <View style={styles.customBox}>
              <TextInput value={vpp} onChangeText={t => setVpp(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" style={styles.customInput} placeholder="Custom" placeholderTextColor="#888" />
            </View>
          </View>
          <Text style={{ color: '#888', marginTop: 6, fontSize: 13 }}>{`Default from settings: ${initialVersesPerPage ?? 15} verses`}</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
            <Pressable onPress={onCancel} style={[styles.outlineBtn, { borderColor: '#444' }]}>
              <Text style={{ color: '#fff' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onPressStart} style={[styles.primaryBtn, { backgroundColor: primary }]}>
              <Text style={{ color: '#111', fontWeight: '700' }}>Start Reading</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { width: '100%', padding: 18, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: '#111', borderWidth: 1 },
  title: { color: '#FFD700', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#ccc', marginBottom: 8 },
  sectionTitle: { color: '#aaa', marginTop: 12, marginBottom: 8 },
  modeRow: { flexDirection: 'row', gap: 12 },
  modeCard: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#222' },
  modeCardLabel: { color: '#fff', fontWeight: '700', marginBottom: 6 },
  modeCardDesc: { color: '#bbb', fontSize: 12 },
  presetRow: { flexDirection: 'row', alignItems: 'center' },
  preset: { padding: 12, borderRadius: 8, minWidth: 48, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  customBox: { borderRadius: 8, backgroundColor: '#222', padding: 6, minWidth: 80, alignItems: 'center' },
  customInput: { width: 64, height: 36, color: '#fff', textAlign: 'center' },
  outlineBtn: { flex: 1, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  primaryBtn: { flex: 1, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
});
