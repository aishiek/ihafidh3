import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  translations: { en: string; ta: string; ms: string; id: string } | null;
  isDarkMode: boolean;
}

export default function WordByWordTooltip({ visible, translations, isDarkMode }: Props) {
  if (!visible || !translations) return null;

  return (
    <View style={[
      styles.tooltipContainer,
      { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)' }
    ]}>
      <Text style={[
        styles.tooltipText,
        { color: isDarkMode ? '#FFFFFF' : '#000000' }
      ]}>
        {translations.en && (
          <Text style={styles.languageText}>EN: {translations.en}</Text>
        )}
        {translations.ta && (
          <Text style={styles.languageText}>TA: {translations.ta}</Text>
        )}
        {translations.ms && (
          <Text style={styles.languageText}>MS: {translations.ms}</Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltipContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 8,
    zIndex: 1000,
  },
  tooltipText: {
    fontSize: 14,
    lineHeight: 20,
  },
  languageText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
});
