import React, { memo, useMemo } from 'react';
import { Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

// Constants
const TOTAL_VERSES = 6236; // Default total Quran verses

export type TimeRange = 'day' | 'week' | 'month' | 'year';

export interface VerseProgressData {
  date: Date;
  cumulativeMemorized: number;
  cumulativeRevised: number;
  label: string;
  isCurrentPeriod: boolean;
}

interface Props {
  timeRange: TimeRange;
  data: VerseProgressData[];
  totalVerses?: number;
  colors: {
    primary: string;
    primaryLight: string;
    text: string;
    textSecondary: string;
    background: string;
    border: string;
    accent: string;
  };
  onBarPress?: (item: VerseProgressData) => void;
}

// Safe AnimatedRect component
const SafeAnimatedRect = memo(({ 
  x, y, width, height, rx, ry, fill, opacity, barKey, index 
}: { 
  x: number; 
  y: number; 
  width: number; 
  height: number; 
  rx: number; 
  ry: number; 
  fill: string; 
  opacity: number; 
  barKey: string;
  index: number;
}) => {
  try {
    if (Platform.OS === 'android') {
      return (
        <Rect
          key={barKey}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={rx}
          ry={ry}
          fill={fill}
          opacity={opacity}
        />
      );
    }
    
    const AnimatedRect = Animated.createAnimatedComponent(Rect);
    return (
      <AnimatedRect
        key={barKey}
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        ry={ry}
        fill={fill}
        opacity={opacity}
        entering={FadeIn.duration(300).delay(index * 30)}
        exiting={FadeOut.duration(150)}
      />
    );
  } catch (error) {
    console.warn('AnimatedRect render error:', error);
    return (
      <Rect
        key={barKey}
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        ry={ry}
        fill={fill}
        opacity={opacity}
      />
    );
  }
});

SafeAnimatedRect.displayName = 'SafeAnimatedRect';

export default function VerseProgressGraph({ 
  timeRange, 
  data, 
  totalVerses = TOTAL_VERSES, 
  colors, 
  onBarPress 
}: Props) {
  // Validate props
  if (!data || data.length === 0 || !colors || !timeRange) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors?.background || '#f0f0f0' }]}>
        <Text style={[styles.emptyText, { color: colors?.textSecondary || '#666' }]}>
          No activity data yet
        </Text>
      </View>
    );
  }

  // Filter and deduplicate data by date with enhanced logic
  const processedData = useMemo(() => {
    const dataMap = new Map<string, VerseProgressData>();
    
    data.forEach(item => {
      if (
        !item || 
        typeof item.cumulativeMemorized !== 'number' ||
        typeof item.cumulativeRevised !== 'number' ||
        !(item.date instanceof Date) || 
        typeof item.label !== 'string'
      ) {
        return;
      }

      // Create a more specific unique key to prevent over-deduplication
      // For week view, include the actual date to distinguish different days with same label
      const dateStr = item.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      const dateKey = timeRange === 'week' 
        ? `${dateStr}-${item.label}` // Use full date for week to allow same day names
        : `${item.date.getTime()}-${item.label}`;
      
      // For week view, prioritize keeping the most recent or current period
      if (!dataMap.has(dateKey) || (timeRange === 'week' && item.isCurrentPeriod)) {
        dataMap.set(dateKey, item);
      }
    });

    // Convert back to array and sort by date
    return Array.from(dataMap.values()).sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );
  }, [data, timeRange]);

  if (processedData.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Invalid data format
        </Text>
      </View>
    );
  }

  // Screen and layout calculations
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 32;
  const availableScreenWidth = screenWidth - cardPadding;
  const graphHeight = 220;
  const chartPadding = { top: 20, bottom: 40, left: 8, right: 8 };
  
  const denominator = totalVerses || TOTAL_VERSES;
  const minBarHeight = 3;

  // Process stacked bar data
  const stackedData = useMemo(() => {
    return processedData.map(d => {
      const mem = Math.max(0, Math.min(d.cumulativeMemorized, denominator));
      const rev = Math.max(0, Math.min(d.cumulativeRevised, denominator));
      const total = Math.min(mem + rev, denominator);
      return { ...d, _mem: mem, _rev: rev, _total: total };
    });
  }, [processedData, denominator]);

  // Calculate global progress
  const globalProgress = stackedData.length > 0 
    ? stackedData[stackedData.length - 1]._total 
    : 0;

  // Dynamic gridline interval
  const gridInterval = useMemo(() => {
    const candidates = [200, 400, 800, 1000];
    const targetLines = 5;
    const approx = globalProgress / targetLines;
    let chosen = candidates[0];
    
    for (const c of candidates) {
      if (approx <= c) {
        chosen = c;
        break;
      }
      chosen = c;
    }
    
    return chosen;
  }, [globalProgress]);

  // Generate gridlines
  const gridlines = useMemo(() => {
    const lines: number[] = [];
    for (let v = gridInterval; v < denominator; v += gridInterval) {
      lines.push(v);
      if (lines.length > 12) break;
    }
    lines.push(denominator);
    return lines;
  }, [gridInterval, denominator]);
  
  // Determine if scrolling is needed
  const needsScrolling = timeRange === 'month' || timeRange === 'year';
  
  // Calculate bar dimensions
  let barSpacing: number;
  let barWidth: number;
  let graphWidth: number;
  
  if (needsScrolling) {
    barWidth = timeRange === 'month' ? 16 : 24;
    barSpacing = timeRange === 'month' ? 4 : 8;
    const totalBarWidth = stackedData.length * barWidth + (stackedData.length - 1) * barSpacing;
    graphWidth = Math.max(availableScreenWidth, totalBarWidth + chartPadding.left + chartPadding.right);
  } else {
    graphWidth = availableScreenWidth;
    const availableWidth = graphWidth - chartPadding.left - chartPadding.right;
    
    if (timeRange === 'day') {
      barWidth = 32;
      barSpacing = 0;
    } else {
      barSpacing = stackedData.length <= 7 ? 12 : 8;
      const totalSpacing = barSpacing * (stackedData.length - 1);
      barWidth = Math.max(8, Math.min(32, (availableWidth - totalSpacing) / stackedData.length));
    }
  }
  
  const availableHeight = graphHeight - chartPadding.top - chartPadding.bottom;

  // Graph content component
  const GraphContent = () => (
    <View style={{ width: graphWidth }}>
      <Svg width={graphWidth} height={graphHeight}>
        {/* Baseline */}
        <Line
          x1={chartPadding.left}
          y1={graphHeight - chartPadding.bottom}
          x2={graphWidth - chartPadding.right}
          y2={graphHeight - chartPadding.bottom}
          stroke={colors.border}
          strokeWidth={1}
          opacity={0.3}
        />
        
        {/* Gridlines */}
        {gridlines.map((val) => {
          const ratio = val / denominator;
          const y = graphHeight - chartPadding.bottom - ratio * availableHeight;
          const isTop = val === denominator;
          
          return (
            <React.Fragment key={`grid-${val}`}>
              <Line
                x1={chartPadding.left}
                y1={y}
                x2={graphWidth - chartPadding.right}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
                opacity={isTop ? 0.6 : 0.25}
                strokeDasharray={isTop ? '0' : '4 4'}
              />
              {/* Y-axis labels removed for cleaner appearance */}
            </React.Fragment>
          );
        })}

        {/* Stacked Bars */}
        {stackedData.map((item, index) => {
          const totalHeight = item._total > 0 
            ? Math.max(minBarHeight, (item._total / denominator) * availableHeight) 
            : 0;
          const memHeight = item._mem > 0 
            ? Math.max(minBarHeight, (item._mem / denominator) * availableHeight) 
            : 0;
          const revHeight = item._rev > 0 
            ? Math.max(minBarHeight, (item._rev / denominator) * availableHeight) 
            : 0;

          // Adjust heights to prevent overflow
          const adjustedMemHeight = item._rev > 0 && memHeight + revHeight > totalHeight 
            ? Math.max(minBarHeight, totalHeight - revHeight) 
            : memHeight;
          const adjustedRevHeight = revHeight;

          // Calculate x position
          let x: number;
          if (timeRange === 'day') {
            x = (graphWidth - barWidth) / 2;
          } else {
            x = chartPadding.left + index * (barWidth + barSpacing);
          }

          const baseY = graphHeight - chartPadding.bottom;
          const memY = baseY - adjustedMemHeight;
          const revY = memY - adjustedRevHeight;

          const memColor = colors.primaryLight;
          const revColor = colors.primary;
          const opacityMem = item._mem === 0 ? 0.12 : (item.isCurrentPeriod ? 0.9 : 0.75);
          const opacityRev = item._rev === 0 ? 0.12 : (item.isCurrentPeriod ? 1 : 0.85);

          return (
            <React.Fragment key={`bar-${index}-${item.date.getTime()}`}>
              {/* Memorized segment */}
              {adjustedMemHeight > 0 && (
                <SafeAnimatedRect
                  barKey={`mem-${index}-${item.date.getTime()}`}
                  x={x}
                  y={memY}
                  width={barWidth}
                  height={adjustedMemHeight}
                  rx={4}
                  ry={4}
                  fill={memColor}
                  opacity={opacityMem}
                  index={index}
                />
              )}
              {/* Revised segment */}
              {adjustedRevHeight > 0 && (
                <SafeAnimatedRect
                  barKey={`rev-${index}-${item.date.getTime()}`}
                  x={x}
                  y={revY}
                  width={barWidth}
                  height={adjustedRevHeight}
                  rx={4}
                  ry={4}
                  fill={revColor}
                  opacity={opacityRev}
                  index={index}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Value labels removed for cleaner chart */}
      </Svg>

      {/* X-axis labels */}
      <View style={styles.labelsContainer}>
        {stackedData.map((item, index) => {
          let x: number;
          let marginLeft: number;
          
          if (timeRange === 'day') {
            x = (graphWidth - barWidth) / 2;
            marginLeft = x;
          } else {
            x = chartPadding.left + index * (barWidth + barSpacing);
            marginLeft = index === 0 ? x : barSpacing;
          }
          
          return (
            <Pressable
              key={`label-${index}-${item.date.getTime()}`}
              onPress={() => onBarPress?.(item)}
              style={[
                styles.labelWrapper,
                {
                  width: barWidth,
                  marginLeft,
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}, ${item._total} verses (Memorized: ${item._mem}, Revised: ${item._rev})`}
            >
              <Text
                style={[
                  styles.label,
                  { 
                    color: item.isCurrentPeriod ? colors.primary : colors.textSecondary,
                    fontWeight: item.isCurrentPeriod ? '700' : '500'
                  }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {needsScrolling ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          <GraphContent />
        </ScrollView>
      ) : (
        <GraphContent />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  emptyContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  labelsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  labelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 14,
  },
});
