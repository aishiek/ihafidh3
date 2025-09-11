import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { BarChart2 } from 'lucide-react-native';
import { useCustomColors } from '@/utils/themeUtils';
import { formatTime } from '@/utils/dateUtils';

interface StatsCardProps {
  memorizedVerses: number;
  revisedVerses: number;
  totalTimeSpent: number;
}

export default function StatsCard({ 
  memorizedVerses, 
  revisedVerses, 
  totalTimeSpent 
}: StatsCardProps) {
  const router = useRouter();
  const colors = useCustomColors();
  
  const handlePress = () => {
    router.push('/stats');
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
        <Text style={[styles.title, { color: colors.text }]}>Your Progress</Text>
        <BarChart2 size={20} color={colors.primary} />
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {memorizedVerses}
          </Text>
          <Text style={[styles.statLabel, { color: colors.inactive }]}>
            Memorized
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {revisedVerses}
          </Text>
          <Text style={[styles.statLabel, { color: colors.inactive }]}>
            Revised
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {formatTime(totalTimeSpent)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.inactive }]}>
            Time Spent
          </Text>
        </View>
      </View>
      
      <Text style={[styles.viewMore, { color: colors.primary }]}>
        View detailed statistics →
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
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  statsContainer: {
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
  viewMore: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
});