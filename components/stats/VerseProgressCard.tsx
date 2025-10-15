import { TOTAL_VERSES } from '@/constants/quran';
import { getVerseActivitiesBetween } from '@/database/QuranDatabase';
import { useDayKey } from '@/hooks/useDayKey';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { useProgressStore } from '@/store/progressStore';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TimeRangeSelector, { TimeRange } from './TimeRangeSelector';
import VerseProgressGraph, { VerseProgressData } from './VerseProgressGraph';

// Error Boundary Component
class VerseProgressErrorBoundary extends React.Component<
  { children: React.ReactNode; colors: any },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('VerseProgress Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.card, { backgroundColor: this.props.colors.background, borderColor: this.props.colors.border }]}>
          <Text style={[styles.title, { color: this.props.colors.text }]}>Activity Chart</Text>
          <Text style={[styles.subtitle, { color: this.props.colors.textSecondary }]}>
            Unable to load chart. Please try again.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

function formatDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(d: Date){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }

export default function VerseProgressCard(){
  const { theme } = useUnifiedTheme();
  const { memorizedVerses, revisedVerses, verseStatus } = useProgressStore();
  const dayKey = useDayKey();
  const [range, setRange] = useState<TimeRange>('week');
  const [total, setTotal] = useState(0);
  const [graphData, setGraphData] = useState<VerseProgressData[]>([]);
  const [loading, setLoading] = useState(false);
  const currentRequestRef = useRef<string>('');

  const colors = useMemo(() => ({
    primary: theme.primary,
    primaryLight: theme.primaryLight,
    text: theme.text,
    textSecondary: theme.textSecondary,
    background: theme.card,
    border: theme.border,
    accent: theme.accent,
  }), [theme]);

  const loadData = async (r: TimeRange) => {
    const requestId = `${r}-${Date.now()}`;
    currentRequestRef.current = requestId;
    
    if (!loading) {
      setLoading(true);
    }

    try {
      const today = startOfDay(new Date());

      // Check if this request is still current
      if (currentRequestRef.current !== requestId) return;

      // Current totals (for today's snapshot)
      const currentMemorized = Object.values(verseStatus).filter(v => v.status === 'memorized').length;
      const currentRevised = Object.values(verseStatus).filter(v => v.status === 'revised').length;

      if (r === 'day'){
        const items: VerseProgressData[] = [{
          date: new Date(today),
          label: 'Today',
          cumulativeMemorized: currentMemorized,
          cumulativeRevised: currentRevised,
          isCurrentPeriod: true,
        }];
        setGraphData(items);
        setTotal(Math.min(currentMemorized + currentRevised, TOTAL_VERSES));
        return;
      }

      if (r === 'week'){
        const currentDay = today.getDay();
        const weekStart = addDays(today, -currentDay);
        const weekEnd = today;
        
        // Fetch activity data for the week
        const rows = await getVerseActivitiesBetween(formatDate(weekStart), formatDate(weekEnd));
        
        if (currentRequestRef.current !== requestId) return;
        
        // Build activity map by date
        const activityMap: Record<string, { memorized: number; revised: number }> = {};
        rows.forEach(r => {
          if (!activityMap[r.activityDate]) {
            activityMap[r.activityDate] = { memorized: 0, revised: 0 };
          }
          // Assuming your database tracks activity type - adjust based on your schema
          // You may need to modify getVerseActivitiesBetween to return activity type
          activityMap[r.activityDate].memorized += r.count;
        });

        const days = Array.from({length: 7}, (_, i) => addDays(weekStart, i));
        const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        const items: VerseProgressData[] = days.map((d, i) => {
          const dateKey = formatDate(d);
          const isToday = d.getTime() === today.getTime();
          
          // Only show cumulative data for days up to today
          if (d <= today) {
            // For today, use current authoritative counts
            if (isToday) {
              return {
                date: d,
                label: labels[i],
                cumulativeMemorized: currentMemorized,
                cumulativeRevised: currentRevised,
                isCurrentPeriod: true,
              };
            } else {
              // For past days in the week, show zero progress
              // (since we don't have historical snapshots yet)
              return {
                date: d,
                label: labels[i],
                cumulativeMemorized: 0,
                cumulativeRevised: 0,
                isCurrentPeriod: false,
              };
            }
          } else {
            // Future days show zero
            return {
              date: d,
              label: labels[i],
              cumulativeMemorized: 0,
              cumulativeRevised: 0,
              isCurrentPeriod: false,
            };
          }
        });
        
        setGraphData(items);
        setTotal(Math.min(currentMemorized + currentRevised, TOTAL_VERSES));
        return;
      }

      if (r === 'month'){
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        
        const rows = await getVerseActivitiesBetween(formatDate(monthStart), formatDate(monthEnd));
        
        if (currentRequestRef.current !== requestId) return;
        
        const activityMap: Record<string, { memorized: number; revised: number }> = {};
        rows.forEach(r => {
          if (!activityMap[r.activityDate]) {
            activityMap[r.activityDate] = { memorized: 0, revised: 0 };
          }
          activityMap[r.activityDate].memorized += r.count;
        });

        const daysInMonth = monthEnd.getDate();
        const days = Array.from({length: daysInMonth}, (_, i) => new Date(currentYear, currentMonth, i + 1));
        
        const items: VerseProgressData[] = days.map(d => {
          const dateKey = formatDate(d);
          const isToday = d.getTime() === today.getTime();
          
          // Only show cumulative data for days up to today
          if (d <= today) {
            // For today, use current authoritative counts
            if (isToday) {
              return {
                date: d,
                label: String(d.getDate()),
                cumulativeMemorized: currentMemorized,
                cumulativeRevised: currentRevised,
                isCurrentPeriod: true,
              };
            } else {
              // For past days in the month, show zero progress
              // (since we don't have historical snapshots yet)
              return {
                date: d,
                label: String(d.getDate()),
                cumulativeMemorized: 0,
                cumulativeRevised: 0,
                isCurrentPeriod: false,
              };
            }
          } else {
            // Future days show zero
            return {
              date: d,
              label: String(d.getDate()),
              cumulativeMemorized: 0,
              cumulativeRevised: 0,
              isCurrentPeriod: false,
            };
          }
        });
        
        setGraphData(items);
        setTotal(Math.min(currentMemorized + currentRevised, TOTAL_VERSES));
        return;
      }

      // Year view
      const currentYear = today.getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31);
      
      const rows = await getVerseActivitiesBetween(formatDate(yearStart), formatDate(yearEnd));
      
      if (currentRequestRef.current !== requestId) return;
      
      const activityMap: Record<string, { memorized: number; revised: number }> = {};
      rows.forEach(r => {
        if (!activityMap[r.activityDate]) {
          activityMap[r.activityDate] = { memorized: 0, revised: 0 };
        }
        activityMap[r.activityDate].memorized += r.count;
      });

      const months: { start: Date; end: Date; label: string; current: boolean }[] = [];
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(currentYear, i, 1);
        const monthEnd = new Date(currentYear, i + 1, 0);
        const label = monthStart.toLocaleDateString(undefined, { month: 'short' });
        const current = i === today.getMonth();
        months.push({ start: monthStart, end: monthEnd, label, current });
      }
      
      const items: VerseProgressData[] = months.map((m, i) => {
        const currentMonth = today.getMonth();
        
        // Only show cumulative data for months up to current month
        if (i <= currentMonth) {
          // For current month, use current authoritative counts
          if (m.current) {
            return {
              date: m.end,
              label: m.label,
              cumulativeMemorized: currentMemorized,
              cumulativeRevised: currentRevised,
              isCurrentPeriod: true,
            };
          } else {
            // For past months, show zero progress
            // (since we don't have historical snapshots yet)
            return {
              date: m.end,
              label: m.label,
              cumulativeMemorized: 0,
              cumulativeRevised: 0,
              isCurrentPeriod: false,
            };
          }
        } else {
          // Future months show zero
          return {
            date: m.end,
            label: m.label,
            cumulativeMemorized: 0,
            cumulativeRevised: 0,
            isCurrentPeriod: false,
          };
        }
      });
      
      setGraphData(items);
      setTotal(Math.min(currentMemorized + currentRevised, TOTAL_VERSES));
      
    } catch (error) {
      console.error('Error loading verse activity data:', error);
      if (currentRequestRef.current === requestId) {
        setGraphData([]);
        setTotal(0);
      }
    } finally {
      if (currentRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const changeRangeDebounced = useRef<NodeJS.Timeout | null>(null);
  const handleRangeChange = (newRange: TimeRange) => {
    if (changeRangeDebounced.current) {
      clearTimeout(changeRangeDebounced.current);
    }
    
    Haptics.selectionAsync();
    setRange(newRange);
    
    changeRangeDebounced.current = setTimeout(() => {
      loadData(newRange);
    }, 80);
  };

  React.useEffect(() => { loadData(range); }, []);
  
  React.useEffect(() => { 
    loadData(range); 
  }, [memorizedVerses.length, revisedVerses.length]);

  // Refresh on calendar day change
  React.useEffect(() => {
    loadData(range);
  }, [dayKey]);

  return (
    <VerseProgressErrorBoundary colors={colors}>
      <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}> 
        <View style={styles.headerRow}>
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: colors.text }]}>Activity</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Verses memorized & revised</Text>
          </View>
          <View style={styles.statsSection}>
            <Text style={[styles.total, { color: colors.primary }]}>{total}</Text>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>verses</Text>
          </View>
        </View>

        <TimeRangeSelector value={range} onChange={handleRangeChange} colors={colors as any} />

        <VerseProgressGraph 
          key={`${range}-${graphData.length}`} 
          timeRange={range} 
          data={graphData} 
          totalVerses={TOTAL_VERSES}
          colors={colors} 
          onBarPress={() => {}} 
        />
      </View>
    </VerseProgressErrorBoundary>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius:16, borderWidth:1, padding:20, marginBottom:24 },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 },
  titleSection: { flex:1 },
  title: { fontSize:18, fontWeight:'700', marginBottom:2 },
  subtitle: { fontSize:13, fontWeight:'500' },
  statsSection: { alignItems:'flex-end' },
  total: { fontSize:32, fontWeight:'800', lineHeight:36 },
  totalLabel: { fontSize:12, fontWeight:'600', marginTop:-2 },
});
