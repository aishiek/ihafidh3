import { Platform } from 'react-native';

export type ArabicFontOption = 'default' | 'scheherazade' | 'scheherazade-bold' | 'tajweed' | 'indo-pak' | 'amiri-quran';

// Centralized mapping for Arabic font families used across the app
export function getArabicFontFamily(option: ArabicFontOption): string | undefined {
  switch (option) {
    case 'amiri-quran':
      return 'AmiriQuran-Regular';
    case 'scheherazade':
      return 'ScheherazadeNew-Regular';
    case 'scheherazade-bold':
      return 'ScheherazadeNew-Bold';
    case 'tajweed':
      // rn-tajweed-verse will colorize, we choose a legible Arabic font as base
      return 'ScheherazadeNew-Regular';
    case 'indo-pak':
      return 'NooreHuda-Regular';
    case 'default':
    default:
      // Let platform default decide; RN native ignores comma-separated stacks.
      // For web, returning undefined falls back to CSS default.
      return Platform.OS === 'web' ? undefined : undefined;
  }
}
