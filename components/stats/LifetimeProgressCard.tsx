import { getVerseActivitiesBetween } from '@/database/QuranDatabase';
import { useDayKey } from '@/hooks/useDayKey';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { useProgressStore } from '@/store/progressStore';
import { getOrSetInstallDate } from '@/utils/installDate';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type SeriesPoint = { 
  x: number; 
  y: number; 
  date: string; 
  total: number; 
  hasActivity: boolean; // Track if there was activity on this day
  activityCount: number; // How many verses on this day
  isCompressed?: boolean; // Whether this point represents compressed timeline
  // ECG-specific properties
  memTotal?: number; // Cumulative memorized total
  revTotal?: number; // Cumulative revised total
  memActivity?: number; // Daily memorization activity
  revActivity?: number; // Daily revision activity
};

function formatDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, n: number): Date { 
  const r = new Date(d.getTime()); 
  r.setDate(r.getDate() + n); 
  return r; 
}

export default function LifetimeProgressCard(){
  const { theme } = useUnifiedTheme();
  const { memorizedVerses, revisedVerses } = useProgressStore(); // Add progress store dependency
  const dayKey = useDayKey();
  const colors = useMemo(() => ({
    card: theme.card,
    border: theme.border,
    text: theme.text,
    textSecondary: theme.textSecondary,
    primary: theme.primary,
    accent: theme.accent,
  }), [theme]);

  const [memPoints, setMemPoints] = useState<SeriesPoint[]>([]);
  const [revPoints, setRevPoints] = useState<SeriesPoint[]>([]);
  const [totalMem, setTotalMem] = useState(0);
  const [totalRev, setTotalRev] = useState(0);
  const [installStr, setInstallStr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const installDateStr = await getOrSetInstallDate();
      setInstallStr(installDateStr);
      const start = installDateStr;
      const end = formatDate(new Date());
      const rows = await getVerseActivitiesBetween(start, end);
      
      console.log('[LifetimeProgress] Raw data rows:', rows);
      
      // Build daily totals by type
      const memMap: Record<string, number> = {};
      const revMap: Record<string, number> = {};
      rows.forEach(r => {
        if (r.activityType === 'memorized') {
          memMap[r.activityDate] = (memMap[r.activityDate] || 0) + r.count;
        } else if (r.activityType === 'revised') {
          revMap[r.activityDate] = (revMap[r.activityDate] || 0) + r.count;
        }
      });

      // Create ECG-style daily timeline from install date to today
      const startDate = new Date(start);
      const today = new Date();
      
      // Build complete daily timeline for ECG visualization
      const dailyTimeline: SeriesPoint[] = [];
      let runningMem = 0;
      let runningRev = 0;
      
      for (let d = new Date(startDate); d <= today; d = addDays(d, 1)) {
        const dateStr = formatDate(d);
        const dayMemActivity = memMap[dateStr] || 0;
        const dayRevActivity = revMap[dateStr] || 0;
        
        runningMem += dayMemActivity;
        runningRev += dayRevActivity;
        
        dailyTimeline.push({
          x: 0,
          y: 0,
          date: dateStr,
          total: runningMem + runningRev, // Combined total for main ECG line
          hasActivity: dayMemActivity > 0 || dayRevActivity > 0,
          activityCount: dayMemActivity + dayRevActivity,
          memTotal: runningMem,
          revTotal: runningRev,
          memActivity: dayMemActivity,
          revActivity: dayRevActivity
        });
      }
      
      console.log('[LifetimeProgress] ECG Timeline created:', dailyTimeline.length, 'days');
      console.log('[LifetimeProgress] Sample points:', dailyTimeline.slice(0, 3));
      
      // Create separate memorization and revision timelines
      const mPts: SeriesPoint[] = dailyTimeline.map(point => ({
        ...point,
        total: point.memTotal || 0,
        hasActivity: (point.memActivity || 0) > 0,
        activityCount: point.memActivity || 0
      }));
      
      const rPts: SeriesPoint[] = dailyTimeline.map(point => ({
        ...point,
        total: point.revTotal || 0,
        hasActivity: (point.revActivity || 0) > 0,
        activityCount: point.revActivity || 0
      }));
      
      setMemPoints(mPts);
      setRevPoints(rPts);
      setTotalMem(runningMem);
      setTotalRev(runningRev);
    };
    load();
  }, []);

  // Refresh data when progress changes
  useEffect(() => {
    const load = async () => {
      if (!installStr) return; // Wait for install date to be set
      const start = installStr;
      const end = formatDate(new Date());
      const rows = await getVerseActivitiesBetween(start, end);
      
      // Build daily totals by type
      const memMap: Record<string, number> = {};
      const revMap: Record<string, number> = {};
      rows.forEach(r => {
        if (r.activityType === 'memorized') {
          memMap[r.activityDate] = (memMap[r.activityDate] || 0) + r.count;
        } else if (r.activityType === 'revised') {
          revMap[r.activityDate] = (revMap[r.activityDate] || 0) + r.count;
        }
      });

      // Create ECG-style daily timeline from install date to today
      const startDate = new Date(start);
      const today = new Date();
      
      // Build complete daily timeline for ECG visualization
      const dailyTimeline: SeriesPoint[] = [];
      let runningMem = 0;
      let runningRev = 0;
      
      for (let d = new Date(startDate); d <= today; d = addDays(d, 1)) {
        const dateStr = formatDate(d);
        const dayMemActivity = memMap[dateStr] || 0;
        const dayRevActivity = revMap[dateStr] || 0;
        
        runningMem += dayMemActivity;
        runningRev += dayRevActivity;
        
        dailyTimeline.push({
          x: 0,
          y: 0,
          date: dateStr,
          total: runningMem + runningRev,
          hasActivity: dayMemActivity > 0 || dayRevActivity > 0,
          activityCount: dayMemActivity + dayRevActivity,
          memTotal: runningMem,
          revTotal: runningRev,
          memActivity: dayMemActivity,
          revActivity: dayRevActivity
        });
      }
      
      // Create separate memorization and revision timelines
      const mPts: SeriesPoint[] = dailyTimeline.map(point => ({
        ...point,
        total: point.memTotal || 0,
        hasActivity: (point.memActivity || 0) > 0,
        activityCount: point.memActivity || 0
      }));
      
      const rPts: SeriesPoint[] = dailyTimeline.map(point => ({
        ...point,
        total: point.revTotal || 0,
        hasActivity: (point.revActivity || 0) > 0,
        activityCount: point.revActivity || 0
      }));
      
      console.log('[LifetimeProgress] Refresh - ECG Timeline created:', dailyTimeline.length, 'days');
      
      setMemPoints(mPts);
      setRevPoints(rPts);
      setTotalMem(runningMem);
      setTotalRev(runningRev);
    };
    load();
  }, [memorizedVerses.length, revisedVerses.length, installStr, dayKey]);

  const totalCombined = totalMem + totalRev;
  const pointCount = Math.max(memPoints.length, revPoints.length);
  const empty = memPoints.length === 0 && revPoints.length === 0;
  const showRevisedLine = revPoints.some(p => p.total > 0);

  // ECG-style intelligent compression - group every 15 days for long timelines
  const intelligentCompression = (points: SeriesPoint[]): SeriesPoint[] => {
    if (points.length <= 45) return points; // No compression needed for less than 45 days
    
    const compressionRatio = 15; // Group every 15 days
    const compressed: SeriesPoint[] = [];
    
    for (let i = 0; i < points.length; i += compressionRatio) {
      const group = points.slice(i, i + compressionRatio);
      
      // Find the highest activity day in this group, or use the last day
      const lastDay = group[group.length - 1];
      
      // Use the last day's cumulative total but activity status from most active day
      compressed.push({
        ...lastDay,
        hasActivity: group.some(p => p.hasActivity),
        activityCount: group.reduce((sum, p) => sum + p.activityCount, 0),
        isCompressed: group.length > 1
      });
    }
    
    return compressed;
  };

  // Apply intelligent compression to both memorization and revision data
  const effectiveMemPoints = intelligentCompression(memPoints);
  const effectiveRevPoints = intelligentCompression(revPoints);
  const effectivePointCount = Math.max(effectiveMemPoints.length, effectiveRevPoints.length);

  // Get screen dimensions and calculate responsive width
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 40;
  const availableWidth = screenWidth - cardPadding;
  
  // Scrollable width calculation - each day gets a minimum width
  const minDayWidth = 6;
  const maxDayWidth = 16;
  
  let dayWidth = Math.max(minDayWidth, Math.min(maxDayWidth, availableWidth / effectivePointCount));
  
  // Chart dimensions
  const totalChartWidth = effectivePointCount * dayWidth;
  const needsHorizontalScroll = totalChartWidth > availableWidth - 80; // Leave space for padding
  
  const chartWidth = needsHorizontalScroll 
    ? totalChartWidth + 80
    : availableWidth;

  // Layout - responsive dimensions
  const width = Math.min(availableWidth, chartWidth);
  const height = 220;
  const pad = { 
    top: 20, 
    right: 20, 
    bottom: 40, 
    left: Math.max(40, width * 0.15)
  };

  // Y-axis scaling calculation
  const currentMaxProgress = Math.max(
    totalMem,
    totalRev,
    totalMem + totalRev,
    100
  );
  
  let maxYAxis: number;
  let yAxisLabels: number[];
  
  if (currentMaxProgress <= 50) {
    maxYAxis = 100;
    yAxisLabels = [0, 20, 40, 60, 80, 100];
  } else if (currentMaxProgress <= 100) {
    maxYAxis = 150;
    yAxisLabels = [0, 30, 60, 90, 120, 150];
  } else if (currentMaxProgress <= 150) {
    maxYAxis = 200;
    yAxisLabels = [0, 40, 80, 120, 160, 200];
  } else if (currentMaxProgress <= 200) {
    maxYAxis = 250;
    yAxisLabels = [0, 50, 100, 150, 200, 250];
  } else if (currentMaxProgress <= 300) {
    maxYAxis = 350;
    yAxisLabels = [0, 70, 140, 210, 280, 350];
  } else if (currentMaxProgress <= 500) {
    maxYAxis = 600;
    yAxisLabels = [0, 120, 240, 360, 480, 600];
  } else {
    maxYAxis = 6236;
    yAxisLabels = [0, 1000, 2000, 3000, 4000, 5000, 6236];
  }
  
  const yScale = (value: number) => {
    const usable = height - pad.top - pad.bottom;
    return height - pad.bottom - (value / maxYAxis) * usable;
  };

  const lineSpacing = 2;
  
  // Debug logging
  console.log('[LifetimeProgress] maxTotal:', maxYAxis);
  console.log('[LifetimeProgress] memPoints final:', memPoints[memPoints.length - 1]?.total);
  console.log('[LifetimeProgress] revPoints final:', revPoints[revPoints.length - 1]?.total);
  console.log('[LifetimeProgress] totalMem state:', totalMem, 'totalRev state:', totalRev);
  console.log('[LifetimeProgress] totalCombined:', totalCombined, 'pointCount:', pointCount, 'empty:', empty);
  console.log('[LifetimeProgress] effectiveMemPoints length:', effectiveMemPoints.length, 'effectiveRevPoints length:', effectiveRevPoints.length);
  
  // ECG-style pathD function
  const createECGPath = (series: SeriesPoint[], xOffset: number = 0) => {
    if (series.length === 0) return '';

    const xAt = (idx: number) => pad.left + idx * dayWidth + xOffset;

    if (series.length === 1) {
      const x = xAt(0);
      const y = yScale(series[0].total);
      const baselineY = yScale(0);
      return `M ${x} ${baselineY} L ${x} ${y}`;
    }

    // ECG-style connected path with maintained height and spikes
    let d = '';
    
    for (let i = 0; i < series.length; i++) {
      const x = xAt(i);
      const y = yScale(series[i].total);
      
      if (i === 0) {
        // Start from baseline, spike to first value
        d = `M ${x} ${yScale(0)} L ${x} ${y}`;
      } else {
        const prevX = xAt(i - 1);
        const prevY = yScale(series[i - 1].total);
        
        // Connect from previous point, maintain height or spike up
        if (series[i].hasActivity) {
          // Activity spike: horizontal line then vertical spike
          d += ` L ${x} ${prevY} L ${x} ${y}`;
        } else {
          // No activity: horizontal line at maintained height
          d += ` L ${x} ${prevY}`;
        }
      }
    }
    
    return d;
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Lifetime Progress (ECG)</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {installStr ? `Since ${installStr}` : 'Lifetime'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.total, { color: colors.primary }]}>{totalCombined}</Text>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>verses</Text>
        </View>
      </View>
      {/* Legend */}
      {!empty && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendText, { color: colors.text }]}>Memorized</Text>
            <Text style={[styles.legendValue, { color: colors.textSecondary }]}>{totalMem}</Text>
          </View>
          {showRevisedLine && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.legendText, { color: colors.text }]}>Revised</Text>
              <Text style={[styles.legendValue, { color: colors.textSecondary }]}>{totalRev}</Text>
            </View>
          )}
        </View>
      )}

      {empty ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Start your memorization journey!</Text>
        </View>
      ) : (
        <ScrollView 
          horizontal={needsHorizontalScroll}
          showsHorizontalScrollIndicator={needsHorizontalScroll}
          bounces={false}
          style={{ marginTop: 12 }}
        >
          <View style={{ width: chartWidth }}>
            <Svg width={chartWidth} height={height}>
              {/* Y-axis labels */}
              {yAxisLabels.map((value) => {
                const y = yScale(value);
                const isMax = value === maxYAxis;
                const isZero = value === 0;
                return (
                  <React.Fragment key={`y-label-${value}`}>
                    <Line
                      x1={pad.left}
                      y1={y}
                      x2={chartWidth - pad.right}
                      y2={y}
                      stroke={colors.border}
                      strokeWidth={isZero || isMax ? 2 : 1}
                      opacity={isZero || isMax ? 0.6 : 0.25}
                      strokeDasharray={isZero || isMax ? '0' : '4 4'}
                    />
                    <SvgText
                      x={pad.left - 8}
                      y={y + 4}
                      fontSize={10}
                      fill={colors.textSecondary}
                      textAnchor="end"
                    >
                      {value === 6236 ? '6.2k' : value >= 1000 ? `${(value/1000).toFixed(1)}k` : value.toString()}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Plot boundaries */}
              <Line x1={pad.left} y1={height - pad.bottom} x2={chartWidth - pad.right} y2={height - pad.bottom} stroke={colors.border} strokeWidth={2} opacity={0.7} />
              <Line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke={colors.border} strokeWidth={2} opacity={0.7} />
              
              {/* ECG Lines */}
              <AnimatedPath d={createECGPath(effectiveMemPoints, -lineSpacing)} stroke={colors.primary} strokeWidth={2.5} fill="none" entering={FadeIn.duration(500)} />
              
              {showRevisedLine && (
                <AnimatedPath d={createECGPath(effectiveRevPoints, lineSpacing)} stroke={colors.accent} strokeWidth={2.5} fill="none" entering={FadeIn.duration(500)} />
              )}
              
              {/* ECG dots for each day */}
              {effectiveMemPoints.map((point, index) => {
                const x = pad.left + index * dayWidth - lineSpacing;
                const y = yScale(point.total);
                
                return (
                  <Circle 
                    key={`mem-dot-${index}`} 
                    cx={x} 
                    cy={y} 
                    r={point.hasActivity ? 2 : 1} 
                    fill={colors.primary} 
                    opacity={point.hasActivity ? 1 : 0.4}
                  />
                );
              })}
              
              {showRevisedLine && effectiveRevPoints.map((point, index) => {
                const x = pad.left + index * dayWidth + lineSpacing;
                const y = yScale(point.total);
                
                return (
                  <Circle 
                    key={`rev-dot-${index}`} 
                    cx={x} 
                    cy={y} 
                    r={point.hasActivity ? 2 : 1} 
                    fill={colors.accent} 
                    opacity={point.hasActivity ? 1 : 0.4}
                  />
                );
              })}
            </Svg>

            {/* X-axis labels */}
            <View style={styles.labelsRow}>
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <Text style={[styles.axisLabel, { color: colors.textSecondary, fontSize: 10 }]}>
                  {effectiveMemPoints.length > 0 
                    ? new Date(effectiveMemPoints[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'Start'
                  }
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[styles.axisLabel, { color: colors.textSecondary, fontSize: 9 }]}>
                  ECG Timeline {needsHorizontalScroll ? '(Scroll →)' : ''}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.axisLabel, { color: colors.textSecondary, fontSize: 10, fontWeight: '600' }]}>
                  Today
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius:16, borderWidth:1, padding:20, marginBottom:24 },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 },
  title: { fontSize:18, fontWeight:'700' },
  subtitle: { fontSize:12, fontWeight:'500' },
  total: { fontSize:28, fontWeight:'800', lineHeight:32 },
  totalLabel: { fontSize:11, fontWeight:'600', marginTop:-2 },
  legendRow: { flexDirection:'row', gap:16, marginBottom:8 },
  legendItem: { flexDirection:'row', alignItems:'center', gap:6 },
  legendDot: { width:10, height:10, borderRadius:5 },
  legendText: { fontSize:12, fontWeight:'600' },
  legendValue: { fontSize:12, marginLeft:2 },
  emptyBox: { height:160, justifyContent:'center', alignItems:'center' },
  emptyText: { fontSize:14, fontStyle:'italic' },
  labelsRow: { 
    flexDirection:'row', 
    justifyContent: 'space-between',
    paddingTop:8,
    paddingHorizontal: 20 // Add horizontal padding to align with chart padding
  },
  axisLabel: { fontSize:10 },
});
