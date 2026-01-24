/**
 * Parse Quran Foundation API tajweed HTML into colored segments
 * 
 * ARCHITECTURE: Three-pass parsing pipeline
 * =========================================
 * 
 * Pass 1: API Tags (Quran.com rules)
 * - Ham Wasl, Lam Shamsiyyah, Madd, Silent letters
 * - Encoded in text via <tajweed> HTML tags
 * - Always valid during wasl (continuous recitation)
 * - High accuracy, scholarly correct
 * 
 * Pass 2: Algorithmic Wasl-Safe Rules
 * - Ghunnah, Ikhfa, Idgham, Iqlab
 * - Valid during continuous recitation
 * - NOT dependent on stop positions
 * - Fills gaps where API doesn't provide tags
 * 
 * Pass 3: Stop Rules (Optional - Waqf-dependent)
 * - Qalqalah at word/verse ends
 * - Only valid at stop positions (waqf)
 * - MUST be optional and reversible
 * - Controlled by user setting (Mushaf mode)
 * 
 * CRITICAL PRINCIPLE:
 * - Qalqalah is recitation-state dependent
 * - During wasl (continuous): NO qalqalah coloring
 * - During waqf (stopping): YES qalqalah coloring
 * - This matches scholarly teaching and real Mushaf apps
 * 
 * @see https://api.quran.com/api/v4/verses/by_chapter/{chapter}?fields=text_uthmani_tajweed
 */

import { TajweedParser } from './tajweedParser'; // Existing algorithmic parser

export interface TajweedSegment {
  text: string;
  color: string;
  tajweedClass: string | null;
  source: 'api' | 'algorithmic'; // Track where this came from
}

export interface TajweedOptions {
  enableAlgorithmic?: boolean;  // Apply wasl-safe rules (Ghunnah, Ikhfa, Idgham, Iqlab)
  enableStopRules?: boolean;    // Apply waqf-dependent rules (Qalqalah at stops)
}

// API-tagged rules (what Quran.com provides)
const API_TAGGED_RULES = new Set([
  'ham_wasl',
  'hamza_wasl',
  'hamzat_wasl',
  'laam_shamsiyah',
  'lam_shamsiyah',
  'laam_shamsiyyah',
  'lam_shamsiyyah',
  'madda_normal',
  'madda_permissible',
  'madda_necessary',
  'madda_obligatory',
  'madda_246',
  'madda_6',
  'madda_24',
  'slnt',
  'silent',
]);

// Wasl-safe rules (valid during continuous recitation)
const WASL_SAFE_RULES = new Set([
  'ghunnah',
  'ghunna',
  'ghn',
  'ikhfa',
  'ikhafa',
  'ikhf',
  'idgham',
  'idghaam',
  'idgham_w_ghunnah',
  'idgham_wo_ghunnah',
  'iqlab',
  'iqlb',
  'ikhfa_shafawi',
  'idgham_shafawi',
]);

// Waqf-dependent rules (only valid at stops)
const STOP_RULES = new Set([
  'qalqalah',
  'qalqala',
  'qlq',
  'qalqalah_waqf',
]);

// Standard Mushaf colors (matching Quran.com color guide)
const TAJWEED_COLORS: Record<string, string> = {
  // Silent Letters - Gray
  ham_wasl: '#AAAAAA',
  hamza_wasl: '#AAAAAA',
  hamzat_wasl: '#AAAAAA',
  laam_shamsiyah: '#AAAAAA',
  lam_shamsiyah: '#AAAAAA',
  laam_shamsiyyah: '#AAAAAA',
  lam_shamsiyyah: '#AAAAAA',
  slnt: '#AAAAAA',
  silent: '#AAAAAA',

  // Madd Rules - Orange (fixed from blue to match guide)
  madda_normal: '#FF9632',         // Orange - 2 beats
  madda_permissible: '#FF9632',    // Orange - 2-6 beats
  madda_necessary: '#FF9632',      // Orange - 6 beats
  madda_obligatory: '#FF9632',     // Orange - 4-5 beats
  madda_246: '#FF9632',
  madda_6: '#FF9632',
  madda_24: '#FF9632',

  // Qalqalah - Red
  qalqalah: '#DD0008',
  qalqala: '#DD0008',
  qalaqah: '#DD0008',
  qlq: '#DD0008',

  // Ghunnah & Nasal - Yellow (fixed from orange to match guide)
  ghunnah: '#FFD700',              // Yellow (not orange!)
  ghunna: '#FFD700',
  ghn: '#FFD700',

  // Ikhfa - Pink
  ikhfa: '#FFB6C1',                // Pink
  ikhafa: '#FFB6C1',
  ikhfa_shaddah: '#FFB6C1',
  ikhafa_shaddah: '#FFB6C1',
  ikhf: '#FFB6C1',

  // Idgham - Green
  idgham_wo_ghunnah: '#00C853',    // Green
  idgham_wo_ghunna: '#00C853',
  idgham_w_ghunnah: '#00C853',     // Green
  idgham_w_ghunna: '#00C853',
  idgham_ghunnah: '#00C853',
  idgham_ghunna: '#00C853',
  idgham_wo_shaddah: '#00C853',
  idgham_shaddah: '#00C853',
  idgham_mutajanisayn: '#00C853',
  idgham_mutaqaribayn: '#00C853',
  idgham: '#00C853',               // Generic idgham
  idghaam: '#00C853',
  idgh_ghn: '#00C853',
  idgh_w_ghn: '#00C853',
  idgh_mus: '#00C853',

  // Meem Sakinah - Purple/Light Green
  ikhfa_shafawi: '#DDA0DD',        // Purple
  ikhafa_shafawi: '#DDA0DD',
  ikhf_shfw: '#DDA0DD',
  idgham_shafawi: '#96CEB4',       // Light Green
  idghaam_shafawi: '#96CEB4',
  idghm_shfw: '#96CEB4',

  // Iqlab - Blue
  iqlab: '#007AFF',
  iqlb: '#007AFF',
};

/**
 * STEP 1: Parse API HTML tags (Ham Wasl, Lam Shamsiyyah, Madd, Silent)
 */
function parseAPITags(html: string): TajweedSegment[] {
  if (!html) return [{ text: '', color: '#FFFFFF', tajweedClass: null, source: 'api' }];

  // Validate: Check for nested tags (defensive programming)
  const nestedTagRegex = /<tajweed[^>]*>(?:[^<]*<tajweed)/i;
  if (nestedTagRegex.test(html)) {
    if (__DEV__) {
      console.warn('[QuranTajweedParser] Nested <tajweed> tags detected - stripping all tags');
    }
    return [{ text: cleanText(html), color: '#FFFFFF', tajweedClass: null, source: 'api' }];
  }

  const segments: TajweedSegment[] = [];

  // Regex to match: <tajweed class="rule_name">text</tajweed>
  // Regex to match: <tajweed class="rule_name">text</tajweed>
  // UPDATED: supports unquoted attributes too (common in API responses)
  const tajweedRegex = /<tajweed\s+class\s*=\s*["']?([^"'\s>]+)["']?\s*>([\s\S]*?)<\/tajweed>/gi;

  let lastIndex = 0;
  const matches = Array.from(html.matchAll(tajweedRegex));

  for (const match of matches) {
    const matchStart = match.index!;
    const matchEnd = matchStart + match[0].length;

    // Add plain text before this tajweed tag
    if (matchStart > lastIndex) {
      const plainText = html.substring(lastIndex, matchStart);
      const cleaned = cleanText(plainText);
      if (cleaned) {
        segments.push({
          text: cleaned,
          color: '#FFFFFF',
          tajweedClass: null,
          source: 'api',
        });
      }
    }

    // Add the tajweed segment from API
    const tajweedClass = match[1].toLowerCase();
    const text = cleanText(match[2]);
    const color = TAJWEED_COLORS[tajweedClass] || '#FFFFFF';

    if (text) {
      segments.push({
        text,
        color,
        tajweedClass,
        source: 'api',
      });
    }

    lastIndex = matchEnd;
  }

  // Add remaining text after last tag
  if (lastIndex < html.length) {
    const remaining = html.substring(lastIndex);
    const cleaned = cleanText(remaining);
    if (cleaned) {
      segments.push({
        text: cleaned,
        color: '#FFFFFF',
        tajweedClass: null,
        source: 'api',
      });
    }
  }

  // If no segments were found, return the entire text as plain
  if (segments.length === 0 && html) {
    return [{ text: cleanText(html) || html, color: '#FFFFFF', tajweedClass: null, source: 'api' }];
  }

  return segments;
}

/**
 * STEP 2: Apply algorithmic detection for wasl-safe rules
 * Detects: Ghunnah, Ikhfa, Idgham, Iqlab (NOT Qalqalah - that's waqf-only)
 */
function applyAlgorithmicRules(segments: TajweedSegment[]): TajweedSegment[] {
  const enhanced: TajweedSegment[] = [];

  for (const segment of segments) {
    // Skip segments that already have API tajweed tags
    if (segment.tajweedClass && API_TAGGED_RULES.has(segment.tajweedClass)) {
      enhanced.push(segment);
      continue;
    }

    // Apply algorithmic detection to plain text segments
    const algorithmicSegments = TajweedParser.parse(segment.text);

    for (const algSeg of algorithmicSegments) {
      // Check if algorithmic parser found a WASL-SAFE rule
      const rule = algSeg.rule?.toLowerCase();
      const isWaslSafeRule = rule && (
        rule.includes('ghunnah') ||
        rule.includes('ghunna') ||
        rule.includes('ikhfa') ||
        rule.includes('ikhafa') ||
        rule.includes('idgham') ||
        rule.includes('idghaam') ||
        rule.includes('iqlab')
      );

      // IMPORTANT: Exclude qalqalah from this pass
      const isQalqalah = rule && (
        rule.includes('qalqalah') ||
        rule.includes('qalqala')
      );

      if (isWaslSafeRule && !isQalqalah) {
        enhanced.push({
          text: algSeg.text,
          color: algSeg.color,
          tajweedClass: rule,
          source: 'algorithmic',
        });
      } else {
        // No wasl-safe rule detected, keep as plain text
        enhanced.push({
          text: algSeg.text,
          color: segment.color, // Preserve original color
          tajweedClass: segment.tajweedClass,
          source: segment.source,
        });
      }
    }
  }

  return enhanced;
}

/**
 * STEP 3: Apply stop rules (waqf-dependent)
 * Only colors qalqalah at word/verse ends (NOT during wasl)
 * 
 * CRITICAL: MUST be applied AFTER sanitization to prevent segment merging from destroying colors
 * 
 * Why inline detection failed:
 * 1. Text doesn't contain sukoon markers at word ends (أَحَدٌ has tanween, not sukoon)
 * 2. Segment merging erases qalqalah before rendering
 * 3. API segments skip algorithmic detection entirely
 * 
 * Solution: Final pass that splits segments to color only the qalqalah letter
 * Example: "أَحَدٌ" → [{ text: "أَحَ", color: white }, { text: "دٌ", color: red }]
 * 
 * REGEX FIX: Include ALL Uthmani marks (tanween, sukoon, madd alif, stop symbols)
 * BOUNDARY FIX: Check for NBSP, zero-width chars, and Quranic stop signs
 * 
 * EXPORTED for use in TajweedText.tsx after sanitization
 */
export function applyStopRules(segments: TajweedSegment[]): TajweedSegment[] {
  return segments.flatMap((seg, index) => {
    if (!seg.text) return [seg];

    // Match: (prefix)(qalqalah_letter)(ALL_QURANIC_MARKS)
    // Includes: tanween, sukoon, madd alif (0670), stop symbols (06D6-06ED)
    // Example: "أَحَدٌ" → ["أَحَ", "د", "ٌ"]
    const match = seg.text.match(
      /^(.*?)([قطبجد])([\u064B-\u0652\u06D6-\u06ED\u0670]*)/
    );

    // No qalqalah letter at end → return unchanged
    if (!match) return [seg];

    const [, before, letter, marks] = match;

    // Check if this is at a stop position (word/verse end)
    // Must check for: space, NBSP, zero-width chars, Quranic stop symbols
    const isEnd =
      index === segments.length - 1 ||
      /^[\s\u00A0\u200B\u200C\u06D6-\u06ED]/.test(
        segments[index + 1].text
      );

    // Not at stop → return unchanged (qalqalah only at waqf)
    if (!isEnd) return [seg];

    // Split segment: white prefix + red qalqalah
    const result: TajweedSegment[] = [];

    if (before) {
      result.push({
        text: before,
        color: seg.color,
        tajweedClass: seg.tajweedClass,
        source: seg.source,
      });
    }

    result.push({
      text: letter + marks,
      color: TAJWEED_COLORS.qalqalah,
      tajweedClass: 'qalqalah_waqf',
      source: 'algorithmic',
    });

    return result;
  });
}

/**
 * MAIN PARSER: Combines API tags + Algorithmic detection + Optional stop rules
 * Input: `قَالُوٓاْ <tajweed class="madda_obligatory">ءَامَنَّا</tajweed> بِهِۦٓ`
 * Output: [
 *   { text: 'قَالُوٓاْ ', color: '#FFFFFF', tajweedClass: null, source: 'api' },
 *   { text: 'ءَامَنَّا', color: '#FF9632', tajweedClass: 'madda_obligatory', source: 'api' },
 *   { text: ' بِهِۦٓ', color: '#FFFFFF', tajweedClass: null, source: 'api' }
 * ]
 * 
 * Pipeline:
 * 1. API tags (Quran.com rules - always valid during wasl)
 * 2. Algorithmic wasl-safe rules (Ghunnah, Ikhfa, Idgham, Iqlab)
 * 3. Optional stop rules (Qalqalah at waqf - only if enableStopRules=true)
 */
export function parseTajweedHTML(
  html: string,
  options: TajweedOptions = {}
): TajweedSegment[] {
  const {
    enableAlgorithmic = true,
    enableStopRules = false,
  } = options;

  if (!html) return [{ text: '', color: '#FFFFFF', tajweedClass: null, source: 'api' }];

  // Step 1: Parse API tags (Ham Wasl, Lam Shamsiyyah, Madd, Silent)
  let segments = parseAPITags(html);

  // Step 2: Apply algorithmic detection for wasl-safe rules (Ghunnah, Ikhfa, etc.)
  if (enableAlgorithmic) {
    segments = applyAlgorithmicRules(segments);
  }

  // NOTE: Stop rules (qalqalah) are applied AFTER sanitization in TajweedText.tsx
  // to prevent segment merging from destroying red coloring

  return segments;
}

/**
 * Clean text - remove HTML entities and extra tags
 */
function cleanText(text: string): string {
  if (!text) return '';

  // Preserve verse endings: <span class=end>١</span> -> ۝
  // We use the glyph (U+06DD) as a logical marker. 
  // The TajweedText component will manually overlay the correct verse number 
  // inside this glyph to ensure perfect centering and alignment.
  const withEndings = text.replace(
    /<span\s+class\s*=\s*["']?end["']?\s*>\s*([0-9\u0660-\u0669]+)\s*<\/span>/gi,
    '\u06DD'
  );

  return withEndings
    .replace(/<[^>]+>/g, '') // Remove any HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Debug helper - Shows hybrid parsing results
 */
export function debugTajweedParsing(
  html: string,
  options: TajweedOptions = {}
): void {
  if (!__DEV__) return; // Skip debug output in production

  const {
    enableAlgorithmic = true,
    enableStopRules = false,
  } = options;

  console.log('\n=== HYBRID TAJWEED PARSING DEBUG ===');
  console.log('Input HTML (first 150 chars):', html.substring(0, 150));
  console.log('Algorithmic detection:', enableAlgorithmic ? 'ENABLED' : 'DISABLED');
  console.log('Stop rules (Qalqalah):', enableStopRules ? 'ENABLED ⭐' : 'DISABLED');

  const segments = parseTajweedHTML(html, options);
  console.log(`\nParsed ${segments.length} segments:`);

  const apiCount = segments.filter(s => s.source === 'api' && s.tajweedClass).length;
  const algoCount = segments.filter(s => s.source === 'algorithmic' && s.tajweedClass).length;
  const qalqalahCount = segments.filter(s => s.tajweedClass?.includes('qalqalah')).length;

  console.log(`  - API tags: ${apiCount}`);
  console.log(`  - Algorithmic (wasl-safe): ${algoCount - qalqalahCount}`);
  console.log(`  - Stop rules (Qalqalah): ${qalqalahCount}`);

  segments.forEach((seg, i) => {
    if (seg.tajweedClass) {
      const preview = seg.text.length > 20 ? seg.text.substring(0, 20) + '...' : seg.text;
      const colorName = Object.entries(TAJWEED_COLORS).find(([_, c]) => c === seg.color)?.[0] || 'default';
      console.log(`  [${i}] "${preview}" → ${seg.color} (${seg.tajweedClass}) [${seg.source}] [${colorName}]`);
    }
  });

  // Show Qalqalah specifically (critical for user's requirement!)
  const qalqalahSegments = segments.filter(s => s.tajweedClass?.includes('qalqalah') || s.tajweedClass?.includes('qalqala'));
  if (qalqalahSegments.length > 0) {
    console.log(`\n✅ Found ${qalqalahSegments.length} Qalqalah segments (RED):`);
    qalqalahSegments.forEach(seg => {
      console.log(`  - "${seg.text}" (${seg.source})`);
    });
  } else {
    console.log('\n⚠️ No Qalqalah segments found');
  }

  // Show color usage stats
  const colorCounts = segments.reduce((acc, seg) => {
    if (seg.tajweedClass) {
      acc[seg.tajweedClass] = (acc[seg.tajweedClass] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  if (Object.keys(colorCounts).length > 0) {
    console.log('\nTajweed rule usage:');
    Object.entries(colorCounts).forEach(([rule, count]) => {
      const source = segments.find(s => s.tajweedClass === rule)?.source || 'unknown';
      console.log(`  ${rule}: ${count}x [${source}]`);
    });
  }

  console.log('=====================================\n');
}

/**
 * Check if text contains tajweed HTML tags
 */
export function hasTajweedHTML(text: string): boolean {
  return text.includes('<tajweed');
}
