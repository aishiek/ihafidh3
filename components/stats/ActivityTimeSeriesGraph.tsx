import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import React, { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

interface ActivityData {
  memorizedVerses: Array<{ date: string; count: number }>;
  revisedVerses: Array<{ date: string; count: number }>;
}

interface PageActivityData {
  memorizedPages: Array<{ date: string; count: number }>;
  revisedPages: Array<{ date: string; count: number }>;
}

interface Props {
  data: ActivityData;
  pageData?: PageActivityData;
}

type TimeRange = 'week' | 'month' | 'year';
type DataType = 'verses' | 'pages';

interface DataPoint {
  date: Date;
  dateStr: string;
  memorized: number;
  revised: number;
  label: string;
}

const ActivityTimeSeriesGraph: React.FC<Props> = ({ data, pageData }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [dataType, setDataType] = useState<DataType>('verses');
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const { theme: colors } = useUnifiedTheme();

  // Process and aggregate data based on time range
  const chartData = useMemo(() => {
    const memMap: Record<string, number> = {};
    const revMap: Record<string, number> = {};

    if (dataType === 'pages' && pageData) {
      pageData.memorizedPages.forEach((item) => {
        memMap[item.date] = (memMap[item.date] || 0) + item.count;
      });
      pageData.revisedPages.forEach((item) => {
        revMap[item.date] = (revMap[item.date] || 0) + item.count;
      });
    } else {
      data.memorizedVerses.forEach((item) => {
        memMap[item.date] = (memMap[item.date] || 0) + item.count;
      });
      data.revisedVerses.forEach((item) => {
        revMap[item.date] = (revMap[item.date] || 0) + item.count;
      });
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);

    const points: DataPoint[] = [];

    // Helper to format date string
    const getDateStr = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (timeRange === 'week') {
      // Last 7 days, but strict cut-off at Jan 1 Current Year
      // We start from 6 days ago (or less if close to Jan 1)

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // STRICT FILTER: Stop if date is before Jan 1
        if (date < startOfYear) continue;

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
      // Last 30 days, but strict cut-off at Jan 1 Current Year
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // STRICT FILTER: Stop if date is before Jan 1
        if (date < startOfYear) continue;

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
      // Last 12 months (History allowed)
      // Actually user said "history data should only apply for Year tab"
      // So '1Y' tab can show history, but maybe we should stick to 'current year' months?
      // "all other tabs should reflect for 2026 and no longer display 2025"
      // Usually "1Y" trend means last 12 months. 
      // User says "Year Mode" -> ok, let's keep it as Last 12 Months for trend context, 
      // or strictly Current Year months?
      // Since BarChart 'Yearly' shows last 3 years, let's make this '1Y' show strictly Current Year months?
      // But standard graph '1Y' usually implies rolling.
      // Given "just keep it in the year section", I'll make 1Y show LAST 12 MONTHS but maybe the user implicitly meant 
      // strict 2026? 
      // Actually, for a Trend Graph, showing just "Jan" when it's Jan 3rd is very empty.
      // I will keep 1Y as rolling 12 months for now unless explicitly asked to truncate, 
      // as "Year section" in Bar Chart handles the specific year buckets.
      // WAIT, re-reading: "7D, 30D and 1Y ... just keep it in the year section"
      // This implies 7D, 30D should be strict, but 1Y might be the "Year Mode".
      // Let's stick to Rolling for 1Y to populate the graph, but strict for 7D/30D.

      for (let i = 11; i >= 0; i--) {
        const date = new Date(today);
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth();

        let memSum = 0;
        let revSum = 0;

        // Aggregate all days in this month
        Object.keys(memMap).forEach((dateStr) => {
          const [yStr, mStr] = dateStr.split('-');
          const dYear = parseInt(yStr, 10);
          const dMonth = parseInt(mStr, 10) - 1;

          if (dYear === year && dMonth === month) {
            memSum += memMap[dateStr];
          }
        });

        Object.keys(revMap).forEach((dateStr) => {
          const [yStr, mStr] = dateStr.split('-');
          const dYear = parseInt(yStr, 10);
          const dMonth = parseInt(mStr, 10) - 1;

          if (dYear === year && dMonth === month) {
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
  }, [data, pageData, timeRange, dataType]);

  // Calculate max value for Y-axis scaling
  const maxValue = useMemo(() => {
    const allValues = chartData.flatMap(p => [p.memorized, p.revised]);
    // Filter out NaNs and ensure we have numbers
    const validValues = allValues.filter(v => typeof v === 'number' && !isNaN(v));

    if (validValues.length === 0) return 5;

    const max = Math.max(...validValues);
    // If max is small (e.g. < 5), use 5. If large, scale nicely.
    // User complaint: "50 is not displayed correctly".
    // We want a nice round number above max.
    const ceil = Math.ceil(max / 5) * 5;
    return Math.max(ceil, 5);
  }, [chartData]);

  // SVG dimensions
  const screenWidth = Dimensions.get('window').width;
  // Reduce width slightly to account for padding
  const chartWidth = screenWidth - 60;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };

  // Calculate actual content width (for scrolling)
  // Ensure strict minimal width 
  const pointWidth = 50;
  const contentWidth = Math.max(chartWidth, chartData.length * pointWidth);
  const graphWidth = contentWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  // Scale functions
  const xScale = (index: number) => {
    // Handle single data point case to avoid division by zero
    if (chartData.length <= 1) {
      return padding.left + graphWidth / 2; // Center the single point
    }
    const x = padding.left + (index / (chartData.length - 1)) * graphWidth;
    return isNaN(x) ? padding.left : x;
  };

  const yScale = (value: number) => {
    const safeValue = isNaN(value) ? 0 : value;
    const safeMax = maxValue || 5; // Prevent division by zero
    const y = padding.top + graphHeight - (safeValue / safeMax) * graphHeight;
    return isNaN(y) ? padding.top + graphHeight : y;
  };

  // Generate Y-axis labels
  const yAxisLabels = useMemo(() => {
    // Generate 5 ticks: 0, 25%, 50%, 75%, 100%
    const step = maxValue / 4;
    return [0, 1, 2, 3, 4].map(i => Math.round(i * step));
  }, [maxValue]);

  // Create SVG path for line
  const createLinePath = (points: DataPoint[], getValue: (p: DataPoint) => number): string => {
    if (points.length === 0) return '';
    // If single point, render a dot? Path needs at least 2 points to be a line? 
    // Actually we render circles for points anyway, so line can be empty if 1 point.
    if (points.length < 2) return '';

    let path = '';
    points.forEach((point, index) => {
      const x = xScale(index);
      const val = getValue(point);
      const y = yScale(val);

      if (isNaN(x) || isNaN(y)) return;

      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        // Smooth curve using quadratic bezier
        const prevX = xScale(index - 1);
        const prevVal = getValue(points[index - 1]);
        const prevY = yScale(prevVal);

        if (isNaN(prevX) || isNaN(prevY)) {
          path += ` M ${x} ${y}`; // Restart path if previous point was invalid
        } else {
          const cpX = (prevX + x) / 2;
          // Use simpler straight lines if points are too close? No, quadratic is fine.
          path += ` Q ${cpX} ${prevY}, ${x} ${y}`;
        }
      }
    });

    return path;
  };

  const memPath = createLinePath(chartData, p => p.memorized);
  const revPath = createLinePath(chartData, p => p.revised);

  const scrollViewRef = React.useRef<ScrollView>(null);

  // Auto-scroll to end when data or timeRange changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [timeRange, chartData.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* 
        Header Stack:
        Row 1: Title
        Row 2: 7D/30D/1Y Tabs
        Row 3: Verses/Pages Toggle
      */}
      <View style={styles.headerStack}>
        <Text style={[styles.title, { color: colors.text }]}>📈 Activity Trends</Text>

        <View style={styles.controlsRow}>
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

          {/* Type Toggle */}
          {pageData && (
            <View style={styles.toggleContainer}>
              <Pressable
                onPress={() => setDataType('verses')}
                style={[
                  styles.toggleButton,
                  dataType === 'verses' && { backgroundColor: colors.primary }
                ]}
              >
                <Text style={[
                  styles.toggleText,
                  { color: dataType === 'verses' ? '#1a1a1a' : colors.textSecondary }
                ]}>Verses</Text>
              </Pressable>
              <Pressable
                onPress={() => setDataType('pages')}
                style={[
                  styles.toggleButton,
                  dataType === 'pages' && { backgroundColor: colors.primary }
                ]}
              >
                <Text style={[
                  styles.toggleText,
                  { color: dataType === 'pages' ? '#1a1a1a' : colors.textSecondary }
                ]}>Pages</Text>
              </Pressable>
            </View>
          )}
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
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
        onContentSizeChange={() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }}
      >
        <View style={{ width: contentWidth }}>
          <Svg width={contentWidth} height={chartHeight}>
            {/* Y-axis gridlines */}
            {yAxisLabels.map((value) => {
              const y = yScale(value);
              return (
                <React.Fragment key={`grid-${value}`}>
                  <Line
                    x1={padding.left}
                    y1={y}
                    x2={contentWidth - padding.right}
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
                  : true; // 1Y shows all months

              return (
                <Pressable
                  key={`xlabel-${index}`}
                  onPress={() => setSelectedPoint(point)}
                  style={[
                    styles.xLabel,
                    {
                      width: graphWidth / (chartData.length - 1 || 1),
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
  headerStack: {
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 2,
    alignSelf: 'flex-start',
  },
  toggleButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rangeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    gap: 4,
    flex: 1,
    maxWidth: 200,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeText: {
    fontSize: 13,
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
