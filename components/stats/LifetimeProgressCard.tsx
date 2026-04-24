import { useDayKey } from '@/hooks/useDayKey';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { useProgressStore } from '@/store/progressStore';
import { getOrSetInstallDate } from '@/utils/installDate';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

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
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}

export default function LifetimeProgressCard() {
  const { theme } = useUnifiedTheme();
  const { memorizedVerses, revisedVerses, verseStatus, memorizedVerseDates } = useProgressStore();
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
      // 1. Get or set the install date
      let currentInstallStr = installStr;
      if (!currentInstallStr) {
        currentInstallStr = await getOrSetInstallDate();
        setInstallStr(currentInstallStr);
      }

      const start = currentInstallStr;
      const today = formatDate(new Date());

      // 2. Build activity maps
      const memMap: Record<string, number> = {};
      const revMap: Record<string, number> = {};

      memorizedVerses.forEach(verseId => {
        const date = memorizedVerseDates[verseId] || currentInstallStr;
        memMap[date] = (memMap[date] || 0) + 1;
      });

      revisedVerses.forEach(rv => {
        const dateKey = rv.revisionDate || currentInstallStr;
        revMap[dateKey] = (revMap[dateKey] || 0) + 1;
      });

      // 3. Create ECG-style daily timeline from install date to today
      const startDate = new Date(start + 'T00:00:00');
      const todayDate = new Date(today + 'T00:00:00');

      // Add a "Day 0" point at zero so the graph starts from the baseline
      const dayZeroDate = addDays(startDate, -1);
      const dayZeroStr = formatDate(dayZeroDate);
      
      const dailyTimeline: SeriesPoint[] = [{
        x: 0,
        y: 0,
        date: dayZeroStr,
        total: 0,
        hasActivity: false,
        activityCount: 0,
        memTotal: 0,
        revTotal: 0,
        memActivity: 0,
        revActivity: 0
      }];

      let runningMem = 0;
      let runningRev = 0;

      let currentDate = new Date(startDate);
      while (currentDate <= todayDate) {
        const dateStr = formatDate(currentDate);
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

        currentDate = addDays(currentDate, 1);
      }

      // 4. Create separate memorization and revision timelines
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

    load().catch(err => {
      console.error('[LifetimeProgress] Error in load():', err);
    });
  }, [memorizedVerses.length, revisedVerses.length, memorizedVerseDates, dayKey]); 

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
  // Get screen dimensions and calculate responsive width
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 40;
  const availableWidth = screenWidth - cardPadding;

  // Chart layout dimensions
  const height = 220;
  const pad = {
    top: 20,
    right: 40, // Increased to prevent max-date label clipping
    bottom: 40,
    left: Math.max(45, availableWidth * 0.12)
  };

  // Scrollable width calculation - each day gets a minimum width
  const minDayWidth = 6;
  const maxDayWidth = 16;
  
  const chartContentWidth = availableWidth - pad.left - pad.right;
  let dayWidth = effectivePointCount > 1 
    ? Math.max(minDayWidth, chartContentWidth / (effectivePointCount - 1))
    : maxDayWidth;

  // Chart dimensions - exact width needed for all points plus padding
  const totalChartWidth = pad.left + (effectivePointCount > 0 ? (effectivePointCount - 1) * dayWidth : 0) + pad.right;
  const needsHorizontalScroll = totalChartWidth > availableWidth;

  const chartWidth = needsHorizontalScroll
    ? totalChartWidth
    : availableWidth;

  // Layout - responsive dimensions
  const width = Math.min(availableWidth, chartWidth);

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

  // Smooth cumulative path function
  const createCumulativePath = (series: SeriesPoint[], xOffset: number = 0) => {
    if (series.length === 0) return '';
    const xAt = (idx: number) => pad.left + idx * dayWidth + xOffset;
    
    let d = `M ${xAt(0)} ${yScale(series[0].total)}`;
    for (let i = 1; i < series.length; i++) {
        d += ` L ${xAt(i)} ${yScale(series[i].total)}`;
    }
    return d;
  };

  const createAreaPath = (series: SeriesPoint[], xOffset: number = 0) => {
    if (series.length < 2) return '';
    const xAt = (idx: number) => pad.left + idx * dayWidth + xOffset;
    const baselineY = yScale(0);
    
    let d = `M ${xAt(0)} ${baselineY}`;
    for (let i = 0; i < series.length; i++) {
      d += ` L ${xAt(i)} ${yScale(series[i].total)}`;
    }
    d += ` L ${xAt(series.length - 1)} ${baselineY} Z`;
    return d;
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Lifetime Progress</Text>
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
          <View style={{ width: chartWidth + 20 /* Add safe buffer to right side */ }}>
            <Svg width={chartWidth + 20} height={height}>
              <Defs>
                <LinearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
                </LinearGradient>
                <LinearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.2" />
                  <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
                </LinearGradient>
              </Defs>

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
                      strokeWidth={isZero || isMax ? 1.5 : 1}
                      opacity={isZero || isMax ? 0.3 : 0.15}
                    />
                    <SvgText
                      x={pad.left - 8}
                      y={y + 4}
                      fontSize={10}
                      fill={colors.textSecondary}
                      textAnchor="end"
                    >
                      {value === 6236 ? '6.2k' : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Area Fills */}
              <Path d={createAreaPath(effectiveMemPoints)} fill="url(#memGradient)" />
              {showRevisedLine && (
                <Path d={createAreaPath(effectiveRevPoints)} fill="url(#revGradient)" />
              )}

              {/* Smooth Lines */}
              <AnimatedPath 
                d={createCumulativePath(effectiveMemPoints)} 
                stroke={colors.primary} 
                strokeWidth={3} 
                fill="none" 
                entering={FadeIn.duration(800)} 
              />

              {showRevisedLine && (
                <AnimatedPath 
                  d={createCumulativePath(effectiveRevPoints)} 
                  stroke={colors.accent} 
                  strokeWidth={2} 
                  strokeDasharray="4 2"
                  fill="none" 
                  entering={FadeIn.duration(800)} 
                />
              )}

              {/* Activity markers (dots only on active days) */}
              {effectiveMemPoints.map((point, index) => {
                if (!point.hasActivity) return null;
                const x = pad.left + index * dayWidth;
                const y = yScale(point.total);
                return <Circle key={`m-dot-${index}`} cx={x} cy={y} r={3.5} fill={colors.primary} />;
              })}

              {/* Revised Activity markers */}
              {showRevisedLine && effectiveRevPoints.map((point, index) => {
                if (!point.hasActivity) return null;
                const x = pad.left + index * dayWidth;
                const y = yScale(point.total);
                return <Circle key={`r-dot-${index}`} cx={x} cy={y} r={3.5} fill={colors.accent} />;
              })}

              {/* Revised Activity markers (Small dots for activity days) */}
              {showRevisedLine && effectiveRevPoints.filter(p => p.hasActivity).map((point, index) => {
                const x = pad.left + effectiveRevPoints.indexOf(point) * dayWidth;
                const y = yScale(point.total);
                return <Circle key={`r-dot-${index}`} cx={x} cy={y} r={3} fill={colors.accent} />;
              })}

              {/* X-axis labels (Start, Middle, End) inside SVG for perfect alignment */}
              {effectiveMemPoints.length > 1 && (
                <G>
                  {/* Start Date */}
                  <SvgText
                    x={pad.left}
                    y={height - 5}
                    fontSize={10}
                    fill={colors.textSecondary}
                    textAnchor="start"
                  >
                    {new Date(effectiveMemPoints[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </SvgText>

                  {/* Middle Date (Only if we have ample padding and points) */}
                  {effectiveMemPoints.length > 25 && needsHorizontalScroll && (
                    <SvgText
                      x={pad.left + Math.floor(effectiveMemPoints.length / 2) * dayWidth}
                      y={height - 5}
                      fontSize={10}
                      fill={colors.textSecondary}
                      textAnchor="middle"
                    >
                      {new Date(effectiveMemPoints[Math.floor(effectiveMemPoints.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </SvgText>
                  )}

                  {/* End Date */}
                  <SvgText
                    x={pad.left + (effectiveMemPoints.length - 1) * dayWidth}
                    y={height - 5}
                    fontSize={10}
                    fill={colors.textSecondary}
                    textAnchor="end"
                  >
                    {new Date(effectiveMemPoints[effectiveMemPoints.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </SvgText>
                </G>
              )}
            </Svg>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500' },
  total: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  totalLabel: { fontSize: 11, fontWeight: '600', marginTop: -2 },
  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: '600' },
  legendValue: { fontSize: 12, marginLeft: 2 },
  emptyBox: { height: 160, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
});
