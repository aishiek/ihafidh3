import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { useActivityStore } from '@/store/activityStore';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

export default function StreakHeaderIcon() {
  const currentStreak = useActivityStore(state => state.currentStreak);
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/streak-detail');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.container,
        currentStreak === 0 && styles.containerInactive
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Streak: ${currentStreak} days`}
      accessibilityHint="Shows reading activity calendar and streak details"
    >
      <Flame 
        size={16} 
        color={currentStreak > 0 ? '#FF5722' : '#888888'} 
        fill={currentStreak > 0 ? '#FF5722' : 'none'} 
      />
      <Text style={[styles.text, currentStreak > 0 ? styles.activeText : styles.inactiveText]}>
        {currentStreak}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 87, 34, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 34, 0.4)',
    paddingHorizontal: 8,
    marginRight: 8,
  },
  containerInactive: {
    backgroundColor: 'rgba(136, 136, 136, 0.1)',
    borderColor: 'rgba(136, 136, 136, 0.3)',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  activeText: {
    color: '#FF5722',
  },
  inactiveText: {
    color: '#888888',
  },
});
