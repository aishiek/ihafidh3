import { Platform } from 'react-native';

export type ArabicFontOption = 'default' | 'uthman-taha' | 'scheherazade' | 'scheherazade-bold' | 'tajweed' | 'indo-pak' | 'amiri-quran' | 'noto-naskh';

/**
 * Centralized mapping for Arabic font families used across the app.
 * Returns undefined for 'default' to allow system fallback behavior (we still purposely map to UthmanTaha though).
 */
export function getArabicFontFamily(option: ArabicFontOption): string | undefined {
  switch (option) {
    case 'uthman-taha':
      return 'NotoNaskhArabic-Regular';
    case 'amiri-quran':
      return 'AmiriQuran-Regular';
    case 'scheherazade':
      return 'ScheherazadeNew-Regular';
    case 'scheherazade-bold':
      return 'ScheherazadeNew-Bold';
    case 'tajweed':
      // For tajweed coloring, use Scheherazade as the base font (rn-tajweed-verse applies color overlays)
      return 'ScheherazadeNew-Regular';
    case 'indo-pak':
      return 'NooreHuda-Regular';
    case 'noto-naskh':
      return 'NotoNaskhArabic-Regular';
    case 'default':
    default:
      // System Default uses ScheherazadeNew-Regular
      return 'ScheherazadeNew-Regular';
  }
}

/**
 * Returns proper Arabic typography settings following best practices:
 * - NO positive letter spacing (Arabic is a connected script)
 * - Appropriate line heights for readability without wasting space
 * - Platform-specific fine tuning
 * - Provides RTL alignment signals
 */
export function getArabicTypographySizing(base: number, fontOption?: ArabicFontOption) {
  const font = fontOption || 'default';

  // Letter spacing MUST remain 0 for Arabic to keep connections.
  const letterSpacing = 0;

  let lineHeightMultiplier: number;
  switch (font) {
    case 'amiri-quran':
      // Amiri: tall ascenders/descenders; previous 2.5 was too airy.
      lineHeightMultiplier = 2.0;
      break;
    case 'scheherazade':
    case 'scheherazade-bold':
      lineHeightMultiplier = 1.85;
      break;
    case 'indo-pak':
      lineHeightMultiplier = 1.75;
      break;
    case 'tajweed':
      lineHeightMultiplier = 1.9; // needs a touch more for colored marks
      break;
    case 'uthman-taha':
    case 'default':
    default:
      lineHeightMultiplier = 1.8;
      break;
  }

  // Platform adjustments
  if (Platform.OS === 'android') {
    if (font === 'amiri-quran' || font === 'uthman-taha') {
      lineHeightMultiplier += 0.05; // small compensation
    }
  }

  return {
    fontSize: base,
    lineHeight: Math.round(base * lineHeightMultiplier),
    letterSpacing,
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
  } as const;
}

/** Basic Arabic text style helpers for components that manage sizing separately. */
export function getArabicTextStyle() {
  return {
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
    letterSpacing: 0 as const,
  };
}

/** Font-specific size multiplier (some fonts render visually smaller or tighter). */
export function getArabicFontSizeMultiplier(fontOption?: ArabicFontOption): number {
  const font = fontOption || 'default';
  switch (font) {
    case 'amiri-quran':
      return 1.05; // subtle boost
    case 'indo-pak':
      return 1.03; // slightly compact
    case 'uthman-taha':
    case 'scheherazade':
    case 'scheherazade-bold':
    case 'tajweed':
    case 'default':
    default:
      return 1.0;
  }
}

/** Whether a font needs extra diacritic breathing space (e.g., tajweed coloring overlays) */
export function fontRequiresDiacriticSpace(fontOption?: ArabicFontOption): boolean {
  const font = fontOption || 'default';
  return font === 'tajweed' || font === 'amiri-quran';
}
