import React from 'react';
import { StyleSheet, Text, View, Switch } from 'react-native';
import { useCustomColors } from '@/utils/themeUtils';

interface ToggleOptionProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export default function ToggleOption({
  title,
  description,
  value,
  onValueChange,
}: ToggleOptionProps) {
  const colors = useCustomColors();
  
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {description && (
          <Text style={[styles.description, { color: colors.inactive }]}>
            {description}
          </Text>
        )}
      </View>
      
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.inactive, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
  },
});