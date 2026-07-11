import { logScreenView } from '@/utils/analyticsHelper';
import { surahsData } from '@/data/surahs';
import { useThemeColor } from '@/utils/useThemeColor';
import { Check, Search, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (params: { surahId: number; startVerse: number; endVerse: number; note?: string }) => void;
};

export default function SurahRangePicker({
  visible, onClose, onConfirm }: Props) {
  React.useEffect(() => {
    if (visible) {
      logScreenView('modal_surahrangepicker').catch(() => {});
    }
  }, [visible]);
  const { primary } = useThemeColor();
  const [search, setSearch] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [rangeType, setRangeType] = useState<'full' | 'partial'>('full');
  const [startVerse, setStartVerse] = useState<string>('1');
  const [endVerse, setEndVerse] = useState<string>('1');
  const [note, setNote] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return surahsData;
    return surahsData.filter(
      (s) =>
        `${s.id}`.includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.englishName.toLowerCase().includes(q)
    );
  }, [search]);

  const selectedSurahInfo = selectedSurah ? surahsData.find((s) => s.id === selectedSurah) : undefined;

  const resetState = () => {
    setSearch('');
    setSelectedSurah(null);
    setRangeType('full');
    setStartVerse('1');
    setEndVerse('1');
    setNote('');
  };

  const handleConfirm = () => {
    if (!selectedSurahInfo) return;
    const total = selectedSurahInfo.versesCount;
    let s = 1;
    let e = total;
    if (rangeType === 'partial') {
      const sv = Math.max(1, Math.min(total, parseInt(startVerse || '1', 10)));
      const ev = Math.max(1, Math.min(total, parseInt(endVerse || `${total}`, 10)));
      s = Math.min(sv, ev);
      e = Math.max(sv, ev);
    }
    onConfirm({ surahId: selectedSurahInfo.id, startVerse: s, endVerse: e, note: note.trim() || undefined });
    resetState();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pick Surah and Range</Text>
          <Pressable onPress={() => { resetState(); onClose(); }} style={styles.closeBtn}>
            <X size={22} color="#e2e8f0" />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Search size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Surah Name or number"
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <X size={18} color="#94a3b8" />
            </Pressable>
          )}
        </View>

        {!selectedSurah && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {filtered.map((surah) => (
              <TouchableOpacity key={surah.id} style={styles.item} onPress={() => setSelectedSurah(surah.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={[styles.itemNumber, { color: primary }]}>{surah.id}</Text>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.itemName}>{surah.name}</Text>
                    <Text style={styles.itemEn}>{surah.englishName}</Text>
                  </View>
                  <Text style={styles.itemMeta}>{surah.versesCount} ayat</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {!!selectedSurah && selectedSurahInfo && (
          <View style={{ flex: 1, padding: 16 }}>
            <Text style={styles.selectedLabel}>
              {selectedSurahInfo.id}. {selectedSurahInfo.name} — {selectedSurahInfo.englishName}
            </Text>
            <View style={styles.rangeToggleRow}>
              {(['full', 'partial'] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setRangeType(v)}
                  style={({ pressed }) => [
                    styles.toggleBtn, 
                    rangeType === v && styles.toggleBtnActive,
                    pressed && rangeType !== v && { backgroundColor: '#333333' }
                  ]}
                >
                  <Text style={[styles.toggleBtnText, rangeType === v && styles.toggleBtnTextActive]}>
                    {v === 'full' ? 'Full Surah' : 'Verse Range'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {rangeType === 'partial' && (
              <View style={styles.rangeInputs}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Start</Text>
                  <TextInput
                    style={styles.numberInput}
                    keyboardType="numeric"
                    value={startVerse}
                    onChangeText={setStartVerse}
                    placeholder="1"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>End</Text>
                  <TextInput
                    style={styles.numberInput}
                    keyboardType="numeric"
                    value={endVerse}
                    onChangeText={setEndVerse}
                    placeholder={`${selectedSurahInfo.versesCount}`}
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a short note..."
                placeholderTextColor="#64748b"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.footerRow}>
              <Pressable 
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && { backgroundColor: '#333333' }
                ]} 
                onPress={() => setSelectedSurah(null)}
              >
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
              <Pressable 
                style={({ pressed }) => [
                  styles.confirmBtn,
                  pressed && { backgroundColor: '#333333' }
                ]} 
                onPress={handleConfirm}
              >
                <Check size={18} color="#ffffff" />
                <Text style={styles.confirmText}>Add to Plan</Text>
              </Pressable>
            </View>

            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>💡 How to Add Multiple Surahs</Text>
              <Text style={styles.tipText}>
                Select a surah, tap "Add to Plan", then tap "Back" to choose another. 
                Repeat for each surah you want to add. Close the picker using the X button at the top when done.
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  title: { color: '#e2e8f0', fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  searchInput: { flex: 1, color: '#e5e7eb', paddingVertical: 10 },
  listFrame: { maxHeight: 360, marginHorizontal: 12, marginBottom: 8, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.35)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.15)' },
  item: {
    backgroundColor: 'rgba(2,6,23,0.4)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)'
  },
  itemNumber: { fontWeight: '700', width: 26 },
  itemName: { color: '#e5e7eb', fontWeight: '600' },
  itemEn: { color: '#94a3b8', fontSize: 12 },
  itemMeta: { color: '#94a3b8', fontSize: 12 },
  selectedLabel: { color: '#e2e8f0', fontWeight: '700', marginBottom: 8 },
  rangeToggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { backgroundColor: '#000000', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#8b5cf6' },
  toggleBtnActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  toggleBtnText: { color: '#ffffff', fontWeight: '600' },
  toggleBtnTextActive: { color: '#ffffff', fontWeight: '600' },
  rangeInputs: { flexDirection: 'row', gap: 12, marginTop: 12 },
  inputCol: { flex: 1 },
  inputLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 6 },
  numberInput: { backgroundColor: '#0f172a', color: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#1f2937' },
  noteInput: { backgroundColor: '#0f172a', color: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#1f2937' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  backBtn: { paddingVertical: 9, paddingHorizontal: 16, backgroundColor: '#000000', borderRadius: 8, borderWidth: 1, borderColor: '#8b5cf6' },
  backBtnText: { color: '#ffffff', fontWeight: '600' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#000000', borderWidth: 1, borderColor: '#8b5cf6' },
  confirmText: { color: '#ffffff', fontWeight: '600' },
  tipBox: { marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: 'rgba(148,163,184,0.12)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.25)' },
  tipTitle: { color: '#e2e8f0', fontWeight: '700', marginBottom: 6, fontSize: 12 },
  tipText: { color: '#cbd5e1', fontSize: 12, lineHeight: 18 },
});
