import React, { memo, useMemo } from 'react';
import { Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

// Constants
const TOTAL_VERSES = 6236;

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
  x, y, width, height, fill, opacity, barKey, index
}: {
  x: number;
  y: number;
  width: number;
  height: number;
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
        fill={fill}
        opacity={opacity}
      />
    );
  }
});

SafeAnimatedRect.displayName = 'SafeAnimatedRect';

const getScaleSettings = (maxValue: number) => {
  let scale, step;

  if (maxValue <= 500) {
    scale = 500;
    step = 100;
  } else if (maxValue <= 1000) {
    scale = 1000;
    step = 200;
  } else if (maxValue <= 1500) {
    scale = 1500;
    step = 300;
  } else if (maxValue <= 2000) {
    scale = 2000;
    step = 400;
  } else if (maxValue <= 2500) {
    scale = 2500;
    step = 500;
  } else if (maxValue <= 6236) {
    scale = 6236;
    step = 1000; // Large steps for full Quran scale
  } else {
    scale = Math.ceil(maxValue / 1000) * 1000;
    step = scale / 5;
  }

  const labels = [];
  for (let i = 0; i < scale; i += step) {
    if (i === 0) {
      labels.push('0');
    } else if (i >= 1000) {
      labels.push(`${(i / 1000).toFixed(1).replace('.0', '')}K`);
    } else {
      labels.push(i.toString());
    }
  }
  // Always include the actual scale if it's 6236 or if it's the last label
  if (scale === 6236) {
    labels.push('6.2K');
  } else if (scale >= 1000) {
    labels.push(`${(scale / 1000).toFixed(1).replace('.0', '')}K`);
  } else {
    labels.push(scale.toString());
  }

  return { labels, scale };
};

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

  // Filter and deduplicate data
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

      const dateStr = item.date.toISOString().split('T')[0];
      const dateKey = timeRange === 'week'
        ? `${dateStr}-${item.label}`
        : `${item.date.getTime()}-${item.label}`;

      if (!dataMap.has(dateKey) || (timeRange === 'week' && item.isCurrentPeriod)) {
        dataMap.set(dateKey, item);
      }
    });

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

  // Layout calculations
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 32;
  const availableScreenWidth = screenWidth - cardPadding;
  const graphHeight = 240;
  const yAxisWidth = 45; // Space for Y-axis labels
  const chartPadding = { top: 24, bottom: 48, left: 12 + yAxisWidth, right: 12 };

  const minBarHeight = 3;
  const availableHeight = graphHeight - chartPadding.top - chartPadding.bottom;

  // Calculate local max for dynamic scaling
  const rawMaxValue = useMemo(() => {
    const lastPoint = processedData[processedData.length - 1];
    const maxVal = Math.max(lastPoint.cumulativeMemorized + lastPoint.cumulativeRevised, 1);
    return maxVal;
  }, [processedData]);

  const { labels: yAxisLabels, scale: denominator } = useMemo(() => getScaleSettings(rawMaxValue), [rawMaxValue]);

  // Process stacked bar data
  const stackedData = useMemo(() => {
    return processedData.map(d => {
      const mem = Math.max(0, Math.min(d.cumulativeMemorized, denominator));
      const rev = Math.max(0, Math.min(d.cumulativeRevised, denominator));
      const total = Math.min(mem + rev, denominator);
      return { ...d, _mem: mem, _rev: rev, _total: total };
    });
  }, [processedData, denominator]);

  // Generate gridlines based on getScaleSettings labels
  const gridlines = useMemo(() => {
    const step = denominator / (yAxisLabels.length - 1);
    const lines = [];
    for (let i = 0; i < yAxisLabels.length; i++) {
      lines.push(i * step);
    }
    return lines;
  }, [denominator, yAxisLabels]);

  // Determine if scrolling is needed
  const needsScrolling = timeRange === 'month' || timeRange === 'year';

  // Calculate bar dimensions - Clean rectangular bars
  let barSpacing: number;
  let barWidth: number;
  let graphWidth: number;

  if (needsScrolling) {
    barWidth = timeRange === 'month' ? 12 : 16;
    barSpacing = timeRange === 'month' ? 10 : 14;
    const totalBarWidth = stackedData.length * barWidth + (stackedData.length - 1) * barSpacing;
    graphWidth = Math.max(availableScreenWidth, totalBarWidth + chartPadding.left + chartPadding.right);
  } else {
    graphWidth = availableScreenWidth;
    const availableWidth = graphWidth - chartPadding.left - chartPadding.right;

    if (timeRange === 'day') {
      barWidth = 32;
      barSpacing = 0;
    } else {
      barSpacing = stackedData.length <= 7 ? 18 : 14;
      const totalSpacing = barSpacing * (stackedData.length - 1);
      barWidth = Math.max(8, Math.min(24, (availableWidth - totalSpacing) / stackedData.length));
    }
  }



  // Graph content component
  const GraphContent = () => (
    <View style={{ width: graphWidth }}>
      {/* Y-axis labels */}
      <View style={[styles.yAxisContainer, { height: graphHeight }]}>
        {gridlines.map((val) => {
          const ratio = val / denominator;
          const y = graphHeight - chartPadding.bottom - ratio * availableHeight;

          return (
            <View
              key={`ylabel-${val}`}
              style={[styles.yAxisLabel, { top: y - 8 }]}
            >
              <Text style={[styles.yAxisText, { color: colors.textSecondary }]}>
                {yAxisLabels[gridlines.indexOf(val)]}
              </Text>
            </View>
          );
        })}
      </View>

      <Svg width={graphWidth} height={graphHeight}>
        {/* Baseline */}
        <Line
          x1={chartPadding.left}
          y1={graphHeight - chartPadding.bottom}
          x2={graphWidth - chartPadding.right}
          y2={graphHeight - chartPadding.bottom}
          stroke={colors.border}
          strokeWidth={1.5}
          opacity={0.4}
        />

        {/* Gridlines */}
        {gridlines.map((val) => {
          const ratio = val / denominator;
          const y = graphHeight - chartPadding.bottom - ratio * availableHeight;
          const isTop = val === denominator;

          return (
            <Line
              key={`grid-${val}`}
              x1={chartPadding.left}
              y1={y}
              x2={graphWidth - chartPadding.right}
              y2={y}
              stroke={colors.border}
              strokeWidth={isTop ? 1.5 : 0.8}
              opacity={isTop ? 0.4 : 0.15}
              strokeDasharray={isTop ? undefined : '3 5'}
            />
          );
        })}

        {/* Clean rectangular stacked bars */}
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

          // Clean color scheme
          const memColor = colors.primaryLight;
          const revColor = colors.primary;

          const opacityMem = item._mem === 0 ? 0.1 : (item.isCurrentPeriod ? 0.85 : 0.6);
          const opacityRev = item._rev === 0 ? 0.1 : (item.isCurrentPeriod ? 1 : 0.7);

          return (
            <React.Fragment key={`bar-${index}-${item.date.getTime()}`}>
              {/* Memorized segment - rectangular */}
              {adjustedMemHeight > 0 && (
                <SafeAnimatedRect
                  barKey={`mem-${index}-${item.date.getTime()}`}
                  x={x}
                  y={memY}
                  width={barWidth}
                  height={adjustedMemHeight}
                  fill={memColor}
                  opacity={opacityMem}
                  index={index}
                />
              )}

              {/* Revised segment - rectangular */}
              {adjustedRevHeight > 0 && (
                <SafeAnimatedRect
                  barKey={`rev-${index}-${item.date.getTime()}`}
                  x={x}
                  y={revY}
                  width={barWidth}
                  height={adjustedRevHeight}
                  fill={revColor}
                  opacity={opacityRev}
                  index={index}
                />
              )}

              {/* Subtle border for current period */}
              {item.isCurrentPeriod && (adjustedMemHeight > 0 || adjustedRevHeight > 0) && (
                <Rect
                  x={x}
                  y={adjustedRevHeight > 0 ? revY : memY}
                  width={barWidth}
                  height={(adjustedRevHeight > 0 ? adjustedRevHeight : 0) + adjustedMemHeight}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={1.5}
                  opacity={0.4}
                />
              )}
            </React.Fragment>
          );
        })}
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
  yAxisContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    zIndex: 1,
  },
  yAxisLabel: {
    position: 'absolute',
    left: 0,
    width: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 16,
  },
  yAxisText: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  labelsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
    marginLeft: 40, // Offset for Y-axis
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