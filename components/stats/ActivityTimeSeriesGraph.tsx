import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  } else {
    // Round up to nearest 1000 or use 6236 as a reference point? 
    // User mentioned "Round up dynamically" or "6.2K"
    scale = Math.ceil(maxValue / 1000) * 1000;
    if (scale < 6000 && maxValue > 2500) {
      // If close to total Quran verses, maybe just use 6236 or 6300
    }
    step = scale / 5;
  }

  const labels = [];
  for (let i = 0; i <= scale; i += step) {
    if (i === 0) {
      labels.push('0');
    } else if (i >= 1000) {
      labels.push(`${(i / 1000).toFixed(1).replace('.0', '')}K`);
    } else {
      labels.push(i.toString());
    }
  }
  return { labels, scale };
};

const ActivityTimeSeriesGraph: React.FC<Props> = ({ data, pageData }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [dataType, setDataType] = useState<DataType>('verses');
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const { theme: colors } = useUnifiedTheme();

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
    const points: DataPoint[] = [];

    const getDateStr = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (timeRange === 'week') {
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
      for (let i = 11; i >= 0; i--) {
        const date = new Date(today);
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth();

        let memSum = 0;
        let revSum = 0;

        Object.keys(memMap).forEach((dateStr) => {
          const [yStr, mStr] = dateStr.split('-');
          if (parseInt(yStr, 10) === year && (parseInt(mStr, 10) - 1) === month) {
            memSum += memMap[dateStr];
          }
        });

        Object.keys(revMap).forEach((dateStr) => {
          const [yStr, mStr] = dateStr.split('-');
          if (parseInt(yStr, 10) === year && (parseInt(mStr, 10) - 1) === month) {
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

  const rawMaxValue = useMemo(() => {
    const allValues = chartData.flatMap(p => [p.memorized, p.revised]);
    const validValues = allValues.filter(v => typeof v === 'number' && !isNaN(v));
    return Math.max(...validValues, 1);
  }, [chartData]);

  const { labels: yAxisLabels, scale: maxValue } = useMemo(() => getScaleSettings(rawMaxValue), [rawMaxValue]);

  const screenWidth = Dimensions.get('window').width;
  // Chart dimensions in local coordinate system
  const VIEWBOX_WIDTH = 1000;
  const VIEWBOX_HEIGHT = 400;
  const padding = { top: 40, right: 40, bottom: 60, left: 100 };

  // Aspect ratio preserved scaling
  const chartWidth = screenWidth - 40; // Horizontal space available
  const chartHeight = 220;

  // contentWidth controls how much horizontal space the SVG takes (can be scrollable)
  const contentWidth = Math.max(VIEWBOX_WIDTH, chartData.length * 60);
  const graphWidth = contentWidth - padding.left - padding.right;
  const graphHeight = VIEWBOX_HEIGHT - padding.top - padding.bottom;

  const xScale = (index: number) => {
    if (chartData.length <= 1) return padding.left + graphWidth / 2;
    return padding.left + (index / (chartData.length - 1)) * graphWidth;
  };

  const yScale = (value: number) => {
    const safeValue = isNaN(value) ? 0 : value;
    const y = padding.top + graphHeight - (safeValue / maxValue) * graphHeight;
    return isNaN(y) ? padding.top + graphHeight : y;
  };

  const createLinePath = (points: DataPoint[], getValue: (p: DataPoint) => number): string => {
    if (points.length === 0) return '';
    let path = '';
    points.forEach((point, index) => {
      const x = xScale(index);
      const y = yScale(getValue(point));
      if (index === 0) path += `M ${x} ${y}`;
      else {
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

  const scrollViewRef = useRef<ScrollView>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [timeRange, chartData.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>📈 Activity Trends</Text>
          {pageData && (
            <View style={styles.toggleContainer}>
              <Pressable
                onPress={() => setDataType('verses')}
                style={[styles.toggleButton, dataType === 'verses' && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.toggleText, { color: dataType === 'verses' ? '#1a1a1a' : colors.textSecondary }]}>Verses</Text>
              </Pressable>
              <Pressable
                onPress={() => setDataType('pages')}
                style={[styles.toggleButton, dataType === 'pages' && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.toggleText, { color: dataType === 'pages' ? '#1a1a1a' : colors.textSecondary }]}>Pages</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={[styles.rangeSelector, { backgroundColor: colors.background }]}>
          {(['week', 'month', 'year'] as TimeRange[]).map((range) => (
            <Pressable
              key={range}
              onPress={() => {
                setTimeRange(range);
                setSelectedPoint(null);
              }}
              style={[styles.rangeButton, timeRange === range && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.rangeText, { color: timeRange === range ? '#1a1a1a' : colors.textSecondary }]}>
                {range === 'week' ? '7D' : range === 'month' ? '30D' : '1Y'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

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

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={{ width: (contentWidth / VIEWBOX_WIDTH) * (screenWidth - 40), height: chartHeight }}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${contentWidth} ${VIEWBOX_HEIGHT}`}
            preserveAspectRatio="none"
          >
            {yAxisLabels.map((_, i) => {
              const value = (i * maxValue) / (yAxisLabels.length - 1);
              const y = yScale(value);
              return (
                <Line
                  key={`grid-${i}`}
                  x1={padding.left}
                  y1={y}
                  x2={contentWidth - padding.right}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={2}
                  opacity={i === 0 ? 0.4 : 0.15}
                />
              );
            })}

            {memPath && (
              <Path d={memPath} stroke="#4ECDC4" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {revPath && (
              <Path d={revPath} stroke="#FF9800" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {chartData.map((point, index) => {
              const x = xScale(index);
              const memY = yScale(point.memorized);
              const revY = yScale(point.revised);
              return (
                <React.Fragment key={`pts-${index}`}>
                  {point.memorized > 0 && <Circle cx={x} cy={memY} r={8} fill="#4ECDC4" stroke={colors.card} strokeWidth={selectedPoint?.dateStr === point.dateStr ? 4 : 0} />}
                  {point.revised > 0 && <Circle cx={x} cy={revY} r={8} fill="#FF9800" stroke={colors.card} strokeWidth={selectedPoint?.dateStr === point.dateStr ? 4 : 0} />}
                </React.Fragment>
              );
            })}
          </Svg>

          <View style={[styles.yAxisLabelsWrapper, { height: '100%' }]}>
            {yAxisLabels.map((label, i) => {
              const value = (i * maxValue) / (yAxisLabels.length - 1);
              const yPercent = ((yScale(value) - 8) / VIEWBOX_HEIGHT) * 100;
              return (
                <View key={`yl-${i}`} style={[styles.yLabel, { top: `${yPercent}%` }]}>
                  <Text style={[styles.yLabelText, { color: colors.textSecondary }]}>{label}</Text>
                </View>
              );
            })}
          </View>

          <View style={[styles.xAxisLabels, { marginLeft: `${(padding.left / VIEWBOX_WIDTH) * 100}%` } as any]}>
            {chartData.map((point, index) => {
              const showLabel = timeRange === 'week' ? true : timeRange === 'month' ? index % 5 === 0 || index === chartData.length - 1 : true;
              return (
                <Pressable
                  key={`xl-${index}`}
                  onPress={() => setSelectedPoint(point)}
                  style={[styles.xLabel, { width: `${(graphWidth / (chartData.length - 1) / contentWidth) * 100}%` } as any]}
                >
                  {showLabel && (
                    <Text style={[styles.xLabelText, { color: selectedPoint?.dateStr === point.dateStr ? colors.primary : colors.textSecondary }]} numberOfLines={1}>
                      {point.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

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
    padding: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
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
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '700',
    marginBottom: 6,
  },
  tooltipRow: {
    flexDirection: 'row',
    gap: 16,
  },
  tooltipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tooltipLabel: {
    fontSize: 11,
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  yAxisLabelsWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 45,
  },
  yLabel: {
    position: 'absolute',
    right: 5,
    alignItems: 'flex-end',
  },
  yLabelText: {
    fontSize: 10,
    fontWeight: '700',
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
    fontWeight: '600',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ActivityTimeSeriesGraph;
