/**
 * Fetch a Surah and its verses by ID
 * Example: getSurahById(1) → Surah Al-Fatihah
 */
export async function getSurahById(surahNumber: number) {
  try {
    const response = await fetch(`${ALQURAN_CLOUD_API}/surah/${surahNumber}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch surah ${surahNumber}`);
    }

    const json = await response.json();
    const surahData = json?.data;

    return {
      id: surahData.number,
      name: surahData.name,
      englishName: surahData.englishName,
      versesCount: surahData.numberOfAyahs,
      verses: surahData.ayahs.map((ayah: any) => ({
        id: ayah.number,
        surahId: surahData.number,
        verseNumber: ayah.numberInSurah,
        arabicText: ayah.text,
      })),
    };
  } catch (err) {
    console.error("[getSurahById] Error:", err);
    return null;
  }
}

/**
 * Dummy placeholder until caching is implemented.
 * Always returns false.
 */
export async function isSurahFullyCached(_surahNumber: number): Promise<boolean> {
  return false;
}
import { addFailedVerse, cacheVerses } from '@/assets/database/QuranDatabase';
import {
  BISMILLAH_ARABIC,
  BISMILLAH_AUDIO_URL,
  BISMILLAH_TRANSLATION_EN,
  BISMILLAH_WBW,
  shouldHaveBismillah,
} from '@/constants/basmalah';
import { useSettingsStore } from '@/store/settingsStore';
import { Verse } from '@/types';
import { getAudioUrl } from '@/utils/audioUtils';
import NetInfo from '@react-native-community/netinfo';

const ALQURAN_CLOUD_API = 'https://api.alquran.cloud/v1';

interface AlQuranCloudAyahResponse {
  code: number;
  status: string;
  data: {
    number: number;
    text: string;
    edition: { identifier: string; language: string; name: string; englishName: string; format: string; type: string };
    surah: { number: number; name: string; englishName: string; englishNameTranslation: string; numberOfAyahs: number; revelationType: string };
    numberInSurah: number;
    juz: number;
    manzil: number;
    page: number;
    ruku: number;
    hizbQuarter: number;
    sajda: boolean;
  };
}

// Circuit breaker
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 30000;

  canExecute(): boolean {
    if (this.failures >= this.threshold) {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.failures = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  onSuccess(): void { this.failures = 0; }
  onFailure(): void { this.failures++; this.lastFailTime = Date.now(); }
}

const circuitBreaker = new CircuitBreaker();
const transliterationAvailability: Record<string, boolean | undefined> = {};

// Helper functions
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('Request timeout');
    throw error;
  }
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 1000,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      if (attempt === maxRetries) throw lastError;
      const delay = initialDelay * Math.pow(1.5, attempt - 1) + Math.random() * 500;
      onRetry?.(attempt, lastError);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError!;
}

/** Full-string Bismillah translation for WBW-backed languages; English otherwise. */
function translationForVirtualBismillah(translationLanguage: string): string {
  const base = (translationLanguage.split('.')[0] || 'en').toLowerCase();
  if (base === 'ta') return BISMILLAH_WBW.map((w) => w.ta).filter(Boolean).join(' ');
  if (base === 'id') return BISMILLAH_WBW.map((w) => w.id).filter(Boolean).join(' ');
  if (base === 'ms') return BISMILLAH_WBW.map((w) => w.ms).filter(Boolean).join(' ');
  return BISMILLAH_TRANSLATION_EN;
}

export async function fetchTransliterationText(
  surahNumber: number,
  verseNumber: number,
  langCode: string
): Promise<string | undefined> {
  try {
    if (verseNumber === 0 && shouldHaveBismillah(surahNumber)) {
      return 'Bismillāhi ar-raḥmāni ar-raḥīm';
    }

    // Try to fetch the requested language first
    const resp = await fetchWithTimeout(
      `${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/${langCode}.transliteration`
    );
    
    if (resp.ok) {
      const data: AlQuranCloudAyahResponse = await resp.json();
      return data?.data?.text;
    }
    
    // If requested language fails AND it's not English, fall back to English
    if (langCode !== 'en') {
      console.warn(`[fetchTransliterationText] ${langCode} not available, falling back to English`);
      const enResp = await fetchWithTimeout(
        `${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/en.transliteration`
      );
      
      if (enResp.ok) {
        const enData: AlQuranCloudAyahResponse = await enResp.json();
        return enData?.data?.text;
      }
    }
  } catch (e) {
    console.error('[fetchTransliterationText] fetch error:', e);
  }
  
  return undefined;
}

function calculateVerseId(surahNumber: number, verseNumber: number): number {
  const counts = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53,
    89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12,
    12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
    30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
  ];
  return counts.slice(0, surahNumber - 1).reduce((a, b) => a + b, 0) + verseNumber;
}

// Lazy queue
class LazyQueue {
  private active = new Map<string, Promise<any>>();
  private readonly maxConcurrent = 3;
  private readonly delayBetweenRequests = 800;

  async add<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.active.has(key)) return this.active.get(key) as Promise<T>;
    while (this.active.size >= this.maxConcurrent) await new Promise(r => setTimeout(r, 100));
    const p = this.execute(key, fn);
    this.active.set(key, p);
    return p;
  }

  private async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      setTimeout(() => this.active.delete(key), this.delayBetweenRequests);
      return result;
    } catch (e) {
      this.active.delete(key);
      throw e;
    }
  }
}

const lazyQueue = new LazyQueue();

/**
 * Checks if the device has an active network connection
 * @returns Promise<boolean> - True if connected, false otherwise
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch (error) {
    console.warn('Network connectivity check failed:', error);
    return false; // Default to offline mode if check fails
  }
}

// --- Fetch Single Verse ---
export async function fetchSingleVerse(
  surahNumber: number,
  verseNumber: number,
  translationLanguage: string = 'en.asad',
  reciterIdentifier: string = 'ar.alafasy'
): Promise<Verse | null> {
  const key = `${surahNumber}:${verseNumber}`;
  if (!circuitBreaker.canExecute()) return null;

  return lazyQueue.add(key, async () =>
    fetchWithRetry(async () => {
      try {
        if (verseNumber === 0) {
          if (!shouldHaveBismillah(surahNumber)) {
            circuitBreaker.onSuccess();
            return null;
          }
          const wantTransliteration = !!useSettingsStore.getState().showTransliteration;
          const transliterationText = wantTransliteration
            ? await fetchTransliterationText(surahNumber, verseNumber, 'en')
            : undefined;
          const verse: Verse = {
            id: -surahNumber,
            surahId: surahNumber,
            verseNumber: 0,
            arabicText: BISMILLAH_ARABIC,
            translation: translationForVirtualBismillah(translationLanguage),
            transliteration: transliterationText,
            audioUrl: BISMILLAH_AUDIO_URL,
          };
          circuitBreaker.onSuccess();
          return verse;
        }

        const wantTransliteration = !!useSettingsStore.getState().showTransliteration;
        const preferredLang = (translationLanguage.split('.')[0] || 'en').toLowerCase();
        
        // Check if we can use local database for English translations
        const isEnglish = preferredLang === 'en';
        
        if (isEnglish) {
          // Try local database first for English
          try {
            const { getVerseFromLocalDB } = await import('./verseDbService');
            const localVerse = await getVerseFromLocalDB(surahNumber, verseNumber);
            
            if (localVerse && localVerse.ayah) {
              const audioUrl = getAudioUrl(reciterIdentifier, surahNumber, verseNumber);
              
              const verse: Verse = {
                id: localVerse.verse_id || calculateVerseId(surahNumber, verseNumber),
                surahId: localVerse.chapter_id || surahNumber,
                verseNumber: localVerse.verse_number || verseNumber,
                arabicText: localVerse.ayah,
                translation: localVerse.translation || '',
                transliteration: wantTransliteration ? (localVerse.transliteration || undefined) : undefined,
                audioUrl,
                juzNumber: localVerse.part_id || undefined,
                pageNumber: localVerse.page_id || undefined
              };
              
              circuitBreaker.onSuccess();
              return verse;
            }
          } catch (localDbErr) {
            console.warn(`Local DB fetch failed for ${key}, falling back to API:`, localDbErr);
            // Fall through to API call
          }
        }
        
        // For non-English or if local DB failed, use API
        const [arabicResp, translationResp] = await Promise.all([
          fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/ar.alafasy`),
          fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/${translationLanguage}`)
        ]);
        const arabicData: AlQuranCloudAyahResponse = await arabicResp.json();
        const translationData: AlQuranCloudAyahResponse = await translationResp.json();

        // Simplify transliteration: always request English transliteration regardless of selected translation language.
        const transliterationText = wantTransliteration
          ? await fetchTransliterationText(surahNumber, verseNumber, 'en')
          : undefined;

        const audioUrl = getAudioUrl(reciterIdentifier, surahNumber, verseNumber);

        // Safely extract data with fallbacks
        const arabicText = arabicData?.data?.text || '';
        const translationText = translationData?.data?.text || '';
        const juzNumber = arabicData?.data?.juz || 1;
        const hizbQuarter = arabicData?.data?.hizbQuarter || 1;
        const pageNumber = arabicData?.data?.page || 1;

        if (!arabicText) {
          console.warn(`No Arabic text found for verse ${surahNumber}:${verseNumber}`);
        }

        const verse: Verse = {
          id: calculateVerseId(surahNumber, verseNumber),
          surahId: surahNumber,
          verseNumber,
          arabicText,
          translation: translationText,
          transliteration: transliterationText,
          audioUrl,
          juzNumber,
          hizbNumber: Math.ceil(hizbQuarter / 4),
          pageNumber
        };

        circuitBreaker.onSuccess();
        return verse;
      } catch (err) {
        circuitBreaker.onFailure();
        addFailedVerse(surahNumber, verseNumber);
        console.error(`Failed fetching verse ${key}:`, err);
        return null;
      }
    }, 2)
  );
}

// --- Fetch multiple verses by surah ---
export async function fetchVersesBySurah(
  surahId: number,
  page: number = 1,
  pageSize: number = 10,
  translationLanguage: string = 'en.asad'
): Promise<{ verses: Verse[]; total: number; errors: string[] }> {
  const surahVerseCounts = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53,
    89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12,
    12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
    30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
  ];
  const total = surahVerseCounts[surahId - 1] || 0;
  if (total === 0) return { verses: [], total: 0, errors: ['Invalid surah ID'] };

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);
  if (start > total) return { verses: [], total, errors: [] };

  const verses: Verse[] = [];
  const errors: string[] = [];
  await Promise.all(
    Array.from({ length: end - start + 1 }, (_, i) =>
      fetchSingleVerse(surahId, start + i, translationLanguage, useSettingsStore.getState().reciterIdentifier)
        .then(v => (v ? verses.push(v) : errors.push(`Verse ${surahId}:${start + i} failed`)))
    )
  );

  verses.sort((a, b) => a.verseNumber - b.verseNumber);
  if (verses.length) await cacheVerses(verses).catch(err => errors.push('Caching failed: ' + err.message));
  return { verses, total, errors };
}

// Optimized smartDownloadSurah with parallel batches
export async function smartDownloadSurahOptimized(
  surahId: number,
  onProgress?: (completed: number, total: number, currentVerse?: string) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; downloadedCount: number; totalCount: number; errors: string[] }> {

  const surahVerseCounts = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53,
    89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12,
    12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
    30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
  ];

  const totalCount = surahVerseCounts[surahId - 1] || 0;
  const downloadedVerses: Verse[] = [];
  const errors: string[] = [];
  const batchSize = 5;

  for (let startVerse = 1; startVerse <= totalCount; startVerse += batchSize) {
    if (signal?.aborted) break;

    const endVerse = Math.min(startVerse + batchSize - 1, totalCount);
    const batchPromises = [];

    for (let verseNumber = startVerse; verseNumber <= endVerse; verseNumber++) {
      batchPromises.push(
        fetchSingleVerse(
          surahId,
          verseNumber,
          useSettingsStore.getState().translationLanguage,
          useSettingsStore.getState().reciterIdentifier
        ).then(verse => {
          if (verse) {
            downloadedVerses.push(verse);
            onProgress?.(downloadedVerses.length, totalCount, `${surahId}:${verseNumber}`);
          } else {
            errors.push(`Verse ${surahId}:${verseNumber} failed`);
          }
        }).catch(err => {
          errors.push(`Verse ${surahId}:${verseNumber} error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          onProgress?.(downloadedVerses.length, totalCount, `${surahId}:${verseNumber}`);
        })
      );
    }

    // Wait for the batch to finish
    await Promise.all(batchPromises);

    // Cache batch immediately
    if (downloadedVerses.length > 0) {
      try {
        await cacheVerses(downloadedVerses);
      } catch (cacheError: any) {
        errors.push(`Caching error: ${cacheError.message}`);
      }
    }

    // Small delay between batches to reduce API load
    if (endVerse < totalCount) await new Promise(resolve => setTimeout(resolve, 800));
  }

  return {
    success: downloadedVerses.length > 0,
    downloadedCount: downloadedVerses.length,
    totalCount,
    errors
  };
}

/**
 * Fetch translations for a list of verses (keeps ordering). This only calls the API
 * for translation text and does not overwrite other fields. Returns an array of
 * strings (translation text) aligned with the input verses array.
 */
export async function fetchTranslationsForVerses(
  surahId: number,
  verses: Array<{ verse_number: number }>,
  translationLanguage: string = 'en.asad'
): Promise<string[]> {
  const translations: string[] = new Array(verses.length).fill('');
  const langBase = (translationLanguage.split('.')[0] || 'en').toLowerCase();

  if (langBase === 'en') return translations; // nothing to do

  // We'll batch requests to avoid overloading the API
  const batchSize = 10;
  for (let i = 0; i < verses.length; i += batchSize) {
    const batch = verses.slice(i, i + batchSize);
    const fetches = batch.map(async (v, idx) => {
      try {
        const resp = await fetch(`${ALQURAN_CLOUD_API}/ayah/${surahId}:${v.verse_number}/${translationLanguage}`);
        if (!resp.ok) return '';
        const json = await resp.json();
        return json?.data?.text || '';
      } catch (err) {
        return '';
      }
    });

    const results = await Promise.all(fetches);
    for (let j = 0; j < results.length; j++) {
      translations[i + j] = results[j] || '';
    }
  }

  return translations;
}

// In-memory cache for Tajweed text
const tajweedCache = new Map<string, string>();

/**
 * Fetch Tajweed text from Al-Quran Cloud API
 * Uses the quran-simple edition which has proper diacritical marks including sukoon
 * @param surahNumber - Surah number (1-114)
 * @param verseNumber - Verse number within the surah
 * @returns Promise<string | null> - Tajweed text or null if failed
 */
export async function fetchTajweedText(
  surahNumber: number,
  verseNumber: number
): Promise<string | null> {
  const key = `${surahNumber}:${verseNumber}`;
  
  // Check cache first
  if (tajweedCache.has(key)) {
    return tajweedCache.get(key)!;
  }

  try {
    // Use quran-simple edition which includes proper diacritical marks (including sukoon)
    // This edition has all the marks needed for Tajweed detection
    const response = await fetchWithTimeout(
      `${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/quran-simple`,
      {},
      5000
    );

    if (!response.ok) {
      console.warn(`[fetchTajweedText] Failed to fetch ${key}: ${response.status}`);
      return null;
    }

    const data: AlQuranCloudAyahResponse = await response.json();
    let tajweedText = data?.data?.text;

    if (tajweedText) {
      // Strip any color markup tags in case API returns tagged text
      tajweedText = stripColorMarkup(tajweedText);
      
      // Cache the cleaned result
      tajweedCache.set(key, tajweedText);
      return tajweedText;
    }

    return null;
  } catch (error) {
    console.error(`[fetchTajweedText] Error fetching ${key}:`, error);
    return null;
  }
}

/**
 * Clear Tajweed cache (useful for memory management)
 */
export function clearTajweedCache(): void {
  tajweedCache.clear();
}

/**
 * Remove color markup tags from quran-tajweed edition text
 * Tags like [h:9999[, [o[, [f:17[, [q:19[ etc.
 */
function stripColorMarkup(text: string): string {
  // Remove all square bracket markup tags like [h:9999[, [o[, [f:17[, etc.
  return text.replace(/\[[^\]]*\[/g, '');
}

/**
 * Fetch Surah with Tajweed data from Quran.com API
 * Returns verses with text_uthmani_tajweed field containing HTML tags
 * 
 * @param surahNumber - Surah number (1-114)
 * @returns Array of verses with tajweed HTML or null on error
 * 
 * @example
 * const verses = await fetchSurahWithTajweed(1);
 * // verses[0].text_uthmani_tajweed contains: "بِسۡمِ <tajweed class="madda_normal">ٱللَّهِ</tajweed>..."
 */
export async function fetchSurahWithTajweed(surahNumber: number): Promise<Array<{
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  text_uthmani_tajweed: string;
}> | null> {
  try {
    const QURAN_COM_API = 'https://api.quran.com/api/v4';
    const url = `${QURAN_COM_API}/verses/by_chapter/${surahNumber}?` +
      `language=ar&` +
      `words=false&` +
      `per_page=300&` + // Fetch all verses (longest surah is 286 verses)
      `fields=text_uthmani,text_uthmani_tajweed`;
    
    const response = await fetchWithTimeout(url, {}, 10000);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // DEBUG: Verify tajweed data is present
    if (__DEV__ && data.verses?.[0]) {
      console.log('✅ Tajweed API Response Sample:', {
        surah: surahNumber,
        verse_key: data.verses[0].verse_key,
        has_tajweed: !!data.verses[0].text_uthmani_tajweed,
        tajweed_sample: data.verses[0].text_uthmani_tajweed?.substring(0, 100),
      });
    }
    
    return data.verses || [];
  } catch (error) {
    console.error(`[fetchSurahWithTajweed] Error fetching surah ${surahNumber}:`, error);
    return null;
  }
}
