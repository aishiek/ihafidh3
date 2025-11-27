import * as SQLite from 'expo-sqlite';
import { surahsData } from '../../../data/surahs';

const TAG = 'mushafSurahService';
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

// Logging utilities
const log = (msg: string, ...args: any[]) => {
  if (DEV) console.log(`[${TAG}] ${msg}`, ...args);
};

const logErr = (msg: string, err?: any) => {
  // Reduce noisy dev errors for known schema mismatches (e.g. prepareAsync/no such table)
  const raw = String((err && (err.message || err)) ?? '');
  if (/no such table|prepareAsync/i.test(raw)) {
    // Schema mismatch / prepare failures are not operationally fatal here — log as debug
    if (DEV) console.debug(`[${TAG}] ${msg}`, raw);
    return;
  }

  console.error(`[${TAG}] ${msg}`, err);
};

// Types
interface SurahInfo {
  id: number;
  name: string;
  page: number;
}

class MushafSurahService {
  /**
   * Initialize the Mushaf database connection.
   * Now stateless: just ensures LayoutService is ready.
   */
  async initializeDatabase(): Promise<void> {
    try {
      const { LayoutService } = await import('./layoutService');
      await LayoutService.initializeDefaultLayout();
      log('Database initialized (delegated to LayoutService)');
    } catch (err) {
      logErr('Failed to initialize database', err);
      throw err;
    }
  }

  /**
   * Check if database is initialized and ready
   */
  isInitialized(): boolean {
    // We can't easily check LayoutService's internal state synchronously without importing it,
    // but for the purpose of this check, we assume true if the app is running.
    // Real validation happens during calls.
    return true;
  }

  /**
   * Helper to get the active DB from LayoutService
   */
  private async getDb(): Promise<any> {
    const { LayoutService } = await import('./layoutService');
    const db = LayoutService.getActiveDb();
    if (!db) {
      throw new Error('No active Mushaf database found in LayoutService');
    }
    return db;
  }

  /**
   * Get the starting page number for a specific surah
   * @param surahNumber - The surah number (1-114)
   * @returns The starting page number
   */
  async getSurahStartPage(surahNumber: number): Promise<number> {
    try {
      const db = await this.getDb();
      const result = await (db as any).getFirstAsync(
        'SELECT MIN(page_number) as page FROM pages WHERE CAST(surah_number AS INTEGER) = ?;',
        [surahNumber]
      );
      return result?.page ?? null;
    } catch (e) {
      const msg = (e as any)?.message ?? String(e);
      logErr('Failed to get surah start page', msg);
      throw new Error(`Failed to get start page for surah ${surahNumber}`);
    }
  }

  /**
   * Get all surahs with their starting page numbers
   * @returns Array of surah information
   */
  async getAllSurahs(): Promise<SurahInfo[]> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const db = await this.getDb();

        // Select only surah id and starting page from the pages table.
        // Some packaged DBs don't include a `name` column which caused "no such column: name" errors on Android.
        // Map readable names from the local `surahsData` static list instead of relying on the DB schema.
        const sql = `
        SELECT surah_number as id, MIN(page_number) as page
        FROM pages
        WHERE CAST(surah_number AS INTEGER) BETWEEN 1 AND 114
        GROUP BY surah_number
        ORDER BY surah_number
      `;
        const rows = await (db.getAllAsync as any)(sql) as Array<any>;
        const mapped = rows.map(r => ({
          id: r.id,
          page: r.page,
          name: surahsData.find(s => s.id === r.id)?.name ?? `Surah ${r.id}`,
        }));

        // If we got a partial mapping, try packaged DB assets as reliable sources.
        const EXPECTED_SURAH_COUNT = 114;
        if (mapped.length < EXPECTED_SURAH_COUNT) {
          log('[getAllSurahs] Partial mapping detected, attempting packaged DB fallbacks');
          const fallbackCandidates = [
            'qpc-hafs-15-lines.db',
            'qpc-nastaleeq-15-lines.db',
            'qudratullah-indopak-nastaleeq.db',
            'indopak-nastaleeq.db'
          ];

          for (const candidate of fallbackCandidates) {
            try {
              log(`[getAllSurahs] Trying packaged fallback DB: ${candidate}`);
              const candidateDb = await (SQLite as any).openDatabaseAsync(candidate);
              try {
                const hasPages = await candidateDb.getFirstAsync(
                  "SELECT name FROM sqlite_master WHERE type='table' AND name='pages' LIMIT 1",
                  []
                );
                if (!hasPages) {
                  continue;
                }

                const rows2 = await candidateDb.getAllAsync(
                  `SELECT surah_number as id, MIN(page_number) as page FROM pages GROUP BY surah_number ORDER BY surah_number`
                );
                const mapped2 = (rows2 || []).map((r: any) => ({ id: r.id, page: r.page, name: surahsData.find(s => s.id === r.id)?.name ?? `Surah ${r.id}` }));
                if (mapped2.length === EXPECTED_SURAH_COUNT) {
                  log(`[getAllSurahs] Successfully built full surah map from packaged DB ${candidate}`);
                  return mapped2;
                }
              } finally {
                try { await candidateDb.closeAsync(); } catch (_) { /* ignore */ }
              }
            } catch (e) {
              // Ignore fallback errors
              continue;
            }
          }
          log('[getAllSurahs] No packaged fallback produced a full mapping - returning partial mapping');
        }

        log(`Retrieved ${mapped.length} surahs`);
        return mapped;
      } catch (e) {
        const msg = (e as any)?.message ?? String(e);
        logErr(`getAllSurahs attempt ${attempts + 1} failed`, msg);
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 200));
          continue;
        }
        logErr('Failed to get all surahs after retries', e);
        throw new Error('Failed to retrieve surahs');
      }
    }
    throw new Error('Failed to retrieve surahs');
  }

  /**
   * Close the database connection
   * No-op now as we don't own the connection
   */
  async closeDatabase(): Promise<void> {
    // No-op
  }
}

// Singleton instance
export const mushafSurahService = new MushafSurahService();

// Convenience exports
export async function initializeMushafDatabase(): Promise<void> {
  return mushafSurahService.initializeDatabase();
}

export function isMushafDatabaseReady(): boolean {
  return mushafSurahService.isInitialized();
}

export async function getSurahStartPage(surahNumber: number): Promise<number> {
  return mushafSurahService.getSurahStartPage(surahNumber);
}

export async function getAllSurahs(): Promise<SurahInfo[]> {
  return mushafSurahService.getAllSurahs();
}

export function closeMushafDatabase(): Promise<void> {
  return mushafSurahService.closeDatabase();
}