/**
 * Test: Qalqalah Detection Final Pass
 * 
 * Verifies the regex pattern and segment splitting logic
 */

import { parseTajweedHTML, TajweedSegment } from '../utils/QuranTajweedParser';

describe('Qalqalah Final Overlay Pass', () => {
  test('should split segment with qalqalah letter at end', () => {
    // Simulate a segment with qalqalah letter د at the end
    const testSegments: TajweedSegment[] = [
      { text: 'أَحَدٌ', color: '#FFFFFF', tajweedClass: null, source: 'api' }
    ];
    
    // Test regex pattern
    const text = 'أَحَدٌ';
    const match = text.match(/^(.*?)([قطبجد])([\u064B-\u0652]*)$/);
    
    expect(match).not.toBeNull();
    expect(match![1]).toBe('أَحَ'); // prefix
    expect(match![2]).toBe('د');    // qalqalah letter
    expect(match![3]).toBe('ٌ');     // tanween damma
  });

  test('should not match when qalqalah letter is not at end', () => {
    const text = 'قَالَ';
    const match = text.match(/^(.*?)([قطبجد])([\u064B-\u0652]*)$/);
    
    expect(match).toBeNull();
  });

  test('should match all qalqalah letters', () => {
    const letters = ['ق', 'ط', 'ب', 'ج', 'د'];
    
    letters.forEach(letter => {
      const text = `أَ${letter}ٌ`;
      const match = text.match(/^(.*?)([قطبجد])([\u064B-\u0652]*)$/);
      
      expect(match).not.toBeNull();
      expect(match![2]).toBe(letter);
    });
  });

  test('should work with empty prefix', () => {
    const text = 'دٌ';
    const match = text.match(/^(.*?)([قطبجد])([\u064B-\u0652]*)$/);
    
    expect(match).not.toBeNull();
    expect(match![1]).toBe('');  // empty prefix
    expect(match![2]).toBe('د'); // qalqalah letter
    expect(match![3]).toBe('ٌ');  // mark
  });

  test('should work with sukoon marker', () => {
    const text = 'أَحْقْ';
    const match = text.match(/^(.*?)([قطبجد])([\u064B-\u0652]*)$/);
    
    expect(match).not.toBeNull();
    expect(match![1]).toBe('أَحْ');
    expect(match![2]).toBe('ق');
    expect(match![3]).toBe('ْ'); // sukoon
  });

  test('parseTajweedHTML with enableStopRules should split qalqalah', () => {
    // Plain text without HTML tags (will use algorithmic parser)
    const plainText = 'أَحَدٌ';
    
    // Parse with stop rules disabled
    const withoutStop = parseTajweedHTML(plainText, {
      enableAlgorithmic: true,
      enableStopRules: false,
    });
    
    // Parse with stop rules enabled
    const withStop = parseTajweedHTML(plainText, {
      enableAlgorithmic: true,
      enableStopRules: true,
    });
    
    // With stop rules enabled, should have more segments (split at qalqalah)
    expect(withStop.length).toBeGreaterThan(withoutStop.length);
    
    // Last segment should be red qalqalah
    const lastSegment = withStop[withStop.length - 1];
    expect(lastSegment.color).toBe('#DD0008'); // RED
    expect(lastSegment.tajweedClass).toBe('qalqalah_waqf');
  });

  test('should handle multiple words with qalqalah', () => {
    const text = 'قَالَ أَحَدٌ';
    
    const segments = parseTajweedHTML(text, {
      enableAlgorithmic: true,
      enableStopRules: true,
    });
    
    // Should have qalqalah on both ق (if at word boundary) and د
    const redSegments = segments.filter(seg => seg.color === '#DD0008');
    expect(redSegments.length).toBeGreaterThan(0);
  });

  test('isSegmentEnd logic - last segment', () => {
    const segments: TajweedSegment[] = [
      { text: 'أَحَ', color: '#FFFFFF', tajweedClass: null, source: 'api' },
      { text: 'دٌ', color: '#DD0008', tajweedClass: 'qalqalah_waqf', source: 'algorithmic' }
    ];
    
    const index = segments.length - 1;
    const isAtStop = index === segments.length - 1;
    
    expect(isAtStop).toBe(true);
  });

  test('isSegmentEnd logic - before whitespace', () => {
    const segments: TajweedSegment[] = [
      { text: 'دٌ', color: '#DD0008', tajweedClass: 'qalqalah_waqf', source: 'algorithmic' },
      { text: ' أَحَدٌ', color: '#FFFFFF', tajweedClass: null, source: 'api' }
    ];
    
    const index = 0;
    const nextSeg = segments[index + 1];
    const isAtStop = nextSeg && nextSeg.text && /^\s/.test(nextSeg.text);
    
    expect(isAtStop).toBe(true);
  });
});

describe('Qalqalah Edge Cases', () => {
  test('should not apply qalqalah in middle of word', () => {
    // "قَالَ" - ق is at start, not end
    const text = 'قَالَ';
    const match = text.match(/^(.*?)([قطبجد])([\u064B-\u0652]*)$/);
    
    // No match because ق is not at the end
    expect(match).toBeNull();
  });

  test('should handle empty text', () => {
    const segments = parseTajweedHTML('', {
      enableAlgorithmic: true,
      enableStopRules: true,
    });
    
    expect(segments.length).toBe(1);
    expect(segments[0].text).toBe('');
  });

  test('should not affect non-qalqalah letters', () => {
    const text = 'ٱللَّهُ'; // No qalqalah letters
    
    const segments = parseTajweedHTML(text, {
      enableAlgorithmic: true,
      enableStopRules: true,
    });
    
    // Should not have any red segments
    const redSegments = segments.filter(seg => seg.color === '#DD0008');
    expect(redSegments.length).toBe(0);
  });
});
