/**
 * asrEngine.ts
 * Pure utility functions for Quran Recitation ASR verification.
 * No UI or side-effects — all functions are independently testable.
 *
 * Fixed:
 *  - redirect: 'follow' to handle FastAPI 307 slash redirects
 *  - iOS Simulator .caf MIME type support
 *  - No manual Content-Type header (breaks multipart boundary)
 *  - Improved error logging (prints response body on failure)
 *  - Abort errors no longer trigger useless retries
 *  - Increased retry delay to 2s
 *  - Lazy-safe timeout cleanup on every path
 *  - HTML-response detection: surfaces clean error when Space is sleeping/down
 *  - Full URL logged on every attempt for easier diagnosis
 */

const ASR_API_URL = 'https://ihafidh-ihafidhasr.hf.space/transcribe';
const HF_TOKEN = process.env.EXPO_PUBLIC_HF_TOKEN;

if (__DEV__ && !HF_TOKEN) {
  console.warn('[ASR] EXPO_PUBLIC_HF_TOKEN is not set — requests will be unauthenticated');
}

const TIMEOUT_MS = 60_000; // 60s to allow cold-start wake-up
const MAX_RETRIES = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BackendASRResponse = {
  transcription: string;
  word_scores?: { word: string; confidence: number }[];
  fluency?: string;
  wpm?: number;
};

export type WordScore = {
  word: string;
  confidence: number;        // 0–1 from Whisper
  status: 'correct' | 'hesitant' | 'wrong' | 'missed';
};

export type ScorecardResult = {
  overallAccuracy: number;       // 0–100, word match rate (legacy fallback compatible)
  wordsCorrect: number;
  wordsTotal: number;
  fluency: string;               // "Fast" | "Normal" | "Slow"
  wordBreakdown: WordScore[];    // per expected word
  grade: 'Excellent' | 'Good' | 'Needs Practice' | 'Try Again';
};

export type ASRResult = {
  transcription: string;
  accuracy: number; // 0–100
  scorecard?: ScorecardResult;
};

/** Three-tier suggestion derived from accuracy score */
export type ASRSuggestion = 'correct' | 'retry' | 'incorrect';

export function getASRSuggestion(accuracy: number): ASRSuggestion {
  if (accuracy >= 80) return 'correct';  // ≥80% match — auto-correct threshold
  if (accuracy >= 50) return 'retry';    // roughly half right — needs review
  return 'incorrect';
}

// ─────────────────────────────────────────────────────────────────────────────
// getMimeType  (handles iOS Simulator .caf format)
// ─────────────────────────────────────────────────────────────────────────────

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'wav':  return 'audio/wav';
    case 'mp3':  return 'audio/mpeg';
    case 'mp4':  return 'audio/mp4';
    case 'caf':  return 'audio/x-caf'; // iOS Simulator records in .caf
    case 'aac':  return 'audio/aac';
    case 'm4a':
    default:     return 'audio/m4a';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// transcribeAudio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a recorded audio file (URI) to the ASR API.
 * Retries up to MAX_RETRIES times on network failure.
 * Does NOT retry on timeout (AbortError) — pointless if Space is unresponsive.
 * Throws a descriptive error after all retries are exhausted.
 */
export async function transcribeAudio(uri: string, expectedArabicText?: string): Promise<BackendASRResponse> {
  if (!uri) throw new Error('Cannot transcribe: audio URI is empty or invalid.');

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const filename = uri.split('/').pop() ?? 'recording.m4a';
      const mimeType = getMimeType(filename);

      const formData = new FormData();

      // React Native FormData accepts { uri, name, type } as a pseudo-Blob.
      // Do NOT set Content-Type header manually — RN sets it with the correct
      // multipart boundary automatically. Setting it manually will break the
      // server's ability to parse the form fields.
      formData.append('audio', {
        uri,
        name: filename,
        type: mimeType,
      } as unknown as Blob);

      if (expectedArabicText) {
        formData.append('expected', expectedArabicText);
      }

      if (__DEV__) {
        console.log(`[ASR] Attempt ${attempt + 1}/${MAX_RETRIES + 1} → ${ASR_API_URL}`);
        console.log(`[ASR] File: ${filename} (${mimeType})`);
        if (HF_TOKEN) {
          console.log(`[ASR] Auth: Bearer ${HF_TOKEN.substring(0, 10)}***`);
        }
      }

      const response = await fetch(ASR_API_URL, {
        method: 'POST',
        redirect: 'follow', // Follow FastAPI 307 redirects (trailing slash etc.)
        headers: {
          // Only inject Authorization — let RN handle Content-Type for multipart
          ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}),
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (__DEV__) console.log(`[ASR] Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        // If we got HTML back, the Space is down — give a clean message
        // instead of dumping a wall of HTML markup into the logs.
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('text/html')) {
          throw new Error(
            `ASR Space is unreachable (${response.status}). ` +
            `Check https://huggingface.co/spaces/ihafidh/ihafidhasr is running.`
          );
        }

        // Non-HTML error — read the body for a more useful message
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          errorBody = '(could not read error body)';
        }
        console.error(`[ASR] Error body (${ASR_API_URL}):`, errorBody);
        throw new Error(`ASR API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      const transcription = json?.transcription;

      if (typeof transcription !== 'string') {
        throw new Error(
          `Unexpected ASR response — "transcription" field missing or not a string. ` +
          `Got: ${JSON.stringify(json)}`
        );
      }

      if (__DEV__) console.log(`[ASR] Transcription: "${transcription}"`);
      return json;

    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      const isAbort = err instanceof Error && err.name === 'AbortError';

      if (isAbort) {
        // Timeout — retrying won't help if the Space is unresponsive
        throw new Error(
          `ASR timed out after ${TIMEOUT_MS / 1000}s. ` +
          `The HuggingFace Space may be cold-starting — try again in 30s.`
        );
      }

      if (attempt < MAX_RETRIES) {
        if (__DEV__) console.log(`[ASR] Attempt ${attempt + 1} failed, retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2_000));
      }
    }
  }

  throw lastError ?? new Error('ASR transcription failed after all retries');
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeArabic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes Arabic text for comparison:
 *
 *  ✓ Removes tashkeel / harakat (diacritics, shadda, sukun, tanwin)
 *  ✓ Normalizes all alif variants (أ إ آ ٱ ء) → ا
 *  ✓ Normalizes waw-hamza (ؤ) → و  (Whisper often omits the hamza)
 *  ✓ Normalizes ya-hamza  (ئ) → ي
 *  ✓ Strips Arabic punctuation and non-letter characters
 *  ✓ Collapses whitespace
 *
 *  ✗ ta marbuta (ة) is intentionally NOT normalized → Whisper outputs it
 *    correctly and collapsing it to ه hurts accuracy.
 */
export function normalizeArabic(text: string): string {
  return text
    // 1. Remove tashkeel — includes harakat, shadda, sukun, tanwin, maddah, etc.
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06ED]/g, '')
    // 2. Normalize all alif and hamza variants → bare alif (ا)
    .replace(/[أإآٱء]/g, 'ا')
    // 3. Normalize waw-hamza (ؤ) → و
    .replace(/ؤ/g, 'و')
    // 4. Normalize ya-hamza (ئ) → ي
    .replace(/ئ/g, 'ي')
    // 5. Remove non-Arabic characters (Latin, digits, punctuation, Quranic marks)
    .replace(/[^\u0600-\u06FF\s]/g, '')
    // 6. Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateSimilarity  (word-level Levenshtein)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a 0–100 similarity score using word-level Levenshtein distance.
 *
 * Word-level is deliberate: one wrong Arabic word is a meaningful mistake
 * and should score significantly lower than a single character difference
 * would under character-level comparison.
 *
 * Example: 4 words, 1 substituted → 75% (vs ~95% char-level)
 *
 * Both inputs should be pre-normalized with normalizeArabic().
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 100;

  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = b.split(' ').filter(Boolean);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const lenA = tokensA.length;
  const lenB = tokensB.length;

  // Single-row DP — O(lenA × lenB) time, O(lenB) space
  let prev = Array.from({ length: lenB + 1 }, (_, i) => i);

  for (let i = 1; i <= lenA; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= lenB; j++) {
      const cost = tokensA[i - 1] === tokensB[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,         // deletion
        curr[j - 1] + 1,     // insertion
        prev[j - 1] + cost   // substitution
      );
    }
    prev = curr;
  }

  const distance = prev[lenB];
  const maxLen = Math.max(lenA, lenB);
  return Math.max(0, Math.min(100, Math.round(((maxLen - distance) / maxLen) * 100)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Scorecard Builder
// ─────────────────────────────────────────────────────────────────────────────

export function charLevenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const lenA = a.length, lenB = b.length;
  let prev = Array.from({ length: lenB + 1 }, (_, i) => i);
  for (let i = 1; i <= lenA; i++) {
    const curr = [i];
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  const maxLen = Math.max(lenA, lenB);
  return (maxLen - prev[lenB]) / maxLen;
}

export function buildScorecard(
  expectedText: string,
  wordScores: { word: string; confidence: number }[],
  fluency: string
): ScorecardResult {
  const expectedWords = normalizeArabic(expectedText).split(' ').filter(Boolean);
  const transcribedWords = wordScores.map(w => ({
    normalized: normalizeArabic(w.word),
    confidence: w.confidence,
    raw: w.word,
  }));

  const breakdown: WordScore[] = [];
  const usedIndexes = new Set<number>();

  for (const expected of expectedWords) {
    let bestIdx = -1;
    let bestSim = 0;

    transcribedWords.forEach((tw, i) => {
      // Allow slight out-of-order matches but prefer sequential
      if (usedIndexes.has(i)) return; 
      const sim = charLevenshteinSimilarity(expected, tw.normalized);
      if (sim > bestSim) { bestSim = sim; bestIdx = i; }
    });

    if (bestIdx === -1 || bestSim < 0.5) {
      breakdown.push({ word: expected, confidence: 0, status: 'missed' });
    } else {
      usedIndexes.add(bestIdx);
      const conf = transcribedWords[bestIdx].confidence;
      const status =
        (bestSim >= 0.90 && conf >= 0.50) ? 'correct' :   // They said the exact expected string
        (bestSim >= 0.60 && conf >= 0.70) ? 'correct' :   // High acoustic confidence, but severe Uthmani spelling variation
        (bestSim >= 0.50 && conf >= 0.80) ? 'correct' :   // Extremely high acoustic confidence, forgive major ASR hallucination (50% text match)
        (bestSim >= 0.75 && conf >= 0.60) ? 'correct' :   // Moderate spelling match and moderate acoustic match
        bestSim >= 0.40 || conf >= 0.40 ? 'hesitant' :
        'wrong';
      breakdown.push({ word: expected, confidence: conf, status });
    }
  }

  const wordsCorrect = breakdown.filter(w => w.status === 'correct').length;
  // Calculate a precise accuracy based on exactly the expected words, ignoring hallucinated extra words
  const computedAccuracy = expectedWords.length > 0 
    ? Math.round((wordsCorrect / expectedWords.length) * 100) 
    : 0;

  const grade =
    computedAccuracy >= 90 ? 'Excellent' :
    computedAccuracy >= 75 ? 'Good' :
    computedAccuracy >= 50 ? 'Needs Practice' :
    'Try Again';

  return {
    overallAccuracy: computedAccuracy,
    wordsCorrect,
    wordsTotal: expectedWords.length,
    fluency,
    wordBreakdown: breakdown,
    grade,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// evaluateRecitation  (main entry point)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full pipeline: transcribe audio → normalize both texts → compare.
 *
 * @param audioUri        Local file URI from expo-av recording
 * @param expectedArabicText  The Arabic verse text the user should have recited
 * @returns ASRResult with the raw transcription and an accuracy score 0–100
 */
export async function evaluateRecitation(
  audioUri: string,
  expectedArabicText: string
): Promise<ASRResult> {
  const responseJson = await transcribeAudio(audioUri, expectedArabicText);
  const transcription = responseJson.transcription;

  const normalizedExpected = normalizeArabic(expectedArabicText);
  const normalizedTranscription = normalizeArabic(transcription);

  console.log(`[ASR] Expected (normalized):      "${normalizedExpected}"`);
  console.log(`[ASR] Transcription (normalized): "${normalizedTranscription}"`);

  let accuracy = calculateSimilarity(normalizedExpected, normalizedTranscription);

  let scorecard: ScorecardResult | undefined;

  // If the backend returns `word_scores`, we can build the scorecard!
  if (responseJson.word_scores && Array.isArray(responseJson.word_scores)) {
    const rawFluency = responseJson.fluency;
    const validatedFluency = ['Fast', 'Normal', 'Slow'].includes(rawFluency as string) 
      ? rawFluency as string 
      : 'Normal';

    scorecard = buildScorecard(
      expectedArabicText,
      responseJson.word_scores,
      validatedFluency
    );
    
    // Only use scorecard accuracy if it successfully evaluated words
    if (scorecard.overallAccuracy > 0 || scorecard.wordsTotal > 0) {
      accuracy = scorecard.overallAccuracy;
    }
  }

  console.log(`[ASR] Final Accuracy score: ${accuracy}%  → ${getASRSuggestion(accuracy)}`);

  return {
    transcription,
    accuracy,
    scorecard,
  };
}
