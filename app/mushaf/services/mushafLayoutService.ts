import type { MushafPageLayout, MushafWordLayout } from '../types/mushaf.types';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';
import { getArabicWord, getTajweedColor } from '@/utils/tajweedParser';

export async function getPageLayout(pageNumber: number): Promise<MushafPageLayout> {
  try {
    // Safe require of JSON layout file inside the cache (may be downloaded at runtime)
    // Attempt first from local cache folder
    // NOTE: in development you may want to bundle a small sample under app/mushaf/assets for quick testing
    // Use dynamic import if available, fallback to fetch
    // Here we assume files are saved to `${MUSHAF_CACHE_DIR}/pages/${pageNumber}.json`
    const jsonPath = `${MUSHAF_CACHE_DIR}/pages/${pageNumber}.json`;
    // eslint-disable-next-line no-undef
    const layoutJson = require(jsonPath); // may throw if not present

    const words: MushafWordLayout[] = Object.entries(layoutJson).map(([key, coords]: any) => {
      const parts = String(key).split(':').map((v) => Number(v));
      const surah = parts[0] || 0; const verse = parts[1] || 0; const word = parts[2] || 0;
      return {
        key,
        surah,
        verse,
        word,
        x: coords.x,
        y: coords.y,
        w: coords.w,
        h: coords.h,
        text: getArabicWord(surah, verse, word),
        tajweedColor: getTajweedColor(surah, verse, word)
      } as MushafWordLayout;
    });

    return {
      pageNumber,
      imageUri: getPageImageUri(pageNumber),
      words,
      totalWords: words.length,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[MushafLayoutService] getPageLayout error', error);
    throw error;
  }
}

export function getPageImageUri(pageNumber: number): string {
  // Image path in cache
  return `file://${MUSHAF_CACHE_DIR}/images/page_${pageNumber}.png`;
}
