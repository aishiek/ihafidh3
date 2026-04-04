/**
 * Centralized constants and logic for Basmalah (Bismillah) handling.
 */

export const BISMILLAH_ARABIC = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
export const BISMILLAH_TRANSLATION_EN = 'In the name of Allah, the Entirely Merciful, the Especially Merciful.';
export const BISMILLAH_AUDIO_URL = 'https://verses.quran.com/Bismillah.mp3';

/**
 * Hard-coded Word-by-Word data for Basmalah.
 * Standardizes the 4 words used in the Basmalah across all languages.
 */
export const BISMILLAH_WBW = [
  {
    word_index: 1,
    arabic: 'بِسْمِ',
    en: 'In the name of',
    ta: 'பெயரால்',
    id: 'Dengan nama',
    ms: 'Dengan nama',
  },
  {
    word_index: 2,
    arabic: 'اللَّهِ',
    en: 'Allah',
    ta: 'அல்லாஹ்வின்',
    id: 'Allah',
    ms: 'Allah',
  },
  {
    word_index: 3,
    arabic: 'الرَّحْمَٰنِ',
    en: 'the Entirely Merciful',
    ta: 'அளவற்ற அருளாளன்',
    id: 'Yang Maha Pengasih',
    ms: 'Yang Maha Pengasih',
  },
  {
    word_index: 4,
    arabic: 'الرَّحِيمِ',
    en: 'the Especially Merciful',
    ta: 'நிகரற்ற அன்புடையோன்',
    id: 'Yang Maha Penyayang',
    ms: 'Yang Maha Penyayang',
  },
];

/**
 * Utility: Determines if a surah should have Bismillah prepended.
 * Excludes Surah Al-Fatihah (1) and Surah At-Tawbah (9).
 */
export function shouldHaveBismillah(surahId: number): boolean {
  return surahId !== 1 && surahId !== 9;
}
