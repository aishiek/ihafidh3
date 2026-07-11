jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Text: () => null,
  View: () => null,
}));
jest.mock('@shopify/react-native-skia', () => ({
  Skia: { Color: (c: string) => c },
}));

import { sanitizeRunsForSkia } from '../components/TajweedText';
import { parseTajweedHTML } from '../utils/QuranTajweedParser';

describe('Tajweed Skia Sanitization - ZWJ injection and color preservation', () => {
  it('does not collapse colors across Noon+Alif (ءَنَآ) or across ayah pause marks in 5:104', () => {
    // Exact segment of Surah 5:104 containing Noon + Alif with Maddah above followed by pause mark and next word:
    // "ءَنَآ‌ۚ أَوَلَوْ..."
    const inputHTML = 'ءَن<tajweed class="madda_obligatory">َآ‌ۚ</tajweed> أَوَلَوْ كَانَ';
    const parsed = parseTajweedHTML(inputHTML, { enableAlgorithmic: false, enableStopRules: false });
    const sanitized = sanitizeRunsForSkia(parsed);

    // Find the segment for "ءَنَ" (Noon with fatha) and "آ‌ۚ" (Alif + Maddah above + pause mark)
    const noonSeg = sanitized.find(s => s.text.includes('ءَن'));
    const alifMaddahSeg = sanitized.find(s => s.text.includes('آ'));
    const nextWordSeg = sanitized.find(s => s.text.includes('أَوَلَوْ'));

    expect(noonSeg).toBeDefined();
    expect(alifMaddahSeg).toBeDefined();
    expect(nextWordSeg).toBeDefined();

    // Noon segment (#FFFFFF) should get ZWJ appended to open medial connection to Alif
    expect(noonSeg!.color).toBe('#FFFFFF');
    expect(noonSeg!.text.endsWith('\u200D')).toBe(true);

    // Alif segment (#FF9632) should NOT get ZWJ appended across the pause sign (‌ۚ)
    // and should NOT have ZWJ prepended (which causes Skia to merge and collapse run colors)
    expect(alifMaddahSeg!.color).toBe('#FF9632');
    expect(alifMaddahSeg!.text.startsWith('\u200D')).toBe(false);
    expect(alifMaddahSeg!.text.endsWith('\u200D')).toBe(false);

    // Next word (#FFFFFF) should NOT get ZWJ prepended across the space/pause mark
    expect(nextWordSeg!.color).toBe('#FFFFFF');
    expect(nextWordSeg!.text.startsWith('\u200D')).toBe(false);
  });

  it('Bug 2 fix: sanitizeRunsForSkia should not leak trailing whitespace into combining cluster when pulling base letter from previous run', () => {
    // When previous segment ends with base letter + diacritic + space ("نَ "),
    // and next segment begins with a non-structural combining mark ("\u0651..."),
    // sanitizeRunsForSkia should keep the trailing space on the first run and only pull the base letter + diacritic into the second run.
    const runs = [
      { text: 'نَ ', color: '#FFFFFF' },
      { text: '\u0651بَ', color: '#FFD700' }
    ];
    const sanitized = sanitizeRunsForSkia(runs);
    expect(sanitized.length).toBe(2);
    // The first segment should retain its trailing space (and nothing else after the base is moved)
    expect(sanitized[0].text).toBe(' ');
    // The second segment should start with the base letter 'نَ' directly before '\u0651بَ', without any space inside
    expect(sanitized[1].text).toBe('نَ\u0651بَ');
  });
});
