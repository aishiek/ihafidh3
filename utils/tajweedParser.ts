/**
 * Tajweed Parser for Arabic Quranic Text
 * Detects and applies Tajweed rules for proper color coding
 */

import { TAJWEED_COLORS } from './tajweedColors';

export interface TajweedSegment {
  text: string;
  color: string;
  rule?: string;
  isSilent?: boolean; // Flag for U+06DF markers (needs reduced opacity)
}

export class TajweedParser {
  // Qalqalah letters (ق، ط، ب، ج، د)
  private static QALQALAH = /[قطبجد]/;
  
  // Idgham letters with ghunnah (ي، ن، م، و)
  private static IDGHAM_GHUNNAH = /[ينمو]/;
  
  // Idgham letters without ghunnah (ل، ر)
  private static IDGHAM_NO_GHUNNAH = /[لر]/;
  
  // Ikhfa letters (15 letters)
  private static IKHFA_LETTERS = /[تثجدذزسشصضطظفقك]/;
  
  // Iqlab letter (ب)
  private static IQLAB = /ب/;
  
  // Diacritics
  private static SHADDAH = '\u0651';      // ّ
  private static SUKOON = '\u0652';       // ْ
  private static TANWEEN_FATH = '\u064B'; // ً
  private static TANWEEN_DAM = '\u064C';  // ٌ
  private static TANWEEN_KASR = '\u064D'; // ٍ
  private static TANWEEN = /[\u064B\u064C\u064D]/;
  
  // Madd indicators
  private static MADD_ALIF = '\u0670';    // Small alif above (ٰ)
  private static ALIF = 'ا';
  private static WAW = 'و';
  private static YA = 'ي';
  
  // Letters
  private static NOON = 'ن';
  private static MEEM = 'م';

  /**
   * Parse Arabic text and return segments with Tajweed colors
   */
  static parse(text: string): TajweedSegment[] {
    if (!text || text.trim().length === 0) {
      return [{ text, color: TAJWEED_COLORS.default }];
    }

    // Replace sun icon with proper madd alif
    text = text.replace(/☀/g, this.MADD_ALIF);
    
    const segments: TajweedSegment[] = [];
    let i = 0;
    
    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1] || '';
      const nextNextChar = text[i + 2] || '';
      
      let color: string = TAJWEED_COLORS.default;
      let length = 1;
      let rule: string | undefined;
      
      // 1. Check for Noon/Meem with Shaddah (Ghunnah)
      if (char === this.NOON && nextChar === this.SHADDAH) {
        color = TAJWEED_COLORS.ghunnah;
        rule = 'ghunnah';
        length = 2;
      } else if (char === this.MEEM && nextChar === this.SHADDAH) {
        color = TAJWEED_COLORS.ghunnah;
        rule = 'ghunnah';
        length = 2;
      }
      // 2. Check for Madd (elongation indicator)
      else if (char === this.MADD_ALIF) {
        if (segments.length > 0) {
          const prevSeg = segments[segments.length - 1];
          // Append dagger alif to previous segment so it stays with its base letter
          prevSeg.text += char;
          if (prevSeg.text.match(/[اوي\u0670]/)) {
            prevSeg.color = TAJWEED_COLORS.madd;
            prevSeg.rule = 'madd';
          }
        } else {
          // No previous segment — push as its own (sanitizeRunsForSkia will handle it)
          segments.push({ text: char, color: TAJWEED_COLORS.default });
        }
        i++;
        continue;
      }
      // 3. Check for Qalqalah with sukoon
      else if (this.QALQALAH.test(char) && nextChar === this.SUKOON) {
        color = TAJWEED_COLORS.qalqalah;
        rule = 'qalqalah';
        length = 2;
      }
      // 4. Check for Idgham (after noon saakin or tanween)
      else if (this.IDGHAM_GHUNNAH.test(char)) {
        if (this.hasPrecedingNoonOrTanween(text, i)) {
          color = TAJWEED_COLORS.idgham_with_ghunnah;
          rule = 'idgham_with_ghunnah';
          // Also color the preceding noon/tanween
          this.colorPrecedingNoonOrTanween(segments, TAJWEED_COLORS.idgham_with_ghunnah);
        }
      } else if (this.IDGHAM_NO_GHUNNAH.test(char)) {
        if (this.hasPrecedingNoonOrTanween(text, i)) {
          color = TAJWEED_COLORS.idgham_no_ghunnah;
          rule = 'idgham_no_ghunnah';
          // Also color the preceding noon/tanween
          this.colorPrecedingNoonOrTanween(segments, TAJWEED_COLORS.idgham_no_ghunnah);
        }
      }
      // 5. Check for Ikhfa (concealment)
      else if (this.IKHFA_LETTERS.test(char)) {
        if (this.hasPrecedingNoonOrTanween(text, i)) {
          color = TAJWEED_COLORS.ikhfa;
          rule = 'ikhfa';
          // Also color the preceding noon/tanween
          this.colorPrecedingNoonOrTanween(segments, TAJWEED_COLORS.ikhfa);
        }
      }
      // 6. Check for Iqlab (conversion)
      else if (this.IQLAB.test(char)) {
        if (this.hasPrecedingNoonOrTanween(text, i)) {
          color = TAJWEED_COLORS.iqlab;
          rule = 'iqlab';
          // Also color the preceding noon/tanween
          this.colorPrecedingNoonOrTanween(segments, TAJWEED_COLORS.iqlab);
        }
      }
      // 7. Check for Noon saakin (for next iteration coloring)
      else if (char === this.NOON && nextChar === this.SUKOON) {
        // Keep default color, will be colored by following letter
        length = 2;
      }
      
      // Add segment
      const segment = text.substring(i, i + length);
      segments.push({ text: segment, color, rule });
      
      i += length;
    }
    
    // Merge consecutive segments with same color for efficiency
    return this.mergeSegments(segments);
  }

  /**
   * Check if there's a preceding noon saakin or tanween
   */
  private static hasPrecedingNoonOrTanween(text: string, index: number): boolean {
    // Look back up to 5 characters for noon saakin or tanween
    // (accounting for spaces and diacritics)
    for (let i = Math.max(0, index - 5); i < index; i++) {
      const char = text[i];
      const nextChar = text[i + 1] || '';
      
      // Check for noon with sukoon
      if (char === this.NOON && nextChar === this.SUKOON) {
        return true;
      }
      
      // Check for tanween
      if (this.TANWEEN.test(char)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Color the preceding noon saakin or tanween segment
   */
  private static colorPrecedingNoonOrTanween(segments: TajweedSegment[], color: string): void {
    // Look back through recent segments
    for (let i = segments.length - 1; i >= Math.max(0, segments.length - 5); i--) {
      const seg = segments[i];
      
      // Check if this segment contains noon saakin or tanween
      if (seg.text.includes(this.NOON + this.SUKOON) || this.TANWEEN.test(seg.text)) {
        seg.color = color;
        return;
      }
    }
  }

  /**
   * Merge consecutive segments with the same color
   */
  private static mergeSegments(segments: TajweedSegment[]): TajweedSegment[] {
    if (segments.length === 0) return segments;
    
    const merged: TajweedSegment[] = [];
    let current = segments[0];
    
    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      
      if (current.color === next.color) {
        // Merge with current segment
        current.text += next.text;
      } else {
        // Push current and start new segment
        merged.push(current);
        current = next;
      }
    }
    
    // Push the last segment
    merged.push(current);
    
    return merged;
  }
}
