import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Flame, 
  Clock, 
  BookOpen, 
  Award, 
  CheckCircle2, 
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  X
} from 'lucide-react-native';
import { useActivityStore } from '@/store/activityStore';
import { useProgressStore } from '@/store/progressStore';
import { useCustomColors } from '@/utils/themeUtils';
import { getHijriDateOffline } from '@/utils/dateUtils';
import { surahsData } from '@/data/surahs';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 48 - 24) / 7; // fits 7 cells on screen neatly

export default function StreakDetailScreen() {
  const router = useRouter();
  const colors = useCustomColors();
  
  // Stores data
  const { 
    currentStreak, 
    longestStreak, 
    dailyActivities 
  } = useActivityStore();

  const { 
    memorizedVerseDates, 
    revisedVerses 
  } = useProgressStore();

  // Calendar State: Track visible month/year
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  // Modal State
  const [selectedDayData, setSelectedDayData] = useState<{
    dateStr: string;
    gregorianDate: Date;
    hijriDateStr: string;
    versesRead: number;
    timeSpent: number;
    memorizedCount: number;
    revisedCount: number;
    surahsRead: string[];
    isActive: boolean;
  } | null>(null);

  // Parse activity for a specific date (YYYY-MM-DD)
  const getDayActivity = (dateStr: string) => {
    const activity = dailyActivities?.find(a => a.date === dateStr);
    
    // Calculate memorized verses on this date
    let memorizedCount = 0;
    if (memorizedVerseDates) {
      memorizedCount = Object.values(memorizedVerseDates).filter(d => d === dateStr).length;
    }

    // Calculate revised verses on this date
    let revisedCount = 0;
    if (revisedVerses) {
      revisedCount = revisedVerses.filter(rv => rv.revisionDate === dateStr).length;
    }

    const versesRead = activity?.versesRead || 0;
    const timeSpent = activity?.timeSpent || 0;
    const readSurahIds = activity?.readSurahIds || [];

    // Map surah IDs to names
    const surahsRead = readSurahIds.map(id => {
      const s = surahsData.find(surah => surah.id === id);
      return s ? s.englishName : `Surah ${id}`;
    });

    const isActive = versesRead > 0 || memorizedCount > 0 || revisedCount > 0;

    return {
      versesRead,
      timeSpent,
      memorizedCount,
      revisedCount,
      surahsRead,
      isActive
    };
  };

  // 1. WEEK VIEW DATA (7 days of current week ending today)
  const weekDays = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const activity = getDayActivity(dateStr);
      days.push({
        dayName: d.toLocaleDateString('en', { weekday: 'narrow' }),
        dayNum: d.getDate(),
        dateStr,
        ...activity
      });
    }
    return days;
  }, [dailyActivities, memorizedVerseDates, revisedVerses]);

  // 2. MONTH VIEW GRID DATA
  const monthData = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    const startDayIndex = firstDay.getDay(); // 0 is Sunday, 1 is Monday...

    // Total days in month
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    
    // Empty cells for alignment before month starts
    for (let i = 0; i < startDayIndex; i++) {
      days.push(null);
    }

    // Month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const activity = getDayActivity(dateStr);
      days.push({
        dayNum: i,
        dateStr,
        gregorianDate: d,
        ...activity
      });
    }

    return days;
  }, [currentMonthDate, dailyActivities, memorizedVerseDates, revisedVerses]);

  const handlePrevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleCellPress = (day: any) => {
    if (!day) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    // Offline Hijri Date calculation
    const hijri = getHijriDateOffline(day.gregorianDate || new Date(day.dateStr));

    setSelectedDayData({
      dateStr: day.dateStr,
      gregorianDate: day.gregorianDate || new Date(day.dateStr),
      hijriDateStr: hijri.formatted,
      versesRead: day.versesRead,
      timeSpent: day.timeSpent,
      memorizedCount: day.memorizedCount,
      revisedCount: day.revisedCount,
      surahsRead: day.surahsRead,
      isActive: day.isActive
    });
  };

  // Formatter helpers
  const formatTimeSpent = (secs: number) => {
    if (secs === 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatHeaderDate = (date: Date) => {
    return date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── HEADER BAR ─── */}
      <View style={styles.headerBar}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Reading Activity</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ─── STREAK BANNER CARD ─── */}
        <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.streakHeader}>
            <View style={styles.streakFlameContainer}>
              <Flame size={44} color="#FF5722" fill="#FF5722" />
            </View>
            <View style={styles.streakInfo}>
              <Text style={[styles.streakNumber, { color: colors.text }]}>
                {currentStreak} <Text style={styles.streakUnit}>Days</Text>
              </Text>
              <Text style={[styles.streakSubtitle, { color: colors.inactive }]}>
                Best Streak: {longestStreak} days
              </Text>
            </View>
          </View>
          <View style={[styles.streakDivider, { backgroundColor: colors.border }]} />
          <View style={styles.streakMetrics}>
            <View style={styles.metricItem}>
              <TrendingUp size={16} color={colors.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {currentStreak > 0 ? 'Active' : 'Inactive'}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.inactive }]}>Status</Text>
            </View>
            <View style={[styles.metricSeparator, { backgroundColor: colors.border }]} />
            <View style={styles.metricItem}>
              <Award size={16} color="#FFD700" style={{ marginBottom: 4 }} />
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {longestStreak}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.inactive }]}>Personal Best</Text>
            </View>
          </View>
        </View>

        {/* ─── WEEK VIEW (7 DAYS ROW) ─── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>This Week</Text>
        </View>
        <View style={styles.weekRow}>
          {weekDays.map((day, idx) => {
            const isTodayDate = new Date().toISOString().split('T')[0] === day.dateStr;
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => handleCellPress({ ...day, gregorianDate: new Date(day.dateStr) })}
                style={[
                  styles.weekCell,
                  { backgroundColor: colors.card, borderColor: isTodayDate ? colors.primary : colors.border },
                  day.isActive && styles.activeCell
                ]}
              >
                <Text style={[styles.weekDayName, { color: colors.inactive }]}>
                  {day.dayName}
                </Text>
                <View style={[
                  styles.weekDayCircle,
                  day.isActive && styles.activeCircle
                ]}>
                  <Text style={[
                    styles.weekDayNum,
                    { color: day.isActive ? '#ffffff' : colors.text }
                  ]}>
                    {day.dayNum}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── MONTHLY CALENDAR GRID ─── */}
        <View style={styles.monthHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {currentMonthDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </Text>
          <View style={styles.calendarNav}>
            <TouchableOpacity onPress={handlePrevMonth} style={[styles.navButton, { borderColor: colors.border }]}>
              <ChevronLeft size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNextMonth} style={[styles.navButton, { borderColor: colors.border }]}>
              <ChevronRight size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.calendarGridContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Week Headers */}
          <View style={styles.gridWeekdays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => (
              <Text key={idx} style={[styles.weekdayLabel, { color: colors.inactive }]}>{w}</Text>
            ))}
          </View>

          {/* Grid Cells */}
          <View style={styles.gridDays}>
            {monthData.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.gridCellEmpty} />;
              }
              const isTodayDate = new Date().toISOString().split('T')[0] === day.dateStr;
              return (
                <TouchableOpacity
                  key={`day-${day.dayNum}`}
                  onPress={() => handleCellPress(day)}
                  style={[
                    styles.gridCell,
                    { borderColor: isTodayDate ? colors.primary : 'transparent' },
                    day.isActive ? styles.activeCell : { backgroundColor: 'rgba(255, 255, 255, 0.03)' }
                  ]}
                >
                  <Text style={[
                    styles.gridCellText,
                    { color: day.isActive ? '#ffffff' : colors.text }
                  ]}>
                    {day.dayNum}
                  </Text>
                  {day.isActive && (
                    <View style={styles.activeDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, styles.activeCell]} />
            <Text style={[styles.legendText, { color: colors.inactive }]}>Completed Activity</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} />
            <Text style={[styles.legendText, { color: colors.inactive }]}>No Session</Text>
          </View>
        </View>

      </ScrollView>

      {/* ─── DAY DETAIL MODAL ─── */}
      <Modal
        visible={selectedDayData !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDayData(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedDayData(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {selectedDayData && (
              <>
                {/* Top Right Close X Button */}
                <TouchableOpacity 
                  onPress={() => setSelectedDayData(null)}
                  style={[styles.modalCloseIconButton, { backgroundColor: colors.border }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={16} color={colors.text} />
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalGregorianDate, { color: colors.text }]}>
                    {formatHeaderDate(selectedDayData.gregorianDate)}
                  </Text>
                  <Text style={[styles.modalHijriDate, { color: colors.primary }]}>
                    {selectedDayData.hijriDateStr}
                  </Text>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: selectedDayData.isActive ? 'rgba(76, 175, 80, 0.15)' : 'rgba(136, 136, 136, 0.15)' }
                  ]}>
                    <Text style={[
                      styles.statusBadgeText, 
                      { color: selectedDayData.isActive ? '#4CAF50' : colors.inactive }
                    ]}>
                      {selectedDayData.isActive ? 'Completed' : 'Rest Day'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

                {/* Stats List */}
                <ScrollView 
                  style={styles.modalStatsScroll} 
                  contentContainerStyle={{ paddingBottom: 12 }}
                  showsVerticalScrollIndicator={false}
                >
                  
                  {/* Time Spent */}
                  <View style={styles.modalStatRow}>
                    <View style={styles.modalStatLabelGroup}>
                      <Clock size={16} color={colors.inactive} />
                      <Text style={[styles.modalStatName, { color: colors.text }]}>Time Spent</Text>
                    </View>
                    <Text style={[styles.modalStatValue, { color: colors.text }]}>
                      {formatTimeSpent(selectedDayData.timeSpent)}
                    </Text>
                  </View>

                  {/* Verses Read */}
                  <View style={styles.modalStatRow}>
                    <View style={styles.modalStatLabelGroup}>
                      <BookOpen size={16} color={colors.inactive} />
                      <Text style={[styles.modalStatName, { color: colors.text }]}>Verses Read</Text>
                    </View>
                    <Text style={[styles.modalStatValue, { color: colors.text }]}>
                      {selectedDayData.versesRead}
                    </Text>
                  </View>

                  {/* Surahs Read List */}
                  {selectedDayData.surahsRead.length > 0 && (
                    <View style={styles.surahsListContainer}>
                      <Text style={[styles.surahsListTitle, { color: colors.inactive }]}>Surahs Recited:</Text>
                      <View style={styles.surahBadgesRow}>
                        {selectedDayData.surahsRead.map((name, idx) => (
                          <View key={idx} style={[styles.surahBadge, { backgroundColor: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.2)' }]}>
                            <Text style={styles.surahBadgeText}>{name}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Memorized Verses */}
                  <View style={styles.modalStatRow}>
                    <View style={styles.modalStatLabelGroup}>
                      <CheckCircle2 size={16} color="#4CAF50" />
                      <Text style={[styles.modalStatName, { color: colors.text }]}>Memorized</Text>
                    </View>
                    <Text style={[styles.modalStatValue, { color: '#4CAF50' }]}>
                      {selectedDayData.memorizedCount} {selectedDayData.memorizedCount === 1 ? 'verse' : 'verses'}
                    </Text>
                  </View>

                  {/* Revised Verses */}
                  <View style={styles.modalStatRow}>
                    <View style={styles.modalStatLabelGroup}>
                      <RefreshCw size={16} color={colors.primary} />
                      <Text style={[styles.modalStatName, { color: colors.text }]}>Revised</Text>
                    </View>
                    <Text style={[styles.modalStatValue, { color: colors.primary }]}>
                      {selectedDayData.revisedCount} {selectedDayData.revisedCount === 1 ? 'verse' : 'verses'}
                    </Text>
                  </View>

                </ScrollView>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  streakCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakFlameContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakInfo: {
    marginLeft: 16,
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: '800',
  },
  streakUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF5722',
  },
  streakSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  streakDivider: {
    height: 1,
    marginVertical: 16,
  },
  streakMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  metricLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  metricSeparator: {
    width: 1,
    height: 30,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  weekCell: {
    width: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  activeCell: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  weekDayName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  weekDayCircle: {
    width: CELL_SIZE - 12,
    height: CELL_SIZE - 12,
    borderRadius: (CELL_SIZE - 12) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  weekDayNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarNav: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarGridContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  gridWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekdayLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  gridDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  gridCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: (width - 48 - 32 - (CELL_SIZE * 7)) / 14, // auto centering cells
    borderWidth: 1,
  },
  gridCellEmpty: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    marginHorizontal: (width - 48 - 32 - (CELL_SIZE * 7)) / 14,
  },
  gridCellText: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    position: 'absolute',
    bottom: 6,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '82%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  modalCloseIconButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalHeader: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  modalGregorianDate: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalHijriDate: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalDivider: {
    width: '100%',
    height: 1,
    marginVertical: 16,
  },
  modalStatsScroll: {
    width: '100%',
    flexShrink: 1,
  },
  modalStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  modalStatLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalStatName: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalStatValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  surahsListContainer: {
    width: '100%',
    paddingLeft: 24,
    marginBottom: 8,
  },
  surahsListTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  surahBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  surahBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  surahBadgeText: {
    fontSize: 11,
    color: '#D4AF37',
    fontWeight: '600',
  },
});
