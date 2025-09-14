import { toGregorian, toHijri } from 'hijri-converter';
import React, { useMemo, useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
// Using a custom grid instead of RNCalendar for Hijri month layout
import { FASTING_INFO } from '@/constants/fastingInfo';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { FastingLogic } from '@/services/fasting/fastingLogic';
import { CalendarDay, FastingIntention, FastingType } from '@/types/fasting';
import DayDetailModal from './context/DayDetailModal';

// English names for Hijri months
const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  "Rabi' al-awwal",
  "Rabi' al-thani",
  'Jumada al-awwal',
  'Jumada al-thani',
  'Rajab',
  'Sha\'ban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qadah',
  'Dhu al-Hijjah',
];

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ENGLISH_MONTHS_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const THEMES = [
  { label: 'Blue', value: 'blue' },
  { label: 'Green', value: 'green' },
  { label: 'Purple', value: 'purple' },
  { label: 'Orange', value: 'orange' },
];

interface CalendarProps {
  days: CalendarDay[];
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  onSetIntention: (intention: FastingIntention) => void;
}

const { width } = Dimensions.get('window');

// Sizing for custom grid
const GRID_PADDING = 8;
const CELL_MARGIN = 2;
const CELL_DIM = Math.floor((width - GRID_PADDING * 2 - CELL_MARGIN * 2 * 7) / 7);

export default function Calendar({
  days: calendarDays,
  currentMonth,
  onMonthChange,
  onSetIntention,
}: CalendarProps) {
  const { theme } = useUnifiedTheme();
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const formatMonthYear = (date: Date) => {
    try {
      // Get the Hijri date using hijri-converter
      const gregorianDate = new Date(date);
      // Ensure we're using UTC to avoid timezone issues
      const utcDate = new Date(Date.UTC(
        gregorianDate.getFullYear(),
        gregorianDate.getMonth(),
        gregorianDate.getDate()
      ));
      
      const hijriDate = toHijri(
        utcDate.getUTCFullYear(),
        utcDate.getUTCMonth() + 1,
        utcDate.getUTCDate()
      );
      
      const hijriMonthEn = HIJRI_MONTHS_EN[(hijriDate.hm - 1 + 12) % 12] || '';
      const englishMonth = ENGLISH_MONTHS_ABBR[utcDate.getUTCMonth()];
      
      // New Format: HijriMonthEnglish HijriYear
      return `${hijriMonthEn} ${hijriDate.hy}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      // Fallback to Gregorian date if Hijri conversion fails
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const goToToday = () => {
    const now = new Date();
    // Jump to today's Gregorian date; CalendarScreen will dispatch currentMonth and reload
    onMonthChange(now);
  };

  const changeMonth = (delta: number) => {
    const ref = new Date(currentMonth);
    const h = toHijri(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
    let hy = h.hy;
    let hm = h.hm + delta;
    while (hm > 12) { hm -= 12; hy += 1; }
    while (hm < 1) { hm += 12; hy -= 1; }
    // Go to 1st of target Hijri month
    const g = toGregorian(hy, hm, 1);
    const nextDate = new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
    onMonthChange(nextDate);
  };

  const handleDayPress = (day: any) => {
    const selected = calendarDays.find(d => d.date === day.dateString);
    if (selected) {
      setSelectedDay(selected);
      setIsModalVisible(true);
    }
  };

  const dayMap = useMemo(() => {
    const map: Record<string, CalendarDay> = {};
    calendarDays.forEach(d => { if (d?.date) map[d.date] = d; });
    return map;
  }, [calendarDays]);

  const getMarkedDates = () => {
    const marked: Record<string, any> = {};

    calendarDays.forEach(day => {
      if (!day?.date || !day.isCurrentMonth) return;
      if (!day.fastingTypes || day.fastingTypes.length === 0) return;

      // Pick the fasting type with highest priority
      const topType = day.fastingTypes
        .slice()
        .sort((a, b) => (FASTING_INFO[b].priority - FASTING_INFO[a].priority))[0];
      const fastingInfo = FASTING_INFO[topType];
      if (!fastingInfo) return;

      marked[day.date] = {
        selected: true,
        selectedColor: fastingInfo.color,
        selectedTextColor: '#ffffff',
        dotColor: fastingInfo.color,
      };
    });

    return marked;
  };

  const renderLegend = () => {
    // Determine active fasting types in this grid
    const activeTypes = new Set<FastingType>();
    const combos = new Set<string>();
    hijriMonthDays.forEach(d => {
      d.fastingTypes?.forEach(t => activeTypes.add(t));
      if (d.fastingTypes && d.fastingTypes.length >= 2) {
        const topTwo = d.fastingTypes
          .slice()
          .sort((a, b) => (FASTING_INFO[b].priority - FASTING_INFO[a].priority))
          .slice(0, 2);
        combos.add(`${topTwo[0]}+${topTwo[1]}`);
      }
    });
    const isRamadanMonth = hijriMonthDays.length > 0 && hijriMonthDays[0].hijriMonth === 9;

    // Build legend entries dynamically
    type LegendEntry = { key: string; name: string; color: string; color2?: string };
    const entries: LegendEntry[] = [];
    activeTypes.forEach((t) => {
      const info = FASTING_INFO[t];
      if (info) entries.push({ key: t, name: info.name, color: info.color });
    });
    // Add combined entries (dual-color chip)
    combos.forEach((combo) => {
      const [a, b] = combo.split('+') as [FastingType, FastingType];
      const ia = FASTING_INFO[a];
      const ib = FASTING_INFO[b];
      if (ia && ib) {
        entries.push({ key: `combo:${a}+${b}`, name: `${ia.name} + ${ib.name}`, color: ia.color, color2: ib.color });
      }
    });
    if (isRamadanMonth) {
      entries.unshift({ key: 'ramadan', name: 'Ramadan (Full month)', color: '#4F46E5' });
    }

    if (entries.length === 0) return null;

    return (
      <View style={[styles.legendContainer, { backgroundColor: theme.surface }]}>
        <View style={styles.legendHeader}>
          <Text style={[styles.legendTitle, { color: theme.text }]}>Fasting Types</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.legendScrollContent}
        >
          {entries.map((e) => (
            <View 
              key={e.key} 
              style={[
                styles.legendItem, 
                { 
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                }
              ]}
            >
              {e.color2 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row' }}>
                    <View style={{ flex: 1, backgroundColor: e.color }} />
                    <View style={{ flex: 1, backgroundColor: e.color2 }} />
                  </View>
                </View>
              ) : (
                <View style={[styles.legendDot, { backgroundColor: e.color }]} />
              )}
              <Text style={[styles.legendName, { color: theme.text }]}>{e.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Build Hijri month grid: days 1..29/30, mapped to Gregorian dates
  const hijriMonthDays = useMemo(() => {
    const ref = new Date(currentMonth);
    const h = toHijri(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
    const hy = h.hy;
    const hm = h.hm;
    const days: Array<{ key: string; hijriDay: number; hijriMonth: number; gregDate: Date; dateString: string; isToday: boolean; fastingTypes: FastingType[]; }> = [];
    // Build a UTC-normalized ISO for "today" based on local date to avoid timezone shift
    const now = new Date();
    const todayUtcMidnight = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const todayISO = todayUtcMidnight.toISOString().split('T')[0];
    for (let d = 1; d <= 31; d++) {
      try {
        const g = toGregorian(hy, hm, d);
        if (!g || !g.gy) break;
        const gd = new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
        const iso = gd.toISOString().split('T')[0];
        // Stop if month overflow (some libs still return a date but it belongs to next Hijri month)
        const hCheck = toHijri(gd.getUTCFullYear(), gd.getUTCMonth() + 1, gd.getUTCDate());
        if (hCheck.hm !== hm) break;
        // Determine fasting types via logic
        const hijriForLogic: any = { day: String(d), month: { number: hm } };
        const ftypes: FastingType[] = FastingLogic.getFastingTypesForDay(hijriForLogic, gd);
        days.push({ key: iso, hijriDay: d, hijriMonth: hm, gregDate: gd, dateString: iso, isToday: iso === todayISO, fastingTypes: ftypes });
      } catch (_) {
        // Invalid day (29-day month): stop at previous day
        break;
      }
    }
    return days;
  }, [currentMonth]);

  // Compute leading blanks to align week start to Monday (Mon=1...Sun=0)
  const leadingBlanks = useMemo(() => {
    if (hijriMonthDays.length === 0) return 0;
    const first = hijriMonthDays[0].gregDate;
    const weekday = first.getUTCDay(); // 0=Sun..6=Sat
    // We want Mon..Sun header; convert so Mon=0
    const monIndex = (weekday + 6) % 7; 
    return monIndex;
  }, [hijriMonthDays]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={[styles.header, { borderBottomColor: theme.border }] }>
        <TouchableOpacity
          accessibilityLabel="Previous month"
          onPress={() => changeMonth(-1)}
          style={[styles.navButton, { borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.navButtonText, { color: theme.primary }]}>{'<'}</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.monthText, { color: theme.text }]}>
            {formatMonthYear(currentMonth)}
          </Text>
        </View>

        <TouchableOpacity
          accessibilityLabel="Next month"
          onPress={() => changeMonth(1)}
          style={[styles.navButton, { borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.navButtonText, { color: theme.primary }]}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Optional: Gregorian start month label (if start/end months differ) ABOVE the weekday header */}
      {(() => {
        if (hijriMonthDays.length === 0) return null;
        const first = hijriMonthDays[0].gregDate;
        const last = hijriMonthDays[hijriMonthDays.length - 1].gregDate;
        const startMonth = first.toLocaleString('en-US', { month: 'short' });
        const startYear = first.getUTCFullYear();
        const endMonth = last.toLocaleString('en-US', { month: 'short' });
        const endYear = last.getUTCFullYear();
        const differs = startMonth !== endMonth || startYear !== endYear;
        if (!differs) return null;
        return (
          <View style={styles.gregLabelsTop}>
            <Text style={[styles.gregLabelText, { color: theme.textSecondary }]}>{`${startMonth} ${startYear}`}</Text>
          </View>
        );
      })()}

      {/* Weekday headers Mon..Sun */}
      <View style={styles.weekHeaderRow}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
          <Text key={d} style={[styles.weekHeaderText, { color: theme.textSecondary }]}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <View key={`blank-${i}`} style={[styles.dayCell, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />
        ))}
        {hijriMonthDays.map(day => {
          // Ramadan override: color entire month in indigo
          const isRamadan = day.hijriMonth === 9;
          const RAMADAN_COLOR = '#4F46E5';

          // Determine fasting colors (up to 2 colors) unless Ramadan
          const sortedTypes: FastingType[] = isRamadan ? [] : day.fastingTypes
            .slice()
            .sort((a, b) => (FASTING_INFO[b].priority - FASTING_INFO[a].priority));
          const uniqueTypes: FastingType[] = Array.from(new Set(sortedTypes));
          const colors = isRamadan ? [RAMADAN_COLOR] : uniqueTypes.slice(0, 2).map(t => FASTING_INFO[t].color);

          const hasFasting = colors.length > 0;
          const borderColor = hasFasting ? colors[0] : theme.border;
          const hijriTextColor = hasFasting ? '#FFFFFF' : theme.text;
          const gregTextColor = hasFasting ? 'rgba(255,255,255,0.85)' : theme.textSecondary;

          return (
            <TouchableOpacity key={day.key} onPress={() => handleDayPress({ dateString: day.dateString })} activeOpacity={0.8}>
              <View style={[styles.dayCell, { backgroundColor: theme.surface, borderColor }]}> 
                {/* Colored backgrounds */}
                {hasFasting && colors.length === 1 && (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors[0], borderRadius: 8 }]} />
                )}
                {hasFasting && colors.length === 2 && (
                  <>
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors[0], width: '50%', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]} />
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors[1], left: '50%', width: '50%', borderTopRightRadius: 8, borderBottomRightRadius: 8 }]} />
                  </>
                )}

                {day.isToday && (
                  <View style={[styles.todayRing, { borderColor: '#14B8A6' }]} />
                )}
                <Text style={[styles.hijriNumber, { color: hijriTextColor }]}>{day.hijriDay}</Text>
                <Text style={[styles.gregNumber, { color: '#FFFF00' }]}>{day.gregDate.getUTCDate()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Optional: Gregorian end month label (right-aligned, above legend) */}
      {(() => {
        if (hijriMonthDays.length === 0) return null;
        const first = hijriMonthDays[0].gregDate;
        const last = hijriMonthDays[hijriMonthDays.length - 1].gregDate;
        const startMonth = first.toLocaleString('en-US', { month: 'short' });
        const startYear = first.getUTCFullYear();
        const endMonth = last.toLocaleString('en-US', { month: 'short' });
        const endYear = last.getUTCFullYear();
        const differs = startMonth !== endMonth || startYear !== endYear;
        if (!differs) return null;
        return (
          <View style={styles.gregLabelsBottom}>
            <Text style={[styles.gregLabelText, { color: theme.textSecondary }]}>{`${endMonth} ${endYear}`}</Text>
          </View>
        );
      })()}

      {renderLegend()}

      <DayDetailModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        selectedDate={selectedDay?.date || null}
        calendarDays={calendarDays}
        fastingIntentions={{}}
        onSetIntention={onSetIntention}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 20, // Add bottom padding to utilize bottom space
  },
  gregLabelsTop: {
    paddingHorizontal: 8,
    paddingTop: 4,
    alignItems: 'flex-start',
  },
  gregLabelsBottom: {
    paddingHorizontal: 8,
    paddingTop: 6,
    alignItems: 'flex-end',
  },
  gregLabelText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  monthText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 0,
  },
  navButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  themeSelector: {
    minWidth: 100,
  },
  picker: {
    height: 40,
    width: 120,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  calendar: {
    margin: 8,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: GRID_PADDING,
    marginTop: 8,
  },
  weekHeaderText: {
    width: CELL_DIM,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PADDING,
    paddingTop: 6,
  },
  dayCell: {
    width: CELL_DIM,
    height: CELL_DIM,
    margin: CELL_MARGIN,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 12,
  },
  todayRing: {
    position: 'absolute',
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderWidth: 1.5,
    borderRadius: 6,
  },
  hijriNumber: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  gregNumber: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    textAlign: 'right',
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.7,
  },
  legendContainer: {
    margin: 16,
    marginBottom: 30, // Increase bottom margin to utilize bottom space
    borderRadius: 12,
    padding: 16, // Increase padding for better spacing
    elevation: 2,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  legendScrollContent: {
    paddingVertical: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendName: {
    fontSize: 14,
  },
});
