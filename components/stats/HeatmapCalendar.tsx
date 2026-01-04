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
  year: number;
}

interface MonthSummary {
  year: number;
  month: number; // 0-11
  totalCount: number;
  label: string;
}

const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({ data, type = 'memorized' }) => {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthSummary | null>(null);
  const { theme: colors } = useUnifiedTheme();

  // Helper function to get local date string (YYYY-MM-DD)
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { currentYearDays, historyMonths, stats } = useMemo(() => {
    const sourceData = type === 'memorized' ? data.memorizedVerses : data.revisedVerses;
    const dateMap: Record<string, number> = {};

    sourceData.forEach((item) => {
      dateMap[item.date] = (dateMap[item.date] || 0) + item.count;
    });

    const today = new Date();
    const currentYear = today.getFullYear();

    // 1. Generate Current Year Daily Data (Jan 1 to Today/Dec 31)
    // We will show the FULL current year grid (Jan 1 -> Dec 31) so it fills up.

    const currentYearDays: DayData[] = [];
    const jan1 = new Date(currentYear, 0, 1);
    const dec31 = new Date(currentYear, 11, 31);

    // Iterate from Jan 1 to Dec 31
    for (let d = new Date(jan1); d <= dec31; d.setDate(d.getDate() + 1)) {
      // Don't show future days? Or show empty slots? 
      // Usually a calendar shows the full grid or up to today. 
      // "growing horizontally" implies showing up to today.
      // But for a nice grid layout, usually we show full year or up to today.
      // Let's show up to Today to be safe and avoid empty space if that's preferred, 
      // BUT user said "growing horizontally year after year", 
      // and for current year "Jan to Dec".
      // Let's generate up to TODAY.

      if (d > today) break;

      const dateStr = getLocalDateString(d);
      currentYearDays.push({
        date: dateStr,
        count: dateMap[dateStr] || 0,
        day: d.getDay(),
        month: d.getMonth(),
        dayOfMonth: d.getDate(),
        year: d.getFullYear(),
      });
    }

    // 2. Generate History Data (Previous Years)
    // Aggregated by Month

    const historyM: MonthSummary[] = [];
    // Find earliest year in data? Or just last few years?
    // Let's scan all data to find years < currentYear
    const years = new Set<number>();
    Object.keys(dateMap).forEach(dStr => {
      const y = parseInt(dStr.split('-')[0], 10);
      if (y < currentYear) years.add(y);
    });

    // Sort years descending
    const sortedYears = Array.from(years).sort((a, b) => b - a);

    sortedYears.forEach(year => {
      // For each month 0-11
      for (let m = 0; m < 12; m++) {
        let total = 0;
        // Sum strict matches for this month
        Object.keys(dateMap).forEach(dStr => {
          const [yStr, mStr] = dStr.split('-');
          if (parseInt(yStr, 10) === year && parseInt(mStr, 10) - 1 === m) {
            total += dateMap[dStr];
          }
        });

        historyM.push({
          year,
          month: m,
          totalCount: total,
          label: new Date(year, m, 1).toLocaleDateString('en', { month: 'short' })
        });
      }
    });

    // 3. Stats (Current Year Only for "Quick Stats"?)
    // Usually stats reflect the view. Let's do Current Year stats for the main header.
    const allCounts = currentYearDays.map(d => d.count);
    const activeDays = allCounts.filter(c => c > 0).length;
    const totalCount = allCounts.reduce((sum, c) => sum + c, 0);

    return { currentYearDays, historyMonths: historyM, stats: { activeDays, totalCount } };
  }, [data, type]);

  // Color Scales

  // For Daily Grid (Current Year)
  const getDailyColor = (count: number) => {
    if (count === 0) return colors.background;
    if (count > 0 && count < 3) return type === 'memorized' ? '#0e4429' : '#0a3069';
    if (count < 7) return type === 'memorized' ? '#006d32' : '#0969da';
    if (count < 15) return type === 'memorized' ? '#26a641' : '#54aeff';
    return type === 'memorized' ? '#39d353' : '#80ccff';
  };

  // For Monthly Blocks (History) - Scale needs to be higher since it's monthly sum
  const getMonthlyColor = (count: number) => {
    if (count === 0) return colors.card; // Using card color to blend in or distinct empty?
    // Use a darker shade for empty/low?
    if (count === 0) return '#2A2A2A'; // Simple dark grey

    // Scale: e.g. 10, 50, 100, 200 ???
    if (count < 10) return type === 'memorized' ? '#0e4429' : '#0a3069';
    if (count < 50) return type === 'memorized' ? '#006d32' : '#0969da';
    if (count < 150) return type === 'memorized' ? '#26a641' : '#54aeff';
    return type === 'memorized' ? '#39d353' : '#80ccff';
  };

  // Build Layouts

  // 1. Current Year Matrix (Rows = Weekdays, Cols = Weeks)
  // We need to group `currentYearDays` into weeks.
  // Since we start from Jan 1, the first week might be partial.
  // We want standard GitHub style: Col-major (Weeks as columns).
  // Jan 1 2026 is a Thursday. So S M T W are empty.

  const weeks: (DayData | null)[][] = [];
  let currentWeek: (DayData | null)[] = [];

  // Fill empty slots for first week based on Jan 1 day of week
  if (currentYearDays.length > 0) {
    const firstDay = currentYearDays[0];
    for (let i = 0; i < firstDay.day; i++) {
      currentWeek.push(null);
    }
  }

  currentYearDays.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  // Fill remaining slots
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  // Generate month labels for Current Year
  const monthLabels: Array<{ weekIndex: number; label: string }> = [];
  let lastMonth = -1;
  weeks.forEach((week, wIndex) => {
    const firstValid = week.find(d => d);
    if (firstValid && firstValid.month !== lastMonth) {
      monthLabels.push({ weekIndex: wIndex, label: new Date(2000, firstValid.month, 1).toLocaleDateString('en', { month: 'short' }) });
      lastMonth = firstValid.month;
    }
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>
          {type === 'memorized' ? '📚 Memorization' : '🔄 Revision'} Activity
        </Text>

        {/* Quick stats (Current Year) */}
        <View style={styles.quickStats}>
          <Text style={[styles.statText, { color: colors.textSecondary }]}>
            {stats.activeDays} days • {stats.totalCount} verses (2026)
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.contentContainer}>

          {/* HISTORY SECTION (If exists) */}
          {historyMonths.length > 0 && (
            <View style={styles.historySection}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>History</Text>
              <View style={styles.historyGrid}>
                {/* Group by Year */}
                {Array.from(new Set(historyMonths.map(m => m.year))).map(year => (
                  <View key={year} style={styles.historyYearRow}>
                    <Text style={[styles.yearLabel, { color: colors.textSecondary }]}>{year}</Text>
                    <View style={styles.monthsRow}>
                      {historyMonths.filter(m => m.year === year).sort((a, b) => a.month - b.month).map(m => (
                        <TouchableOpacity
                          key={`${m.year}-${m.month}`}
                          style={[
                            styles.monthBlock,
                            { backgroundColor: getMonthlyColor(m.totalCount) }
                          ]}
                          onPress={() => {
                            setSelectedMonth(selectedMonth === m ? null : m);
                            setSelectedDay(null);
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* CURRENT YEAR SECTION */}
          <View style={styles.currentYearSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 8 }]}>2026 Progress</Text>

            <View style={styles.heatmapContainer}>
              {/* Month Labels */}
              <View style={styles.monthLabelsRow}>
                {monthLabels.map((m, i) => (
                  <Text key={i} style={[styles.monthLabel, { left: m.weekIndex * 16, color: colors.textSecondary }]}>
                    {m.label}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {/* Day Labels */}
                <View style={styles.dayLabelsColumn}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <Text key={i} style={[styles.dayLabel, { marginTop: i === 0 ? 0 : 2, color: colors.textSecondary }]}>{day}</Text>
                  ))}
                </View>

                {/* Grid */}
                <View style={styles.weeksContainer}>
                  {weeks.map((week, wIndex) => (
                    <View key={wIndex} style={styles.weekColumn}>
                      {week.map((day, dIndex) => (
                        <TouchableOpacity
                          key={dIndex}
                          style={[
                            styles.dayCell,
                            {
                              backgroundColor: day ? getDailyColor(day.count) : 'transparent',
                              borderColor: day && selectedDay?.date === day.date ? colors.text : 'transparent',
                              borderWidth: day && selectedDay?.date === day.date ? 1 : 0
                            }
                          ]}
                          disabled={!day}
                          onPress={() => {
                            if (day) {
                              setSelectedDay(selectedDay?.date === day.date ? null : day);
                              setSelectedMonth(null);
                            }
                          }}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Tooltip Area (Bottom fixed) */}
      <View style={styles.tooltipContainer}>
        {selectedDay && (
          <View style={[styles.tooltip, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.tooltipRow}>
              <View style={[styles.tooltipIndicator, { backgroundColor: getDailyColor(selectedDay.count) }]} />
              <View>
                <Text style={[styles.tooltipDate, { color: colors.text }]}>
                  {new Date(selectedDay.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <Text style={[styles.tooltipCount, { color: colors.textSecondary }]}>
                  {selectedDay.count} verses
                </Text>
              </View>
            </View>
          </View>
        )}

        {selectedMonth && (
          <View style={[styles.tooltip, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.tooltipRow}>
              <View style={[styles.tooltipIndicator, { backgroundColor: getMonthlyColor(selectedMonth.totalCount) }]} />
              <View>
                <Text style={[styles.tooltipDate, { color: colors.text }]}>
                  {selectedMonth.label} {selectedMonth.year}
                </Text>
                <Text style={[styles.tooltipCount, { color: colors.textSecondary }]}>
                  {selectedMonth.totalCount} verses total
                </Text>
              </View>
            </View>
          </View>
        )}

        {!selectedDay && !selectedMonth && (
          <View style={[styles.legendContainer]}>
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Less</Text>
            <View style={styles.legendCells}>
              <View style={[styles.legendCell, { backgroundColor: getDailyColor(1) }]} />
              <View style={[styles.legendCell, { backgroundColor: getDailyColor(5) }]} />
              <View style={[styles.legendCell, { backgroundColor: getDailyColor(10) }]} />
              <View style={[styles.legendCell, { backgroundColor: getDailyColor(20) }]} />
            </View>
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>More</Text>
          </View>
        )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  quickStats: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    marginHorizontal: -20,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  contentContainer: {
    flexDirection: 'column',
    gap: 24,
    minWidth: 600,
  },
  historySection: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyGrid: {
    gap: 8,
  },
  historyYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  yearLabel: {
    width: 40,
    fontSize: 12,
    fontWeight: '600',
  },
  monthsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  monthBlock: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  currentYearSection: {
    // 
  },
  heatmapContainer: {
    // 
  },
  monthLabelsRow: {
    height: 16,
    marginBottom: 4,
    marginLeft: 20, // Offset for day labels
    position: 'relative',
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  dayLabelsColumn: {
    marginTop: 0,
    gap: 0,
    justifyContent: 'space-between',
    height: 104, // 7 days * 14px + gaps
  },
  dayLabel: {
    fontSize: 9,
    height: 14,
    lineHeight: 14,
    textAlign: 'center',
  },
  weeksContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  weekColumn: {
    gap: 2,
  },
  dayCell: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  tooltipContainer: {
    marginTop: 16,
    height: 50,
    justifyContent: 'center',
  },
  tooltip: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tooltipIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  tooltipDate: {
    fontWeight: '700',
    fontSize: 13,
  },
  tooltipCount: {
    fontSize: 12,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  legendCells: {
    flexDirection: 'row',
    gap: 4,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
});

export default HeatmapCalendar;
