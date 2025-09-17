import { Verse } from '@/types';
import { addFailedVerse, cacheVerses } from '@/database/QuranDatabase';
import { generateSharedAudioUrl } from '@/utils/audioUtils';
import { useSettingsStore } from '@/store/settingsStore';

const ALQURAN_CLOUD_API = 'https://api.alquran.cloud/v1';

// API response interfaces
interface AlQuranCloudAyahResponse {
  code: number;
  status: string;
  data: {
    number: number;
    text: string;
    edition: {
      identifier: string;
      language: string;
      name: string;
      englishName: string;
      format: string;
      type: string;
    };
    surah: {
      number: number;
      name: string;
      englishName: string;
      englishNameTranslation: string;
      numberOfAyahs: number;
      revelationType: string;
    };
    numberInSurah: number;
    juz: number;
    manzil: number;
    page: number;
    ruku: number;
    hizbQuarter: number;
    sajda: boolean;
  };
}

// Circuit breaker to prevent cascading failures
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 30000; // 30 seconds

  canExecute(): boolean {
    if (this.failures >= this.threshold) {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.failures = 0; // Reset after timeout
        return true;
      }
      return false;
    }
    return true;
  }

  onSuccess(): void {
    this.failures = 0;
  }

  onFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
  }
}

const circuitBreaker = new CircuitBreaker();

// Cache transliteration availability per language code to avoid repeated failures
const transliterationAvailability: Record<string, boolean | undefined> = {};

async function fetchTransliterationText(
  surahNumber: number,
  verseNumber: number,
  preferredLangCode: string
): Promise<string | undefined> {
  try {
    // Default to English unless we KNOW preferred language is available
    const preferEnglish = preferredLangCode !== 'en' && transliterationAvailability[preferredLangCode] !== true;
    if (preferEnglish) {
      const enResp = await fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/en.transliteration`);
      if (enResp.ok) {
        const enData: AlQuranCloudAyahResponse = await enResp.json();
        return enData?.data?.text || undefined;
      }
      // If English failed (rare), try preferred once
      const fallbackPreferredEdition = `${preferredLangCode}.transliteration`;
      const fallbackResp = await fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/${fallbackPreferredEdition}`);
      if (fallbackResp.ok) {
        transliterationAvailability[preferredLangCode] = true;
        const data: AlQuranCloudAyahResponse = await fallbackResp.json();
        return data?.data?.text || undefined;
      } else {
        transliterationAvailability[preferredLangCode] = false;
      }
      return undefined;
    }

    // Known-available preferred language: use it first
    const preferredEdition = `${preferredLangCode}.transliteration`;
    let resp = await fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/${preferredEdition}`);
    if (resp.ok) {
      transliterationAvailability[preferredLangCode] = true;
      const data: AlQuranCloudAyahResponse = await resp.json();
      return data?.data?.text || undefined;
    }

    // If preferred failed, fall back to English and mark unavailable
    if (preferredLangCode !== 'en') {
      transliterationAvailability[preferredLangCode] = false;
      resp = await fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/en.transliteration`);
      if (resp.ok) {
        const data: AlQuranCloudAyahResponse = await resp.json();
        return data?.data?.text || undefined;
      }
    }
  } catch {
    // Ignore errors; fallback to undefined
  }
  return undefined;
}

// Improved fetch with shorter timeout for lazy loading
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// Improved retry logic with better backoff
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2, // Reduced retries for lazy loading
  initialDelay: number = 1000,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = initialDelay * Math.pow(1.5, attempt - 1);
      const jitter = Math.random() * 500;
      const finalDelay = delay + jitter;
      
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }
  
  throw lastError!;
}

// Calculate verse ID
function calculateVerseId(surahNumber: number, verseNumber: number): number {
  const surahVerseCounts = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
    123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
    60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
    5, 4, 5, 6
  ];
  
  let id = 0;
  for (let i = 1; i < surahNumber; i++) {
    if (i <= surahVerseCounts.length) {
      id += surahVerseCounts[i - 1];
    }
  }
  return id + verseNumber;
}

// Generate audio URL (delegate to shared util which respects reciter setting)
function generateAudioUrl(surahNumber: number, verseNumber: number): string {
  const reciterIdentifier = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
  return generateSharedAudioUrl(surahNumber, verseNumber, reciterIdentifier);
}

// Improved request queue for lazy loading
class LazyLoadingQueue {
  private activeRequests = new Map<string, Promise<any>>();
  private readonly maxConcurrent = 3; // Allow some concurrency for lazy loading
  private readonly delayBetweenRequests = 800;

  async add<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Return existing request if already in progress
    if (this.activeRequests.has(key)) {
      return this.activeRequests.get(key) as Promise<T>;
    }

    // Wait if too many concurrent requests
    while (this.activeRequests.size >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const promise = this.executeRequest(key, requestFn);
    this.activeRequests.set(key, promise);
    
    return promise;
  }

  private async executeRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    try {
      const result = await requestFn();
      
      // Add delay before removing from active requests
      setTimeout(() => {
        this.activeRequests.delete(key);
      }, this.delayBetweenRequests);
      
      return result;
    } catch (error) {
      this.activeRequests.delete(key);
      throw error;
    }
  }
}

const lazyQueue = new LazyLoadingQueue();

// Improved single verse fetch with fallback editions
export async function fetchSingleVerse(
  surahNumber: number,
  verseNumber: number,
  translationLanguage: string = 'en.asad',
  reciterIdentifier: string = 'ar.alafasy'
): Promise<Verse | null> {
  const key = `${surahNumber}:${verseNumber}`;
  
  // Check circuit breaker
  if (!circuitBreaker.canExecute()) {
    console.warn(`Circuit breaker open for ${key}`);
    return null;
  }
  
  return lazyQueue.add(key, () => 
    fetchWithRetry(
      async () => {
        // Check if Tajweed mode is enabled
        const arabicFont = useSettingsStore.getState().arabicFont;
        const useTajweed = arabicFont === 'tajweed';
        
        // Primary editions
        let arabicEdition = useTajweed ? 'quran-tajweed' : 'ar.alafasy';
        let translationEdition = translationLanguage;
        const wantTransliteration = !!useSettingsStore.getState().showTransliteration;
        // Use translation language for transliteration, fallback to English if unavailable (cached)
        const preferredLangCode = (translationLanguage.split('.')[0] || 'en').toLowerCase();
        
        try {
          const [arabicResponse, translationResponse] = await Promise.all([
            fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/${arabicEdition}`),
            fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/${translationEdition}`)
          ]);
          
          if (!arabicResponse.ok || !translationResponse.ok) {
            throw new Error(`HTTP error: ${arabicResponse.status} or ${translationResponse.status}`);
          }
          
          const arabicData: AlQuranCloudAyahResponse = await arabicResponse.json();
          const translationData: AlQuranCloudAyahResponse = await translationResponse.json();
          let transliterationText: string | undefined = undefined;

          if (wantTransliteration) {
            transliterationText = await fetchTransliterationText(surahNumber, verseNumber, preferredLangCode);
          }
          
          if (!arabicData.data || !translationData.data) {
            throw new Error('No verse data returned');
          }
          
          const verseId = calculateVerseId(surahNumber, verseNumber);
          
          // For Tajweed mode, we need to fetch both regular and Tajweed text
          let arabicTextPlain = '';
          if (useTajweed) {
            // Fetch plain Arabic text as fallback
            try {
              const plainResponse = await fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/ar.alafasy`);
              if (plainResponse.ok) {
                const plainData: AlQuranCloudAyahResponse = await plainResponse.json();
                arabicTextPlain = plainData.data?.text || '';
              }
            } catch (e) {
              console.warn('Failed to fetch plain Arabic text for Tajweed fallback');
            }
          }
          
          const verse: Verse = {
            id: verseId,
            surahId: surahNumber,
            verseNumber: verseNumber,
            arabicText: useTajweed ? arabicTextPlain : (arabicData.data.text || ''),
            tajweedText: useTajweed ? (arabicData.data.text || '') : undefined,
            translation: translationData.data.text || '',
            transliteration: transliterationText,
            audioUrl: generateSharedAudioUrl(surahNumber, verseNumber, reciterIdentifier),
            juzNumber: arabicData.data.juz || 1,
            hizbNumber: Math.ceil((arabicData.data.hizbQuarter || 1) / 4),
            pageNumber: arabicData.data.page || 1,
          };
          
          circuitBreaker.onSuccess();
          return verse;
          
        } catch (primaryError) {
          console.warn(`Primary editions failed for ${key}, trying fallbacks:`, primaryError);
          
          // Fallback editions
          arabicEdition = 'ar.asad'; // Different Arabic edition
          translationEdition = 'en.sahih'; // Different translation (fallback)
          // Transliteration handled via helper with cached availability
          
          try {
            const [arabicResponse, translationResponse] = await Promise.all([
              fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/${arabicEdition}`),
              fetchWithTimeout(`${ALQURAN_CLOUD_API}/ayah/${surahNumber}:${verseNumber}/${translationEdition}`)
            ]);
            
            if (!arabicResponse.ok || !translationResponse.ok) {
              throw new Error(`Fallback HTTP error: ${arabicResponse.status} or ${translationResponse.status}`);
            }
            
            const arabicData: AlQuranCloudAyahResponse = await arabicResponse.json();
            const translationData: AlQuranCloudAyahResponse = await translationResponse.json();
            let transliterationText: string | undefined = undefined;
            if (wantTransliteration) {
              transliterationText = await fetchTransliterationText(surahNumber, verseNumber, preferredLangCode);
            }
            
            if (!arabicData.data || !translationData.data) {
              throw new Error('No fallback verse data returned');
            }
            
            const verseId = calculateVerseId(surahNumber, verseNumber);
            
            const verse: Verse = {
              id: verseId,
              surahId: surahNumber,
              verseNumber: verseNumber,
              arabicText: arabicData.data.text || '',
              tajweedText: undefined, // Tajweed not available in fallback
              translation: translationData.data.text || '',
              transliteration: transliterationText,
              audioUrl: generateSharedAudioUrl(surahNumber, verseNumber, reciterIdentifier),
              juzNumber: arabicData.data.juz || 1,
              hizbNumber: Math.ceil((arabicData.data.hizbQuarter || 1) / 4),
              pageNumber: arabicData.data.page || 1,
            };
            
            circuitBreaker.onSuccess();
            return verse;
            
          } catch (fallbackError) {
            console.error(`Both primary and fallback failed for ${key}:`, fallbackError);
            throw fallbackError;
          }
        }
      },
      2, // Reduced retries for lazy loading
      1000,
      (attempt, error) => {
        console.warn(`Retry ${attempt}/2 for ${key}: ${error.message}`);
      }
    ).catch(error => {
      console.error(`Failed to fetch ${key}:`, error);
      circuitBreaker.onFailure();
      addFailedVerse(surahNumber, verseNumber);
      return null;
    })
  );
}

// Improved lazy loading with partial success handling
export async function fetchVersesBySurah(
  surahId: number,
  page: number = 1,
  pageSize: number = 10,
  translationLanguage: string = 'en.asad'
): Promise<{ verses: Verse[], total: number, errors: string[] }> {
  console.log(`[LAZY] Fetching surah ${surahId}, page ${page}, pageSize ${pageSize}`);
  
  const surahVerseCounts = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
    123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
    60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
    5, 4, 5, 6
  ];
  
  const totalVersesInSurah = surahVerseCounts[surahId - 1] || 0;
  
  if (totalVersesInSurah === 0) {
    return { verses: [], total: 0, errors: ['Invalid surah ID'] };
  }
  
  const startVerse = (page - 1) * pageSize + 1;
  const endVerse = Math.min(startVerse + pageSize - 1, totalVersesInSurah);
  
  if (startVerse > totalVersesInSurah) {
    return { verses: [], total: totalVersesInSurah, errors: [] };
  }
  
  const verses: Verse[] = [];
  const errors: string[] = [];
  
  // Use Promise.all instead of Promise.allSettled for better compatibility
  const promises = [];
  for (let verseNumber = startVerse; verseNumber <= endVerse; verseNumber++) {
    promises.push(
      fetchSingleVerse(surahId, verseNumber, translationLanguage, useSettingsStore.getState().reciterIdentifier)
        .then(verse => ({ verseNumber, verse, error: null }))
        .catch(error => ({ verseNumber, verse: null, error: error instanceof Error ? error.message : 'Unknown error' }))
    );
  }
  
  const results = await Promise.all(
    promises.map(p => p.catch(error => ({ 
      verseNumber: 0, 
      verse: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })))
  );
  
  for (const result of results) {
    if (result.verse) {
      verses.push(result.verse);
    } else if (result.error) {
      errors.push(`Verse ${surahId}:${result.verseNumber} - ${result.error}`);
    }
  }
  
  // Sort verses by verse number
  verses.sort((a, b) => a.verseNumber - b.verseNumber);
  
  // Cache successfully fetched verses in batches to avoid database locks
  if (verses.length > 0) {
    try {
      await cacheVerses(verses);
    } catch (cacheError) {
      console.warn('Failed to cache verses:', cacheError);
      errors.push('Caching failed');
    }
  }
  
  console.log(`[LAZY] Fetched ${verses.length}/${endVerse - startVerse + 1} verses for surah ${surahId}, page ${page}`);
  
  return {
    verses,
    total: totalVersesInSurah,
    errors
  };
}

// Network connectivity check
export async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${ALQURAN_CLOUD_API}/meta`, {
      method: 'HEAD',
    }, 3000);
    return response.ok;
  } catch {
    return false;
  }
}

// Batch download with better error recovery
export async function smartDownloadSurah(
  surahId: number,
  onProgress?: (completed: number, total: number, currentVerse?: string) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; downloadedCount: number; totalCount: number; errors: string[] }> {
  console.log(`Starting smart download for surah ${surahId}...`);
  
  const surahVerseCounts = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
    123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
    60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
    5, 4, 5, 6
  ];
  
  const totalCount = surahVerseCounts[surahId - 1] || 0;
  let downloadedCount = 0;
  const errors: string[] = [];
  const batchSize = 5; // Process in small batches
  
  for (let startVerse = 1; startVerse <= totalCount; startVerse += batchSize) {
    if (signal?.aborted) {
      break;
    }
    
    const endVerse = Math.min(startVerse + batchSize - 1, totalCount);
    const batchPromises = [];
    
    for (let verseNumber = startVerse; verseNumber <= endVerse; verseNumber++) {
      batchPromises.push(
        fetchSingleVerse(surahId, verseNumber, 'en.asad', useSettingsStore.getState().reciterIdentifier)
          .then(verse => {
            if (verse) {
              downloadedCount++;
              if (onProgress) {
                onProgress(downloadedCount, totalCount, `${surahId}:${verseNumber}`);
              }
              // Cache individual verses immediately
              return cacheVerses([verse]).catch((err: Error) => {
                errors.push(`Cache error for ${surahId}:${verseNumber}: ${err.message}`);
              });
            }
          })
          .catch((error: unknown) => {
            errors.push(`Download error for ${surahId}:${verseNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            if (onProgress) {
              onProgress(downloadedCount, totalCount, `${surahId}:${verseNumber}`);
            }
          })
      );
    }
    
    await Promise.all(
      batchPromises.map(p => p.catch((error: unknown) => {
        if (error instanceof Error) {
          errors.push(error.message);
        } else {
          errors.push('Unknown error occurred');
        }
      }))
    );
    
    // Longer delay between batches
    if (endVerse < totalCount) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return {
    success: downloadedCount > 0,
    downloadedCount,
    totalCount,
    errors
  };
}