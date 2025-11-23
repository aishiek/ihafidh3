import { Verse } from '@/types';

export interface Page {
  pageIndex: number;
  verses: Verse[];
  startVerse: {
    surah: number;
    ayah: number;
  };
  endVerse: {
    surah: number;
    ayah: number;
  };
}

/**
 * Slices verses into pages
 */
export function calculatePages(
  verses: Verse[],
  versesPerPage: number
): Page[] {
  // Ensure versesPerPage is sane — clamp to allowed PageMode range (3..20)
  const vpp = Math.max(3, Math.min(20, Math.floor(versesPerPage) || 3));
  const pages: Page[] = [];
  const totalVerses = verses.length;

  if (totalVerses === 0) return [];

  // Slice verses into pages
  for (let i = 0; i < totalVerses; i += vpp) {
    const pageVerses = verses.slice(i, Math.min(i + vpp, totalVerses));
    
    if (pageVerses.length === 0) continue;

    // DEV: validate page items for missing critical fields to avoid UI recycling bugs
    if (__DEV__) {
      for (const pv of pageVerses) {
        if (pv == null || typeof pv.surahId !== 'number' || typeof pv.verseNumber !== 'number') {
          console.warn('[pageUtils] calculatePages encountered verse with missing surahId/verseNumber', pv);
        }
      }
    }

    pages.push({
      pageIndex: Math.floor(i / vpp),
      verses: pageVerses,
      startVerse: {
        surah: pageVerses[0].surahId,
        ayah: pageVerses[0].verseNumber
      },
      endVerse: {
        surah: pageVerses[pageVerses.length - 1].surahId,
        ayah: pageVerses[pageVerses.length - 1].verseNumber
      }
    });
  }

  return pages;
}
