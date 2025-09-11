import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomColors } from '@/utils/themeUtils';

export default function FontSizeSelector() {
  const { 
    fontSizeArabic, 
    fontSizeTranslation, 
    setFontSizeArabic, 
    setFontSizeTranslation 
  } = useSettingsStore();
  const colors = useCustomColors();
  
  const handleDecreaseFontSizeArabic = () => {
    if (fontSizeArabic > 16) {
      setFontSizeArabic(fontSizeArabic - 2);
    }
  };
  
  const handleIncreaseFontSizeArabic = () => {
    if (fontSizeArabic < 36) {
      setFontSizeArabic(fontSizeArabic + 2);
    }
  };
  
  const handleDecreaseFontSizeTranslation = () => {
    if (fontSizeTranslation > 12) {
      setFontSizeTranslation(fontSizeTranslation - 1);
    }
  };
  
  const handleIncreaseFontSizeTranslation = () => {
    if (fontSizeTranslation < 24) {
      setFontSizeTranslation(fontSizeTranslation + 1);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Font Size</Text>
      
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Arabic Text</Text>
        <View style={styles.controlsContainer}>
          <Pressable
            style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleDecreaseFontSizeArabic}
            disabled={fontSizeArabic <= 16}
          >
            <Minus size={16} color={fontSizeArabic <= 16 ? colors.inactive : colors.primary} />
          </Pressable>
          
          <Text style={[styles.fontSizeValue, { color: colors.text }]}>
            {fontSizeArabic}
          </Text>
          
          <Pressable
            style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleIncreaseFontSizeArabic}
            disabled={fontSizeArabic >= 36}
          >
            <Plus size={16} color={fontSizeArabic >= 36 ? colors.inactive : colors.primary} />
          </Pressable>
        </View>
      </View>
      
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Translation</Text>
        <View style={styles.controlsContainer}>
          <Pressable
            style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleDecreaseFontSizeTranslation}
            disabled={fontSizeTranslation <= 12}
          >
            <Minus size={16} color={fontSizeTranslation <= 12 ? colors.inactive : colors.primary} />
          </Pressable>
          
          <Text style={[styles.fontSizeValue, { color: colors.text }]}>
            {fontSizeTranslation}
          </Text>
          
          <Pressable
            style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleIncreaseFontSizeTranslation}
            disabled={fontSizeTranslation >= 24}
          >
            <Plus size={16} color={fontSizeTranslation >= 24 ? colors.inactive : colors.primary} />
          </Pressable>
        </View>
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
    marginBottom: 16,
  },
  sectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  fontSizeValue: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});