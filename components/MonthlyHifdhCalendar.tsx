import HifdhPlannerStats from '@/components/HifdhPlannerStats';
import { surahsData } from '@/data/surahs';
import { usePlannerStore } from '@/store/plannerStore';
import { useProgressStore } from '@/store/progressStore';
import { useThemeColor } from '@/utils/useThemeColor';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DayPlannerModal from './DayPlannerModal';

function formatDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
function parseDMY(s: string): Date | null {
  const m = /^([0-3]\d)-([0-1]\d)-(\d{4})$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  // Validate round-trip to avoid 31/02 etc.
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd ? d : null;
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function addMonths(d: Date, delta: number) { return new Date(d.getFullYear(), d.getMonth()+delta, 1); }
function toPrettyMonth(d: Date) { return d.toLocaleDateString(undefined, { month:'long', year:'numeric' }); }

function getGlobalStartIdForSurah(surahId: number): number {
  let total = 0; for (let i=1;i<surahId;i++){ const s = surahsData.find(x=>x.id===i); if (s) total += s.versesCount; }
  return total + 1;
}
function toVerseId(surahId: number, verseNumber: number): number { return getGlobalStartIdForSurah(surahId) + (verseNumber-1); }

type PillStatus = 'completed'|'in-progress'|'pending'|'overdue';

export default function MonthlyHifdhCalendar() {
  const { primary } = useThemeColor();
  const today = new Date();
  const [monthCursor, setMonthCursor] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);

  const plansByDate = usePlannerStore(s => s.plansByDate);
  const addPlan = usePlannerStore(s => s.addPlan);
  const removePlan = usePlannerStore(s => s.removePlan);

  const memorized = useProgressStore(s => s.memorizedVerses);
  const revised = useProgressStore(s => s.revisedVerses);
  const markMem = useProgressStore(s => s.markVerseAsMemorized);
  const markRev = useProgressStore(s => s.markVerseAsRevised);

  const monthDays = useMemo(() => {
    const start = startOfMonth(monthCursor);
    const end = endOfMonth(monthCursor);
    const days: (Date | null)[] = [];
    const pad = (start.getDay() + 7) % 7; // Sun=0
    for (let i=0;i<pad;i++) days.push(null);
    for (let d=1; d<=end.getDate(); d++) days.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d));
    return days;
  }, [monthCursor]);

  function computeDayStatus(dateKey: string, dayDate: Date): { status: PillStatus; percent: number } | null {
    const entries = plansByDate[dateKey] || [];
    if (entries.length === 0) return null;

    // Build unique verse set for the day to handle overlapping ranges
    const uniquePlannedVerses = new Set<number>();
    for (const p of entries) {
      const sId = toVerseId(p.surahId, p.startVerse);
      const eId = toVerseId(p.surahId, p.endVerse);
      for (let id = sId; id <= eId; id++) uniquePlannedVerses.add(id);
    }

    // Count completed verses using OR logic (memorized OR revised)
    let completedCount = 0;
    uniquePlannedVerses.forEach((id) => {
      const isMem = memorized.includes(id);
      const isRev = revised.some((rv) => rv.verseId === id);
      if (isMem || isRev) completedCount++;
    });

    const totalUnique = uniquePlannedVerses.size;
    const percent = totalUnique > 0 ? Math.round((completedCount / totalUnique) * 100) : 0;
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isPast = dayDate < todayStart;
    const status: PillStatus = percent===100 ? 'completed' : percent>0 ? 'in-progress' : (isPast ? 'overdue' : 'pending');
    return { status, percent };
  }

  function getLastReviewedLabel(dateKey: string): string {
    const entries = plansByDate[dateKey] || [];
    // Unique verse IDs planned for the day
    const uniquePlannedVerses = new Set<number>();
    for (const p of entries) {
      const sId = toVerseId(p.surahId, p.startVerse);
      const eId = toVerseId(p.surahId, p.endVerse);
      for (let id = sId; id <= eId; id++) uniquePlannedVerses.add(id);
    }

    // Find latest revision among unique verses
    let latest: string | null = null;
    uniquePlannedVerses.forEach((id) => {
      const match = revised.find((rv) => rv.verseId === id);
      if (match) {
        if (!latest || match.revisionDate > latest) latest = match.revisionDate;
      }
    });
    if (!latest) return '—';
    const ld = new Date(latest);
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startLd = new Date(ld.getFullYear(), ld.getMonth(), ld.getDate());
    const diffDays = Math.floor((startToday.getTime() - startLd.getTime()) / 86400000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  }

  const selectedEntries = selectedISO ? (plansByDate[selectedISO] || []) : [];
  const selectedStatus = selectedISO ? (parseDMY(selectedISO) ? computeDayStatus(selectedISO, parseDMY(selectedISO) as Date) : null) : null;
  const selectedPretty = selectedISO ? (() => { const d = parseDMY(selectedISO); return d ? d.toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short', year:'numeric' }) : selectedISO; })() : '';

  const handleMarkCompleted = async () => {
    if (!selectedISO) return;
    const entries = plansByDate[selectedISO] || [];
    const uniqueVerses = new Set<number>();
    for (const p of entries) {
      const sId = toVerseId(p.surahId, p.startVerse);
      const eId = toVerseId(p.surahId, p.endVerse);
      for (let id = sId; id <= eId; id++) uniqueVerses.add(id);
    }
    uniqueVerses.forEach((id) => {
      if (!memorized.includes(id)) markMem(id);
      if (!revised.some((rv) => rv.verseId === id)) markRev(id);
    });
  };

  React.useEffect(() => {
    const { logAnalyticsEvent} = require('@/utils/analyticsHelper');
    logAnalyticsEvent('hifdh_planner_opened', {});
  }, []);

  return (
    <View style={styles.wrapper}>
      {/* Calendar Card - match revision theme */}
      <View style={styles.card}>
        <View style={styles.goalHeader}>
          <Calendar size={20} color={primary} />
          <Text style={styles.goalTitle}>Hifdh Planner</Text>
        </View>
        <Text style={styles.goalDescription}>Plan and track your daily Hifdh schedule</Text>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setMonthCursor(d => addMonths(d, -1))} style={[styles.navBtn, { backgroundColor: primary }]}>
            <ChevronLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{toPrettyMonth(monthCursor)}</Text>
          <TouchableOpacity onPress={() => setMonthCursor(d => addMonths(d, 1))} style={[styles.navBtn, { backgroundColor: primary }]}>
            <ChevronRight size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={styles.weekHeaderRow}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <Text key={d} style={styles.weekHeaderText}>{d}</Text>
          ))}
        </View>
    {/* Grid */}
        <View style={styles.grid}>
            {monthDays.map((d, idx) => {
              if (!d) return <View key={`pad-${idx}`} style={styles.cell} />;
              const iso = formatDMY(d);
              const pill = computeDayStatus(iso, d);
              const isToday = isSameDay(d, today);
              return (
                <Pressable
                  key={iso}
                  onPress={() => {
                    setSelectedISO(iso);
                    setDayModalVisible(true);
                  }}
                  style={[styles.cell, isToday && styles.todayCell]}
                >
                  <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>{d.getDate()}</Text>
                  {!!pill && (
                    <View style={styles.markerRow}>
                      {pill.status === 'completed' ? (
                        <Text style={styles.star}>★</Text>
                      ) : pill.status === 'pending' ? (
                        <View style={styles.dotPendingWrap}>
                          <View style={styles.dotPendingInner} />
                        </View>
                      ) : (
                        <View style={[
                          styles.dot,
                          pill.status==='in-progress' && styles.dotProgress,
                          pill.status==='overdue' && styles.dotOverdue,
                        ]} />
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

        {/* Legend */}
  {/* Hifdh Planner Stats (show stats for the calendar month being viewed) */}
  <HifdhPlannerStats monthDate={monthCursor} />
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <Text style={styles.star}>★</Text>
            <Text style={styles.legendText}>Completed</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotProgress]} />
            <Text style={styles.legendText}>In progress</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.dotPendingWrap}><View style={styles.dotPendingInner} /></View>
            <Text style={styles.legendText}>Pending</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotOverdue]} />
            <Text style={styles.legendText}>Overdue</Text>
          </View>
        </View>
      </View>

      {/* Day Planner Modal */}
      <DayPlannerModal visible={dayModalVisible} dateISO={selectedISO} onClose={() => setDayModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  card: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 16, marginBottom: 16 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  goalTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginLeft: 8 },
  goalDescription: { fontSize: 14, color: '#888888', marginBottom: 16 },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 12 },
  monthTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  navBtn: { padding: 8, borderRadius: 8 },
  weekHeaderRow: { flexDirection:'row', justifyContent:'space-between', paddingHorizontal: 4, marginBottom: 6 },
  weekHeaderText: { width: `${100/7}%`, textAlign:'center', color:'#94a3b8', fontWeight:'700', fontSize:12 },
  grid: { flexDirection:'row', flexWrap:'wrap' },
  cell: { width: `${100/7}%`, aspectRatio: 1, padding: 6, alignItems:'center', justifyContent:'flex-start', backgroundColor:'rgba(51,65,85,0.5)', borderWidth:2, borderColor:'#475569', borderRadius:12 },
  dayNumber: { color:'#e2e8f0', fontWeight:'800' },
  todayCell: { backgroundColor:'rgba(88,28,135,0.5)', borderColor:'#a855f7' },
  todayNumber: { color:'#d8b4fe' },
  markerRow: { marginTop: 'auto', alignSelf:'center', height: 14, justifyContent:'center' },
  star: { color: '#fbbf24', fontSize: 14, lineHeight: 14, textAlign:'center' },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#3b82f6' },
  dotProgress: { backgroundColor: '#f59e0b' },
  dotPending: { backgroundColor: '#3b82f6' },
  dotOverdue: { backgroundColor: '#f43f5e' },
  dotPendingWrap: { width: 12, height: 12, borderRadius: 999, borderWidth: 2, borderColor: '#3b82f6', alignItems:'center', justifyContent:'center' },
  dotPendingInner: { width: 6, height: 6, borderRadius: 999, backgroundColor: '#3b82f6' },
  legendRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop: 10, paddingHorizontal: 6 },
  legendItem: { flexDirection:'row', alignItems:'center', gap: 6 },
  legendText: { color:'#94a3b8', fontSize: 12, fontWeight:'600' },
});
