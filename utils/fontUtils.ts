import { Platform } from 'react-native';

export type ArabicFontOption = 'default' | 'uthman-taha' | 'scheherazade' | 'scheherazade-bold' | 'tajweed' | 'indo-pak' | 'amiri-quran';

// Centralized mapping for Arabic font families used across the app
export function getArabicFontFamily(option: ArabicFontOption): string | undefined {
  switch (option) {
    case 'uthman-taha':
      return 'UthmanTaha-Ver10';
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
      // Prefer Uthman Taha when available; fallback to Scheherazade which has excellent Arabic coverage
      return 'UthmanTaha-Ver10';
  }
}

// Recommended Arabic typography tweaks (can be consumed by components)
export function getArabicTypographySizing(base: number) {
  // Best practices from common Quran apps: generous line height, minimal letter spacing
  return {
    fontSize: base,
    lineHeight: Math.round(base * 1.8),
    // Slight negative spacing can tighten ligatures; we keep it subtle and cross-platform safe
    letterSpacing: Platform.OS === 'ios' ? -0.2 : 0,
  } as const;
}
