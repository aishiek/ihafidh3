/**
 * Tajweed Parser for Arabic Quranic Text
 * Detects and applies Tajweed rules for proper color coding
 * Based on standard Tajweed rules used by Quranly and iQuran apps
 * 
 * Uses grapheme-aware parsing to handle diacritics correctly
 * 
 * IMPORTANT: For Tanween and Noon/Meem Sakinah rules:
 * - BOTH the letter with sukoon/tanween AND the following letter are colored
 * - Example: If تً is followed by م, both the ت+tanween AND the م are colored green (Idgham)
 */

import { GraphemeString } from './GraphemeString';

// Tajweed color scheme - matches standard color-coded Quran Mushafs
export const TAJWEED_COLORS = {
  // Noon Sakinah & Tanween Rules
  ghunnah: '#FF9500',           // Orange - Noon/Meem Mushaddad (stressed)
  ikhfa: '#FFB6C1',             // Light Pink - Ikhfa (concealment with ghunnah)
  idgham_with_ghunnah: '#00C853', // Green - Idgham with ghunnah (ينمو)
  idgham_no_ghunnah: '#4DD0E1', // Light Blue/Cyan - Idgham without ghunnah (لر)
  iqlab: '#007AFF',             // Blue - Iqlab (conversion to meem)
  // Note: Izhar (clarity) uses default color - no special highlighting
  
  // Meem Sakinah Rules
  ikhfa_shafawi: '#DDA0DD',     // Plum - Ikhfa Shafawi (مْ before ب)
  idgham_shafawi: '#96CEB4',    // Light Green - Idgham Shafawi (مْ before م)
  
  // Other Rules
  qalqalah: '#FF3B30',          // Red - Qalqalah (echo on قطبجد)
  madd: '#FFA500',              // Orange - Madd (elongation)
  silent_letters: '#AAAAAA',    // Gray - Silent letters
  default: '#FFFFFF'            // White - Default text color
} as const;

export interface TajweedSegment {
  text: string;
  color: string;
  rule?: string;
  isSilent?: boolean;
}

export class TajweedParser {
  // Noon Sakinah & Tanween Rule Letters
  private static IZHAR_LETTERS = /[ءهعحغخ]/;        // 6 throat letters - NO color
  private static IDGHAM_GHUNNAH = /[ينمو]/;        // 4 letters - GREEN
  private static IDGHAM_NO_GHUNNAH = /[لر]/;      // 2 letters - CYAN
  private static IQLAB_LETTER = /ب/;              // 1 letter - BLUE
  private static IKHFA_LETTERS = /[تثجدذزسشصضطظفقك]/; // 15 letters - PINK
  
  // Qalqalah letters
  private static QALQALAH = /[قطبجد]/;
  
  // Ba letter
  private static BA = 'ب';
  
  // Diacritics
  private static SHADDAH = '\u0651';      // ّ
  private static SUKOON = '\u0652';       // ْ
  private static TANWEEN = /[\u064B\u064C\u064D]/; // Tanween marks
  private static VOWELS = /[\u064E\u064F\u0650]/;  // Fatha, Damma, Kasra
  
  // Special characters
  private static SMALL_HIGH_ROUNDED_ZERO = '\u06DF'; // ۟
  private static SMALL_HIGH_UPRIGHT_ZERO = '\u06E0'; // ۠
  private static SMALL_HIGH_MADDA = '\u0653';        // ٓ
  
  // Madd indicators
  private static MADD_ALIF = '\u0670';    // ٰ
  
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

    const gText = new GraphemeString(text);
    const segments: TajweedSegment[] = [];
    const processedIndices = new Set<number>();
    
    let i = 0;
    
    while (i < gText.length) {
      if (processedIndices.has(i)) {
        i++;
        continue;
      }
      
      const cluster = gText.charAt(i);
      const nextCluster = gText.charAt(i + 1);
      
      // FIX 1: SILENT LETTERS (Dotted Circle Fix)
      // Combine base letter with silent circle marker in ONE segment
      if (nextCluster && (nextCluster.includes(this.SMALL_HIGH_ROUNDED_ZERO) || 
                          nextCluster.includes(this.SMALL_HIGH_UPRIGHT_ZERO))) {
        segments.push({ 
          text: cluster + nextCluster,
          color: TAJWEED_COLORS.silent_letters, 
          rule: 'silent',
          isSilent: true
        });
        processedIndices.add(i);
        processedIndices.add(i + 1);
        i += 2;
        continue;
      }
      
      // 1. Silent letter markers (if not already handled above)
      if (cluster.includes(this.SMALL_HIGH_ROUNDED_ZERO) || 
          cluster.includes(this.SMALL_HIGH_UPRIGHT_ZERO)) {
        segments.push({ 
          text: cluster, 
          color: TAJWEED_COLORS.silent_letters, 
          rule: 'silent',
          isSilent: true 
        });
        processedIndices.add(i);
        i++;
        continue;
      }
      
      // 2. Ghunnah (Noon/Meem with Shaddah)
      if ((cluster.includes(this.NOON) || cluster.includes(this.MEEM)) && 
          cluster.includes(this.SHADDAH)) {
        segments.push({ text: cluster, color: TAJWEED_COLORS.ghunnah, rule: 'ghunnah' });
        processedIndices.add(i);
        i++;
        continue;
      }
      
      // 3. Madd
      // TODO: Refine madd detection - currently permissive and may over-color
      // Should restrict to: Madd letters preceded by appropriate vowel OR explicit madd signs
      if ((cluster.match(/[اوي]/) && !cluster.includes(this.SUKOON)) ||
          cluster.includes(this.MADD_ALIF) || 
          cluster.includes(this.SMALL_HIGH_MADDA)) {
        segments.push({ text: cluster, color: TAJWEED_COLORS.madd, rule: 'madd' });
        processedIndices.add(i);
        i++;
        continue;
      }
      
      // NOTE: Qalqalah detection REMOVED - must be applied as final pass with waqf context
      // See applyStopRules() in QuranTajweedParser.ts for correct implementation
      
      // 4. Check for Tanween FIRST (before we check individual marks)
      // Look for a base letter followed by Tanween in the NEXT cluster
      const baseLetter = this.getBaseLetter(cluster);
      const followingCluster = gText.charAt(i + 1);
      
      if (baseLetter && followingCluster && this.TANWEEN.test(followingCluster) && 
          !processedIndices.has(i + 1)) {
        // We have: current cluster (base letter) + next cluster (tanween mark)
        const result = this.processTanweenRule(gText, i, i + 1, processedIndices);
        if (result) {
          segments.push(...result.segments);
          result.processedIndices.forEach(idx => processedIndices.add(idx));
          i = result.nextIndex;
          continue;
        }
      }
      
      // 5. Check if current cluster itself has Tanween with base letter
      if (baseLetter && this.TANWEEN.test(cluster)) {
        const result = this.processTanweenRule(gText, i, i, processedIndices);
        if (result) {
          segments.push(...result.segments);
          result.processedIndices.forEach(idx => processedIndices.add(idx));
          i = result.nextIndex;
          continue;
        }
      }
      
      // 6. Noon Sakinah rules
      if (cluster.includes(this.NOON) && cluster.includes(this.SUKOON)) {
        const result = this.processNoonSakinahRule(gText, i, processedIndices);
        if (result) {
          segments.push(...result.segments);
          result.processedIndices.forEach(idx => processedIndices.add(idx));
          i = result.nextIndex;
          continue;
        }
      }
      
      // 7. Meem Sakinah rules
      if (cluster.includes(this.MEEM) && cluster.includes(this.SUKOON)) {
        const result = this.processMeemSakinahRule(gText, i, processedIndices);
        if (result) {
          segments.push(...result.segments);
          result.processedIndices.forEach(idx => processedIndices.add(idx));
          i = result.nextIndex;
          continue;
        }
      }
      
      // Default: no special rule
      segments.push({ text: cluster, color: TAJWEED_COLORS.default });
      processedIndices.add(i);
      i++;
    }
    
    return this.mergeSegments(segments);
  }

  /**
   * Process Tanween rules
   * UPDATED: Ensures base letter + tanween + silent alif are grouped together
   * @param baseIndex - index of the base letter with tanween
   * @param tanweenIndex - index where tanween mark is (can be same as baseIndex)
   */
  private static processTanweenRule(
    gText: GraphemeString,
    baseIndex: number,
    tanweenIndex: number,
    processedIndices: Set<number>
  ): { segments: TajweedSegment[]; processedIndices: Set<number>; nextIndex: number } | null {
    const segments: TajweedSegment[] = [];
    const newProcessed = new Set<number>();
    
    // 1. Find the next Arabic letter after the tanween to determine the rule
    const nextLetterInfo = this.findNextLetter(gText, tanweenIndex + 1);
    
    let color: string = TAJWEED_COLORS.default;
    let rule = 'izhar_tanween';
    let colorFollowing = false;

    if (nextLetterInfo) {
      const followingLetter = this.getBaseLetter(gText.charAt(nextLetterInfo.startIndex));
      if (followingLetter) {
        if (this.IZHAR_LETTERS.test(followingLetter)) {
          color = TAJWEED_COLORS.default;
          rule = 'izhar_tanween';
        } else if (this.IKHFA_LETTERS.test(followingLetter)) {
          color = TAJWEED_COLORS.ikhfa;
          rule = 'ikhfa_tanween';
          colorFollowing = true;
        } else if (this.IDGHAM_GHUNNAH.test(followingLetter)) {
          color = TAJWEED_COLORS.idgham_with_ghunnah;
          rule = 'idgham_tanween_ghunnah';
          colorFollowing = true;
        } else if (this.IDGHAM_NO_GHUNNAH.test(followingLetter)) {
          color = TAJWEED_COLORS.idgham_no_ghunnah;
          rule = 'idgham_tanween_no_ghunnah';
          colorFollowing = true;
        } else if (this.IQLAB_LETTER.test(followingLetter)) {
          color = TAJWEED_COLORS.iqlab;
          rule = 'iqlab_tanween';
          colorFollowing = true;
        }
      }
    }

    // 2. BUILD PRIMARY COLORED SEGMENT
    // Combine base letter + tanween mark into ONE string to ensure proper coloring
    let primaryText = gText.charAt(baseIndex);
    newProcessed.add(baseIndex);

    if (baseIndex !== tanweenIndex) {
      primaryText += gText.charAt(tanweenIndex);
      newProcessed.add(tanweenIndex);
    }

    // 3. FIX: Include silent Alif after Tanween Fatha
    // Tanween Fatha (ً) is often followed by a silent Alif that should be grouped
    const afterTanweenIdx = tanweenIndex + 1;
    if (afterTanweenIdx < gText.length && !processedIndices.has(afterTanweenIdx)) {
      const nextChar = gText.charAt(afterTanweenIdx);
      // Check for Alif or Alif with silent marker
      if (nextChar === 'ا' || nextChar === 'ى' || 
          nextChar.includes('ا') || nextChar.includes('ى') ||
          nextChar.includes(this.SMALL_HIGH_ROUNDED_ZERO) ||
          nextChar.includes(this.SMALL_HIGH_UPRIGHT_ZERO)) {
        primaryText += nextChar;
        newProcessed.add(afterTanweenIdx);
      }
    }

    segments.push({ text: primaryText, color, rule });

    // 4. Handle intermediate spaces/characters
    const lastProcessedIdx = Math.max(...Array.from(newProcessed));
    if (nextLetterInfo && colorFollowing) {
      for (let j = lastProcessedIdx + 1; j < nextLetterInfo.startIndex; j++) {
        if (!processedIndices.has(j)) {
          segments.push({ text: gText.charAt(j), color: TAJWEED_COLORS.default });
          newProcessed.add(j);
        }
      }

      // 5. Add the following letter (colored per the rule)
      const followingCluster = gText.slice(nextLetterInfo.startIndex, nextLetterInfo.endIndex);
      segments.push({ text: followingCluster, color, rule: `${rule}_following` });
      for (let j = nextLetterInfo.startIndex; j < nextLetterInfo.endIndex; j++) {
        newProcessed.add(j);
      }
      return { 
        segments, 
        processedIndices: newProcessed, 
        nextIndex: nextLetterInfo.endIndex 
      };
    }

    return { 
      segments, 
      processedIndices: newProcessed, 
      nextIndex: lastProcessedIdx + 1 
    };
  }

  /**
   * Process Noon Sakinah rules
   */
  private static processNoonSakinahRule(
    gText: GraphemeString,
    index: number,
    processedIndices: Set<number>
  ): { segments: TajweedSegment[]; processedIndices: Set<number>; nextIndex: number } | null {
    const segments: TajweedSegment[] = [];
    const newProcessed = new Set<number>();
    
    const cluster = gText.charAt(index);
    
    // Find next Arabic letter
    const nextLetterInfo = this.findNextLetter(gText, index + 1);
    
    if (!nextLetterInfo) {
      segments.push({ text: cluster, color: TAJWEED_COLORS.default });
      newProcessed.add(index);
      return { segments, processedIndices: newProcessed, nextIndex: index + 1 };
    }
    
    const followingLetter = this.getBaseLetter(gText.charAt(nextLetterInfo.startIndex));
    if (!followingLetter) {
      segments.push({ text: cluster, color: TAJWEED_COLORS.default });
      newProcessed.add(index);
      return { segments, processedIndices: newProcessed, nextIndex: index + 1 };
    }
    
    // Determine rule
    let color: string = TAJWEED_COLORS.default;
    let rule: string;
    let colorFollowing = false;
    
    if (this.IZHAR_LETTERS.test(followingLetter)) {
      color = TAJWEED_COLORS.default;
      rule = 'izhar';
    } else if (this.IKHFA_LETTERS.test(followingLetter)) {
      color = TAJWEED_COLORS.ikhfa;
      rule = 'ikhfa';
      colorFollowing = true;
    } else if (this.IDGHAM_GHUNNAH.test(followingLetter)) {
      color = TAJWEED_COLORS.idgham_with_ghunnah;
      rule = 'idgham_with_ghunnah';
      colorFollowing = true;
    } else if (this.IDGHAM_NO_GHUNNAH.test(followingLetter)) {
      color = TAJWEED_COLORS.idgham_no_ghunnah;
      rule = 'idgham_no_ghunnah';
      colorFollowing = true;
    } else if (this.IQLAB_LETTER.test(followingLetter)) {
      color = TAJWEED_COLORS.iqlab;
      rule = 'iqlab';
      colorFollowing = true;
    } else {
      color = TAJWEED_COLORS.default;
      rule = 'default';
    }
    
    // Add noon sakinah
    segments.push({ text: cluster, color, rule });
    newProcessed.add(index);
    
    // Add intermediate characters
    for (let j = index + 1; j < nextLetterInfo.startIndex; j++) {
      segments.push({ text: gText.charAt(j), color: TAJWEED_COLORS.default });
      newProcessed.add(j);
    }
    
    // Add following letter if it should be colored
    if (colorFollowing) {
      const followingCluster = gText.slice(nextLetterInfo.startIndex, nextLetterInfo.endIndex);
      segments.push({ text: followingCluster, color, rule: `${rule}_following` });
      for (let j = nextLetterInfo.startIndex; j < nextLetterInfo.endIndex; j++) {
        newProcessed.add(j);
      }
      return { segments, processedIndices: newProcessed, nextIndex: nextLetterInfo.endIndex };
    }
    
    return { segments, processedIndices: newProcessed, nextIndex: index + 1 };
  }

  /**
   * Process Meem Sakinah rules
   */
  private static processMeemSakinahRule(
    gText: GraphemeString,
    index: number,
    processedIndices: Set<number>
  ): { segments: TajweedSegment[]; processedIndices: Set<number>; nextIndex: number } | null {
    const segments: TajweedSegment[] = [];
    const newProcessed = new Set<number>();
    
    const cluster = gText.charAt(index);
    
    // Find next letter
    const nextLetterInfo = this.findNextLetter(gText, index + 1);
    
    if (!nextLetterInfo) {
      segments.push({ text: cluster, color: TAJWEED_COLORS.default });
      newProcessed.add(index);
      return { segments, processedIndices: newProcessed, nextIndex: index + 1 };
    }
    
    const followingLetter = this.getBaseLetter(gText.charAt(nextLetterInfo.startIndex));
    if (!followingLetter) {
      segments.push({ text: cluster, color: TAJWEED_COLORS.default });
      newProcessed.add(index);
      return { segments, processedIndices: newProcessed, nextIndex: index + 1 };
    }
    
    let color: string = TAJWEED_COLORS.default;
    let rule: string;
    let colorFollowing = false;
    
    if (followingLetter === this.BA) {
      color = TAJWEED_COLORS.ikhfa_shafawi;
      rule = 'ikhfa_shafawi';
      colorFollowing = true;
    } else if (followingLetter === this.MEEM) {
      color = TAJWEED_COLORS.idgham_shafawi;
      rule = 'idgham_shafawi';
      colorFollowing = true;
    } else {
      color = TAJWEED_COLORS.default;
      rule = 'izhar_shafawi';
    }
    
    // Add meem sakinah
    segments.push({ text: cluster, color, rule });
    newProcessed.add(index);
    
    // Add intermediate
    for (let j = index + 1; j < nextLetterInfo.startIndex; j++) {
      segments.push({ text: gText.charAt(j), color: TAJWEED_COLORS.default });
      newProcessed.add(j);
    }
    
    // Add following letter if colored
    if (colorFollowing) {
      const followingCluster = gText.slice(nextLetterInfo.startIndex, nextLetterInfo.endIndex);
      segments.push({ text: followingCluster, color, rule: `${rule}_following` });
      for (let j = nextLetterInfo.startIndex; j < nextLetterInfo.endIndex; j++) {
        newProcessed.add(j);
      }
      return { segments, processedIndices: newProcessed, nextIndex: nextLetterInfo.endIndex };
    }
    
    return { segments, processedIndices: newProcessed, nextIndex: index + 1 };
  }

  /**
   * Extract base Arabic letter from cluster
   */
  private static getBaseLetter(cluster: string): string | null {
    const match = cluster.match(/[\u0621-\u064A]/);
    return match ? match[0] : null;
  }

  /**
   * Find next Arabic letter with position
   * Scans until: Arabic letter found, word boundary (space), or end of text
   */
  private static findNextLetter(
    gText: GraphemeString,
    startIndex: number
  ): { startIndex: number; endIndex: number } | null {
    for (let i = startIndex; i < gText.length; i++) {
      const cluster = gText.charAt(i);
      
      // Stop at word boundaries
      if (cluster === ' ' || cluster === '\u00A0' || cluster === '\u200B' || cluster === '\u200C') {
        return null;
      }
      
      // Skip diacritics-only clusters (Arabic clusters rarely >4 graphemes deep)
      if (/^[\u064B-\u065F\u0670]+$/.test(cluster)) {
        continue;
      }
      
      // Found Arabic letter
      if (cluster.match(/[\u0621-\u064A]/)) {
        return { startIndex: i, endIndex: i + 1 };
      }
    }
    return null;
  }

  /**
   * Merge consecutive segments with same color
   */
  private static mergeSegments(segments: TajweedSegment[]): TajweedSegment[] {
    if (segments.length === 0) return segments;
    
    const merged: TajweedSegment[] = [];
    let current = segments[0];
    
    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      
      if (current.color === next.color && current.isSilent === next.isSilent) {
        current.text += next.text;
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }
}

// --- QALQALAH FINAL OVERLAY ---
// Only colors the correct letters at word ends without touching text
export function applyQalqalahOverlay(
  segments: TajweedSegment[],
  enable: boolean
): TajweedSegment[] {
  if (!enable) return segments;

  const QALQALAH_LETTERS = /[قطبجد]/; // letters for qalqalah
  const ARABIC_MARKS = /[\u064B-\u0652\u0670\u06D6-\u06ED]*/; // diacritics

  return segments.flatMap((seg, idx) => {
    if (!seg.text) return [seg];

    // match last Arabic letter of the segment plus any marks
    const match = seg.text.match(
      new RegExp(`^(.*?)([قطبجد])(${ARABIC_MARKS.source})$`)
    );

    if (!match) return [seg];

    const [, before, letter, marks] = match;

    // only apply if this letter is at word end
    const nextText = segments[idx + 1]?.text ?? '';
    const isWordEnd = /^[\s\u00A0\u200B\u06D6-\u06ED]*$/.test(nextText);

    if (!isWordEnd) return [seg];

    return [
      before && { ...seg, text: before }, // keep preceding text
      {
        ...seg,
        text: letter + marks,
        color: TAJWEED_COLORS.qalqalah, // override color only
        rule: 'qalqalah_waqf',
      },
    ].filter(Boolean);
  });
}

/**
 * Debug helper
 */
export function debugArabicCharacters(text: string, label: string = 'Text'): void {
  if (!__DEV__) return;
  
  console.log(`\n=== ${label} Character Analysis ===`);
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    const hex = code.toString(16).toUpperCase().padStart(4, '0');
    
    let description = '';
    if (code >= 0x0600 && code <= 0x06FF) description = 'Arabic/Quranic';
    else if (code >= 0x0750 && code <= 0x077F) description = 'Arabic Supplement';
    else if (code >= 0x25A0 && code <= 0x25FF) description = 'Geometric Shape';
    else if (code >= 0x2600 && code <= 0x26FF) description = 'Misc Symbol';
    else if (code === 0x06DF) description = 'KGFQPC Silent Marker';
    else if (code === 0x0670) description = 'Madd Alif';
    else if (code === 0x0020) description = 'Space';
    else if (code === 0x00A0) description = 'Non-breaking Space';
    
    console.log(`[${i}] "${char}" | U+${hex} (${code}) | ${description}`);
  }
  console.log('========================\n');
}

/**
 * Debug Tajweed parsing
 */
export function debugTajweed(text: string): void {
  if (!__DEV__) return;
  
  console.log('\n=== TAJWEED DEBUG ===');
  console.log('Input:', text);
  console.log('\nParsed segments:');
  
  const segments = TajweedParser.parse(text);
  segments.forEach((seg, i) => {
    console.log(`${i}: "${seg.text}" → ${seg.color} (${seg.rule || 'default'})`);
  });
  
  console.log('===================\n');
}

/**
 * Check if character is a circle variant
 */
export function isCircleCharacter(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    code === 0x25CB ||  // ○
    code === 0x25EF ||  // ◯
    code === 0x25CF ||  // ●
    code === 0x26AA ||  // ⚪
    code === 0x2600 ||  // ☀
    code === 0x06DF ||  // ۟
    code === 0x06E0     // ۠
  );
}