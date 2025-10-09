import { surahsData } from '@/data/surahs';
import { usePlannerStore } from '@/store/plannerStore';
import { useProgressStore } from '@/store/progressStore';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SurahRangePicker from './SurahRangePicker';

function formatDMY(d: Date): string { const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear(); return `${dd}-${mm}-${yyyy}`; }
function parseDMY(s: string): Date | null { const m=/^([0-3]\d)-([0-1]\d)-(\d{4})$/.exec(s); if(!m) return null; const dd=+m[1], mm=+m[2], yyyy=+m[3]; const d=new Date(yyyy, mm-1, dd); return d.getFullYear()===yyyy && d.getMonth()===mm-1 && d.getDate()===dd ? d : null; }
function getGlobalStartIdForSurah(surahId: number): number {
  let total = 0; for (let i=1;i<surahId;i++){ const s = surahsData.find(x=>x.id===i); if (s) total += s.versesCount; }
  return total + 1;
}
function toVerseId(surahId: number, verseNumber: number): number { return getGlobalStartIdForSurah(surahId) + (verseNumber-1); }

type Props = {
  visible: boolean;
  dateISO: string | null;
  onClose: () => void;
};

export default function DayPlannerModal({ visible, dateISO, onClose }: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const plansByDate = usePlannerStore(s => s.plansByDate);
  const addPlan = usePlannerStore(s => s.addPlan);
  const removePlan = usePlannerStore(s => s.removePlan);

  const memorized = useProgressStore(s => s.memorizedVerses);
  const revised = useProgressStore(s => s.revisedVerses);
  const markMem = useProgressStore(s => s.markVerseAsMemorized);
  const markRev = useProgressStore(s => s.markVerseAsRevised);

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const entries = dateISO ? (plansByDate[dateISO] || []) : [];

  // Unique verses for this day (handles overlapping ranges)
  const uniqueVerses = useMemo(() => {
    const verses = new Set<number>();
    if (!dateISO) return verses;
    for (const p of entries) {
      const sId = toVerseId(p.surahId, p.startVerse);
      const eId = toVerseId(p.surahId, p.endVerse);
      for (let id = sId; id <= eId; id++) verses.add(id);
    }
    return verses;
  }, [dateISO, entries]);

  const status = useMemo(() => {
    if (!dateISO || entries.length === 0) return { percent: 0, state: 'pending' as const };
    let completed = 0;
    uniqueVerses.forEach((id) => {
      const isMem = memorized.includes(id);
      const isRev = revised.some((rv) => rv.verseId === id);
      if (isMem || isRev) completed++;
    });
    const total = uniqueVerses.size;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    let isPast = false;
    if (dateISO) {
      const d = parseDMY(dateISO);
      if (d) {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        isPast = start < todayStart;
      }
    }
    const state = percent === 100 ? 'completed' : percent > 0 ? 'in-progress' : isPast ? 'overdue' : 'pending';
    return { percent, state };
  }, [dateISO, entries, memorized, revised, todayStart, uniqueVerses]);

  const lastReviewed = useMemo(() => {
    if (!dateISO) return '—';
    let latest: string | null = null;
    uniqueVerses.forEach((id) => {
      const match = revised.find((rv) => rv.verseId === id);
      if (match) {
        if (!latest || match.revisionDate > latest) latest = match.revisionDate;
      }
    });
    if (!latest) return '—';
    const latestDate = new Date(latest);
    const startLatest = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate());
    const diffDays = Math.floor((todayStart.getTime() - startLatest.getTime()) / 86400000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  }, [dateISO, revised, todayStart, uniqueVerses]);

  const pretty = dateISO ? (() => { const d=parseDMY(dateISO); return d ? d.toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short', year:'numeric' }) : dateISO; })() : '';

  const handleMarkCompleted = async () => {
    if (!dateISO) return;
    uniqueVerses.forEach((id) => {
      if (!memorized.includes(id)) markMem(id);
      if (!revised.some((rv) => rv.verseId === id)) markRev(id);
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{pretty}</Text>
          <Pressable style={styles.headerClose} onPress={onClose}><X size={18} color="#e2e8f0" /></Pressable>
        </View>

        {/* Surah info & progress */}
        <LinearGradient colors={["#8b5cf6","#4f46e5"]} style={styles.infoCard}>
          <Text style={styles.infoTitle}>Scheduled</Text>
          {entries.length === 0 ? (
            <Text style={styles.infoEmpty}>No schedules yet. Add surahs below.</Text>
          ) : (
            entries.map((p) => {
              const s = surahsData.find(x=>x.id===p.surahId);
              return (
                <View key={p.id} style={styles.infoRow}>
                  <Text style={styles.infoText}>{p.surahId}. {s?.name} ({s?.englishName}) — {p.startVerse}-{p.endVerse}</Text>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => { if (dateISO) removePlan(dateISO, p.id); }}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </LinearGradient>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>Completion</Text>
          <View style={styles.progressBg}>
            <LinearGradient colors={["#8b5cf6","#4f46e5"]} start={{x:0,y:0}} end={{x:1,y:0}} style={[styles.progressFill,{ width:`${status.percent}%` }]} />
          </View>
          <Text style={styles.progressPct}>{status.percent}%</Text>
        </View>

        <View style={styles.blockRow}>
          <Text style={styles.metaLabel}>Last reviewed</Text>
          <Text style={styles.metaValue}>{lastReviewed}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => ({
              flex: 1,
              marginHorizontal: 4,
              paddingVertical: 9,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: pressed ? '#333333' : '#000000',
              borderColor: '#8b5cf6',
              borderWidth: 1,
            })}
            onPress={() => setPickerVisible(true)}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
              Add Plan
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => ({
              flex: 1,
              marginHorizontal: 4,
              paddingVertical: 9,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: pressed ? '#333333' : '#000000',
              borderColor: '#8b5cf6',
              borderWidth: 1,
            })}
            onPress={() => { if (dateISO) (plansByDate[dateISO]||[]).forEach(p=>removePlan(dateISO, p.id)); }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
              Reset
            </Text>
          </Pressable>
        </View>

        {/* Internal Surah picker for multi-add */}
        <SurahRangePicker
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onConfirm={({ surahId, startVerse, endVerse, note }) => {
            if (dateISO) addPlan(dateISO, { surahId, startVerse, endVerse, note });
            // Keep picker open so user can add multiple if desired
          }}
        />
        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxTitle}>Tips</Text>
          <Text style={styles.infoBoxText}>
            You can add multiple plans for the same day. Choose full surahs or custom verse ranges.
            Your progress updates automatically when you mark verses as Memorized or Revised anywhere in the app.
          </Text>
          <Text style={[styles.infoBoxText, { marginTop: 6 }]}>
            Overlapping ranges are handled smartly and won’t be double-counted.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0b1220' },
  header: { padding: 16, paddingTop: 56, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, borderColor:'#1f2937', backgroundColor:'#0b1220' },
  headerTitle: { fontSize: 16, fontWeight:'800', color:'#e2e8f0' },
  headerClose: { padding: 8, borderRadius:8 },
  infoCard: { borderRadius: 16, margin: 16, padding: 12 },
  infoTitle: { color:'#fff', fontWeight:'800', marginBottom: 8 },
  infoEmpty: { color:'#f8fafc', opacity:0.9 },
  infoRow: { backgroundColor:'rgba(15,23,42,0.35)', padding:8, borderRadius:8, marginBottom:6, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderWidth:1, borderColor:'rgba(148,163,184,0.15)' },
  infoText: { color:'#fff', fontWeight:'600', flex:1, paddingRight: 8 },
  removeBtn: { paddingVertical:6, paddingHorizontal:10, backgroundColor:'rgba(0,0,0,0.2)', borderRadius:8 },
  removeText: { color:'#fff', fontWeight:'700' },
  block: { paddingHorizontal: 16, marginBottom: 8 },
  blockLabel: { color:'#94a3b8', fontWeight:'700', marginBottom: 6 },
  progressBg: { height:8, backgroundColor:'#111827', borderRadius:999, overflow:'hidden', borderWidth:1, borderColor:'#1f2937' },
  progressFill: { height: '100%' },
  progressPct: { color:'#e2e8f0', fontWeight:'800', marginTop: 4 },
  blockRow: { flexDirection:'row', justifyContent:'space-between', paddingHorizontal:16, marginBottom: 8 },
  metaLabel: { color:'#94a3b8', fontWeight:'700' },
  metaValue: { color:'#e2e8f0', fontWeight:'800' },
  actionsRow: { flexDirection:'row', justifyContent:'space-between', padding: 16 },
  infoBox: { margin: 16, padding: 12, borderRadius: 10, backgroundColor: 'rgba(148,163,184,0.12)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.25)' },
  infoBoxTitle: { color:'#e2e8f0', fontWeight:'800', marginBottom: 6, fontSize: 12, letterSpacing: 0.5 },
  infoBoxText: { color:'#cbd5e1', fontSize: 12, lineHeight: 18 },
});
