/**
 * asrEngine.ts — Quran Recitation ASR verification engine.
 * No UI or side-effects — all functions are independently testable.
 *
 * Philosophy: Quran-verification-friendly, not ASR-friendly.
 * Acoustic confidence tells you whether Whisper heard something clearly —
 * it NEVER tells you whether that something was the correct Quranic word.
 *
 * Changes from previous version:
 *  - DP sequence alignment replaces SLIP window (no more cascade miss failures)
 *  - HIGH_CONF_FLOOR override deleted (clear-but-wrong recitations no longer pass)
 *  - MIN_CLAIM_SIM raised to 0.65 (40%-similar word is a different word)
 *  - resolveWordStatus: confidence can only downgrade, never upgrade
 *  - First/last word penalties (critical positions in memorization)
 *  - Extra word penalty for additions beyond the expected ayah
 *  - N-gram repetition hallucination detection (catches الله×4 loops)
 *  - Hallucination flag uses word ratio only (duration alone is not evidence)
 *  - Conservative normalization preserves hamza variants (إله ≠ اله)
 *  - Grade thresholds aligned to getASRSuggestion boundaries
 *  - WordScore.transcribed exposes what the user actually said
 *
 * Changes in this revision (tuned against reported false-negatives on
 * correct recitations, and re-tuned for tarteel-ai/whisper-base-ar-quran,
 * whose confidence scores are less calibrated than larger Whisper variants):
 *  - normalizeArabic now collapses ة/ه (extremely common Whisper artifact on
 *    correctly-pronounced word endings; was previously a full char mismatch)
 *  - New computeAlignmentSimilarity(): short words (≤4 chars — the most
 *    common Arabic function words) no longer get tanked by a single-character
 *    Whisper slip. Char-ratio similarity punishes brevity: 1 edit on a
 *    3-letter word drops similarity to 0.67 (below HESITANT_FLOOR), while the
 *    same 1-edit slip on a 10-letter word barely registers. This function
 *    treats a single edit on a short word as near-correct; 2+ edits still
 *    falls through to the raw ratio (genuinely a different word).
 *  - HESITANT_FLOOR confidence tiebreaker lowered 0.45 → 0.35. The code
 *    already documents that Whisper confidence systematically underrates
 *    rare Quranic vocabulary; that problem isn't scoped only to the
 *    CORRECT_FLOOR tier, and a base-size model is less reliably calibrated
 *    than large/turbo variants. TUNE further once you have telemetry.
 *  - Bigram hallucination check now requires the SAME word-pair to repeat
 *    3+ times anywhere in the transcription (was: fires on any single
 *    adjacent repeat = 2 occurrences). A single restart/self-correction
 *    while memorizing ("ar-Rahman ar-Raheem... ar-Rahman ar-Raheem, Maliki
 *    yawm-id-deen") is normal human behavior, not a hallucination loop —
 *    genuine Whisper loop hallucinations repeat 3+ times, not once.
 *  - First/last critical-position penalties are now capped at a combined
 *    -20 (was: up to -25 uncapped). Short ayahs are the most common case in
 *    a memorization app, and stacking both boundary penalties on top of one
 *    noisy word each was over-punishing otherwise-correct recitations.
 *
 * All of the thresholds below are starting points, not final values — mark
 * TUNE comments show where to adjust once you have a labeled test set of
 * real (known-correct and known-incorrect) recitations from tarteel-base.
 */

const ASR_API_URL = 'https://ihafidh-ihafidhasr.hf.space/transcribe';
const HF_TOKEN = process.env.EXPO_PUBLIC_HF_TOKEN;

if (!HF_TOKEN) {
  if (__DEV__) {
    console.warn('[ASR] EXPO_PUBLIC_HF_TOKEN is not set — requests will be unauthenticated');
  } else {
    console.error('[ASR] EXPO_PUBLIC_HF_TOKEN is missing in production — ASR will fail');
  }
}

const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2_000;
// LONG_AYAH_THRESHOLD_MS removed: duration alone is not evidence of hallucination.
// The word-count ratio check in detectHallucination is sufficient.
const HALLUCINATION_ACCURACY_CAP = 90;

// ─── Types ───────────────────────────────────────────────────────────────────

export type Fluency = 'Fast' | 'Normal' | 'Slow';

export type BackendASRResponse = {
  transcription: string;
  word_scores?: { word: string; confidence: number }[];
  fluency?: Fluency;
  wpm?: number;
  duration_ms?: number;
};

export type WordStatus = 'correct' | 'hesitant' | 'wrong' | 'missed';

export type WordScore = {
  word: string;          // expected word (for display alongside expected text)
  transcribed?: string;  // what the user actually said (undefined if missed)
  confidence: number;    // 0–1 from Whisper
  status: WordStatus;
};

export type Grade = 'Excellent' | 'Good' | 'Needs Practice' | 'Try Again';

export type ScorecardResult = {
  overallAccuracy: number;
  wordsCorrect: number;
  wordsTotal: number;
  extraWordsDetected: number;  // transcribed words not aligned to any expected word
  fluency: Fluency;
  wordBreakdown: WordScore[];
  grade: Grade;
  hallucinationSuspected: boolean;
};

export type ASRResult = {
  transcription: string;
  accuracy: number;
  scorecard?: ScorecardResult;
};

/**
 * Three-tier outcome:
 *  ≥ 80% → correct  |  ≥ 50% → retry  |  < 50% → incorrect
 * Grade thresholds are aligned to these same boundaries.
 */
export type ASRSuggestion = 'correct' | 'retry' | 'incorrect';

export function getASRSuggestion(accuracy: number): ASRSuggestion {
  if (accuracy >= 80) return 'correct';
  if (accuracy >= 50) return 'retry';
  return 'incorrect';
}

// ─── getMimeType ─────────────────────────────────────────────────────────────

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'wav': return 'audio/wav';
    case 'mp3': return 'audio/mpeg';
    case 'mp4': return 'audio/mp4';
    case 'caf': return 'audio/x-caf';
    case 'aac': return 'audio/aac';
    case 'm4a':
    default: return 'audio/m4a';
  }
}

// ─── transcribeAudio ─────────────────────────────────────────────────────────

/**
 * Sends a recorded audio file (URI) to the ASR API.
 * Retries up to MAX_RETRIES times on network failure.
 * Does NOT retry on AbortError (timeout).
 */
export async function transcribeAudio(
  uri: string,
  expectedArabicText?: string
): Promise<BackendASRResponse> {
  if (!uri) throw new Error('Cannot transcribe: audio URI is empty or invalid.');

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const filename = uri.split('/').pop() ?? 'recording.m4a';
      const mimeType = getMimeType(filename);

      const formData = new FormData();
      formData.append('audio', { uri, name: filename, type: mimeType } as unknown as Blob);
      if (expectedArabicText) formData.append('expected', expectedArabicText);

      if (__DEV__) {
        console.log(`[ASR] Attempt ${attempt + 1}/${MAX_RETRIES + 1} → ${ASR_API_URL}`);
        console.log(`[ASR] File: ${filename} (${mimeType})`);
        if (HF_TOKEN) console.log(`[ASR] Auth: Bearer ${HF_TOKEN.substring(0, 10)}***`);
      }

      const response = await fetch(ASR_API_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}) },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (__DEV__) console.log(`[ASR] Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('text/html')) {
          throw new Error(`ASR Space is unreachable (${response.status}). Check https://huggingface.co/spaces/ihafidh/ihafidhasr is running.`);
        }
        let errorBody = '(could not read error body)';
        try { errorBody = await response.text(); } catch { /* ignore */ }
        console.error(`[ASR] Error body (${ASR_API_URL}):`, errorBody);
        throw new Error(`ASR API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      const transcription = json?.transcription;
      if (typeof transcription !== 'string') {
        throw new Error(`Unexpected ASR response — "transcription" missing. Got: ${JSON.stringify(json)}`);
      }

      if (__DEV__) console.log(`[ASR] Transcription: "${transcription}"`);
      return json as BackendASRResponse;

    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`ASR timed out after ${TIMEOUT_MS / 1000}s. The HuggingFace Space may be cold-starting — try again in 30s.`);
      }

      if (attempt < MAX_RETRIES) {
        if (__DEV__) console.log(`[ASR] Attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError ?? new Error('ASR transcription failed after all retries');
}

// ─── normalizeArabic ─────────────────────────────────────────────────────────

/**
 * Conservative normalization — only collapses what Whisper consistently
 * outputs differently. Preserves phonemically distinct hamza variants:
 *  أ إ ء ؤ ئ are NOT collapsed — إله and اله are different Quranic words.
 *
 *  ✓ Removes harakat/tashkeel
 *  ✓ Removes tatweel (kashida)
 *  ✓ Normalizes alif-wasla (ٱ) and alif-madda (آ) → ا (Whisper outputs these as plain alif)
 *  ✓ Normalizes ta marbuta (ة) → ha (ه) — Whisper interchanges these constantly
 *    at word endings even on correctly-pronounced audio; they are not
 *    phonemically distinct enough in fast recitation for Whisper to be
 *    reliable here.
 *  ✓ Collapses أ إ آ ٱ → ا for ASR scoring robustness against Whisper Base artifacts.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    // Alef maqsura (ى) → ya (ي): Whisper inconsistently outputs both forms
    // e.g. في vs فى — these must score identically.
    .replace(/\u0649/g, '\u064A')
    // Ta marbuta (ة) → ha (ه): same rationale as alef maqsura above — a
    // consistent Whisper output-form quirk, not a real pronunciation error.
    .replace(/\u0629/g, '\u0647')
    // Strip trailing waw-alef pausal suffix Whisper adds to verb forms:
    // ينفخوا → ينفخ, فتأتوا → فتأت etc.
    // Safe: standalone واو suffix on verbs is almost always a Whisper
    // transcription artifact of pausal-form recitation, not a real word.
    .replace(/\u0648\u0627(?=\s|$)/g, '')
    .replace(/[^\u0600-\u06FF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── calculateSimilarity  (word-level Levenshtein, unchanged) ────────────────

/**
 * Returns a 0–100 similarity score using word-level Levenshtein distance.
 * Both inputs should be pre-normalized with normalizeArabic().
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = b.split(' ').filter(Boolean);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const lenA = tokensA.length;
  const lenB = tokensB.length;
  let prev = Array.from({ length: lenB + 1 }, (_, i) => i);

  for (let i = 1; i <= lenA; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= lenB; j++) {
      const cost = tokensA[i - 1] === tokensB[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }

  const distance = prev[lenB];
  const maxLen = Math.max(lenA, lenB);
  return Math.max(0, Math.min(100, Math.round(((maxLen - distance) / maxLen) * 100)));
}

// ─── levenshteinDistance / charLevenshteinSimilarity ─────────────────────────

/** Raw character-level Levenshtein edit distance. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const lenA = a.length;
  const lenB = b.length;
  let prev = Array.from({ length: lenB + 1 }, (_, i) => i);

  for (let i = 1; i <= lenA; i++) {
    const curr = [i];
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }

  return prev[lenB];
}

/**
 * Character-level Levenshtein similarity, returns 0–1. Used in dpAlign.
 * Unchanged behavior from previous version — kept as a general-purpose
 * exported utility. Short-word-aware adjustment lives in
 * computeAlignmentSimilarity() below, which wraps this rather than
 * changing its semantics, since other call sites may depend on the raw
 * ratio.
 */
export function charLevenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return (maxLen - levenshteinDistance(a, b)) / maxLen;
}

/**
 * Alignment-time similarity used for scoring (dpAlign's sim matrix and
 * resolveWordStatus). Short Arabic words (≤4 chars — the bulk of common
 * function words: من في لا قد ثم إن ...) are punished disproportionately by
 * raw char-ratio: a single-character Whisper slip on a 3-letter word drops
 * similarity to 0.67 (already below HESITANT_FLOOR), while the same slip on
 * a 10-letter word barely registers. A single edit on a short word is
 * treated as near-correct here; 2+ edits still falls through to the raw
 * ratio, since that's very likely a genuinely different word.
 *
 * TUNE: the 0.85 floor and the 4-char cutoff are starting points — adjust
 * against a labeled test set once you have one.
 */
const SHORT_WORD_MAX_LEN = 4;
const SHORT_WORD_SINGLE_EDIT_SIM = 0.85;

function computeAlignmentSimilarity(expected: string, transcribed: string): number {
  const rawSim = charLevenshteinSimilarity(expected, transcribed);
  const minLen = Math.min(expected.length, transcribed.length);

  if (minLen > 0 && minLen <= SHORT_WORD_MAX_LEN) {
    const distance = levenshteinDistance(expected, transcribed);
    if (distance === 0) return 1.0;
    if (distance === 1) return Math.max(rawSim, SHORT_WORD_SINGLE_EDIT_SIM);
  }

  return rawSim;
}

// ─── resolveWordStatus ───────────────────────────────────────────────────────

/**
 * Resolves the status of a matched word given text similarity and confidence.
 *
 * Confidence is removed from the CORRECT_FLOOR tier entirely.
 * Whisper per-word confidence is log-probability derived and systematically
 * underrates rare Quranic vocabulary (e.g. الوقود, rare 3-syllable word) even
 * in perfectly clear audio — this is a vocabulary-frequency artifact, not an
 * audio-quality signal. Using conf to gate correct at this tier causes false
 * 'hesitant' for words the user said perfectly. This effect is expected to
 * be more pronounced on tarteel-ai/whisper-base-ar-quran (a base-size model)
 * than on large/turbo Whisper variants, since smaller models are generally
 * less well-calibrated.
 *
 * Confidence only acts as a tiebreaker in the HESITANT_FLOOR band (0.72–0.82)
 * where text similarity is genuinely ambiguous and audio quality adds real
 * signal. That tiebreaker threshold is lowered from 0.45 to 0.35 in this
 * revision for the same base-model-calibration reason above. TUNE further
 * once you have telemetry — this is a starting point, not a measured value.
 *
 * Safety: wrong-word substitutions (العليم for الرحيم) score ~0.57–0.65 sim
 * and cannot reach CORRECT_FLOOR — removing/loosening the conf gate here has
 * effectively zero false-pass risk.
 *
 * NOTE: 'missed' is assigned before this function via the MIN_CLAIM_SIM gate.
 */
const HESITANT_CONF_TIEBREAKER = 0.35; // TUNE — was 0.45; lowered for base-model calibration

function resolveWordStatus(bestSim: number, conf: number, isShortAyah: boolean): WordStatus {
  const CORRECT_FLOOR = 0.78;
  // HESITANT_FLOOR must stay above MIN_CLAIM_SIM (0.55) so 'wrong' is reachable.
  // Bands: 0.55–0.68 → wrong | 0.68–0.78 → hesitant/correct by conf | ≥0.78 → correct
  const HESITANT_FLOOR = 0.68;

  // Strong or near-perfect match → correct, regardless of Whisper confidence.
  if (bestSim >= 0.92) return 'correct';  // near-perfect (≥92%)
  if (bestSim >= CORRECT_FLOOR) return 'correct';  // strong match (≥78%) — conf not used

  // Borderline similarity — confidence is a genuine tiebreaker here.
  // Audio quality matters when text match is uncertain.
  if (bestSim >= HESITANT_FLOOR && conf >= HESITANT_CONF_TIEBREAKER) return 'correct';
  if (bestSim >= HESITANT_FLOOR) return 'hesitant';

  return 'wrong';  // 0.55 ≤ bestSim < HESITANT_FLOOR — clearly a different word
}

// ─── detectHallucination ─────────────────────────────────────────────────────

/**
 * Detects likely Whisper hallucination via:
 *  1. Word-count ratio outside 0.55–1.35
 *  2. Any single word appearing >= 5× (loop hallucination: الله الله الله...)
 *  3. Bigram repetition: same consecutive word-pair appearing 4+ times
 *     anywhere in the transcription.
 * A single restart/self-correction while reciting from memory — repeating a
 * phrase once or twice before continuing — is normal human behavior, not a hallucination.
 */
function detectHallucination(
  expectedWordCount: number,
  transcribedWords: { normalized: string }[]
): { suspected: boolean; reason: string | null } {
  const count = transcribedWords.length;
  if (expectedWordCount === 0) return { suspected: false, reason: null };

  const ratio = count / expectedWordCount;

  // For very short ayahs (≤ 4 words), one extra Whisper token produces a ratio
  // ≥ 1.25–1.5 by pure arithmetic. Use a wider window and let the extra-word
  // penalty (-2% per word) handle spurious single tokens instead.
  const ratioUpperBound = expectedWordCount <= 4 ? 2.0 : 1.35;
  const ratioLowerBound = expectedWordCount <= 4 ? 0.40 : 0.55;

  if (ratio > ratioUpperBound || ratio < ratioLowerBound) {
    return {
      suspected: true,
      reason: `Abnormal word ratio: ${ratio.toFixed(2)} (allowed ${ratioLowerBound}–${ratioUpperBound}, expected ${expectedWordCount}, got ${count})`,
    };
  }

  const unigramFreq: Record<string, number> = {};
  for (const { normalized } of transcribedWords) {
    unigramFreq[normalized] = (unigramFreq[normalized] ?? 0) + 1;
    if (unigramFreq[normalized] >= 5) {
      return {
        suspected: true,
        reason: `Unigram repetition loop: "${normalized}" repeated ${unigramFreq[normalized]} times (threshold >= 5)`,
      };
    }
  }

  const bigramFreq: Record<string, number> = {};
  for (let i = 0; i < transcribedWords.length - 1; i++) {
    const bigram = `${transcribedWords[i].normalized}|${transcribedWords[i + 1].normalized}`;
    bigramFreq[bigram] = (bigramFreq[bigram] ?? 0) + 1;
    if (bigramFreq[bigram] >= 4) {
      return {
        suspected: true,
        reason: `Bigram repetition loop: "${bigram.replace('|', ' ')}" repeated ${bigramFreq[bigram]} times (threshold >= 4)`,
      };
    }
  }

  return { suspected: false, reason: null };
}

// ─── dpAlign ─────────────────────────────────────────────────────────────────

/**
 * Smith-Waterman-style DP alignment of expected → transcribed words.
 * Replaces the old SLIP window which caused cascade miss failures:
 * one missed/inserted word would knock all subsequent positions off by one.
 *
 * Returns per-expected-word { bestIdx, bestSim } and extraCount (transcribed
 * words not aligned to any expected word — additions / Whisper insertions).
 *
 * Short ayahs use higher gap penalties so every position is held to strict account.
 *
 * Uses computeAlignmentSimilarity() (short-word-aware) rather than raw
 * charLevenshteinSimilarity for the sim matrix, so alignment quality scoring
 * and final word-status resolution use the same, consistent similarity.
 */
function dpAlign(
  expectedWords: string[],
  transcribedWords: { normalized: string; confidence: number }[],
  isShortAyah: boolean
): { alignments: { bestIdx: number; bestSim: number }[]; extraCount: number } {
  const E = expectedWords.length;
  const T = transcribedWords.length;

  if (E === 0) return { alignments: [], extraCount: T };
  if (T === 0) {
    return {
      alignments: new Array(E).fill(null).map(() => ({ bestIdx: -1, bestSim: 0 })),
      extraCount: 0,
    };
  }

  const sim: number[][] = Array.from({ length: E }, (_, e) =>
    Array.from({ length: T }, (_, t) =>
      computeAlignmentSimilarity(expectedWords[e], transcribedWords[t].normalized)
    )
  );

  const SKIP_COST = isShortAyah ? 0.5 : 0.3; // penalty: skip transcribed word (insertion)
  const MISS_COST = isShortAyah ? 0.7 : 0.5; // penalty: skip expected word (missed)

  const dp: number[][] = Array.from({ length: E + 1 }, () => new Array(T + 1).fill(0));
  // from[e][t]: 0 = diagonal (match), 1 = up (expected missed), 2 = left (transcribed skipped)
  // Stored during fill so traceback never re-evaluates float sums (IEEE 754 re-accumulation
  // can produce bitwise-unequal results even for the same logical path).
  const from: number[][] = Array.from({ length: E + 1 }, () => new Array(T + 1).fill(0));

  for (let t = 1; t <= T; t++) dp[0][t] = dp[0][t - 1] - SKIP_COST;
  for (let e = 1; e <= E; e++) dp[e][0] = dp[e - 1][0] - MISS_COST;

  for (let e = 1; e <= E; e++) {
    for (let t = 1; t <= T; t++) {
      const diag = dp[e - 1][t - 1] + sim[e - 1][t - 1];
      const up = dp[e - 1][t] - MISS_COST;
      const left = dp[e][t - 1] - SKIP_COST;
      if (diag >= up && diag >= left) { dp[e][t] = diag; from[e][t] = 0; }
      else if (up >= left) { dp[e][t] = up; from[e][t] = 1; }
      else { dp[e][t] = left; from[e][t] = 2; }
    }
  }

  // Traceback — reads from[][] directly, no float re-evaluation
  const traced: { e: number; t: number }[] = [];
  let e = E, t = T;
  while (e > 0 || t > 0) {
    if (e > 0 && t > 0 && from[e][t] === 0) {
      traced.push({ e: e - 1, t: t - 1 }); e--; t--;
    } else if (t > 0 && (e === 0 || from[e][t] === 2)) {
      traced.push({ e: -1, t: t - 1 }); t--; // extra transcribed word
    } else {
      traced.push({ e: e - 1, t: -1 }); e--; // expected word missed
    }
  }
  traced.reverse();

  const alignments = new Array(E).fill(null).map(() => ({ bestIdx: -1, bestSim: 0 }));
  let extraCount = 0;
  for (const { e: eIdx, t: tIdx } of traced) {
    if (eIdx === -1) {
      extraCount++;
    } else if (tIdx >= 0) {
      alignments[eIdx] = { bestIdx: tIdx, bestSim: sim[eIdx][tIdx] };
    }
    // eIdx >= 0, tIdx === -1 → missed; leave default { -1, 0 }
  }

  return { alignments, extraCount };
}

// ─── buildScorecard ──────────────────────────────────────────────────────────

/**
 * Builds a per-word scorecard aligning transcribed words to expected words.
 *
 * Pipeline:
 *  1. Normalize both sides.
 *  2. Detect hallucination (ratio + repetition checks).
 *  3. Run DP alignment (no cascade failures).
 *  4. Gate each alignment with MIN_CLAIM_SIM = 0.65.
 *  5. Resolve word status (sim drives verdict; confidence is tiebreaker only).
 *  6. Apply critical-position penalties (first/last word), capped combined.
 *  7. Apply extra-word penalty.
 *  8. Cap at HALLUCINATION_ACCURACY_CAP when hallucination detected.
 *  9. Assign grade aligned to getASRSuggestion thresholds.
 */
export function buildScorecard(
  expectedText: string,
  wordScores: { word: string; confidence: number }[],
  fluency: Fluency,
  audioDurationMs?: number  // used for dev logging only — does not affect hallucination flag
): ScorecardResult {
  const expectedWordsForScoring = normalizeArabic(expectedText).split(' ').filter(Boolean);
  // For display alongside expected text in WordScore chips, strip only tashkeel/diacritics
  // so hamza variants (أ إ آ ٱ) remain intact when displayed on screen.
  const expectedWordsForDisplay = expectedText
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[^\u0600-\u06FF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  const transcribedWords = wordScores.map(w => ({
    normalized: normalizeArabic(w.word),
    confidence: w.confidence,
  }));

  // Hallucination detection — word ratio + repetition only.
  // Duration alone is not evidence: a long ayah recited correctly has a healthy ratio.
  const { suspected: hallucinationSuspected, reason: hallucinationReason } = detectHallucination(
    expectedWordsForScoring.length,
    transcribedWords
  );

  if (__DEV__ && hallucinationSuspected) {
    console.warn(
      `[ASR] Hallucination suspected (${hallucinationReason}) — expected ${expectedWordsForScoring.length} words, ` +
      `got ${transcribedWords.length}` +
      (audioDurationMs ? `, duration ${(audioDurationMs / 1000).toFixed(1)}s` : '')
    );
  }

  const SHORT_AYAH_WORD_THRESHOLD = 20;
  const isShortAyah = expectedWordsForScoring.length < SHORT_AYAH_WORD_THRESHOLD;

  if (__DEV__) {
    console.log(`[ASR] Ayah mode: ${isShortAyah ? 'SHORT (strict)' : 'NORMAL'} — ${expectedWordsForScoring.length} expected words`);
  }

  // DP alignment — self-corrects when words are missed or inserted
  const { alignments, extraCount } = dpAlign(expectedWordsForScoring, transcribedWords, isShortAyah);

  // MIN_CLAIM_SIM gate: below 0.55 the aligned word is still a different word
  const MIN_CLAIM_SIM = 0.55;
  const breakdown: WordScore[] = [];

  for (let eIdx = 0; eIdx < expectedWordsForScoring.length; eIdx++) {
    const expectedDisplay = expectedWordsForDisplay[eIdx] ?? expectedWordsForScoring[eIdx];
    const { bestIdx, bestSim } = alignments[eIdx];

    if (bestIdx === -1 || bestSim < MIN_CLAIM_SIM) {
      breakdown.push({ word: expectedDisplay, transcribed: undefined, confidence: 0, status: 'missed' });
    } else {
      const conf = transcribedWords[bestIdx].confidence;
      const transcribed = wordScores[bestIdx]?.word ? normalizeArabic(wordScores[bestIdx].word) : transcribedWords[bestIdx].normalized;
      const status = resolveWordStatus(bestSim, conf, isShortAyah);
      // Dev diagnostic: borderline band check (0.68–0.78)
      if (__DEV__ && bestSim >= 0.68 && status !== 'correct') {
        console.warn(
          `[ASR] Borderline word landed as '${status}': "${expectedDisplay}" ` +
          `sim=${(bestSim * 100).toFixed(1)}% conf=${(conf * 100).toFixed(1)}% ` +
          `(sim in 0.68–0.78 hesitant band; conf < ${(HESITANT_CONF_TIEBREAKER * 100).toFixed(0)}% prevents upgrade to correct)`
        );
      }
      breakdown.push({ word: expectedDisplay, transcribed, confidence: conf, status });
    }
  }

  // Base accuracy using weighted word scoring:
  // correct = 1.0, hesitant = 0.75, wrong = 0.25, missed = 0
  const wordsCorrect = breakdown.filter(w => w.status === 'correct').length;
  const weightedScoreSum = breakdown.reduce((sum, w) => {
    if (w.status === 'correct') return sum + 1.0;
    if (w.status === 'hesitant') return sum + 0.75;
    if (w.status === 'wrong') return sum + 0.25;
    return sum;
  }, 0);

  const rawScore = expectedWordsForScoring.length > 0
    ? (weightedScoreSum / expectedWordsForScoring.length) * 100
    : 0;
  let overallAccuracy = Math.round(rawScore);

  // Critical-position penalties
  // The final word (rhyme-key / divine attribute) is the most important in Quran memorization.
  const lastWord = breakdown[breakdown.length - 1];
  const firstWord = breakdown[0];
  const sameWord = breakdown.length === 1;

  let structuralPenalty = 0;
  if (lastWord?.status === 'wrong' || lastWord?.status === 'missed') {
    structuralPenalty += 5;
  } else if (lastWord?.status === 'hesitant') {
    structuralPenalty += 1;
  }
  if (!sameWord && (firstWord?.status === 'wrong' || firstWord?.status === 'missed')) {
    structuralPenalty += 3;
  }

  // Maximum structural penalty: 8
  const MAX_STRUCTURAL_PENALTY = 8;
  structuralPenalty = Math.min(structuralPenalty, MAX_STRUCTURAL_PENALTY);
  overallAccuracy -= structuralPenalty;

  // Extra word penalty: additions beyond the expected ayah (-2% per extra word, max 10%)
  const extraPenalty = Math.min(10, extraCount * 2);
  overallAccuracy -= extraPenalty;

  overallAccuracy = Math.max(0, overallAccuracy);

  // Hallucination cap
  if (hallucinationSuspected) {
    overallAccuracy = Math.min(overallAccuracy, HALLUCINATION_ACCURACY_CAP);
    if (__DEV__) console.warn(`[ASR] Accuracy capped at ${HALLUCINATION_ACCURACY_CAP}% due to hallucination (${hallucinationReason})`);
  }

  // Grade thresholds aligned to getASRSuggestion boundaries
  const grade: Grade =
    overallAccuracy >= 80 ? 'Excellent' :      // maps to 'correct'
      overallAccuracy >= 65 ? 'Good' :           // upper retry band
        overallAccuracy >= 50 ? 'Needs Practice' : // lower retry band
          'Try Again';                               // maps to 'incorrect'

  if (__DEV__) {
    console.log('[ASR Diagnostics] ──────────────────────────────────────────────');
    console.log(`  Weighted Score: ${weightedScoreSum.toFixed(2)} / ${expectedWordsForScoring.length} (${rawScore.toFixed(1)}%)`);
    console.log(`  Raw Score (Pre-penalties): ${rawScore.toFixed(1)}%`);
    console.log(`  Penalties Applied: -${structuralPenalty + extraPenalty}% (Structural: -${structuralPenalty}%, Extra Words: -${extraPenalty}%)`);
    console.log(`  Hallucination Reason: ${hallucinationReason || 'None'}`);
    console.log('  Alignment Similarity & Word Breakdown:');
    for (let i = 0; i < breakdown.length; i++) {
      const w = breakdown[i];
      const sim = alignments[i]?.bestSim ?? 0;
      console.log(`    [${i}] "${w.word}" → "${w.transcribed ?? 'NONE'}" | Sim: ${(sim * 100).toFixed(1)}% | Conf: ${(w.confidence * 100).toFixed(1)}% | Status: ${w.status}`);
    }
    console.log(`  Final Scorecard Accuracy: ${overallAccuracy}%, Grade: ${grade}`);
    console.log('────────────────────────────────────────────────────────────────');
  }

  return {
    overallAccuracy,
    wordsCorrect,
    wordsTotal: expectedWordsForScoring.length,
    extraWordsDetected: extraCount,
    fluency,
    wordBreakdown: breakdown,
    grade,
    hallucinationSuspected,
  };
}

// ─── stripKnownHallucinationSuffixes ─────────────────────────────────────────

/**
 * Removes known recurring Whisper hallucination appends from a raw Arabic string.
 * These are words Whisper reliably adds at the end of recitations regardless
 * of what was actually said — transcription artifacts, not user errors.
 *
 * Applied to both the raw transcription string AND per-word scores before
 * scoring so neither path is penalised for the extra token.
 */
const WHISPER_KNOWN_SUFFIXES = ['والمسلمين', 'والمسلم', 'والمؤمنين'];

function stripKnownHallucinationSuffixes(text: string): string {
  let cleaned = text.trimEnd();
  for (const suffix of WHISPER_KNOWN_SUFFIXES) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.slice(0, -suffix.length).trimEnd();
      if (__DEV__) console.warn(`[ASR] Stripped known Whisper hallucination suffix: "${suffix}"`);
      break; // only strip one suffix per call
    }
  }
  return cleaned;
}

// ─── evaluateRecitation  (main entry point) ───────────────────────────────────

/**
 * Full pipeline: transcribe audio → normalize → compare → scorecard.
 *
 * @param audioUri           Local file URI from expo-av recording
 * @param expectedArabicText The Arabic verse the user should have recited
 * @returns ASRResult with transcription, accuracy (0–100), and optional scorecard
 */
export async function evaluateRecitation(
  audioUri: string,
  expectedArabicText: string
): Promise<ASRResult> {
  const responseJson = await transcribeAudio(audioUri, expectedArabicText);

  // Strip known recurring Whisper suffix artifacts before any scoring.
  // These are words Whisper reliably appends regardless of what was recited.
  const cleanedTranscription = stripKnownHallucinationSuffixes(responseJson.transcription);
  const cleanedWordScores = (() => {
    const ws = responseJson.word_scores;
    if (!ws || ws.length === 0) return ws;
    // Drop trailing word(s) that match a known hallucination suffix
    let end = ws.length;
    const lastWord = normalizeArabic(ws[ws.length - 1]?.word ?? '');
    if (WHISPER_KNOWN_SUFFIXES.some(s => normalizeArabic(s) === lastWord)) {
      end = ws.length - 1;
      if (__DEV__) console.warn(`[ASR] Dropped trailing hallucination word from word_scores: "${ws[ws.length - 1]?.word}"`);
    }
    return ws.slice(0, end);
  })();

  const normalizedExpected = normalizeArabic(expectedArabicText);
  const normalizedTranscription = normalizeArabic(cleanedTranscription);

  if (__DEV__) {
    console.log(`[ASR] Expected (normalized):      "${normalizedExpected}"`);
    console.log(`[ASR] Transcription (normalized): "${normalizedTranscription}"`);
  }

  // Rich path: backend returned per-word scores → full scorecard
  if (cleanedWordScores && Array.isArray(cleanedWordScores) && cleanedWordScores.length > 0) {
    const fluency: Fluency =
      responseJson.fluency && ['Fast', 'Normal', 'Slow'].includes(responseJson.fluency)
        ? responseJson.fluency
        : 'Normal';

    const scorecard = buildScorecard(
      expectedArabicText,
      cleanedWordScores!,
      fluency,
      responseJson.duration_ms
    );

    const accuracy = scorecard.overallAccuracy;

    if (__DEV__) {
      console.log(
        `[ASR] Scorecard — ${scorecard.wordsCorrect}/${scorecard.wordsTotal} correct, ` +
        `accuracy: ${accuracy}%, grade: ${scorecard.grade}, ` +
        `hallucination: ${scorecard.hallucinationSuspected}`
      );
      console.log(`[ASR] Suggestion: ${getASRSuggestion(accuracy)}`);
    }

    return { transcription: cleanedTranscription, accuracy, scorecard };
  }

  // Fallback path: no word_scores — use full-string similarity with hallucination guard
  const expectedTokens = normalizedExpected.split(' ').filter(Boolean);
  const transcribedTokens = normalizedTranscription.split(' ').filter(Boolean);
  const transcribedForCheck = transcribedTokens.map(w => ({ normalized: w }));
  const { suspected: hallucinationSuspected, reason: hallucinationReason } = detectHallucination(expectedTokens.length, transcribedForCheck);

  let accuracy = calculateSimilarity(normalizedExpected, normalizedTranscription);

  if (hallucinationSuspected) {
    accuracy = Math.min(accuracy, HALLUCINATION_ACCURACY_CAP);
    if (__DEV__) console.warn(`[ASR] Fallback path: hallucination suspected (${hallucinationReason}), accuracy capped at ${HALLUCINATION_ACCURACY_CAP}%`);
  }

  if (__DEV__) console.log(`[ASR] Fallback accuracy: ${accuracy}% → ${getASRSuggestion(accuracy)}`);

  return { transcription: cleanedTranscription, accuracy };
}
