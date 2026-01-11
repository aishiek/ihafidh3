/**
 * TajweedText Component
 * Renders Arabic Quran text with Tajweed coloring using React Native Skia
 * 
 * Uses Skia Canvas + Paragraph API for direct text coloring (no background highlights)
 * 
 * @see utils/QuranTajweedParser.ts for API-based parsing (preferred)
 * @see utils/tajweedParser.tsx for algorithmic fallback
 */

import { parseTajweedHTML } from '@/utils/QuranTajweedParser';
import { TajweedParser } from '@/utils/tajweedParser';
import { Canvas, Paragraph, Skia, TextAlign, TextDirection, useFonts } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { StyleProp, TextStyle, View } from 'react-native';

/**
 * Detects if text starts with combining mark (production-safe for Skia)
 * Covers: General combining marks (0300-036F), Arabic harakat (0610-061A, 064B-065F),
 * Madd Alif (0670), Small High Madda (0653), Quranic annotation marks (06D6-06ED),
 * Extended Arabic combining marks (08D3-08FF)
 */
const COMBINING_MARK_START = /^[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06ED\u08D3-\u08FF]/;

export function startsWithCombiningMark(text: string): boolean {
  return COMBINING_MARK_START.test(text);
}

function isCombiningMarkChar(char: string): boolean {
  return COMBINING_MARK_START.test(char);
}

function isWhitespaceChar(char: string): boolean {
  // Treat any Unicode whitespace as whitespace.
  return char.trim().length === 0;
}

function isIgnorableLeadingChar(char: string): boolean {
  // Whitespace, bidi marks, and format controls that can appear in API responses.
  // If a combining mark occurs after these, Skia can still render it as a standalone mark.
  return (
    isWhitespaceChar(char) ||
    char === '\u200E' || // LRM
    char === '\u200F' || // RLM
    char === '\u200B' || // ZWSP
    (char >= '\u202A' && char <= '\u202E') || // bidi embeddings/overrides
    (char >= '\u2066' && char <= '\u2069') // bidi isolates
  );
}

function splitLeadingIgnorables(text: string): { leading: string; rest: string } {
  if (!text) return { leading: '', rest: '' };
  const codepoints = Array.from(text);
  let i = 0;
  while (i < codepoints.length && isIgnorableLeadingChar(codepoints[i])) i++;
  return {
    leading: codepoints.slice(0, i).join(''),
    rest: codepoints.slice(i).join(''),
  };
}

function startsWithCombiningMarkIgnoringLeading(text: string): boolean {
  const { rest } = splitLeadingIgnorables(text);
  return startsWithCombiningMark(rest);
}

function splitOffTrailingCluster(text: string): { head: string; cluster: string } | null {
  if (!text) return null;

  const codepoints = Array.from(text);
  let end = codepoints.length - 1;

  // If the segment ends with whitespace, do NOT treat whitespace as the base.
  // Combining marks should attach to the last non-whitespace base letter.
  while (end >= 0 && isWhitespaceChar(codepoints[end])) {
    end--;
  }

  if (end < 0) return null;

  let i = end;

  // Collect trailing combining marks (if any)
  while (i >= 0 && isCombiningMarkChar(codepoints[i])) {
    i--;
  }

  // No base character found (text is all combining marks)
  if (i < 0) return null;

  // Include the base character and anything after it up to the last non-whitespace.
  // Keep trailing whitespace in the head so it stays in the original segment.
  const head = codepoints.slice(0, i).join('') + codepoints.slice(end + 1).join('');
  const cluster = codepoints.slice(i, end + 1).join('');
  return { head, cluster };
}

function normalizeForMushaf(text: string): string {
  // Pass through Quranic marks (Madd, Dagger Alif, Small waw/ya, annotation marks)
  // and let the font render them natively.
  
  // Strip U+0640 (Arabic Tatweel/Kashida) when used as a carrier for combining marks.
  // Quran.com uses U+0640 + U+0670 (ـٰ) which renders as a "sun" glyph in some fonts.
  // We want just the combining mark (U+0670) without the carrier.
  let normalized = text.replace(/\u0640(?=[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06ED\u08D3-\u08FF])/g, '');
  
  // Strip U+25CC (dotted-circle placeholder)
  normalized = normalized.replace(/\u25CC/g, '');
  
  return normalized;
}

const __devLoggedCarrierRemovals = new Set<string>();

const __devLoggedInterestingMarks = new Set<string>();

function __devLogCarrierPresenceOnce(key: string, raw: string) {
  if (!__DEV__) return;
  if (__devLoggedCarrierRemovals.has(key)) return;

  const matches = Array.from(raw.matchAll(/[\u25CC\u06DF\u06E0\u06EC]/g)).map((m) => m[0]);
  if (matches.length === 0) return;

  __devLoggedCarrierRemovals.add(key);
  const uniq = Array.from(new Set(matches));
  const codes = uniq
    .map((ch) => `U+${ch.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`)
    .join(', ');
}

function __devLogInterestingMarksOnce(key: string, raw: string) {
  if (!__DEV__) return;
  if (__devLoggedInterestingMarks.has(key)) return;

  // Silently track that we've seen marks for this verse
  // (previously logged Quranic/combining marks - removed as not useful)
  const matches = Array.from(
    raw.matchAll(/[\u25CC\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0653\u0670\u06D6-\u06ED\u08D3-\u08FF]/g)
  ).map((m) => m[0]);
  if (matches.length === 0) return;

  __devLoggedInterestingMarks.add(key);
  // Removed console.warn - marks are expected in Quranic text
}

interface TextRun {
  text: string;
  [key: string]: any; // Preserves style props (color, font, tajweed, etc.)
}

/**
 * Production-safe sanitizer for Skia paragraph rendering
 * Guarantees no Skia run starts with combining mark (prevents dotted circles)
 * 
 * @param runs - Styled text segments from parser
 * @returns Safe segments ready for Skia paragraph building
 */
export function sanitizeRunsForSkia<T extends TextRun>(
  runs: readonly T[]
): T[] {
  if (runs.length === 0) return [];

  // Step 1: Clone (never mutate caller data)
  const result: T[] = [];

  // Step 2: Backward merge unsafe starts
  for (const run of runs) {
    // ✅ NEW: Preserve qalqalah segments exactly
    if ((run as any).rule === 'qalqalah_waqf') {
      result.push({ ...run });
      continue;
    }

    if (
      result.length > 0 &&
      run.text &&
      startsWithCombiningMarkIgnoringLeading(run.text)
    ) {
      const prevIndex = result.length - 1;
      const prev = result[prevIndex];
      const { leading, rest } = splitLeadingIgnorables(run.text);

      // If the run begins with whitespace/bidi marks, move those onto the previous run
      // so the combining mark sequence is adjacent to a base character.
      if (leading.length > 0) {
        result[prevIndex] = { ...prev, text: prev.text + leading };
      }

      // Check if this is a structural combining mark that must stay with base
      const firstChar = rest ? Array.from(rest)[0] : '';
      if (firstChar && isStructuralCombiningMark(firstChar)) {
        // Merge entire run INTO previous to ensure font shaping works
        const prevAfterLeading = result[prevIndex];
        result[prevIndex] = {
          ...prevAfterLeading,
          text: prevAfterLeading.text + rest,
        };
        continue;
      }

      // For non-structural combining marks: pull base letter into current run
      const prevAfterLeading = result[prevIndex];
      const split = splitOffTrailingCluster(prevAfterLeading.text);

      if (split) {
        // Preserve current run's styling by moving the trailing grapheme cluster
        // from the previous run into the current run.
        if (split.head.length === 0) {
          result.pop();
        } else {
          result[prevIndex] = { ...prev, text: split.head };
        }

        result.push({
          ...run,
          text: split.cluster + rest,
        });
      } else {
        // Fallback: merge into previous run (may lose current styling)
        result[prevIndex] = {
          ...prevAfterLeading,
          text: prevAfterLeading.text + rest,
        };
      }
    } else {
      result.push({ ...run });
    }
  }

  // Step 3: Second pass (handles chained combining marks)
  for (let i = 1; i < result.length; i++) {
    const cur = result[i];
    if ((cur as any).rule === 'qalqalah_waqf') continue; // ✅ skip qalqalah

    if (startsWithCombiningMarkIgnoringLeading(cur.text)) {
      const prev = result[i - 1];
      const { leading, rest } = splitLeadingIgnorables(cur.text);

      // Move leading whitespace/bidi marks into the previous run first
      if (leading.length > 0) {
        result[i - 1] = { ...prev, text: prev.text + leading };
      }

      // Check if this is a structural combining mark
      const firstChar = rest ? Array.from(rest)[0] : '';
      if (firstChar && isStructuralCombiningMark(firstChar)) {
        // Merge into previous to ensure font shaping works
        const prevAfterLeading = result[i - 1];
        result[i - 1] = {
          ...prevAfterLeading,
          text: prevAfterLeading.text + rest,
        };
        result.splice(i, 1);
        i--;
        continue;
      }

      const prevAfterLeading = result[i - 1];
      const split = splitOffTrailingCluster(prevAfterLeading.text);

      if (split) {
        // Move trailing cluster into current run to preserve current styling
        if (split.head.length === 0) {
          result.splice(i - 1, 1);
          i--;
        } else {
          result[i - 1] = { ...prev, text: split.head };
        }

        result[i] = {
          ...cur,
          text: split.cluster + rest,
        };
      } else {
        // Fallback: merge into previous run (may lose current styling)
        result[i - 1] = {
          ...prevAfterLeading,
          text: prevAfterLeading.text + rest,
        };
        result.splice(i, 1);
        i--;
      }
    }
  }

  // Step 4: Final safety assertion (dev-only)
  if (__DEV__) {
    for (const run of result) {
      if (startsWithCombiningMarkIgnoringLeading(run.text)) {
        throw new Error(
          `[TajweedText] Skia unsafe run detected: "${run.text}"`
        );
      }
    }
  }

  return result;
}

interface TajweedTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  allowFontScaling?: boolean;
  surahNumber?: number;
  verseNumber?: number;
  highlightOpacity?: number;
  fontMgr?: any; // Optional: pass from parent for better FlashList performance
  enableStopRules?: boolean; // Enable waqf-dependent rules (Qalqalah at stops)
}

interface ColoredSegment {
  text: string;
  color: string;
}

/**
 * Extracts fontSize from StyleProp<TextStyle>
 */
function extractFontSize(style: StyleProp<TextStyle>): number {
  if (!style) return 28;
  
  const styleArray = Array.isArray(style) ? style : [style];
  for (const s of styleArray) {
    if (s && typeof s === 'object' && 'fontSize' in s && typeof s.fontSize === 'number') {
      return s.fontSize;
    }
  }
  
  return 28;
}



/**
 * Parse Arabic text into colored segments
 * HYBRID APPROACH:
 * - API tags for visual rules (Ham Wasl, Lam Shamsiyyah, Madd, Silent)
 * - Algorithmic detection for wasl-safe rules (Ghunnah, Ikhfa, Idgham, Iqlab)
 * - Optional stop rules (Qalqalah at waqf - controlled by user setting)
 * Priority: API+Algorithmic+Stop > Markup format > Algorithmic only (fallback)
 */
function parseText(
  text: string, 
  surahNumber?: number, 
  verseNumber?: number,
  enableStopRules: boolean = false
): ColoredSegment[] {
  // STRATEGY 1: Check if text is pre-tagged HTML from Quran Foundation API
  // HTML tags look like: <tajweed class="madda_normal">text</tajweed>
  if (text.includes('<tajweed')) {
    // Parse with API tags + wasl-safe algorithmic rules + optional stop rules
    const hybridSegments = parseTajweedHTML(text, {
      enableAlgorithmic: true,  // Ghunnah, Ikhfa, Idgham, Iqlab
      enableStopRules,          // Qalqalah at stops (Mushaf mode)
    });
    
    return hybridSegments.map(seg => ({
      text: seg.text,
      color: seg.color,
    }));
  }
  
  // STRATEGY 2: Check for markup format [rule_name]text[/rule_name]
  if (text.includes('[') && text.includes(']')) {
    return parseMarkup(text);
  }
  
  // STRATEGY 3: Fallback to pure algorithmic parsing (least accurate)
  const result = TajweedParser.parse(text);
  return result.map((seg) => ({
    text: seg.text,
    color: seg.color || '#FFFFFF'
  }));
}

/**
 * Parse markup format: [rule_name]text[/rule_name]
 * Example: [ham_wasl]ٱ[/ham_wasl]لْحَمْدُ
 */
function parseMarkup(text: string): ColoredSegment[] {
  const segments: ColoredSegment[] = [];
  
  // Tajweed color mapping - updated to match color guide
  const MARKUP_COLORS: Record<string, string> = {
    // Silent Letters - Gray
    ham_wasl: '#AAAAAA',
    hamza_wasl: '#AAAAAA',
    silent: '#AAAAAA',
    lam_shamsiyah: '#AAAAAA',
    laam_shamsiyah: '#AAAAAA',
    slnt: '#AAAAAA',
    
    // Madd - Orange (fixed from blue)
    madda_normal: '#FF9632',
    madda_permissible: '#FF9632',
    madda_necessary: '#FF9632',
    madda_obligatory: '#FF9632',
    madda_246: '#FF9632',
    madda_6: '#FF9632',
    madda_24: '#FF9632',
    
    // Qalqalah - Red
    qalqalah: '#DD0008',
    qalqala: '#DD0008',
    
    // Ghunnah - Yellow (fixed from orange)
    ghunnah: '#FFD700',
    ghunna: '#FFD700',
    
    // Ikhfa - Pink
    ikhfa: '#FFB6C1',
    ikhfa_shaddah: '#FFB6C1',
    ikhafa: '#FFB6C1',
    
    // Idgham - Green
    idgham_shaddah: '#00C853',
    idgham_wo_shaddah: '#00C853',
    idgham_mutajanisayn: '#00C853',
    idgham_mutaqaribayn: '#00C853',
    idgham_w_ghunnah: '#00C853',
    idgham_wo_ghunnah: '#00C853',
    
    // Iqlab - Blue
    iqlab: '#007AFF',
    
    // Meem Sakinah - Purple/Light Green
    ikhfa_shafawi: '#DDA0DD',
    idgham_shafawi: '#96CEB4',
  };
  
  let position = 0;
  const regex = /\[(\w+)\](.*?)\[\/\1\]/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > position) {
      segments.push({
        text: text.substring(position, match.index),
        color: '#FFFFFF'
      });
    }
    
    // Add colored text
    const ruleName = match[1];
    const coloredText = match[2];
    segments.push({
      text: coloredText,
      color: MARKUP_COLORS[ruleName] || '#FFFFFF'
    });
    
    position = regex.lastIndex;
  }
  
  // Add remaining text
  if (position < text.length) {
    segments.push({
      text: text.substring(position),
      color: '#FFFFFF'
    });
  }
  
  return segments;
}

// Combining marks that MUST stay attached to base letter for correct font shaping.
// These render as decorative "sun" glyphs if standalone. Merge into previous segment.
const STRUCTURAL_COMBINING_MARKS = new Set([
  '\u0670', // Arabic Letter Superscript Alef (Dagger Alif / Madd Alif)
  '\u06E5', // Arabic Small Waw
  '\u06E6', // Arabic Small Yeh
]);

function isStructuralCombiningMark(char: string): boolean {
  return STRUCTURAL_COMBINING_MARKS.has(char);
}

/**
 * CRITICAL: Parser-level combining mark merger
 * Ensures glyph cluster integrity BEFORE styling
 * Combining marks must NEVER be standalone segments
 * 
 * Strategy:
 * - "Structural" marks (Dagger Alif, Small Waw/Ya): merge INTO previous segment
 *   to ensure font shaping works correctly (sacrifices tajweed color)
 * - Other combining marks (harakat): pull base letter into current segment
 *   to preserve tajweed color while maintaining cluster integrity
 * 
 * @param segments - Raw parsed segments from TajweedParser or markup
 * @returns Segments with combining marks merged into base letters
 */
function mergeCombiningIntoBase(segments: ColoredSegment[]): ColoredSegment[] {
  const result: ColoredSegment[] = [];

  for (const seg of segments) {
    if (startsWithCombiningMarkIgnoringLeading(seg.text)) {
      // Optional hardening: Quran text should never begin with combining marks.
      if (result.length === 0) {
        continue;
      }

      const prevIndex = result.length - 1;
      const prevInitial = result[prevIndex];
      const { leading, rest } = splitLeadingIgnorables(seg.text);

      // If this segment starts with whitespace/bidi marks, shift them onto the previous segment
      if (leading.length > 0) {
        result[prevIndex] = { ...prevInitial, text: prevInitial.text + leading };
      }

      const prev = result[prevIndex];
      const segRest = rest;
      if (!segRest) continue;

      // Check if the first combining character is a "structural" mark
      // that must stay with its base for correct rendering
      const firstChar = Array.from(segRest)[0];
      if (isStructuralCombiningMark(firstChar)) {
        // Merge entire segment INTO previous (keeps base+mark together for shaping)
        // This sacrifices the tajweed color but ensures correct rendering
        result[prevIndex] = {
          ...prev,
          text: prev.text + segRest,
        };
        continue;
      }

      // For other combining marks (harakat): pull base letter into current segment
      // to preserve tajweed color while maintaining cluster integrity
      const split = splitOffTrailingCluster(prev.text);

      if (split) {
        if (split.head.length === 0) {
          result.pop();
        } else {
          result[prevIndex] = { ...prev, text: split.head };
        }

        result.push({
          ...seg,
          text: split.cluster + segRest,
        });
      } else {
        // Fallback: merge into previous segment (will use previous color)
        result[prevIndex] = {
          ...prev,
          text: prev.text + segRest,
        };
      }
    } else {
      result.push({ ...seg });
    }
  }

  return result;
}

const TajweedText: React.FC<TajweedTextProps> = ({ 
  text, 
  style,
  surahNumber,
  verseNumber,
  fontMgr: fontMgrProp,
  enableStopRules = false, // Default: wasl mode (no qalqalah)
}) => {
  // Measure actual container width (critical for tablets, landscape, split-screen)
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // Load Quranic font (prefer fontMgr from parent for better FlashList performance)
  // Using Uthman Taha font - cleaner rendering for Quranic diacritics
  // TODO: Always pass fontMgr from parent (Surah screen) to eliminate per-item hook overhead
  const fontMgrLocal = useFonts({
    QuranicFont: [require('@/assets/fonts/UthmanTaha-Ver10.otf')]
  });
  const fontMgr = fontMgrProp || fontMgrLocal;

  // Memoize expensive calculations
  const fontSize = useMemo(() => extractFontSize(style), [style]);

  // Best-practice: preserve raw source text upstream, normalize only for rendering.
  const mushafText = useMemo(() => {
    const key = `${surahNumber ?? 'unknown'}:${verseNumber ?? 'unknown'}`;
    __devLogCarrierPresenceOnce(key, text);
    __devLogInterestingMarksOnce(key, text);
    return normalizeForMushaf(text);
  }, [text, surahNumber, verseNumber]);
  
  // LAYER 1: Parser-level merge (glyph cluster integrity)
  // Ensures combining marks are never standalone segments
  // NOTE: enableStopRules NOT used here - qalqalah applied after sanitization
  const segments = useMemo(() => {
    const parsed = parseText(mushafText, surahNumber, verseNumber, false); // Always false
    return mergeCombiningIntoBase(parsed);
  }, [mushafText, surahNumber, verseNumber]); // Removed enableStopRules

  // LAYER 2: Skia-level sanitizer (paragraph run safety)
  // Multi-pass backward merge ensures no Skia style run starts with combining mark
  const sanitized = useMemo(() => sanitizeRunsForSkia(segments), [segments]);
  
  // LAYER 3: FINAL qalqalah overlay (AFTER sanitization)
  // This is the ONLY correct place to apply stop rules
  const safeSegments = useMemo(() => {
    if (!enableStopRules) return sanitized;
    
    // Import and apply qalqalah as final overlay
    const { applyQalqalahOverlay } = require('@/utils/tajweedParser');
    const withQalqalah = applyQalqalahOverlay(sanitized, true);
    
    // Safety assertion: verify no text was added, only split/recolored
    if (__DEV__) {
      const joinedAfter = withQalqalah.map(s => s.text).join('');
      const joinedBefore = sanitized.map(s => s.text).join('');
      if (joinedAfter !== joinedBefore) {
        console.warn('[Tajweed] Segment text mismatch after qalqalah overlay');
        console.warn('Before:', joinedBefore);
        console.warn('After:', joinedAfter);
      }
    }
    
    return withQalqalah;
  }, [sanitized, enableStopRules]);

  // CRITICAL: Memoize paragraph to prevent re-creation on every render (FlashList performance)
  const paragraph = useMemo(() => {
    if (!fontMgr || !safeSegments.length || !containerWidth) return null;

    const paragraphStyle = {
      textAlign: TextAlign.Right,
      textDirection: TextDirection.RTL,
    };
    
    const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr);
    
    safeSegments.forEach((segment: ColoredSegment) => {
      builder.pushStyle({
        color: Skia.Color(segment.color),
        fontSize: fontSize,
        fontFamilies: ['QuranicFont'],
      });
      // Safe to add directly - sanitizeRunsForSkia ensures no combining mark starts
      builder.addText(segment.text);
      builder.pop();
    });
    
    const p = builder.build();
    // Layout using measured width (supports tablets, landscape, split-screen)
    p.layout(containerWidth);
    return p;
  }, [fontMgr, safeSegments, fontSize, containerWidth]);

  const height = paragraph ? paragraph.getHeight() : fontSize * 2;

  return (
    <View
      style={{ width: '100%' }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {paragraph && containerWidth && (
        <Canvas 
          style={{ 
            width: containerWidth, 
            height: height,
            // Ensure canvas doesn't swallow touch events meant for VerseItem
            pointerEvents: 'none' 
          }}
        >
          <Paragraph paragraph={paragraph} x={0} y={0} width={containerWidth} />
        </Canvas>
      )}
    </View>
  );
};

export default TajweedText;
