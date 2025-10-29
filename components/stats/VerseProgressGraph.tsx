import React, { memo, useMemo } from 'react';
import { Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

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
  const graphHeight = 240;
  const chartPadding = { top: 24, bottom: 48, left: 12, right: 12 };
  
  const denominator = totalVerses || TOTAL_VERSES;
  const minBarHeight = 4;

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
  
  // Calculate bar dimensions - Modern thinner bars
  let barSpacing: number;
  let barWidth: number;
  let graphWidth: number;
  
  if (needsScrolling) {
    // Thinner bars for scrollable views
    barWidth = timeRange === 'month' ? 10 : 14;
    barSpacing = timeRange === 'month' ? 8 : 12;
    const totalBarWidth = stackedData.length * barWidth + (stackedData.length - 1) * barSpacing;
    graphWidth = Math.max(availableScreenWidth, totalBarWidth + chartPadding.left + chartPadding.right);
  } else {
    graphWidth = availableScreenWidth;
    const availableWidth = graphWidth - chartPadding.left - chartPadding.right;
    
    if (timeRange === 'day') {
      barWidth = 24;
      barSpacing = 0;
    } else {
      // More generous spacing for better visual breathing room
      barSpacing = stackedData.length <= 7 ? 16 : 12;
      const totalSpacing = barSpacing * (stackedData.length - 1);
      barWidth = Math.max(6, Math.min(20, (availableWidth - totalSpacing) / stackedData.length));
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
        
        {/* Gridlines - Modern minimal styling */}
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
                strokeWidth={isTop ? 1.5 : 0.8}
                opacity={isTop ? 0.4 : 0.15}
                strokeDasharray={isTop ? undefined : '2 4'}
              />
            </React.Fragment>
          );
        })}

        {/* Stacked Bars - Modern sleek design */}
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

          // Modern color scheme with enhanced contrast
          const memColor = colors.primaryLight;
          const revColor = colors.primary;
          
          // Enhanced opacity for better visual hierarchy
          const opacityMem = item._mem === 0 ? 0.08 : (item.isCurrentPeriod ? 0.95 : 0.65);
          const opacityRev = item._rev === 0 ? 0.08 : (item.isCurrentPeriod ? 1 : 0.75);
          
          // Increased border radius for sleeker look
          const borderRadius = Math.min(barWidth / 2, 6);

          return (
            <React.Fragment key={`bar-${index}-${item.date.getTime()}`}>
              {/* Background shadow for depth (only for current period) */}
              {item.isCurrentPeriod && (adjustedMemHeight > 0 || adjustedRevHeight > 0) && (
                <Rect
                  x={x - 1}
                  y={adjustedRevHeight > 0 ? revY - 1 : memY - 1}
                  width={barWidth + 2}
                  height={(adjustedRevHeight > 0 ? adjustedRevHeight : 0) + adjustedMemHeight + 2}
                  rx={borderRadius + 1}
                  ry={borderRadius + 1}
                  fill={colors.primary}
                  opacity={0.2}
                />
              )}
              
              {/* Memorized segment */}
              {adjustedMemHeight > 0 && (
                <SafeAnimatedRect
                  barKey={`mem-${index}-${item.date.getTime()}`}
                  x={x}
                  y={memY}
                  width={barWidth}
                  height={adjustedMemHeight}
                  rx={borderRadius}
                  ry={borderRadius}
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
                  rx={borderRadius}
                  ry={borderRadius}
                  fill={revColor}
                  opacity={opacityRev}
                  index={index}
                />
              )}
              
              {/* Subtle highlight on top for active bars */}
              {item.isCurrentPeriod && adjustedRevHeight > 0 && (
                <Rect
                  x={x}
                  y={revY}
                  width={barWidth}
                  height={Math.min(adjustedRevHeight / 3, 3)}
                  rx={borderRadius}
                  ry={borderRadius}
                  fill="#FFFFFF"
                  opacity={0.3}
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
    marginTop: 16,
  },
  emptyContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  labelsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  labelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 13,
    letterSpacing: 0.2,
  },
});
