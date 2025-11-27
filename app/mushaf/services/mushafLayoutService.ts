import type { MushafPageLayout, MushafWordLayout } from '../types/mushaf.types';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';
// Note: tajweedParser exports color maps and parsers. For Mushaf we only need raw Arabic words.
// The app provides Quran text via database services; to keep this module decoupled we'll
// fallback to a simple placeholder that returns an empty string when the full DB isn't available.
import { TAJWEED_COLORS } from '@/utils/tajweedParser';
import RNFS from 'react-native-fs';
import LayoutService from './layoutService';
import { getPageInfo, getWordsInRange, initMushafDB } from './mushafMetadataService';

/**
 * CRITICAL FIX: Always get fresh DB reference from LayoutService
 * Never cache database references as they become stale when:
 *  - Switching surahs
 *  - Changing layouts
 *  - Re-initializing the app
 */
async function ensureDB() {
  // Try to initialize the mushaf DB. initMushafDB may throw if the layout is in
  // progress of switching, files are missing, or OS-level file locks occur.
  try {
    await initMushafDB();
  } catch (err: any) {
    // Convert initialization errors (including lock/busy conditions) to a handled
    // error the rest of the module understands. This prevents callers from
    // crashing the app and allows graceful degradation (image-only mode).
    const msg = String(err?.message || err || '');
    if (msg.includes('locked') || msg.includes('busy') || msg.includes('timed out') || msg.includes('not found')) {
      console.info('[MushafLayoutService] initMushafDB signalled not-ready:', msg);
      throw new Error('DATABASE_NOT_READY');
    }
    // For any other error, still treat as not-ready since callers handle that
    // scenario gracefully. Avoid throwing unhandled errors here.
    console.warn('[MushafLayoutService] initMushafDB failed, marking DB not ready:', msg);
    throw new Error('DATABASE_NOT_READY');
  }

  // Always obtain fresh active DB reference from LayoutService. If it's missing
  // (e.g. during a swap), throw DATABASE_NOT_READY so callers can degrade.
  const db = LayoutService.getActiveDb();
  if (!db) {
    console.info('[MushafLayoutService] Active DB not available yet (swapping)');
    throw new Error('DATABASE_NOT_READY');
  }

  // Optional: perform a lightweight probe to ensure DB is responsive and not
  // locked. If the probe fails with a lock/busy error, return DATABASE_NOT_READY.
  try {
    // Some SQLite wrappers expose getFirstAsync — use a simple probe query.
    if (typeof db.getFirstAsync === 'function') {
      await db.getFirstAsync('SELECT 1', []);
    }
  } catch (probeErr: any) {
    const probeMsg = String(probeErr?.message || probeErr || '');
    if (probeMsg.includes('locked') || probeMsg.includes('busy') || probeMsg.includes('lock')) {
      console.info('[MushafLayoutService] DB probe failed with lock/busy, treating as not ready:', probeMsg);
      throw new Error('DATABASE_NOT_READY');
    }
    // If probe failed for some other reason, treat DB as not-ready too (safer)
    console.warn('[MushafLayoutService] DB probe failed, treating as not ready:', probeMsg);
    throw new Error('DATABASE_NOT_READY');
  }

  return db;
}

function mapTajweedColor(rule?: string | null): string | undefined {
  if (!rule) return undefined;
  return (TAJWEED_COLORS as Record<string,string>)[rule] || undefined;
}

// These are filled in per-page when possible
let _lastPageWordsCache: { page:number; words:{id:number;text:string,tajweed_rule?:string}[] } | null = null;

// Ensure we don't hold stale DB references. When LayoutService swaps DBs we must forget cached
// handles so callers will re-initialize via initMushafDB(). This prevents Android "database closed" errors.
try {
  // LayoutService is intentionally imported at top — register a listener to clear caches
  LayoutService.onDatabaseChange(() => {
    // Only clear the page-word cache; we do NOT cache DB references anymore
    _lastPageWordsCache = null;
    console.debug('[MushafLayoutService] Cleared page-word cache due to DB change');
  });
} catch (e) {
  // If LayoutService isn't ready at module load time (rare), ignore.
}

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
    } catch (e: any) {
      // If DB is being swapped, allow graceful degradation and return page without words
      if (e?.message === 'DATABASE_NOT_READY') {
        console.info('[MushafLayoutService] Database not ready - skipping word lookup for page', pageNumber);
      } else {
        console.warn('[MushafLayoutService] Failed to fetch words from DB:', e);
      }
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

  // Try current layout images first
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

  // Fallback: If active layout is warsh_15, try Indopak images
  try {
    const activeLayoutId = typeof LayoutService.getActiveLayoutId === 'function'
      ? await LayoutService.getActiveLayoutId()
      : (LayoutService.activeLayoutId || '');
    if (activeLayoutId === 'warsh_15') {
      for (const rel of candidatesLocal) {
        // Indopak images are usually in images/indopak/page_xxx.png
        const indopakAbs = `${MUSHAF_CACHE_DIR}/indopak/${rel.replace('images/', '')}`;
        if (await RNFS.exists(indopakAbs)) {
          return `file://${indopakAbs}`;
        }
      }
    }
  } catch (e) {
    // ignore fallback errors
  }

  // Last-resort: return the conventional page_ pattern even if missing — caller should handle Image onError
  return `file://${MUSHAF_CACHE_DIR}/images/page_${pageNumber}.png`;
}
