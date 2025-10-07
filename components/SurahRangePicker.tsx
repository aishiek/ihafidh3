import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { surahsData } from '@/data/surahs';
import { useThemeColor } from '@/utils/useThemeColor';
import { Check, Search, X } from 'lucide-react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (params: { surahId: number; startVerse: number; endVerse: number; note?: string }) => void;
};

export default function SurahRangePicker({ visible, onClose, onConfirm }: Props) {
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
            <X size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Search size={18} color="#888" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Surah Name or number"
            placeholderTextColor="#666"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <X size={18} color="#888" />
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
                <TouchableOpacity
                  key={v}
                  onPress={() => setRangeType(v)}
                  style={[styles.toggleBtn, rangeType === v && { backgroundColor: primary }]}
                >
                  <Text style={[styles.toggleBtnText, rangeType === v && { color: '#000' }]}>
                    {v === 'full' ? 'Full Surah' : 'Verse Range'}
                  </Text>
                </TouchableOpacity>
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
                    placeholderTextColor="#666"
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
                    placeholderTextColor="#666"
                  />
                </View>
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a short note..."
                placeholderTextColor="#666"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedSurah(null)}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: primary }]} onPress={handleConfirm}>
                <Check size={18} color="#fff" />
                <Text style={styles.confirmText}>Add to Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  closeBtn: { padding: 8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10 },
  item: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  itemNumber: { fontWeight: '700', width: 26 },
  itemName: { color: '#fff', fontWeight: '600' },
  itemEn: { color: '#aaa', fontSize: 12 },
  itemMeta: { color: '#888', fontSize: 12 },
  selectedLabel: { color: '#fff', fontWeight: '600', marginBottom: 8 },
  rangeToggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { backgroundColor: '#2a2a2a', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  toggleBtnText: { color: '#fff', fontWeight: '600' },
  rangeInputs: { flexDirection: 'row', gap: 12, marginTop: 12 },
  inputCol: { flex: 1 },
  inputLabel: { color: '#aaa', fontSize: 12, marginBottom: 6 },
  numberInput: { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  noteInput: { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, textAlignVertical: 'top' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#2a2a2a', borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  confirmText: { color: '#fff', fontWeight: '700' },
});
