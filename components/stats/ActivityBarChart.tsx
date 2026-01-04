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
    const currentYear = today.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);

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
      // Show days from Jan 1st of CURRENT YEAR up to Today
      // If today is older than Jan 1 (impossible if device date is correct), show at least today.

      // We will iterate from Jan 1 to Today
      // If that's too many days (e.g. late in the year), maybe just show last 30 days but CUT OFF at Jan 1?
      // User request: "history data should only apply for Year tab".
      // Let's show "Current Month" days or "Last 30 Days but capped at Jan 1".
      // actually standard behavior is usually "This Month" or "Last 30 Days".
      // Let's do: Days of the Current Month, OR if early in year, just Jan 1 to Today.
      // Better yet: Just show the last 30 days, but FILTER out any date < Jan 1.

      const daysToShow = 30;
      for (let i = daysToShow - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);

        // STRICT FILTER: Ignore if before Jan 1 of current year
        if (d.getFullYear() < currentYear) continue;

        const dateStr = getLocalDateString(d);
        labels.push(d.getDate().toString());
        memorized.push(memMap[dateStr] || 0);
        revised.push(revMap[dateStr] || 0);
      }

    } else if (timeframe === 'weekly') {
      // Show weeks for the current year. 
      // Simplified: Show last 12 weeks, but cut off any week that ends before Jan 1.

      const weeksToShow = 12;
      for (let i = weeksToShow - 1; i >= 0; i--) {
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() - (i * 7));

        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);

        // Logic: if the WHOLE week is in previous year, skip it.
        // If it overlaps, we include it (maybe partial data).
        // Let's include if endDate >= Jan 1

        if (endDate < startOfYear) continue;

        const weekLabel = `${startDate.getDate()}/${startDate.getMonth() + 1}`;

        // Sum data for this week
        let memSum = 0;
        let revSum = 0;

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          // STRICT FILTER: Only count data points in current year
          if (d.getFullYear() === currentYear) {
            const dateStr = getLocalDateString(d);
            memSum += memMap[dateStr] || 0;
            revSum += revMap[dateStr] || 0;
          }
        }

        labels.push(weekLabel);
        memorized.push(memSum);
        revised.push(revSum);
      }

    } else if (timeframe === 'monthly') {
      // Show months of CURRENT YEAR only (Jan to Current Month)
      const currentMonthIndex = today.getMonth(); // 0-11

      for (let month = 0; month <= currentMonthIndex; month++) {
        let memSum = 0;
        let revSum = 0;

        // Iterate through all data keys to find matches for this month/year
        // (More efficient might be to iterate days of month, but this is fine for small dataset)
        Object.keys(memMap).forEach((dateStr) => {
          const [yStr, mStr] = dateStr.split('-');
          const year = parseInt(yStr, 10);
          const m = parseInt(mStr, 10) - 1;

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
      // Show last 3 years (History allowed here)
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

  // Calculate max value for auto-scaling BUT ensure minimums
  const calculatedMax = Math.max(...chartData.memorized, ...chartData.revised, 1);
  // Round up to nearest 5 or 10 for cleaner grid
  const maxValue = Math.ceil(calculatedMax / 5) * 5;

  const totalMemorized = chartData.memorized.reduce((a, b) => a + b, 0);
  const totalRevised = chartData.revised.reduce((a, b) => a + b, 0);

  const screenWidth = Dimensions.get('window').width;

  // Calculate bar width based on number of items
  const getBarWidth = () => {
    switch (timeframe) {
      case 'daily': return 24;
      case 'weekly': return 40;
      case 'monthly': return 40;
      case 'yearly': return 60;
      default: return 40;
    }
  };

  const barWidth = getBarWidth();
  const chartContentWidth = Math.max(
    screenWidth - 60, // Minimum width (padding accounted)
    chartData.labels.length * (barWidth + 12) // Space for bars + gap
  );

  // Auto-scroll to end when data or timeframe changes
  React.useEffect(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    });
  }, [timeframe, chartData.labels.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>

      {/* 
        LAYOUT FIX: Stacked Header 
        Row 1: Title
        Row 2: Toggle (Verses/Pages) 
        Row 3: Time Tabs 
      */}
      <View style={styles.headerStack}>
        <Text style={[styles.title, { color: colors.text }]}>📊 Activity Overview</Text>

        <View style={styles.controlsContainer}>
          {/* Toggle */}
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

          {/* Timeframe Tabs */}
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

      {/* Chart Container */}
      <View style={styles.chartContainer}>
        {/* Fixed Y-axis labels */}
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

        {/* Scrollable Bar Chart */}
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
      </View>

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
  headerStack: {
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  controlsContainer: {
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
  timeframeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeframeText: {
    fontSize: 13,
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
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
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
    width: 36,
    height: 180,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 6,
    marginRight: 4,
  },
  yAxisText: {
    fontSize: 10,
    fontWeight: '500',
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
    maxWidth: 24,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minWidth: 4,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 6,
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
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 13,
  },
});

export default ActivityBarChart;
