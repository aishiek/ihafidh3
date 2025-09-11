import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Moon, Sun, Smartphone } from 'lucide-react-native';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomColors } from '@/utils/themeUtils';

export default function ThemeSelector() {
  const { theme, setTheme } = useSettingsStore();
  const colors = useCustomColors();
  
  const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Smartphone, label: 'System' },
  ] as const;
  
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Theme</Text>
      
      <View style={styles.optionsContainer}>
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = theme === option.value;
          
          return (
            <Pressable
              key={option.value}
              style={[
                styles.option,
                { 
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                }
              ]}
              onPress={() => setTheme(option.value)}
            >
              <Icon 
                size={20} 
                color={isSelected ? '#fff' : colors.inactive} 
              />
              <Text 
                style={[
                  styles.optionLabel,
                  { color: isSelected ? '#fff' : colors.text }
                ]}
              >
                {option.label}
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
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  optionLabel: {
    marginLeft: 8,
    fontWeight: '500',
  },
});