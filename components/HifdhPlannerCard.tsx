import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '@/utils/useThemeColor';
import { usePlannerStore } from '@/store/plannerStore';
import SurahRangePicker from './SurahRangePicker';
import { useProgressStore } from '@/store/progressStore';
import { surahsData } from '@/data/surahs';
import { Plus, Trash2 } from 'lucide-react-native';

type DateItem = { key: string; label: string; isToday: boolean };

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function prettyLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.toLocaleString('default', { month: 'short' });
  return `${d.getDate()} ${month}`;
}

function getGlobalStartIdForSurah(surahId: number): number {
  let total = 0;
  for (let i = 1; i < surahId; i++) {
    const s = surahsData.find((x) => x.id === i);
    if (s) total += s.versesCount;
  }
  return total + 1; // 1-based start
}

function toVerseId(surahId: number, verseNumber: number): number {
  return getGlobalStartIdForSurah(surahId) + (verseNumber - 1);
}

export default function HifdhPlannerCard() {
  const { primary } = useThemeColor();
  const plansByDate = usePlannerStore((s) => s.plansByDate);
  const addPlan = usePlannerStore((s) => s.addPlan);
  const removePlan = usePlannerStore((s) => s.removePlan);

  const memorizedVerses = useProgressStore((s) => s.memorizedVerses);
  const revised = useProgressStore((s) => s.revisedVerses);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  const dates: DateItem[] = useMemo(() => {
    const out: DateItem[] = [];
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = formatDate(d);
      out.push({ key, label: prettyLabel(key), isToday: i === 0 });
    }
    return out;
  }, []);

  const entries = plansByDate[selectedDate] || [];

  const computeEntryStatus = (surahId: number, startVerse: number, endVerse: number) => {
    const startId = toVerseId(surahId, startVerse);
    const endId = toVerseId(surahId, endVerse);
    const total = endId - startId + 1;

    let completed = 0;
    for (let id = startId; id <= endId; id++) {
      const mem = memorizedVerses.includes(id);
      const rev = revised.some((r) => r.verseId === id);
      if (mem && rev) completed++;
    }
    return { completed, total, done: completed === total };
  };

  const overall = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (const p of entries) {
      const s = computeEntryStatus(p.surahId, p.startVerse, p.endVerse);
      total += s.total;
      completed += s.completed;
    }
    return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
  }, [entries, memorizedVerses, revised]);

  return (
    <View style={styles.card}>
      <Text style={styles.header}>Hifdh Planner</Text>

      <FlatList
        data={dates}
        keyExtractor={(i) => i.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        style={{ marginVertical: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedDate(item.key)}
            style={[styles.dateChip, selectedDate === item.key && { backgroundColor: primary }]}
          >
            <Text style={[styles.dateChipText, selectedDate === item.key && { color: '#000' }]}>{item.label}</Text>
            {item.isToday && <Text style={[styles.dateToday]}>today</Text>}
          </TouchableOpacity>
        )}
      />

      <View style={styles.overallRow}>
        <Text style={styles.overallText}>
          {overall.completed} / {overall.total} verses completed
        </Text>
        <Text style={styles.overallPct}>{overall.percent}%</Text>
      </View>

      <View style={{ marginTop: 8 }}>
        {entries.length === 0 ? (
          <Text style={styles.emptyText}>No plans for this day. Add one below.</Text>
        ) : (
          entries.map((p) => {
            const s = computeEntryStatus(p.surahId, p.startVerse, p.endVerse);
            const surah = surahsData.find((x) => x.id === p.surahId);
            return (
              <View key={p.id} style={[styles.entryRow, s.done && { borderColor: '#4CAF50' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryTitle}>
                    {surah?.name} ({surah?.englishName})
                  </Text>
                  <Text style={styles.entryMeta}>
                    {p.startVerse} — {p.endVerse} • {s.completed}/{s.total}
                  </Text>
                  {!!p.note && <Text style={styles.entryNote}>{p.note}</Text>}
                </View>
                <TouchableOpacity
                  onPress={() => removePlan(selectedDate, p.id)}
                  style={styles.delBtn}
                >
                  <Trash2 size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <Pressable style={[styles.addBtn, { backgroundColor: primary }]} onPress={() => setPickerVisible(true)}>
        <Plus size={18} color="#000" />
        <Text style={styles.addText}>Add plan</Text>
      </Pressable>

      <SurahRangePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onConfirm={({ surahId, startVerse, endVerse, note }) => {
          addPlan(selectedDate, { surahId, startVerse, endVerse, note });
          setPickerVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#2a2a2a', borderRadius: 16, padding: 16, marginBottom: 16 },
  header: { color: '#fff', fontSize: 18, fontWeight: '700' },
  dateChip: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, alignItems: 'center' },
  dateChipText: { color: '#fff', fontWeight: '600' },
  dateToday: { color: '#aaa', fontSize: 10 },
  overallRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  overallText: { color: '#ddd' },
  overallPct: { color: '#fff', fontWeight: '700' },
  emptyText: { color: '#aaa', fontStyle: 'italic', marginTop: 8 },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: '#1f1f1f', borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: 'transparent' },
  entryTitle: { color: '#fff', fontWeight: '600' },
  entryMeta: { color: '#bbb', fontSize: 12, marginTop: 2 },
  entryNote: { color: '#999', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  delBtn: { padding: 8, backgroundColor: '#3a3a3a', borderRadius: 8 },
  addBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  addText: { color: '#000', fontWeight: '700' },
});
