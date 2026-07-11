/**
 * Test: Tajweed Combining Marks & Maddah Above Fix
 * 
 * Verifies that:
 * 1. `parseTajweedHTML` reattaches orphaned combining marks (like \u0653 Maddah Above)
 *    to their preceding API-tagged base letters.
 * 2. `TajweedParser.parse` in `tajweedParser.ts` merges \u0653 with preceding base letters
 *    and applies madd styling during algorithmic parsing.
 * 3. `applyQalqalahOverlay` is correctly exported/bridged from `@/utils/tajweedParser`.
 */

import { parseTajweedHTML } from '../utils/QuranTajweedParser';
import { TajweedParser, applyQalqalahOverlay } from '../utils/tajweedParser';

describe('Tajweed Combining Marks Fix', () => {
  const ORPHAN_COMBINING_MARK = /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06ED\u08D3-\u08FF]/;

  test('should reattach orphan combining mark \\u0653 (Maddah Above) to preceding API tag segment', () => {
    // Simulated HTML where API puts base letter inside <tajweed> but leaves \u0653 outside
    const html = 'قَالُوٓاْ <tajweed class="madda_obligatory">ءَابَآ</tajweed>\u0653ءَنَآ';
    
    const segments = parseTajweedHTML(html, { enableAlgorithmic: false, enableStopRules: false });
    
    // Check no segment begins with an orphan combining mark
    for (const seg of segments) {
      if (seg.text.length > 0) {
        const firstChar = Array.from(seg.text)[0];
        expect(ORPHAN_COMBINING_MARK.test(firstChar)).toBe(false);
      }
    }

    // Check that the madda_obligatory segment now includes the \u0653 mark
    const maddaSeg = segments.find(s => s.tajweedClass === 'madda_obligatory');
    expect(maddaSeg).toBeDefined();
    expect(maddaSeg!.text).toBe('ءَابَآ\u0653');
    expect(maddaSeg!.color).toBe('#FF9632');
  });

  test('should handle \\u0653 (SMALL_HIGH_MADDA) in algorithmic TajweedParser.parse()', () => {
    const text = 'ءَابَآ\u0653';
    const segments = TajweedParser.parse(text);

    expect(segments.length).toBeGreaterThan(0);
    // The madd alif + small high madda should stay attached and get colored as madd
    const maddSegment = segments.find(s => s.rule === 'madd');
    expect(maddSegment).toBeDefined();
    expect(maddSegment!.text).toContain('\u0653');
  });

  test('should correctly bridge and export applyQalqalahOverlay from utils/tajweedParser', () => {
    expect(typeof applyQalqalahOverlay).toBe('function');
  });

  test('Bug 1 fix: applyQalqalahOverlay should color qalqalah letter even when next segment contains pause mark followed by text', () => {
    // When next segment starts with a pause mark (e.g. \u06DD or \u06D6-\u06ED) followed by text in the same segment
    const segments = [
      { text: 'أَحَدٌ', color: '#FFFFFF' },
      { text: 'ۚ كَانُوا', color: '#FFFFFF' }
    ];
    // applyQalqalahOverlay from tajweedParser.ts should check start-of-segment rather than requiring entire segment to be whitespace
    const result = applyQalqalahOverlay(segments, true);
    const qalqalahSeg = result.find(s => s.rule === 'qalqalah_waqf');
    expect(qalqalahSeg).toBeDefined();
    expect(qalqalahSeg!.text).toBe('دٌ');
    expect(qalqalahSeg!.color).toBe('#FF3B30');
  });
});
