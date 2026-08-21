import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ActivityData {
  memorizedVerses: Array<{ date: string; count: number }>;
  revisedVerses: Array<{ date: string; count: number }>;
}

interface PageActivityData {
  memorizedPages: Array<{ date: string; count: number }>;
  revisedPages: Array<{ date: string; count: number }>;
}

interface ActivityBarChartProps {
  data: ActivityData;
  pageData?: PageActivityData;
}

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly';
type DataType = 'verses' | 'pages';

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
    scale = Math.ceil(maxValue / 1000) * 1000;
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

const ActivityBarChart: React.FC<ActivityBarChartProps> = ({ data, pageData }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly');
  const [dataType, setDataType] = useState<DataType>('verses');
  const { theme: colors } = useUnifiedTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const chartData = useMemo(() => {
    // ... aggregated data logic (omitted for brevity but kept in actual file)
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
    const getLocalDateString = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let labels: string[] = [];
    let memorized: number[] = [];
    let revised: number[] = [];

    if (timeframe === 'daily') {
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const lastDay = today.getDate();
      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = getLocalDateString(date);
        labels.push(day.toString());
        memorized.push(memMap[dateStr] || 0);
        revised.push(revMap[dateStr] || 0);
      }
    } else if (timeframe === 'weekly') {
      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const currentDayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
      const sundayDate = new Date(today);
      sundayDate.setDate(today.getDate() - currentDayOfWeek);

      for (let i = 0; i < 7; i++) {
        const date = new Date(sundayDate);
        date.setDate(sundayDate.getDate() + i);
        const dateStr = getLocalDateString(date);
        labels.push(dayNames[i]);
        memorized.push(memMap[dateStr] || 0);
        revised.push(revMap[dateStr] || 0);
      }
    } else if (timeframe === 'monthly') {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      for (let month = 0; month <= currentMonth; month++) {
        let memSum = 0;
        let revSum = 0;
        Object.keys(memMap).forEach((dateStr) => {
          const [yStr, mStr] = dateStr.split('-');
          const year = parseInt(yStr, 10);
          const m = parseInt(mStr, 10) - 1;
          if (year === currentYear && m === month) memSum += memMap[dateStr];
        });
        Object.keys(revMap).forEach((dateStr) => {
          const [yStr, mStr] = dateStr.split('-');
          const year = parseInt(yStr, 10);
          const m = parseInt(mStr, 10) - 1;
          if (year === currentYear && m === month) revSum += revMap[dateStr];
        });
        const monthDate = new Date(currentYear, month, 1);
        labels.push(monthDate.toLocaleDateString('en', { month: 'short' }));
        memorized.push(memSum);
        revised.push(revSum);
      }
    } else if (timeframe === 'yearly') {
      for (let i = 2; i >= 0; i--) {
        const year = today.getFullYear() - i;
        let memSum = 0;
        let revSum = 0;
        Object.keys(memMap).forEach((dateStr) => {
          const [yStr] = dateStr.split('-');
          const dYear = parseInt(yStr, 10);
          if (dYear === year) memSum += memMap[dateStr];
        });
        Object.keys(revMap).forEach((dateStr) => {
          const [yStr] = dateStr.split('-');
          const dYear = parseInt(yStr, 10);
          if (dYear === year) revSum += revMap[dateStr];
        });
        labels.push(year.toString());
        memorized.push(memSum);
        revised.push(revSum);
      }
    }
    return { labels, memorized, revised };
  }, [data, pageData, timeframe, dataType]);

  const rawMaxValue = Math.max(...chartData.memorized, ...chartData.revised, 1);
  const { labels: yAxisLabels, scale: maxValue } = useMemo(() => getScaleSettings(rawMaxValue), [rawMaxValue]);

  const totalMemorized = chartData.memorized.reduce((a, b) => a + b, 0);
  const totalRevised = chartData.revised.reduce((a, b) => a + b, 0);

  const screenWidth = Dimensions.get('window').width;

  const getBarWidth = () => {
    switch (timeframe) {
      case 'daily': return 24;
      case 'weekly': return 26;
      case 'monthly': return 40;
      case 'yearly': return 80;
      default: return 40;
    }
  };

  const barWidth = getBarWidth();
  const gapWidth = timeframe === 'weekly' ? Math.max(10, Math.floor((screenWidth - 90 - 7 * barWidth) / 6)) : 12;
  const horizontalPadding = 30; // padding left + right
  
  const chartContentWidth = Math.max(
    screenWidth - 50, // screenWidth - padding/margins
    chartData.labels.length * (barWidth + gapWidth) + horizontalPadding + (timeframe === 'weekly' ? 10 : 40) // Add buffer for final label
  );

  React.useEffect(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    });
  }, [timeframe, chartData.labels.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.title, { color: colors.text }]}>📊 Activity Overview</Text>
          {pageData && (
            <View style={styles.toggleContainer}>
              <TouchableOpacity
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
              </TouchableOpacity>
              <TouchableOpacity
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
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.timeframeSelector, { backgroundColor: colors.background }]}>
          {(['daily', 'weekly', 'monthly', 'yearly'] as Timeframe[]).map((tf) => {
            const getLabel = (timeframe: Timeframe) => {
              switch (timeframe) {
                case 'daily': return 'Day';
                case 'weekly': return 'Week';
                case 'monthly': return 'Month';
                case 'yearly': return 'Year';
                default: return timeframe;
              }
            };

            return (
              <TouchableOpacity
                key={tf}
                onPress={() => setTimeframe(tf)}
                style={[
                  styles.timeframeButton,
                  timeframe === tf && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    { color: timeframe === tf ? '#1a1a1a' : colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {getLabel(tf)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
          <View style={[styles.summaryBar, { backgroundColor: '#4ECDC4' }]} />
          <View style={styles.summaryContent}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Memorized</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{totalMemorized}</Text>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
          <View style={[styles.summaryBar, { backgroundColor: '#FF9800' }]} />
          <View style={styles.summaryContent}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Revised</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{totalRevised}</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartContainer}>
        <View style={styles.yAxisContainer}>
          {[...yAxisLabels].reverse().map((label, i) => (
            <Text key={i} style={[styles.yAxisText, { color: colors.textSecondary }]}>
              {label}
            </Text>
          ))}
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
          onContentSizeChange={() => {
            requestAnimationFrame(() => {
              scrollViewRef.current?.scrollToEnd({ animated: false });
            });
          }}
        >
          <View style={{ width: chartContentWidth, height: 220 }}>
            <View style={styles.chartWrapper}>
              <View style={styles.gridContainer}>
                {yAxisLabels.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.gridLine,
                      { borderTopColor: colors.textSecondary, borderTopWidth: 1, opacity: 0.1 }
                    ]}
                  />
                ))}
              </View>

              <View style={styles.barsWrapper}>
                {chartData.labels.map((label, i) => {
                  const memHeight = (chartData.memorized[i] / maxValue) * 180;
                  const revHeight = (chartData.revised[i] / maxValue) * 180;

                  return (
                    <View key={i} style={[styles.barColumn, { width: barWidth }]}>
                      <View style={styles.barGroup}>
                        <View style={styles.barPair}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: Math.max(memHeight, chartData.memorized[i] > 0 ? 3 : 0),
                                backgroundColor: '#4ECDC4',
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.bar,
                              {
                                height: Math.max(revHeight, chartData.revised[i] > 0 ? 3 : 0),
                                backgroundColor: '#FF9800',
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text
                        style={[styles.barLabel, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#4ECDC4' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Memorized</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Revised</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16, // Reduced padding for better small screen fit
    marginBottom: 20,
  },
  header: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap', // Added wrap for tab overflow
    gap: 8,
  },
  title: {
    fontSize: 18, // Slightly smaller title
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeframeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeframeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryBar: {
    width: 6,
    height: 32,
    borderRadius: 3,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  chartContainer: {
    flexDirection: 'row',
    height: 220,
  },
  yAxisContainer: {
    width: 40,
    height: 180,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
    marginRight: 4,
  },
  yAxisText: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  scrollView: {
    flex: 1,
  },
  chartWrapper: {
    height: 220,
  },
  gridContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 180,
    justifyContent: 'space-between',
  },
  gridLine: {
    width: '100%',
  },
  barsWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 180,
    gap: 12,
    paddingHorizontal: 20,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barGroup: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    width: '100%',
    justifyContent: 'center',
  },
  bar: {
    flex: 1,
    maxWidth: 20,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 6,
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
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ActivityBarChart;
