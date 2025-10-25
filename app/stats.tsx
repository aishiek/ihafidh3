import { useProgressStore } from '@/store/progressStore';
import { formatTime } from '@/utils/dateUtils';
import { useCustomColors } from '@/utils/themeUtils';
import { useRouter } from 'expo-router';
import { Award, BarChart2, Clock } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function StatsScreen() {
  const router = useRouter();
  const colors = useCustomColors();
  const { 
    memorizedVerses, 
    revisedVerses, 
    timeSpent,
    dailyStreak,
    badges
  } = useProgressStore();
  
  // Memoize expensive calculations to prevent unnecessary re-computations
  const stats = useMemo(() => {
    const totalVerses = 6236;
    const memorizedCount = memorizedVerses?.length || 0;
    const memorizedPercentage = (memorizedCount / totalVerses) * 100;
    
    // Get current date/time info safely
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Fix week calculation - this was potentially problematic
    const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
    const currentWeek = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-${currentWeek}`;
    
    const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
    
  // Safely access timeSpent properties with fallbacks. Cast to any because store's TimeSpent
  // type may be narrower in some builds (daily-only). This keeps the UI resilient.
  const ts: any = timeSpent || {};
  const timeToday = ts.daily ? (ts.daily[today] || 0) : 0;
  const timeThisWeek = ts.weekly ? (ts.weekly[weekKey] || 0) : 0;
  const timeThisMonth = ts.monthly ? (ts.monthly[currentMonth] || 0) : 0;
  const totalTime = ts.total || 0;
    
    // Safely count earned badges
    const earnedBadges = badges ? Object.values(badges).filter(Boolean).length : 0;
    
    // Calculate average daily time safely
    const dailyTimes = timeSpent?.daily ? Object.values(timeSpent.daily) : [];
    const averageDailyTime = dailyTimes.length > 0 
      ? dailyTimes.reduce((sum, time) => sum + (time || 0), 0) / dailyTimes.length
      : 0;
    
    return {
      totalVerses,
      memorizedCount,
      memorizedPercentage,
      timeToday,
      timeThisWeek,
      timeThisMonth,
      totalTime,
      earnedBadges,
      averageDailyTime
    };
  }, [memorizedVerses, timeSpent, badges]);
  
  // Safe navigation handler
  const handleViewBadges = () => {
    try {
      router.push('/badges');
    } catch (error) {
      console.warn('Navigation error:', error);
      // Could show an error toast here
    }
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.overviewHeader}>
            <BarChart2 size={24} color={colors.primary} />
            <Text style={[styles.overviewTitle, { color: colors.text }]}>
              Memorization Overview
            </Text>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {stats.memorizedCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.inactive }]}>
                Memorized
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {revisedVerses?.length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.inactive }]}>
                Revised
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {dailyStreak || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.inactive }]}>
                Day Streak
              </Text>
            </View>
          </View>
          
          <View style={styles.progressSection}>
            <View style={styles.progressLabelContainer}>
              <Text style={[styles.progressLabel, { color: colors.text }]}>
                Overall Progress
              </Text>
              <Text style={[styles.progressValue, { color: colors.primary }]}>
                {stats.memorizedPercentage.toFixed(1)}%
              </Text>
            </View>
            <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
              <View 
                style={[
                  styles.progressBar, 
                  { 
                    width: `${Math.min(stats.memorizedPercentage, 100)}%`,
                    backgroundColor: colors.primary 
                  }
                ]} 
              />
            </View>
          </View>
        </View>
        
        <View style={[styles.timeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.timeHeader}>
            <Clock size={24} color={colors.primary} />
            <Text style={[styles.timeTitle, { color: colors.text }]}>
              Time Spent
            </Text>
          </View>
          
          <View style={styles.timeStatsRow}>
            <View style={[styles.timeStatItem, { backgroundColor: (colors as any).highlight || colors.card }]}>
              <Text style={[styles.timeStatValue, { color: colors.primary }]}>
                {formatTime(stats.timeToday)}
              </Text>
              <Text style={[styles.timeStatLabel, { color: colors.text }]}>
                Today
              </Text>
            </View>
            
            <View style={[styles.timeStatItem, { backgroundColor: (colors as any).highlight || colors.card }]}>
              <Text style={[styles.timeStatValue, { color: colors.primary }]}>
                {formatTime(stats.timeThisWeek)}
              </Text>
              <Text style={[styles.timeStatLabel, { color: colors.text }]}>
                This Week
              </Text>
            </View>
          </View>
          
          <View style={styles.timeStatsRow}>
            <View style={[styles.timeStatItem, { backgroundColor: (colors as any).highlight || colors.card }]}>
              <Text style={[styles.timeStatValue, { color: colors.primary }]}>
                {formatTime(stats.timeThisMonth)}
              </Text>
              <Text style={[styles.timeStatLabel, { color: colors.text }]}>
                This Month
              </Text>
            </View>
            
            <View style={[styles.timeStatItem, { backgroundColor: (colors as any).highlight || colors.card }]}>
              <Text style={[styles.timeStatValue, { color: colors.primary }]}>
                {formatTime(stats.totalTime)}
              </Text>
              <Text style={[styles.timeStatLabel, { color: colors.text }]}>
                Total
              </Text>
            </View>
          </View>
        </View>
        
        <View style={[styles.badgesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.badgesHeader}>
            <Award size={24} color={colors.primary} />
            <Text style={[styles.badgesTitle, { color: colors.text }]}>
              Badges
            </Text>
          </View>
          
          <Text style={[styles.badgesDescription, { color: colors.inactive }]}>
            You have earned {stats.earnedBadges} out of 5 badges.
          </Text>
          
          <Pressable
            style={[styles.viewBadgesButton, { backgroundColor: colors.primary }]}
            onPress={handleViewBadges}
          >
            <Text style={styles.viewBadgesButtonText}>View All Badges</Text>
          </Pressable>
        </View>
        
        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>
            Detailed Statistics
          </Text>
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, { color: colors.inactive }]}>
              Total Verses in Quran:
            </Text>
            <Text style={[styles.detailsValue, { color: colors.text }]}>
              6,236
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, { color: colors.inactive }]}>
              Verses Memorized:
            </Text>
            <Text style={[styles.detailsValue, { color: colors.text }]}>
              {stats.memorizedCount} ({stats.memorizedPercentage.toFixed(1)}%)
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, { color: colors.inactive }]}>
              Verses Remaining:
            </Text>
            <Text style={[styles.detailsValue, { color: colors.text }]}>
              {stats.totalVerses - stats.memorizedCount}
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, { color: colors.inactive }]}>
              Daily Streak:
            </Text>
            <Text style={[styles.detailsValue, { color: colors.text }]}>
              {dailyStreak || 0} days
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, { color: colors.inactive }]}>
              Average Daily Time:
            </Text>
            <Text style={[styles.detailsValue, { color: colors.text }]}>
              {formatTime(stats.averageDailyTime)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  overviewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  progressSection: {
    marginTop: 8,
  },
  progressLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  timeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  timeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeStatItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  timeStatValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  timeStatLabel: {
    fontSize: 14,
  },
  badgesCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgesTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  badgesDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  viewBadgesButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewBadgesButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  detailsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailsLabel: {
    fontSize: 14,
  },
  detailsValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});