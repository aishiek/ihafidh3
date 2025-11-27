import getLogger from '@/utils/logger';
import { Platform } from 'react-native';
import type { MushafInfo, MushafPageRow } from '../types/mushaf.types';
import LayoutService from './layoutService';

const logger = getLogger('MushafMetadataService');

// Prevent concurrent initialization
let isInitializing: boolean = false;
let initPromise: Promise<any> | null = null;
// Keep a single subscription reference so we don't register duplicate listeners
let layoutListenerUnsub: (() => void) | null = null;

/**
 * Initialize and validate that LayoutService is ready.
 * Does NOT return a DB reference - callers should get fresh DB from LayoutService.
 */
export async function initMushafDB(): Promise<void> {
  // Prevent concurrent initialization attempts
  if (isInitializing && initPromise) {
    logger.debug('[initMushafDB] Already initializing, waiting...');
    return initPromise;
  }

  isInitializing = true;
  initPromise = performInit();

  try {
    await initPromise;
  } finally {
    isInitializing = false;
    initPromise = null;
  }
}

// Listen for DB swaps and reset local initialization cache
try {
  if (!layoutListenerUnsub) {
    layoutListenerUnsub = LayoutService.onDatabaseChange(() => {
      logger.info('[mushafMetadataService] Layout DB changed - resetting init cache');
      initPromise = null;
      isInitializing = false;
    });
  }
} catch (e) {
  // ignore if subscription isn't available at module load
}

async function performInit(): Promise<void> {
  try {
    logger.info('[initMushafDB] Validating LayoutService...');

    const layoutInitialized = await LayoutService.initializeDefaultLayout();
    if (!layoutInitialized) {
      throw new Error('Failed to initialize LayoutService');
    }

    // Small delay on Android
    if (Platform.OS === 'android') {
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Verify DB is accessible
    const db = LayoutService.getActiveDb();
    if (!db) {
      throw new Error('LayoutService has no active database');
    }

    // Quick validation
    await db.getFirstAsync('SELECT 1');
    logger.info('[initMushafDB] ✅ LayoutService validated, DB ready');
  } catch (error) {
    logger.error('[initMushafDB] ❌ Validation failed:', error);
    throw error;
  }
}

/**
 * Retry wrapper for DB operations to handle race conditions when DB is closed during layout switches.
 * If a query fails with a database error, retries once with a fresh DB connection.
 */
async function withDbRetry<T>(
  operation: (db: any) => Promise<T>,
  operationName: string
): Promise<T> {
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      const db = LayoutService.getActiveDb();
      if (!db) {
        throw new Error('No active database');
      }

      return await operation(db);
    } catch (error: any) {
      const errorMsg = String(error?.message || error || '').toLowerCase();
      const isDbError = errorMsg.includes('database') ||
        errorMsg.includes('closed') ||
        errorMsg.includes('not open') ||
        errorMsg.includes('connection');

      if (isDbError && attempt < maxAttempts - 1) {
        logger.warn(`[${operationName}] DB error (attempt ${attempt + 1}), retrying with fresh connection...`, errorMsg);
        attempt++;
        await new Promise(r => setTimeout(r, 100)); // Small delay before retry
        continue;
      }

      // Not a DB error or max attempts reached
      throw error;
    }
  }

  throw new Error(`${operationName} failed after ${maxAttempts} attempts`);
}

export async function getMushafInfo(db: any): Promise<MushafInfo | null> {
  if (!db) return null;
  const row = await db.getFirstAsync('SELECT * FROM info LIMIT 1');
  if (!row) return null;
  return {
    name: row.name,
    number_of_pages: row.number_of_pages,
    lines_per_page: row.lines_per_page,
    font_name: row.font_name,
  };
}

export async function getPageInfo(db: any, pageNumber: number): Promise<MushafPageRow | null> {
  if (!db) return null;
  const row = await db.getFirstAsync('SELECT * FROM pages WHERE page_number = ?', [pageNumber]);
  if (!row) return null;
  return row as MushafPageRow;
}

export async function getPageRange(db: any, startPage: number, endPage: number): Promise<MushafPageRow[]> {
  if (!db) return [];
  const rows = await db.getAllAsync('SELECT * FROM pages WHERE page_number BETWEEN ? AND ?', [startPage, endPage]);
  return (rows || []) as MushafPageRow[];
}

export async function getWordsInRange(db: any, firstId: number, lastId: number): Promise<{ id: number; text: string, tajweed_rule?: string }[]> {
  if (!db) return [];
  const rows = await db.getAllAsync('SELECT id, text, tajweed_rule FROM items WHERE id BETWEEN ? AND ? ORDER BY id ASC', [firstId, lastId]);
  return (rows || []) as { id: number; text: string, tajweed_rule?: string }[];
}

export interface PageMetadata {
  pageNumber: number;
  surahNumber: number | null;
  surahName: string | null;
  juzNumber: number | null;
}

export async function getPageMetadata(pageNumber: number): Promise<PageMetadata> {
  return withDbRetry(async (db) => {
    try {
      // Get the first line of the page to determine surah
      let row: any;
      try {
        // Try getting juz_number (works for Madina/Warsh)
        row = await db.getFirstAsync(
          'SELECT surah_number, juz_number FROM pages WHERE page_number = ? ORDER BY line_number ASC LIMIT 1',
          [pageNumber]
        );
      } catch (e) {
        // Fallback for Indopak (no juz_number column)
        row = await db.getFirstAsync(
          'SELECT surah_number FROM pages WHERE page_number = ? ORDER BY line_number ASC LIMIT 1',
          [pageNumber]
        );
      }

      if (!row) {
        return {
          pageNumber,
          surahNumber: null,
          surahName: null,
          juzNumber: null,
        };
      }

      // Import surah data to get the name
      const { surahsData } = await import('../../../data/surahs');
      const surahInfo = surahsData.find((s: any) => s.id === row.surah_number);

      let juzNumber: number | null = row.juz_number || null;

      if (juzNumber == null) {
        try {
          const verses = await getPageVerses(pageNumber);
          if (verses && verses.length > 0) {
            const first = verses[0];
            let globalId = 0;
            for (let i = 1; i < first.surahNumber; i++) {
              const prev = surahsData.find((s: any) => s.id === i);
              if (prev) globalId += prev.versesCount;
            }
            globalId += first.ayahNumber;

            const { getAllJuzRanges } = await import('../../../utils/juzCalculator');
            const ranges = getAllJuzRanges();
            const found = ranges.find(r => globalId >= r.startVerseId && globalId <= r.endVerseId);
            if (found) juzNumber = found.juzNumber;
          }
        } catch (e) {
          logger.warn('[getPageMetadata] could not compute juz for page', pageNumber, e);
        }
      }

      return {
        pageNumber,
        surahNumber: row.surah_number || null,
        surahName: surahInfo?.name || null,
        juzNumber: juzNumber,
      };
    } catch (error) {
      logger.error('[getPageMetadata] Error:', error);
      return {
        pageNumber,
        surahNumber: null,
        surahName: null,
        juzNumber: null,
      };
    }
  }, 'getPageMetadata');
}

export async function getPageVerses(pageNumber: number): Promise<{ surahNumber: number; ayahNumber: number }[]> {
  return withDbRetry(async (db) => {
    // Step 1: Query pages table for word ranges on this page
    let lines: any[] = [];
    try {
      lines = await db.getAllAsync(
        `SELECT first_word_id, last_word_id 
         FROM pages 
         WHERE page_number = ? AND line_type = 'ayah'
         ORDER BY line_number`,
        [pageNumber]
      );
    } catch (queryErr) {
      logger.error('[getPageVerses] Failed to query pages table:', queryErr);
      return [];
    }

    if (!lines || lines.length === 0) {
      logger.warn(`[getPageVerses] No ayah lines found for page ${pageNumber}`);
      return [];
    }

    // Step 2: Query words table from SAME database (no second connection needed!)
    // The words table is now merged into qudratullah-indopak-15-lines.db
    // OPTIMIZATION: Batch query to fetch all words for the page in one go

    // Find min and max word IDs for the whole page
    let minId = Infinity;
    let maxId = -Infinity;
    let hasValidLines = false;

    for (const line of lines) {
      if (line.first_word_id && line.last_word_id) {
        minId = Math.min(minId, line.first_word_id);
        maxId = Math.max(maxId, line.last_word_id);
        hasValidLines = true;
      }
    }

    if (!hasValidLines) {
      logger.warn(`[getPageVerses] No valid word ranges found for page ${pageNumber}`);
      return [];
    }

    const verseSet = new Set<string>();
    let allWords: Array<{ surah: number; ayah: number }> = [];

    try {
      // Query words directly from the same db. If this DB doesn't contain `words`, fallback to the separate words DB.
      try {
        allWords = (await db.getAllAsync(
          `SELECT DISTINCT surah, ayah FROM words WHERE id BETWEEN ? AND ? ORDER BY surah ASC, ayah ASC`,
          [minId, maxId]
        )) as Array<{ surah: number; ayah: number }>;
      } catch (errWordsTable) {
        // Layout DB doesn't have words table — try centralized words DB
        try {
          const LayoutService = (await import('./layoutService')).default;
          const wordsDb = await LayoutService.getWordsDb();
          if (wordsDb) {
            allWords = (await wordsDb.getAllAsync(
              `SELECT DISTINCT surah, ayah FROM words WHERE id BETWEEN ? AND ? ORDER BY surah ASC, ayah ASC`,
              [minId, maxId]
            )) as Array<{ surah: number; ayah: number }>;
          }
        } catch (e) {
          logger.warn('[getPageVerses] fallback words DB failed', e);
        }
      }

      for (const word of allWords) {
        verseSet.add(`${word.surah}:${word.ayah}`);
      }
    } catch (e) {
      logger.warn('[getPageVerses] Failed to fetch verses for page range', minId, maxId, e);
    }

    // Convert to array and sort
    const verses = Array.from(verseSet)
      .map(key => {
        const [surah, ayah] = key.split(':').map(Number);
        return { surahNumber: surah, ayahNumber: ayah };
      })
      .sort((a, b) => {
        if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
        return a.ayahNumber - b.ayahNumber;
      });

    logger.debug(`[getPageVerses] Found ${verses.length} verses for page ${pageNumber}`);
    return verses;
  }, 'getPageVerses');
}

// Export a function to reset the initialization state if needed
export function resetDbCache() {
  logger.info('[resetDbCache] Resetting initialization state');
  isInitializing = false;
  initPromise = null;
}
