import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomColors } from '@/utils/themeUtils';

export default function RepeatModeSelector() {
  const { repeatMode, setRepeatMode } = useSettingsStore();
  const colors = useCustomColors();
  
  const options = [1, 2, 3, 4, 5];
  
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Repeat Mode</Text>
      <Text style={[styles.description, { color: colors.inactive }]}>
        Number of times to repeat each verse during playback
      </Text>
      
      <View style={styles.optionsContainer}>
        {options.map((option) => {
          const isSelected = repeatMode === option;
          
          return (
            <Pressable
              key={option}
              style={[
                styles.option,
                { 
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                }
              ]}
              onPress={() => setRepeatMode(option)}
            >
              <Text 
                style={[
                  styles.optionLabel,
                  { color: isSelected ? '#fff' : colors.text }
                ]}
              >
                {option}x
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  optionLabel: {
    fontWeight: '500',
  },
});