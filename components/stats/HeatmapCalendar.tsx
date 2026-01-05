import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ActivityData {
  memorizedVerses: Array<{ date: string; count: number }>;
  revisedVerses: Array<{ date: string; count: number }>;
}

interface HeatmapCalendarProps {
  data: ActivityData;
  type?: 'memorized' | 'revised';
}

interface DayData {
  date: string;
  count: number;
  day: number;
  month: number;
  dayOfMonth: number;
}

const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({ data, type = 'memorized' }) => {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const { theme: colors } = useUnifiedTheme();

  const heatmapData = useMemo(() => {
    const sourceData = type === 'memorized' ? data.memorizedVerses : data.revisedVerses;
    const dateMap: Record<string, number> = {};

    sourceData.forEach((item) => {
      dateMap[item.date] = (dateMap[item.date] || 0) + item.count;
    });

    // Helper function to get local date string (YYYY-MM-DD)
    const getLocalDateString = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const days: DayData[] = [];
    const today = new Date();

    // Generate last 365 days
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = getLocalDateString(date);
      days.push({
        date: dateStr,
        count: dateMap[dateStr] || 0,
        day: date.getDay(),
        month: date.getMonth(),
        dayOfMonth: date.getDate(),
      });
    }

    return days;
  }, [data, type]);

  const getColor = (count: number) => {
    if (count === 0) return colors.background;

    // Calculate max count for better scaling
    const allCounts = heatmapData.map(d => d.count).filter(c => c > 0);
    const maxCount = Math.max(...allCounts, 10); // Minimum of 10 for better color distribution
    const percentage = (count / maxCount) * 100;

    if (type === 'memorized') {
      // Green shades for memorization
      if (percentage <= 25) return '#0e4429';
      if (percentage <= 50) return '#006d32';
      if (percentage <= 75) return '#26a641';
      return '#39d353';
    } else {
      // Blue shades for revision
      if (percentage <= 25) return '#0a3069';
      if (percentage <= 50) return '#0969da';
      if (percentage <= 75) return '#54aeff';
      return '#80ccff';
    }
  };

  // Build weeks grid
  const weeks: (DayData | null)[][] = [];
  let currentWeek: (DayData | null)[] = [];

  heatmapData.forEach((day, index) => {
    // Fill empty cells at the start of first week
    if (index === 0) {
      for (let i = 0; i < day.day; i++) {
        currentWeek.push(null);
      }
    }

    currentWeek.push(day);

    // Complete week, start new one
    if (currentWeek.length === 7) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  // Fill remaining cells in last week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  // Generate month and year labels
  const labels: Array<{ weekIndex: number; label: string; type: 'month' | 'year' }> = [];
  let lastMonth = -1;
  let lastYear = -1;

  weeks.forEach((week, weekIndex) => {
    const firstDay = week.find((d) => d !== null);
    if (firstDay) {
      const date = new Date(firstDay.date);
      const month = date.getMonth();
      const year = date.getFullYear();

      // Year label logic
      if (year !== lastYear) {
        labels.push({
          weekIndex,
          label: year.toString(),
          type: 'year',
        });
        lastYear = year;
      }

      // Month label logic
      if (month !== lastMonth && firstDay.dayOfMonth <= 7) {
        labels.push({
          weekIndex,
          label: date.toLocaleDateString('en', { month: 'short' }),
          type: 'month',
        });
        lastMonth = month;
      }
    }
  });

  // Calculate statistics for the tooltip
  const stats = useMemo(() => {
    const allCounts = heatmapData.map(d => d.count);
    const activeDays = allCounts.filter(c => c > 0).length;
    const totalCount = allCounts.reduce((sum, c) => sum + c, 0);
    const avgPerActiveDay = activeDays > 0 ? Math.round(totalCount / activeDays) : 0;

    return { activeDays, totalCount, avgPerActiveDay };
  }, [heatmapData]);

  const CELL_SIZE = 12;
  const CELL_GAP = 3;
  const COLUMN_WIDTH = CELL_SIZE + CELL_GAP;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>
          {type === 'memorized' ? '📚 Memorization' : '🔄 Revision'} Activity
        </Text>

        <View style={styles.quickStats}>
          <Text style={[styles.statText, { color: colors.textSecondary }]}>
            {stats.activeDays} days • {stats.totalCount} total
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.heatmapContainer, { minWidth: weeks.length * COLUMN_WIDTH + 50 }]}>
          {/* Labels Row (Months and Years) */}
          <View style={styles.labelsRow}>
            {labels.map((item, index) => (
              <Text
                key={index}
                style={[
                  item.type === 'year' ? styles.yearLabel : styles.monthLabel,
                  {
                    left: item.weekIndex * COLUMN_WIDTH,
                    color: item.type === 'year' ? colors.primary : colors.textSecondary,
                    fontWeight: item.type === 'year' ? 'bold' : '600'
                  },
                ]}
              >
                {item.label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {/* Day labels */}
            <View style={styles.dayLabelsColumn}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <View key={i} style={styles.dayLabelContainer}>
                  <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Heatmap grid */}
            <View style={styles.weeksContainer}>
              {weeks.map((week, weekIndex) => {
                const firstDayInWeek = week.find(d => d !== null);
                const isFirstWeekOfYear = firstDayInWeek && new Date(firstDayInWeek.date).getMonth() === 0 && firstDayInWeek.dayOfMonth <= 7;

                return (
                  <View
                    key={weekIndex}
                    style={[
                      styles.weekColumn,
                      isFirstWeekOfYear && { marginLeft: 10 } // Add gap between years
                    ]}
                  >
                    {week.map((day, dayIndex) => (
                      <TouchableOpacity
                        key={`${weekIndex}-${dayIndex}`}
                        onPress={() => {
                          if (day) {
                            setSelectedDay(selectedDay?.date === day.date ? null : day);
                          }
                        }}
                        style={[
                          styles.dayCell,
                          {
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            backgroundColor: day ? getColor(day.count) : 'transparent',
                            borderColor: day ? colors.border + '22' : 'transparent',
                          },
                        ]}
                        activeOpacity={day ? 0.7 : 1}
                        disabled={!day}
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legendContainer}>
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Less</Text>
            <View style={styles.legendCells}>
              {[0, 1, 3, 5, 7].map((count, index) => {
                const sampleCount = index === 0 ? 0 : Math.ceil((stats.totalCount / 365) * index);
                return (
                  <View
                    key={index}
                    style={[
                      styles.legendCell,
                      {
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        backgroundColor: getColor(sampleCount),
                        borderColor: colors.border + '22',
                      },
                    ]}
                  />
                );
              })}
            </View>
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>More</Text>
          </View>
        </View>
      </ScrollView>

      {selectedDay && (
        <View style={[styles.tooltip, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipIndicator, { backgroundColor: getColor(selectedDay.count) }]} />
            <View style={styles.tooltipContent}>
              <Text style={[styles.tooltipDate, { color: colors.text }]}>
                {new Date(selectedDay.date).toLocaleDateString('en', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Text style={[styles.tooltipCount, { color: colors.textSecondary }]}>
                {selectedDay.count} verse{selectedDay.count !== 1 ? 's' : ''} {type === 'memorized' ? 'memorized' : 'revised'}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  quickStats: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scrollView: {
    marginHorizontal: -16,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  heatmapContainer: {
    minWidth: 800,
  },
  labelsRow: {
    height: 30, // Increased height to accommodate years
    marginBottom: 4,
    position: 'relative',
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
    top: 15, // Push months down
  },
  yearLabel: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: 'bold',
    top: 0,
  },
  calendarGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dayLabelsColumn: {
    marginRight: 8,
    justifyContent: 'space-between',
    height: 105,
  },
  dayLabelContainer: {
    height: 13,
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  weeksContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  weekColumn: {
    gap: 3,
  },
  dayCell: {
    borderRadius: 2,
    borderWidth: 1,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    justifyContent: 'flex-start',
    gap: 6,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  legendCells: {
    flexDirection: 'row',
    gap: 3,
  },
  legendCell: {
    borderRadius: 2,
    borderWidth: 1,
  },
  tooltip: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tooltipIndicator: {
    width: 6,
    height: 36,
    borderRadius: 3,
  },
  tooltipContent: {
    flex: 1,
  },
  tooltipDate: {
    fontWeight: '700',
    marginBottom: 2,
    fontSize: 14,
  },
  tooltipCount: {
    fontSize: 12,
  },
});

export default HeatmapCalendar;
