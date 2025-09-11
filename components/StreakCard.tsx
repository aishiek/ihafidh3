import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { useCustomColors } from '@/utils/themeUtils';

interface StreakCardProps {
  streak: number;
}

export default function StreakCard({ streak }: StreakCardProps) {
  const colors = useCustomColors();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
        <Flame size={24} color="#fff" />
      </View>
      
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Daily Streak</Text>
        <Text style={[styles.streakText, { color: colors.primary }]}>
          {streak} {streak === 1 ? 'day' : 'days'}
        </Text>
        <Text style={[styles.description, { color: colors.inactive }]}>
          {streak > 0 
            ? "Keep going! Don't break your streak." 
            : "Start your journey today!"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
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
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  streakText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
  },
});