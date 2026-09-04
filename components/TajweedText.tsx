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

// ... (rest of imports)

import React, { useMemo, useState } from 'react';
import { Text as RNText, StyleProp, TextStyle, View, Platform } from 'react-native';

/**
 * Detects if text starts with combining mark (production-safe for Skia)
 * Covers: General combining marks (0300-036F), Arabic harakat (0610-061A, 064B-065F),
 * Madd Alif (0670), Small High Madda (0653), Quranic annotation marks (06D6-06ED),
 * Extended Arabic combining marks (08D3-08FF)
 */
const COMBINING_MARK_START = /^[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06DD\u06DF-\u06ED\u08D3-\u08FF]/;

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

  const trailingWhitespace = codepoints.slice(end + 1).join('');
  const cluster = codepoints.slice(i, end + 1).join('');
  const head = codepoints.slice(0, i).join('') + trailingWhitespace;
  return { head, cluster };
}

// ROOT CAUSE (confirmed 2026-08-31): assets/fonts/UthmanTaha-Ver10.otf -- the ONLY
// font hardcoded for this Skia/Canvas Tajweed renderer (see QuranicFont below) -- has
// NO glyphs for almost the entire Quranic small-sign annotation block (U+06D6-U+06ED)
// or the extended Arabic marks block (U+08D3-U+08FF). Confirmed via fontTools cmap
// inspection: every other bundled font (UthmanicHafs1, ScheherazadeNew, NotoNaskhArabic)
// covers these ranges fully; UthmanTaha does not.
//
// When one of these marks appears attached to a base letter (e.g. U+06DF on the final
// Alif of "Ana" (Arabic: Alif-hamza + Noon + Alif + U+06DF) in Surah 18:34 /
// 26:115), Skia's ParagraphBuilder has to
// font-fallback that base+mark cluster to the secondary font in `fontFamilies:
// ['QuranicFont', 'sans-serif']` (see below) to find a glyph for the mark. That pulls
// the BASE LETTER itself into a different font-run than its neighbor, which breaks the
// cursive join between them at the native Skia/HarfBuzz level -- no amount of ZWJ
// hinting in the source text can fix this, since ZWJ only requests a join within a
// single font's shaping run; it cannot bridge two different font families.
//
// Reproduced and confirmed with canvaskit-wasm using the app's actual two-font fallback
// chain (['QuranicFont', 'sans-serif']): "Noon+Alif" alone renders as one continuous
// joined stroke; the same pair with a trailing U+06DF mark visibly splits into a disconnected
// Noon and Alif -- pixel-for-pixel the same defect seen on-device.
//
// Fix: strip these unsupported marks before they ever reach Skia. They already cannot
// be positioned correctly by this renderer (no glyph = no visual contribution besides
// triggering the fallback), so removing them trades a rare, mostly-invisible annotation
// mark for correct letter joining -- a clear net win. U+06DD (End of Ayah) is
// deliberately excluded: it's appended programmatically at the end of each verse
// (see VerseItem.tsx) and has its own existing Android ZWNJ handling for the end-of-ayah
// circle marker; it sits after a word boundary, not inside a joining letter pair, so it
// doesn't trigger this defect and removing it would break that separate feature.
const SKIA_UNSUPPORTED_QURANIC_MARKS = /[\u06D6-\u06DC\u06DE-\u06ED\u08D3-\u08FF]/g;

// Uthmani LETTERS this font has no glyph for. Unlike the annotation marks above, these
// cannot be stripped -- they carry the word itself. They must be mapped onto the nearest
// form the font CAN draw, or Skia falls back to 'sans-serif' mid-word and that font-run
// boundary breaks cursive joining (a ZWJ cannot bridge a font boundary).
//   U+0671 ALEF WASLA            x13,483 -> U+0627 ALEF         (بِٱلْغَيْبِ -> بِالْغَيْبِ)
//   U+0672 ALEF WAVY HAMZA ABOVE  x1,561 -> U+0627 ALEF         (صِرَٲطَ -> صِرَاطَ)
// These are the ONLY two codepoints in the whole Quran that survive the mark-strip above
// without a glyph in UthmanTaha-Ver10.otf -- verified across all 6,236 verses.
//
// Both substitutions are 1:1 in length, so the API's <tajweed> span offsets are preserved
// and the grey ham_wasl colouring stays on the alef. Known trade-off: the wasl head is not
// drawn -- this font contains no wasl glyph under any name.
//
// U+0672 maps to a PLAIN ALEF, not to U+0670 dagger alef, even though the dagger alef is
// the more faithful mushaf form. Measured reason: U+0672 is a base LETTER and the API
// often wraps it in its own <tajweed class="madda_*"> span. Mapping a base letter to a
// combining mark leaves 1,558 spans holding marks with no base; reattachOrphanCombiningMarks()
// then absorbs them into the PREVIOUS segment and drops the madd segment entirely, silently
// losing 1,558 madd colourings. Base-to-base keeps every span anchored and every tajweed
// colour intact -- scratch/v3_baseline_v2.js reports a delta of 0 new orphan spans.
//
// See docs/Tajweed_Alef_Wasla_Investigation_2026-09-03.md
const SKIA_UNSUPPORTED_UTHMANI_LETTERS: readonly (readonly [RegExp, string])[] = [
  [/\u0671/g, '\u0627'],
  [/\u0672/g, '\u0627'],
] as const;

function normalizeForTajweedFont(text: string): string {
  // Pass through Quranic marks (Madd, Dagger Alif) that the font DOES support,
  // and let the font render them natively.

  // We NO LONGER strip U+0640 (Arabic Tatweel) used as a carrier.
  // Stripping it causes the Dagger Alif to fall back onto the preceding letter,
  // which may already have a vowel, causing invalid shaping and rendering a `+` missing-glyph.
  // Instead, we keep the Tatweel and use ZWJ (Zero-Width Joiner) injection across Skia runs
  // to ensure the Tatweel connects properly and doesn't render as an isolated placeholder.

  // Strip U+25CC (dotted-circle placeholder)
  let normalized = text.replace(/\u25CC/g, '');

  // Strip Quranic annotation marks this font has no glyphs for (see comment above) --
  // left in place, they force a font-fallback that breaks cursive joining.
  normalized = normalized.replace(SKIA_UNSUPPORTED_QURANIC_MARKS, '');

  // Map Uthmani letters with no glyph in this font onto their nearest drawable form.
  // Runs AFTER the mark strip and BEFORE parseText(), so the substitution reaches the
  // tajweed-coloured segments -- which is where the joining gap is actually visible.
  for (const [pattern, replacement] of SKIA_UNSUPPORTED_UTHMANI_LETTERS) {
    normalized = normalized.replace(pattern, replacement);
  }

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
        // Merge only the leading run of structural marks INTO previous, to
        // ensure font shaping works -- without dragging unrelated trailing
        // text (and its own styling) into the previous run's color.
        const { run: structuralRun, rest: afterStructural } = splitLeadingStructuralRun(rest);
        const prevAfterLeading = result[prevIndex];
        result[prevIndex] = {
          ...prevAfterLeading,
          text: prevAfterLeading.text + structuralRun,
        };
        if (afterStructural) {
          result.push({ ...run, text: afterStructural });
        }
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
        // Merge only the leading run of structural marks into previous, to
        // ensure font shaping works -- without dragging unrelated trailing
        // text (and its own styling) into the previous run's color.
        const { run: structuralRun, rest: afterStructural } = splitLeadingStructuralRun(rest);
        const prevAfterLeading = result[i - 1];
        result[i - 1] = {
          ...prevAfterLeading,
          text: prevAfterLeading.text + structuralRun,
        };
        if (afterStructural) {
          result[i] = { ...cur, text: afterStructural };
        } else {
          result.splice(i, 1);
          i--;
        }
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

  // Step 3.5: Insurance pass -- inject ZWJ between adjacent joining-letter pairs
  // WITHIN a single run's own text too, not just at colored-segment boundaries
  // (Step 4 below only fires BETWEEN separately-styled runs). This guards against
  // "\u0623\u064e\u0646\u064e\u0627\u061f" (Ana, Surah 18:34 / 26:115), which the Quran.com API returns as a single
  // untagged plain-color run -- so it never crosses a run boundary and Step 4 never
  // touches it -- yet has been observed on-device (Tajweed font / Skia Canvas path)
  // rendering with a visible gap between Noon and Alif that does not reproduce in
  // CanvasKit-WASM testing across multiple fonts. This pass makes the Noon->Alif
  // (and other dual-joining-letter -> letter) join explicit even when the two base
  // letters are already adjacent in the same run/string. Verified as a pixel-level
  // no-op (identical connected-component count, <1% ink-pixel delta from ligature
  // width only) for sequences that already render correctly.
  const LEFT_JOINING_ARABIC = new Set([
    'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ',
    'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'ي', 'ـ', 'ئ'
  ]);
  const ARABIC_BASE_CHAR_RE = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/;
  const ARABIC_CLUSTER_RE = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF][\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u08D3-\u08FF]*/g;

  function injectIntraRunZWJ(text: string): string {
    if (!text) return text;
    const matches = Array.from(text.matchAll(ARABIC_CLUSTER_RE));
    if (matches.length < 2) return text;
    let out = '';
    let cursor = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const clusterEnd = (m.index ?? 0) + m[0].length;
      out += text.slice(cursor, clusterEnd);
      cursor = clusterEnd;
      if (i < matches.length - 1) {
        const next = matches[i + 1];
        const nextIndex = next.index ?? clusterEnd;
        const gapText = text.slice(clusterEnd, nextIndex);
        const baseChar = m[0][0];
        const nextBaseChar = next[0][0];
        if (
          gapText.length === 0 &&
          LEFT_JOINING_ARABIC.has(baseChar) &&
          ARABIC_BASE_CHAR_RE.test(nextBaseChar)
        ) {
          out += '\u200D';
        }
      }
    }
    out += text.slice(cursor);
    return out;
  }

  for (let i = 0; i < result.length; i++) {
    if ((result[i] as any).rule === 'qalqalah_waqf') continue;
    if (!result[i].text) continue;
    result[i] = { ...result[i], text: injectIntraRunZWJ(result[i].text) };
  }

  // Step 4: Inject ZWJ (U+200D) between adjacent runs that should connect cursively.
  // Skia's ParagraphBuilder shapes each run independently, which breaks Arabic
  // cursive joining at run boundaries (e.g., Noon+Alif looking like Daaa).
  // We explicitly check that the current run ends with a left-joining Arabic character
  // and only append ZWJ to the current run. Putting ZWJ on both runs forms a double-ZWJ
  // ligature straddling the pushStyle boundary, which causes Skia to collapse/merge
  // adjacent run colors.
  const COMBINING_MARKS_AND_PAUSES = /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u08D3-\u08FF]/g;

  for (let i = 0; i < result.length - 1; i++) {
    const cur = result[i];
    const next = result[i + 1];
    if (!cur.text || !next.text) continue;

    // Must not have whitespace, ZWNJ, or Quranic pause/stop marks at the boundary
    if (/[\s\u00A0\u200B\u200C\u06D6-\u06ED\u06DD]$/.test(cur.text)) continue;
    if (/^[\s\u00A0\u200B\u200C\u06D6-\u06ED\u06DD]/.test(next.text)) continue;

    // Check if current run ends with an explicitly left-joining Arabic character
    const bases = cur.text.replace(COMBINING_MARKS_AND_PAUSES, '');
    if (bases.length === 0) continue;
    const lastChar = bases[bases.length - 1];

    if (!LEFT_JOINING_ARABIC.has(lastChar)) continue;

    // Check if next run starts with an Arabic letter
    const nextBases = next.text.replace(COMBINING_MARKS_AND_PAUSES, '');
    if (nextBases.length === 0) continue;
    const firstNextChar = nextBases[0];
    if (!/[\u0621-\u064A\u0671]/.test(firstNextChar)) continue;

    // Append ZWJ only to cur to open medial/initial connecting form without
    // causing HarfBuzz/Skia to merge run styles across the boundary
    result[i] = { ...cur, text: cur.text + '\u200D' };
  }

  // Step 5: Final safety assertion (dev-only)
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
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

function extractLineHeight(style: StyleProp<TextStyle>): number | null {
  if (!style) return null;

  const styleArray = Array.isArray(style) ? style : [style];
  for (const s of styleArray) {
    if (s && typeof s === 'object' && 'lineHeight' in s && typeof s.lineHeight === 'number') {
      return s.lineHeight;
    }
  }

  return null;
}

function extractFontFamily(style: StyleProp<TextStyle>): string | undefined {
  if (!style) return undefined;
  const styleArray = Array.isArray(style) ? style : [style];
  for (const s of styleArray) {
    if (s && typeof s === 'object' && 'fontFamily' in s && typeof s.fontFamily === 'string') {
      return s.fontFamily;
    }
  }
  return undefined;
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
export function parseMarkup(text: string): ColoredSegment[] {
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
  '\u0653', // Maddah Above — must stay with base letter for shaping
  '\u06E5', // Arabic Small Waw
  '\u06E6', // Arabic Small Yeh
  '\u06E0', // Arabic Small High Upright Rectangular Zero (Silent) - Keeps ligature attached
  '\u06DF', // Arabic Small High Rounded Zero (Silent) - Keeps ligature attached
  '\u06DD', // Arabic End of Ayah - Must stay with digits for framing
]);

function isStructuralCombiningMark(char: string): boolean {
  return STRUCTURAL_COMBINING_MARKS.has(char);
}

// Bug fix (2026-08-31): peels off ONLY a leading run of structural combining
// marks (normally just one character -- e.g. orphaned Maddah U+0653 or Dagger
// Alif U+0670 left outside a tajweed API tag), never the rest of an untagged
// run. Used by both mergeCombiningIntoBase() and sanitizeRunsForSkia() so a
// tajweed color (most visibly Madd orange) never bleeds past its own mark(s)
// into unrelated following text.
function splitLeadingStructuralRun(text: string): { run: string; rest: string } {
  const codepoints = Array.from(text);
  let i = 0;
  while (i < codepoints.length && isStructuralCombiningMark(codepoints[i])) i++;
  return {
    run: codepoints.slice(0, i).join(''),
    rest: codepoints.slice(i).join(''),
  };
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
export function mergeCombiningIntoBase(segments: ColoredSegment[]): ColoredSegment[] {
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
        // Merge only the LEADING RUN of structural marks into the previous
        // segment (keeps base+mark together for shaping). This sacrifices the
        // tajweed color for just those marks -- NOT for any unrelated text
        // that happens to follow them in the same untagged run, which keeps
        // its own color (previously it did, causing the color-bleed bug).
        const { run: structuralRun, rest: afterStructural } = splitLeadingStructuralRun(segRest);
        result[prevIndex] = {
          ...prev,
          text: prev.text + structuralRun,
        };
        if (afterStructural) {
          result.push({ ...seg, text: afterStructural });
        }
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
  // Local utility to convert numbers to Eastern Arabic numerals (٠-٩)
  const _toArabicDigits = (num: number | string): string => {
    return String(num).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
  };

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
  const lineHeight = useMemo(() => extractLineHeight(style), [style]);

  // Skia uses a height multiplier (e.g. 1.5), not pixel line-height
  const heightMultiplier = useMemo(() => {
    if (!lineHeight || !fontSize) return undefined;
    if (lineHeight === fontSize) return 1.0;
    return lineHeight / fontSize;
  }, [lineHeight, fontSize]);

  const fontFamily = useMemo(() => extractFontFamily(style), [style]);

  // Best-practice: preserve raw source text upstream, normalize only for rendering.
  const tajweedFontText = useMemo(() => {
    const key = `${surahNumber ?? 'unknown'}:${verseNumber ?? 'unknown'}`;
    __devLogCarrierPresenceOnce(key, text);
    __devLogInterestingMarksOnce(key, text);
    return normalizeForTajweedFont(text);
  }, [text, surahNumber, verseNumber]);

  // LAYER 1: Parser-level merge (glyph cluster integrity)
  // Ensures combining marks are never standalone segments
  // NOTE: enableStopRules NOT used here - qalqalah applied after sanitization
  const segments = useMemo(() => {
    const parsed = parseText(tajweedFontText, surahNumber, verseNumber, false); // Always false
    return mergeCombiningIntoBase(parsed);
  }, [tajweedFontText, surahNumber, verseNumber]); // Removed enableStopRules

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
      const joinedAfter = withQalqalah.map((s: ColoredSegment) => s.text).join('');
      const joinedBefore = sanitized.map((s: ColoredSegment) => s.text).join('');
      if (joinedAfter !== joinedBefore) {
        console.warn('[Tajweed] Segment text mismatch after qalqalah overlay');
        console.warn('Before:', joinedBefore);
        console.warn('After:', joinedAfter);
      }
    }

    return withQalqalah;
  }, [sanitized, enableStopRules]);

  const paragraphData = useMemo(() => {
    // EXTRA GUARD: Do not attempt to layout or render if width is too small (prevents extreme vertical wrapping)
    if (!fontMgr || !safeSegments.length || !containerWidth || containerWidth < 100) return null;

    const paragraphStyle = {
      textAlign: TextAlign.Right,
      textDirection: TextDirection.RTL,
    };

    const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr);
    let totalTextLength = 0;

    safeSegments.forEach((segment: ColoredSegment, i: number) => {
      builder.pushStyle({
        color: Skia.Color(segment.color),
        fontSize: fontSize,
        fontFamilies: ['QuranicFont', 'sans-serif'],
        heightMultiplier: heightMultiplier, // Apply calculated line-height ratio
      });
      // Fix Android ligature swallowing: isolate U+06DD so it doesn't combine with preceding grapheme
      let textToAdd = segment.text;
      if (Platform.OS === 'android' && textToAdd.includes('\u06DD')) {
        textToAdd = textToAdd.replace('\u06DD', '\u200C\u06DD');
      }
      builder.addText(textToAdd);
      totalTextLength += textToAdd.length;
      builder.pop();
    });

    const p = builder.build();
    // Layout using measured width (supports tablets, landscape, split-screen)
    p.layout(containerWidth);

    // Calculate overlay position for decorative verse numbers (Tajweed mode)
    let overlay = null;
    if (Platform.OS === 'ios' && verseNumber && tajweedFontText.endsWith('\u06DD')) {
      try {
        // Find position of the last character (the glyph ۝)
        const rects = p.getRectsForRange(totalTextLength - 1, totalTextLength);
        if (rects && rects.length > 0) {
          const glyphRect = rects[0];

          // Create small paragraph for digits to handle perfect centering inside frame
          const digits = _toArabicDigits(verseNumber);
          const digitFontSize = digits.length > 2 ? fontSize * 0.35 : fontSize * 0.45;
          const digitCount = digits.length;

          const dBuilder = Skia.ParagraphBuilder.Make({ 
            textAlign: TextAlign.Center,
            maxLines: 1,
          }, fontMgr);

          dBuilder.pushStyle({
            color: Skia.Color('#ffffff'), // Match standard text color
            fontSize: digitFontSize,
            fontFamilies: ['QuranicFont', 'sans-serif'],
          });
          dBuilder.addText(digits);
          const dp = dBuilder.build();
          
          // Android Skia often wraps too early, so we scale width based on digit count
          const layoutWidth = digitFontSize * digitCount * 2.2;
          dp.layout(layoutWidth);

          overlay = {
            para: dp,
            // Re-center the x position after layout width change (true center)
            x: glyphRect.x + (glyphRect.width / 2) - (layoutWidth / 2),
            // Center digits vertically within glyph box
            y: glyphRect.y + (glyphRect.height - dp.getHeight()) / 2,
          };
        }
      } catch (e) {
        if (__DEV__) console.warn('[TajweedText] Suffix overlay calculation failed', e);
      }
    }

    return { paragraph: p, overlay };
  }, [fontMgr, safeSegments, fontSize, containerWidth, verseNumber, tajweedFontText, heightMultiplier]);

  const paragraph = paragraphData?.paragraph;
  const overlay = paragraphData?.overlay;

  // SAFETY GUARD: Cap the absolute maximum height for a single Skia Canvas.
  // Standard GPU texture limit on iOS is 8192. Capping at 3000 for extra safety.
  // Exceptionally long verses (like 2:282) at high font sizes skip Skia to prevent Metal SIGABRT crashes.
  const METAL_HARDWARE_LIMIT = 3000;

  const rawHeight = paragraph ? paragraph.getHeight() : fontSize * 2;
  const isOverLimit = rawHeight > METAL_HARDWARE_LIMIT;

  const height = isOverLimit ? rawHeight : Math.min(rawHeight, METAL_HARDWARE_LIMIT);

  // OPTIMIZATION: Do not render Skia if dimensions are invalid or width is too small
  const canRenderSkia = !isOverLimit && containerWidth && containerWidth >= 100 && height > 0 && !isNaN(height) && paragraph;

  return (
    <View
      style={{
        width: '100%',
        minHeight: fontSize * 2,
        height: isOverLimit ? undefined : height, // Allow standard Text to expand if over limit
        overflow: isOverLimit ? 'visible' : 'hidden'
      }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setContainerWidth(w);
      }}
    >
      {canRenderSkia ? (
        <Canvas
          style={{
            width: containerWidth,
            height: height,
            pointerEvents: 'none'
          }}
        >
          {paragraph && <Paragraph paragraph={paragraph} x={0} y={0} width={containerWidth} />}
          {overlay && <Paragraph paragraph={overlay.para} x={overlay.x} y={overlay.y} width={overlay.para.getMaxWidth()} />}
        </Canvas>
      ) : isOverLimit ? (
        /* FALLBACK: Use standard React Native Text for massive verses to prevent Metal crash */
        <View style={{ width: '100%', paddingHorizontal: 4 }}>
          <RNText
            style={[
              style as any,
              {
                textAlign: 'right',
                writingDirection: 'rtl',
                lineHeight: lineHeight || Math.round(fontSize * 1.5)
              }
            ]}
          >
            {safeSegments.map((seg: ColoredSegment, i: number) => {
              // Handle decorative ending in fallback mode
              if (i === safeSegments.length - 1 && seg.text.endsWith('\u06DD') && verseNumber) {
                const baseText = seg.text.slice(0, -1);
                const digits = _toArabicDigits(verseNumber);
                const digitFontSize = digits.length > 2 ? fontSize * 0.35 : fontSize * 0.42;

                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                    <RNText style={{ color: seg.color }}>
                      {baseText}
                    </RNText>
                    <View style={{
                      width: fontSize * 1.1,
                      height: fontSize,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: -fontSize * 0.15
                    }}>
                      <RNText style={{
                        fontSize: digitFontSize,
                        fontWeight: 'bold',
                        color: seg.color,
                        textAlign: 'center',
                        marginTop: fontSize * 0.05
                      }}>
                        {digits}
                      </RNText>
                    </View>
                  </View>
                );
              }
              return (
                <RNText key={i} style={{ color: seg.color }}>{seg.text}</RNText>
              );
            })}
          </RNText>
        </View>
      ) : (
        // Initial measurement placeholder
        <View style={{ width: '100%', height: fontSize * 2 }} />
      )}
    </View>
  );
};

export default TajweedText;
