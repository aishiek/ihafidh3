jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Text: () => null,
  View: () => null,
}));
jest.mock('@shopify/react-native-skia', () => ({
  Skia: { Color: (c: string) => c },
}));

import { sanitizeRunsForSkia, mergeCombiningIntoBase } from '../components/TajweedText';

describe('Tajweed color-bleed fix (2026-08-31)', () => {
  it('mergeCombiningIntoBase: does not bleed a tajweed color into unrelated text after an orphaned structural mark', () => {
    // Mirrors real Quran.com API data for 2:6: the madda_obligatory tag wraps only
    // "َا", and the API leaves Maddah Above (ٓ) sitting just outside the tag,
    // immediately followed by several more words of plain (untagged) text before
    // the next tajweed tag.
    const segments = [
      { text: 'سَو', color: '#FFFFFF' },
      { text: 'َا', color: '#FF9632' }, // madda_obligatory
      { text: 'ٓءٌ عَلَيْهِمْ ءَأَ', color: '#FFFFFF' }, // orphaned Maddah + much more text
      { text: 'نذ', color: '#FFB6C1' }, // ikhfa
    ];

    const merged = mergeCombiningIntoBase(segments);

    const maddSeg = merged.find(s => s.color === '#FF9632');
    expect(maddSeg).toBeDefined();
    // Only the Maddah mark itself should have been absorbed into the Madd-colored segment.
    expect(maddSeg!.text).toBe('\u0648\u064e\u0627\u0653');

    // Everything after the orphaned mark must keep its own (white) color, not bleed orange.
    const whiteSeg = merged.find(s => s.text.startsWith('ءٌ'));
    expect(whiteSeg).toBeDefined();
    expect(whiteSeg!.color).toBe('#FFFFFF');
    expect(whiteSeg!.text).toBe('ءٌ عَلَيْهِمْ ءَأَ');

    // No segment anywhere should still be carrying that whole absorbed run under orange.
    for (const seg of merged) {
      if (seg.color === '#FF9632') {
        expect(seg.text.length).toBeLessThan(5);
      }
    }
  });

  it('sanitizeRunsForSkia: does not bleed a run color into unrelated text after an orphaned structural mark', () => {
    const runs = [
      { text: 'سَو', color: '#FFFFFF' },
      { text: 'َا', color: '#FF9632' },
      { text: 'ٓءٌ عَلَيْهِمْ ءَأَ', color: '#FFFFFF' },
    ];

    const sanitized = sanitizeRunsForSkia(runs);

    const maddSeg = sanitized.find(s => s.color === '#FF9632');
    expect(maddSeg).toBeDefined();
    expect(maddSeg!.text).toBe('\u0648\u064e\u0627\u0653');
    expect(maddSeg!.text.length).toBeLessThan(5);

    // sanitizeRunsForSkia's separate Step 3.5 (intra-run ZWJ insurance pass) inserts
    // invisible ZWJ between joining letters within this run; strip it before matching.
    const whiteSeg = sanitized.find(s => s.color === '#FFFFFF' && s.text.replace(/\u200D/g, '').includes('عَلَيْهِمْ'));
    expect(whiteSeg).toBeDefined();
    expect(whiteSeg!.text.startsWith('ءٌ')).toBe(true);
  });
});
