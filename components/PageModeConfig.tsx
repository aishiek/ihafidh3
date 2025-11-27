import { useThemeColor } from '@/utils/useThemeColor';
import React from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  const [vpp, setVpp] = React.useState<string>('');
  const [selectedPreset, setSelectedPreset] = React.useState<number | null>(null);

  React.useEffect(() => {
    setScope(initialScope);
    // Don't set a default value - leave it blank
    setVpp('');
    setSelectedPreset(null);
  }, [initialScope, initialVersesPerPage, visible]);

  const onPressStart = () => {
    const num = parseInt(String(vpp || ''), 10);
    if (Number.isNaN(num)) {
      Alert.alert('Invalid Input', 'Please enter a number.');
      return;
    }
    if (num < 3 || num > 20) {
      Alert.alert('Limit Reached', 'Verses can be chosen from 3 to 20 only');
      return;
    }
    onStart(scope, num);
  };

  const handlePresetPress = (preset: number) => {
    setVpp(String(preset));
    setSelectedPreset(preset);
  };

  const handleCustomInput = (text: string) => {
    setVpp(text.replace(/[^0-9]/g, ''));
    setSelectedPreset(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable
          style={styles.overlayPressable}
          onPress={() => {
            Keyboard.dismiss();
            // Don't call onCancel immediately - let user tap again if they really want to close
          }}
        >
          <Pressable style={[styles.sheet, { borderColor: primary }]} onPress={e => e.stopPropagation()}>
            <Text style={styles.title}>Configure Page Mode</Text>
            <Text style={styles.subtitle}>
              {initialScope === 'surah' ? 'Configure Surah reading' : 'Configure Juz reading'}
            </Text>

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Verses per page</Text>
            <View style={styles.presetRow}>
              {PRESETS.map(p => (
                <Pressable key={p} onPress={() => handlePresetPress(p)} style={[styles.preset, selectedPreset === p ? { backgroundColor: primary } : { backgroundColor: '#333' }]}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{p}</Text>
                </Pressable>
              ))}
              <View style={{ width: 8 }} />
              <View style={styles.customBox}>
                <TextInput
                  value={vpp}
                  onChangeText={handleCustomInput}
                  // Use default keyboard as requested by user
                  // keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                  }}
                  blurOnSubmit={true}
                  maxLength={3}
                  style={styles.customInput}
                  placeholder="Custom"
                  placeholderTextColor="#666"
                />
              </View>
            </View>
            <Text style={{ color: '#888', marginTop: 8, fontSize: 11 }}>{`Default from settings: ${initialVersesPerPage ?? 15} verses`}</Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <Pressable onPress={onCancel} style={[styles.outlineBtn, { borderColor: '#444' }]}>
                <Text style={{ color: '#fff', fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onPressStart} style={[styles.primaryBtn, { backgroundColor: primary }]}>
                <Text style={{ color: '#111', fontWeight: '700', fontSize: 14 }}>Start Reading</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  overlayPressable: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20 },
  sheet: { width: '100%', maxWidth: 340, padding: 20, borderRadius: 16, backgroundColor: '#111', borderWidth: 1 },
  title: { color: '#FFD700', fontSize: 18, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  subtitle: { color: '#ccc', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  sectionTitle: { color: '#aaa', fontSize: 13, marginBottom: 8 },
  presetRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  preset: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  customBox: { borderRadius: 8, backgroundColor: '#222', padding: 2, borderWidth: 1, borderColor: '#333' },
  customInput: { width: 80, height: 40, color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: '600' },
  outlineBtn: { flex: 1, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  primaryBtn: { flex: 1, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
});
