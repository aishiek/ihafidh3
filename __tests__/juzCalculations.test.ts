import { getAllJuzDetails, getJuzVerseRange, isJuzComplete } from '@/utils/juzCalculations';

describe('Juz Calculations', () => {
  test('Juz 30 range and completeness (full range) should be complete', () => {
    const range = getJuzVerseRange(30);
    expect(range).not.toBeNull();
    if (!range) return;

    // Build a full memorized set for Juz 30
    const verses = [] as number[];
    for (let id = range.start; id <= range.end; id++) verses.push(id);

    expect(isJuzComplete(30, verses)).toBe(true);

    // If we drop one verse, it should be incomplete
    verses.pop();
    expect(isJuzComplete(30, verses)).toBe(false);
  });

  test('Out-of-sequence memorization should still mark Juz complete', () => {
    const range = getJuzVerseRange(1);
    expect(range).not.toBeNull();
    if (!range) return;

    const verses = [] as number[];
    for (let id = range.start; id <= range.end; id++) verses.push(id);

    // Shuffle (simple reverse) to emulate out-of-order storage
    verses.reverse();

    expect(isJuzComplete(1, verses)).toBe(true);
  });

  test('getAllJuzDetails returns 30 elements and correct shapes', () => {
    const mockMemorized: number[] = [];
    const details = getAllJuzDetails(mockMemorized as number[]);
    expect(details.length).toBe(30);
    details.forEach(d => {
      expect(typeof d.juzNumber).toBe('number');
      expect(typeof d.totalVerses).toBe('number');
      expect(typeof d.memorizedVerses).toBe('number');
      expect(typeof d.isComplete).toBe('boolean');
    });
  });
});
