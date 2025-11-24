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

const ActivityBarChart: React.FC<ActivityBarChartProps> = ({ data, pageData }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly');
  const [dataType, setDataType] = useState<DataType>('verses');
  const { theme: colors } = useUnifiedTheme();
  const scrollViewRef = useRef<ScrollView>(null);

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

    // Helper function to get local date string (YYYY-MM-DD) without timezone conversion
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
      // Current month - 1st to today (or full month if past months)
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const lastDay = today.getDate(); // Only go up to today

      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = getLocalDateString(date);
        labels.push(day.toString());
        memorized.push(memMap[dateStr] || 0);
        revised.push(revMap[dateStr] || 0);
      }
    } else if (timeframe === 'weekly') {
      // Last 12 weeks in chronological order
      const weeks: Array<{ start: Date; end: Date; label: string }> = [];

      for (let i = 11; i >= 0; i--) {
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() - (i * 7));
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);

        const weekLabel = `${startDate.getDate()}/${startDate.getMonth() + 1}`;
        weeks.push({ start: startDate, end: endDate, label: weekLabel });
      }

      weeks.forEach(week => {
        let memSum = 0;
        let revSum = 0;

        for (let d = new Date(week.start); d <= week.end; d.setDate(d.getDate() + 1)) {
          const dateStr = getLocalDateString(d);
          memSum += memMap[dateStr] || 0;
          revSum += revMap[dateStr] || 0;
        }

        labels.push(week.label);
        memorized.push(memSum);
        revised.push(revSum);
      });
    } else if (timeframe === 'monthly') {
      // Current year: Jan to current month (in sequence)
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-11

      for (let month = 0; month <= currentMonth; month++) {
        let memSum = 0;
        let revSum = 0;

        Object.keys(memMap).forEach((dateStr) => {
          // Parse YYYY-MM-DD manually to avoid UTC conversion issues
          const [yStr, mStr] = dateStr.split('-');
          const year = parseInt(yStr, 10);
          const m = parseInt(mStr, 10) - 1; // 0-indexed

          if (year === currentYear && m === month) {
            memSum += memMap[dateStr];
          }
        });

        Object.keys(revMap).forEach((dateStr) => {
          const [yStr, mStr] = dateStr.split('-');
          const year = parseInt(yStr, 10);
          const m = parseInt(mStr, 10) - 1;

          if (year === currentYear && m === month) {
            revSum += revMap[dateStr];
          }
        });

        const monthDate = new Date(currentYear, month, 1);
        labels.push(monthDate.toLocaleDateString('en', { month: 'short' }));
        memorized.push(memSum);
        revised.push(revSum);
      }
    } else if (timeframe === 'yearly') {
      // Last 3 years in chronological order
      for (let i = 2; i >= 0; i--) {
        const year = today.getFullYear() - i;
        let memSum = 0;
        let revSum = 0;

        Object.keys(memMap).forEach((dateStr) => {
          const [yStr] = dateStr.split('-');
          const dYear = parseInt(yStr, 10);

          if (dYear === year) {
            memSum += memMap[dateStr];
          }
        });

        Object.keys(revMap).forEach((dateStr) => {
          const [yStr] = dateStr.split('-');
          const dYear = parseInt(yStr, 10);

          if (dYear === year) {
            revSum += revMap[dateStr];
          }
        });

        labels.push(year.toString());
        memorized.push(memSum);
        revised.push(revSum);
      }
    }

    return { labels, memorized, revised };
  }, [data, pageData, timeframe, dataType]);

  const maxValue = Math.max(...chartData.memorized, ...chartData.revised, 1);
  const totalMemorized = chartData.memorized.reduce((a, b) => a + b, 0);
  const totalRevised = chartData.revised.reduce((a, b) => a + b, 0);

  const screenWidth = Dimensions.get('window').width;

  // Calculate bar width based on number of items
  const getBarWidth = () => {
    switch (timeframe) {
      case 'daily': return 24; // 30 days
      case 'weekly': return 40; // 12 weeks
      case 'monthly': return 40; // 12 months
      case 'yearly': return 80; // 3 years
      default: return 40;
    }
  };

  const barWidth = getBarWidth();
  const chartContentWidth = Math.max(
    screenWidth - 80, // Minimum width
    chartData.labels.length * (barWidth + 8) // Dynamic width based on bars
  );

  // Auto-scroll to end when data or timeframe changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [timeframe, chartData.labels.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <View>
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
            // Use short labels to prevent wrapping on small screens
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

      {/* Summary Stats */}
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

      {/* Bar Chart */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        onContentSizeChange={() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }}
      >
        <View style={{ width: chartContentWidth }}>
          {/* Y-axis labels */}
          <View style={styles.yAxisContainer}>
            {[
              maxValue,
              Math.floor(maxValue * 0.75),
              Math.floor(maxValue * 0.5),
              Math.floor(maxValue * 0.25),
              0
            ].map((val, i) => (
              <Text key={i} style={[styles.yAxisText, { color: colors.textSecondary }]}>
                {val}
              </Text>
            ))}
          </View>

          {/* Chart area */}
          <View style={styles.chartWrapper}>
            {/* Grid lines */}
            <View style={styles.gridContainer}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.gridLine,
                    { borderTopColor: colors.textSecondary, borderTopWidth: 1, opacity: 0.1 }
                  ]}
                />
              ))}
            </View>

            {/* Bars container */}
            <View style={styles.barsWrapper}>
              {chartData.labels.map((label, i) => {
                const memHeight = maxValue > 0 ? (chartData.memorized[i] / maxValue) * 180 : 0;
                const revHeight = maxValue > 0 ? (chartData.revised[i] / maxValue) * 180 : 0;

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

      {/* Legend */}
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
    padding: 20,
    marginBottom: 20,
  },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 2,
    marginTop: 4,
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
  timeframeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8, // Reduced from 12 for tighter fit
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center', // Center content
  },
  timeframeText: {
    fontSize: 13, // Increased from 12 for better readability
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryBar: {
    width: 12,
    height: 40,
    borderRadius: 4,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  yAxisContainer: {
    position: 'absolute',
    left: 20,
    top: 0,
    height: 180,
    width: 40,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
    zIndex: 2,
  },
  yAxisText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chartWrapper: {
    marginLeft: 50,
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
    gap: 8,
    paddingRight: 20,
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
    marginTop: 4,
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
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
  },
});

export default ActivityBarChart;
