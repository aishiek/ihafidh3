import type { MushafPageLayout, MushafWordLayout } from '../types/mushaf.types';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';
// Note: tajweedParser exports color maps and parsers. For Mushaf we only need raw Arabic words.
// The app provides Quran text via database services; to keep this module decoupled we'll
// fallback to a simple placeholder that returns an empty string when the full DB isn't available.
import { TAJWEED_COLORS } from '@/utils/tajweedParser';
import RNFS from 'react-native-fs';
import { getPageInfo, getWordsInRange, initMushafDB } from './mushafMetadataService';

let _db: any = null;

async function ensureDB() {
  if (!_db) _db = await initMushafDB();
  return _db;
}

function mapTajweedColor(rule?: string | null): string | undefined {
  if (!rule) return undefined;
  return (TAJWEED_COLORS as Record<string,string>)[rule] || undefined;
}

// These are filled in per-page when possible
let _lastPageWordsCache: { page:number; words:{id:number;text:string,tajweed_rule?:string}[] } | null = null;

function getArabicWordFromCache(index: number): string {
  if (!_lastPageWordsCache) return '';
  const w = _lastPageWordsCache.words[index];
  return w ? w.text : '';
}

function getTajweedColorFromCache(index: number): string | undefined {
  if (!_lastPageWordsCache) return undefined;
  const w = _lastPageWordsCache.words[index];
  return w ? mapTajweedColor(w.tajweed_rule) : undefined;
}

export async function getPageLayout(pageNumber: number): Promise<MushafPageLayout> {
  try {
    // Safe require of JSON layout file inside the cache (may be downloaded at runtime)
    // Attempt first from local cache folder
    // NOTE: in development you may want to bundle a small sample under app/mushaf/assets for quick testing
    // Use dynamic import if available, fallback to fetch
    // Try several candidate locations for page JSON files so we accept different archive layouts
    const candidates = [
      `${MUSHAF_CACHE_DIR}/pages/${pageNumber}.json`,
      `${MUSHAF_CACHE_DIR}/json/${pageNumber}.json`,
      `${MUSHAF_CACHE_DIR}/mushaf-layouts/pages/${pageNumber}.json`
    ];

    let layoutJson: any = null;
    for (const p of candidates) {
      try {
        if (await RNFS.exists(p)) {
          const raw = await RNFS.readFile(p, 'utf8');
          layoutJson = JSON.parse(raw);
          console.log(`[MushafLayoutService] Loaded page JSON from ${p}`);
          break;
        }
      } catch (e) {
        // try next candidate
      }
    }

    if (!layoutJson) {
      // Not found in cache — surface an informative error
      throw new Error(`Mushaf page layout not found (tried: ${candidates.join(', ')})`);
    }

    const entries = Object.entries(layoutJson);
    // Try to populate words from DB page info (first_word_id/last_word_id). We'll map sequentially by order as a best-effort.
    try {
      const db = await ensureDB();
      const pageRow = await getPageInfo(db, pageNumber);
      if (pageRow && pageRow.first_word_id && pageRow.last_word_id) {
        const first = Number(pageRow.first_word_id);
        const last = Number(pageRow.last_word_id || first);
        const wordsFromDb = await getWordsInRange(db, first, last);
        _lastPageWordsCache = { page: pageNumber, words: wordsFromDb };
      } else {
        _lastPageWordsCache = null;
      }
    } catch (e) {
      _lastPageWordsCache = null;
    }

    const words: MushafWordLayout[] = entries.map(([key, coords]: any, idx) => {
      const parts = String(key).split(':').map((v) => Number(v));
      const surah = parts[0] || 0; const verse = parts[1] || 0; const word = parts[2] || 0;
      const text = getArabicWordFromCache(idx);
      const tajweedColor = getTajweedColorFromCache(idx);
      return {
        key,
        surah,
        verse,
        word,
        x: coords.x,
        y: coords.y,
        w: coords.w,
        h: coords.h,
        text,
        tajweedColor
      } as MushafWordLayout;
    });

    // Resolve the actual image file (may be named differently in archives)
    const resolvedImage = await getPageImageUriAsync(pageNumber);
    return {
      pageNumber,
      imageUri: resolvedImage,
      words,
      totalWords: words.length,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[MushafLayoutService] getPageLayout error', error);
    throw error;
  }
}

// Synchronous fallback kept for very old callers — prefer using getPageImageUriAsync
export function getPageImageUri(pageNumber: number): string {
  return `file://${MUSHAF_CACHE_DIR}/images/page_${pageNumber}.png`;
}

// Async resolver: checks several candidate filenames and returns the first that exists.
export async function getPageImageUriAsync(pageNumber: number): Promise<string> {
  const candidatesLocal = [
    `images/page_${pageNumber}.png`,
    `images/page-${pageNumber}.png`,
    `images/page${pageNumber}.png`,
    `images/${pageNumber}.png`,
    `images/${pageNumber}.PNG`,
    `images/${String(pageNumber).padStart(3,'0')}.png`,
  ];

  for (const rel of candidatesLocal) {
    const abs = `${MUSHAF_CACHE_DIR}/${rel}`;
    try {
      if (await RNFS.exists(abs)) {
        return `file://${abs}`;
      }
    } catch (e) {
      // ignore and try next
    }
  }

  // Last-resort: return the conventional page_ pattern even if missing — caller should handle Image onError
  return `file://${MUSHAF_CACHE_DIR}/images/page_${pageNumber}.png`;
}
