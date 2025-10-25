import { surahsData } from '@/data/surahs';
import { usePlannerStore } from '@/store/plannerStore';
import { useProgressStore } from '@/store/progressStore';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function getGlobalStartIdForSurah(surahId: number): number {
  let total = 0; for (let i = 1; i < surahId; i++) { const s = surahsData.find(x => x.id === i); if (s) total += s.versesCount; }
  return total + 1;
}
function toVerseId(surahId: number, verseNumber: number): number { return getGlobalStartIdForSurah(surahId) + (verseNumber - 1); }

function parseDMY(s: string): Date | null {
  const m = /^([0-3]\d)-([0-1]\d)-(\d{4})$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]); const mm = Number(m[2]); const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd ? d : null;
}

export default function HifdhPlannerStats() {
  const { plansByDate, mode: plannerMode, selectedSurahId, verseStatsByMonth } = usePlannerStore();
  const { memorizedVerses, revisedVerses } = useProgressStore();

  const stats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    const allPlannedVerseIds = new Set<number>();
    const plannedBySurah = new Map<number, Set<number>>();
    const plannedSurahIds = new Set<number>();

    Object.entries(plansByDate).forEach(([key, entries]) => {
      const d = parseDMY(key);
      if (!d || d.getMonth() !== month || d.getFullYear() !== year) return;
      (entries as any[]).forEach((p: any) => {
        const surahId = Number(p.surahId) || 0; if (surahId <= 0) return;
        // If in surah mode and a surah is selected, only include that surah
        if (plannerMode === 'surah' && selectedSurahId != null && selectedSurahId !== surahId) return;
        plannedSurahIds.add(surahId);
        if (!plannedBySurah.has(surahId)) plannedBySurah.set(surahId, new Set<number>());
        const setForSurah = plannedBySurah.get(surahId)!;
        const sId = toVerseId(surahId, p.startVerse);
        const eId = toVerseId(surahId, p.endVerse);
        for (let id = sId; id <= eId; id++) { allPlannedVerseIds.add(id); setForSurah.add(id); }
      });
    });

    const isRevised = (id: number) => revisedVerses.some(rv => rv.verseId === id) || (plannerMode === 'verse' && !!(verseStatsByMonth[monthKey] && verseStatsByMonth[monthKey][id] && verseStatsByMonth[monthKey][id].completed));

    let completedPlannedVerses = 0;
    allPlannedVerseIds.forEach((id) => { if (memorizedVerses.includes(id) || isRevised(id)) completedPlannedVerses++; });

    let inProgressSurahs = 0;
    plannedBySurah.forEach((ids, sid) => {
      if (plannerMode === 'surah' && selectedSurahId != null && sid !== selectedSurahId) return;
      let done = 0; const total = ids.size; ids.forEach((id) => { if (memorizedVerses.includes(id) || isRevised(id)) done++; });
      if (done > 0 && done < total) inProgressSurahs++;
    });

    const totalPlannedVerses = allPlannedVerseIds.size;
    const totalPlannedSurahs = plannerMode === 'surah' && selectedSurahId != null ? (plannedSurahIds.has(selectedSurahId) ? 1 : 0) : (plannedSurahIds.size || plannedBySurah.size);
    const percent = totalPlannedVerses > 0 ? Math.round((completedPlannedVerses / totalPlannedVerses) * 100) : 0;

    return { monthName: now.toLocaleDateString(undefined, { month: 'long' }), totalPlannedVerses, completedPlannedVerses, inProgressSurahs, totalPlannedSurahs, percent };
  }, [plansByDate, memorizedVerses, revisedVerses, plannerMode, selectedSurahId, verseStatsByMonth]);

  // If in surah mode but no surah selected, show nothing small
  if (plannerMode === 'surah' && (selectedSurahId == null)) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.line}>{stats.completedPlannedVerses} of {stats.totalPlannedVerses} verses completed</Text>
      <View style={styles.row}>
        <Text style={styles.small}>{stats.inProgressSurahs} surahs in progress</Text>
        <Text style={styles.small}>{stats.totalPlannedSurahs} planned</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8, marginBottom: 8 },
  line: { color: '#ddd', fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { color: '#94a3b8', fontSize: 12 }
});
