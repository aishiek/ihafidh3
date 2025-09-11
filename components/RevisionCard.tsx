import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, CheckCircle, XCircle } from 'lucide-react-native';
import { useCustomColors } from '@/utils/themeUtils';

interface RevisionCardProps {
  versesPerDay: number;
  surahsPerWeek: number;
  completedToday: number;
  completedThisWeek: number;
}

export default function RevisionCard({
  versesPerDay,
  surahsPerWeek,
  completedToday,
  completedThisWeek,
}: RevisionCardProps) {
  const router = useRouter();
  const colors = useCustomColors();
  
  const dailyProgress = Math.min(completedToday / versesPerDay, 1);
  const weeklyProgress = Math.min(completedThisWeek / surahsPerWeek, 1);
  
  const handlePress = () => {
    router.push('/revision');
  };
  
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { 
          backgroundColor: colors.card, 
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        }
      ]}
      onPress={handlePress}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <BookOpen size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Revision</Text>
        </View>
        
        {dailyProgress >= 1 && weeklyProgress >= 1 ? (
          <CheckCircle size={20} color={colors.success} />
        ) : (
          <XCircle size={20} color={colors.error} />
        )}
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressItem}>
          <View style={styles.progressLabelContainer}>
            <Text style={[styles.progressLabel, { color: colors.text }]}>Daily</Text>
            <Text style={[styles.progressValue, { color: colors.primary }]}>
              {completedToday}/{versesPerDay} verses
            </Text>
          </View>
          <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
            <View 
              style={[
                styles.progressBar, 
                { 
                  width: `${dailyProgress * 100}%`,
                  backgroundColor: dailyProgress >= 1 ? colors.success : colors.primary 
                }
              ]} 
            />
          </View>
        </View>
        
        <View style={styles.progressItem}>
          <View style={styles.progressLabelContainer}>
            <Text style={[styles.progressLabel, { color: colors.text }]}>Weekly</Text>
            <Text style={[styles.progressValue, { color: colors.primary }]}>
              {completedThisWeek}/{surahsPerWeek} surahs
            </Text>
          </View>
          <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
            <View 
              style={[
                styles.progressBar, 
                { 
                  width: `${weeklyProgress * 100}%`,
                  backgroundColor: weeklyProgress >= 1 ? colors.success : colors.primary 
                }
              ]} 
            />
          </View>
        </View>
      </View>
      
      <Text style={[styles.viewMore, { color: colors.primary }]}>
        Manage revision schedule →
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressItem: {
    marginBottom: 12,
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
  viewMore: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
});