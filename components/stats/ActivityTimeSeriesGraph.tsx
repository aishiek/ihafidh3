import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import React, { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

interface ActivityData {
  memorizedVerses: Array<{ date: string; count: number }>;
  revisedVerses: Array<{ date: string; count: number }>;
}

interface Props {
  data: ActivityData;
}

type TimeRange = 'week' | 'month' | 'year';

interface DataPoint {
  date: Date;
  dateStr: string;
  memorized: number;
  revised: number;
  label: string;
}

const ActivityTimeSeriesGraph: React.FC<Props> = ({ data }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const { theme: colors } = useUnifiedTheme();

  // Process and aggregate data based on time range
  const chartData = useMemo(() => {
    const memMap: Record<string, number> = {};
    const revMap: Record<string, number> = {};

    data.memorizedVerses.forEach((item) => {
      memMap[item.date] = (memMap[item.date] || 0) + item.count;
    });

    data.revisedVerses.forEach((item) => {
      revMap[item.date] = (revMap[item.date] || 0) + item.count;
    });

    const today = new Date();
    const points: DataPoint[] = [];

    // Helper to format date string
    const getDateStr = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (timeRange === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = getDateStr(date);
        
        points.push({
          date,
          dateStr,
          memorized: memMap[dateStr] || 0,
          revised: revMap[dateStr] || 0,
          label: date.toLocaleDateString('en', { weekday: 'short' })
        });
      }
    } else if (timeRange === 'month') {
      // Last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = getDateStr(date);
        
        points.push({
          date,
          dateStr,
          memorized: memMap[dateStr] || 0,
          revised: revMap[dateStr] || 0,
          label: date.getDate().toString()
        });
      }
    } else {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(today);
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth();

        let memSum = 0;
        let revSum = 0;

        // Aggregate all days in this month
        Object.keys(memMap).forEach((dateStr) => {
          const d = new Date(dateStr);
          if (d.getFullYear() === year && d.getMonth() === month) {
            memSum += memMap[dateStr];
          }
        });

        Object.keys(revMap).forEach((dateStr) => {
          const d = new Date(dateStr);
          if (d.getFullYear() === year && d.getMonth() === month) {
            revSum += revMap[dateStr];
          }
        });

        points.push({
          date,
          dateStr: getDateStr(date),
          memorized: memSum,
          revised: revSum,
          label: date.toLocaleDateString('en', { month: 'short' })
        });
      }
    }

    return points;
  }, [data, timeRange]);

  // Calculate max value for Y-axis scaling
  const maxValue = useMemo(() => {
    const allValues = chartData.flatMap(p => [p.memorized, p.revised]);
    const max = Math.max(...allValues, 5); // Minimum 5 for better visibility
    // Round up to nearest multiple of 5
    return Math.ceil(max / 5) * 5;
  }, [chartData]);

  // SVG dimensions
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 80;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };
  
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  // Scale functions
  const xScale = (index: number) => {
    return padding.left + (index / (chartData.length - 1)) * graphWidth;
  };

  const yScale = (value: number) => {
    return padding.top + graphHeight - (value / maxValue) * graphHeight;
  };

  // Generate Y-axis labels
  const yAxisLabels = useMemo(() => {
    const step = maxValue / 4;
    return [0, 1, 2, 3, 4].map(i => Math.round(i * step));
  }, [maxValue]);

  // Create SVG path for line
  const createLinePath = (points: DataPoint[], getValue: (p: DataPoint) => number): string => {
    if (points.length === 0) return '';
    
    let path = '';
    points.forEach((point, index) => {
      const x = xScale(index);
      const y = yScale(getValue(point));
      
      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        // Smooth curve using quadratic bezier
        const prevX = xScale(index - 1);
        const prevY = yScale(getValue(points[index - 1]));
        const cpX = (prevX + x) / 2;
        
        path += ` Q ${cpX} ${prevY}, ${x} ${y}`;
      }
    });
    
    return path;
  };

  const memPath = createLinePath(chartData, p => p.memorized);
  const revPath = createLinePath(chartData, p => p.revised);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>📈 Activity Trends</Text>
        
        {/* Time Range Selector */}
        <View style={[styles.rangeSelector, { backgroundColor: colors.background }]}>
          {(['week', 'month', 'year'] as TimeRange[]).map((range) => (
            <Pressable
              key={range}
              onPress={() => {
                setTimeRange(range);
                setSelectedPoint(null);
              }}
              style={[
                styles.rangeButton,
                timeRange === range && { backgroundColor: colors.primary }
              ]}
            >
              <Text
                style={[
                  styles.rangeText,
                  { color: timeRange === range ? '#1a1a1a' : colors.textSecondary }
                ]}
              >
                {range === 'week' ? '7D' : range === 'month' ? '30D' : '1Y'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Selected Point Info */}
      {selectedPoint && (
        <View style={[styles.tooltip, { backgroundColor: colors.background }]}>
          <Text style={[styles.tooltipDate, { color: colors.text }]}>
            {selectedPoint.date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <View style={styles.tooltipRow}>
            <View style={styles.tooltipItem}>
              <View style={[styles.tooltipDot, { backgroundColor: '#4ECDC4' }]} />
              <Text style={[styles.tooltipLabel, { color: colors.textSecondary }]}>Memorized:</Text>
              <Text style={[styles.tooltipValue, { color: colors.text }]}>{selectedPoint.memorized}</Text>
            </View>
            <View style={styles.tooltipItem}>
              <View style={[styles.tooltipDot, { backgroundColor: '#FF9800' }]} />
              <Text style={[styles.tooltipLabel, { color: colors.textSecondary }]}>Revised:</Text>
              <Text style={[styles.tooltipValue, { color: colors.text }]}>{selectedPoint.revised}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Chart */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
      >
        <View style={{ width: Math.max(chartWidth, chartData.length * 40) }}>
          <Svg width={chartWidth} height={chartHeight}>
            {/* Y-axis gridlines */}
            {yAxisLabels.map((value) => {
              const y = yScale(value);
              return (
                <React.Fragment key={`grid-${value}`}>
                  <Line
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke={colors.border}
                    strokeWidth={value === 0 ? 1.5 : 0.5}
                    opacity={value === 0 ? 0.4 : 0.15}
                  />
                </React.Fragment>
              );
            })}

            {/* Memorization line */}
            {memPath && (
              <Path
                d={memPath}
                stroke="#4ECDC4"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Revision line */}
            {revPath && (
              <Path
                d={revPath}
                stroke="#FF9800"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points (circles) */}
            {chartData.map((point, index) => {
              const x = xScale(index);
              const memY = yScale(point.memorized);
              const revY = yScale(point.revised);

              return (
                <React.Fragment key={`points-${index}`}>
                  {point.memorized > 0 && (
                    <Circle
                      cx={x}
                      cy={memY}
                      r={4}
                      fill="#4ECDC4"
                      opacity={selectedPoint?.dateStr === point.dateStr ? 1 : 0.8}
                      stroke={colors.card}
                      strokeWidth={selectedPoint?.dateStr === point.dateStr ? 2 : 0}
                    />
                  )}
                  {point.revised > 0 && (
                    <Circle
                      cx={x}
                      cy={revY}
                      r={4}
                      fill="#FF9800"
                      opacity={selectedPoint?.dateStr === point.dateStr ? 1 : 0.8}
                      stroke={colors.card}
                      strokeWidth={selectedPoint?.dateStr === point.dateStr ? 2 : 0}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Y-axis labels */}
          <View style={[styles.yAxisLabels, { height: chartHeight }]}>
            {yAxisLabels.map((value) => {
              const y = yScale(value);
              return (
                <View
                  key={`ylabel-${value}`}
                  style={[styles.yLabel, { top: y - 8 }]}
                >
                  <Text style={[styles.yLabelText, { color: colors.textSecondary }]}>
                    {value}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* X-axis labels with touch areas */}
          <View style={[styles.xAxisLabels, { marginLeft: padding.left }]}>
            {chartData.map((point, index) => {
              const showLabel = timeRange === 'week' 
                ? true 
                : timeRange === 'month'
                  ? index % 5 === 0 || index === chartData.length - 1
                  : true;

              return (
                <Pressable
                  key={`xlabel-${index}`}
                  onPress={() => setSelectedPoint(point)}
                  style={[
                    styles.xLabel,
                    { 
                      width: graphWidth / (chartData.length - 1),
                      marginLeft: index === 0 ? 0 : 0
                    }
                  ]}
                >
                  {showLabel && (
                    <Text
                      style={[
                        styles.xLabelText,
                        { color: selectedPoint?.dateStr === point.dateStr ? colors.primary : colors.textSecondary }
                      ]}
                      numberOfLines={1}
                    >
                      {point.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#4ECDC4' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Memorized</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#FF9800' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Revised</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  rangeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  rangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tooltip: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  tooltipDate: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  tooltipRow: {
    flexDirection: 'row',
    gap: 20,
  },
  tooltipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipLabel: {
    fontSize: 12,
  },
  tooltipValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  yAxisLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
  },
  yLabel: {
    position: 'absolute',
    right: 5,
    alignItems: 'flex-end',
  },
  yLabelText: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  xAxisLabels: {
    flexDirection: 'row',
    marginTop: 8,
    height: 20,
  },
  xLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  xLabelText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLine: {
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default ActivityTimeSeriesGraph;
