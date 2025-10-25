import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { surahsData } from '../../../data/surahs';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';

// Constants
const DB_NAME = 'qudratullah-indopak-15-lines.db';
const DB_PATH = `${MUSHAF_CACHE_DIR}/${DB_NAME}`;
// Expo FileSystem expects file:// URIs for local files. Normalize for Android.
const DB_URI = DB_PATH.startsWith('file://') ? DB_PATH : `file://${DB_PATH}`;
// Expo SQLite expects DBs to live under the app's SQLite directory (DocumentDirectory/SQLite)
const SQLITE_DIR = (FileSystem as any).documentDirectory + 'SQLite';
const TARGET_DB_PATH = `${SQLITE_DIR}/${DB_NAME}`;
const TAG = 'mushafSurahService';
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

// Logging utilities
const log = (msg: string, ...args: any[]) => {
  if (DEV) console.log(`[${TAG}] ${msg}`, ...args);
};

const logErr = (msg: string, err?: any) => {
  console.error(`[${TAG}] ${msg}`, err);
};

// Types
interface SurahInfo {
  id: number;
  name: string;
  page: number;
}

interface QueryResult {
  rows: {
    length: number;
    item: (index: number) => any;
  };
}

class MushafSurahService {
  private db: SQLite.SQLiteDatabase | null = null;

  /**
   * Initialize the Mushaf database connection
   * @throws {Error} If database file doesn't exist or connection fails
   */
  async initializeDatabase(): Promise<void> {
    // Verify database file exists. Use a file:// URI for expo FileSystem.
    const info = await FileSystem.getInfoAsync(DB_URI);
    if (!info.exists) {
      throw new Error(
        `Mushaf DB not found at ${DB_PATH}. Ensure download/extract completed.`
      );
    }

    // Ensure SQLite dir exists and copy DB into place where expo-sqlite opens by name
    try {
      const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
        log('Created SQLite dir:', SQLITE_DIR);
      }

      const targetInfo = await FileSystem.getInfoAsync(TARGET_DB_PATH);
        if (!targetInfo.exists) {
        // Copy from cache location to the SQLite dir so openDatabaseAsync(DB_NAME) finds it
        log('Copying Mushaf DB from cache to SQLite dir', DB_PATH, '->', TARGET_DB_PATH);
        await FileSystem.copyAsync({ from: DB_URI, to: TARGET_DB_PATH });
        log('DB copied to SQLite dir');
      }

      log('Opening database by name:', DB_NAME);
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      log('Database opened successfully');
      // Diagnostic: list tables to ensure 'pages' exists
      try {
        const tables = await this.db!.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", []);
        log('SQLite tables:', tables.map(t => t.name));
        const tableNames = tables.map(t => t.name);
        if (!tableNames.includes('pages')) {
          logErr('Pages table not found in opened DB; attempting packaged-asset fallback');
          try {
            // Close current DB before overwriting file
            try { await this.db!.closeAsync(); } catch (_) { /* ignore */ }

            // Resolve packaged asset (bundled DB)
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const ASSET_MODULE = require('../../../assets/database/qudratullah-indopak-15-lines.db');
            const asset = Asset.fromModule(ASSET_MODULE as any);
            await asset.downloadAsync();
            const assetPath = asset.localUri || asset.uri;
            if (!assetPath) throw new Error('Packaged Mushaf DB asset has no localUri');

            // Overwrite target DB
            log('Copying packaged DB asset to', TARGET_DB_PATH);
            await FileSystem.copyAsync({ from: assetPath, to: TARGET_DB_PATH });

            // Reopen DB
            this.db = await SQLite.openDatabaseAsync(DB_NAME);
            log('Reopened DB after packaged fallback');
            const newTables = await this.db!.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", []);
            log('SQLite tables after fallback:', newTables.map(t => t.name));
            if (!newTables.map(t => t.name).includes('pages')) {
              throw new Error('Packaged fallback DB does not contain pages table');
            }
          } catch (fallbackErr) {
            logErr('Packaged-asset fallback failed', fallbackErr);
            // rethrow to outer catch
            throw fallbackErr;
          }
        }
      } catch (tblErr) {
        logErr('Failed to read sqlite_master tables', tblErr);
      }
    } catch (err) {
      logErr('Failed to prepare/open database', err);
      throw err;
    }
  }

  /**
   * Check if database is initialized and ready
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Ensure database is initialized before operations
   * Auto-initializes if not already done
   * @throws {Error} If database file doesn't exist or initialization fails
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized()) {
      log('Database not initialized, attempting auto-initialization...');
      await this.initializeDatabase();
    }
  }

  /**
   * Get the starting page number for a specific surah
   * @param surahNumber - The surah number (1-114)
   * @returns The starting page number
   * @throws {Error} If database is not initialized
   */
  async getSurahStartPage(surahNumber: number): Promise<number> {
    await this.ensureInitialized();

    try {
      const sql = 'SELECT MIN(page_number) as p FROM pages WHERE surah_number = ?';
      const result = await this.db!.getFirstAsync<{ p: number }>(sql, [surahNumber]);
      const pageNumber = result?.p ?? 1;
      log(`Surah ${surahNumber} starts at page ${pageNumber}`);
      return pageNumber;
    } catch (e) {
      logErr('Failed to get surah start page', e);
      throw new Error(`Failed to get start page for surah ${surahNumber}`);
    }
  }

  /**
   * Get all surahs with their starting page numbers
   * @returns Array of surah information
   * @throws {Error} If database is not initialized
   */
  async getAllSurahs(): Promise<SurahInfo[]> {
    await this.ensureInitialized();

    try {
      // Select only surah id and starting page from the pages table.
      // Some packaged DBs don't include a `name` column which caused "no such column: name" errors on Android.
      // Map readable names from the local `surahsData` static list instead of relying on the DB schema.
      const sql = `
        SELECT surah_number as id, MIN(page_number) as page
        FROM pages
        GROUP BY surah_number
        ORDER BY surah_number
      `;
      const rows = await this.db!.getAllAsync<{ id: number; page: number }>(sql);
      const mapped = rows.map(r => ({
        id: r.id,
        page: r.page,
        name: surahsData.find(s => s.id === r.id)?.name ?? `Surah ${r.id}`,
      }));
      log(`Retrieved ${mapped.length} surahs`);
      return mapped;
    } catch (e) {
      logErr('Failed to get all surahs', e);
      throw new Error('Failed to retrieve surahs');
    }
  }

  /**
   * Close the database connection
   */
  async closeDatabase(): Promise<void> {
    if (!this.db) {
      log('Database already closed or not initialized');
      return;
    }

    try {
      await this.db.closeAsync();
      log('Database closed successfully');
      this.db = null;
    } catch (e) {
      logErr('Failed to close database', e);
      this.db = null;
    }
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