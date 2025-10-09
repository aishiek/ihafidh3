export interface VerseHeightConfig {
  arabicFontSize: number; // base Arabic font size in px
  showTranslation: boolean;
  translationFontSize: number; // translation font size in px
}

// Rough constants based on typography decisions
const ARABIC_LINE_HEIGHT_MULTIPLIER = 1.8; // matches getArabicTypographySizing default baseline
const AVG_TRANSLATION_LINES = 2.5; // average lines for translation when shown
const BASE_VERTICAL_PADDING = 80; // includes card padding, verse number badge area, spacing
const AVG_CHARS_PER_LINE_ARABIC = 45; // heuristic for wrapping

export function estimateVerseHeight(
  verse: { arabicText?: string; translation?: string },
  config: VerseHeightConfig
): number {
  const arabic = verse.arabicText?.length || 0;
  // Estimate number of Arabic lines (at least 1)
  const arabicLines = Math.max(1, Math.ceil(arabic / AVG_CHARS_PER_LINE_ARABIC));
  const arabicBlockHeight = arabicLines * (config.arabicFontSize * ARABIC_LINE_HEIGHT_MULTIPLIER);

  let translationBlockHeight = 0;
  if (config.showTranslation && verse.translation) {
    // Use average translation lines heuristic times translation line height (~1.3)
    translationBlockHeight = AVG_TRANSLATION_LINES * (config.translationFontSize * 1.3);
  }

  return Math.round(BASE_VERTICAL_PADDING + arabicBlockHeight + translationBlockHeight);
}

export function getAverageVerseHeight(
  verses: Array<{ arabicText?: string; translation?: string }>,
  config: VerseHeightConfig
): number {
  if (!verses.length) {
    // Provide a reasonable fallback based on assumptions
    return Math.round(BASE_VERTICAL_PADDING + (config.arabicFontSize * ARABIC_LINE_HEIGHT_MULTIPLIER * 2));
  }
  const sample = verses.slice(0, 20); // sample first 20 for speed
  const total = sample.reduce((sum, v) => sum + estimateVerseHeight(v, config), 0);
  return Math.round(total / sample.length);
}
