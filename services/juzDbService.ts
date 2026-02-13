import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { Alert, Platform } from 'react-native';

const DB_NAME = 'AlQurandb.sqlite3';
const SQLITE_DIR = FileSystem.documentDirectory + 'SQLite';
const DB_PATH = SQLITE_DIR + '/' + DB_NAME;

let ASSET_PATH: string | null = null;
let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let isInitializing = false;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Check whether the current DB connection is still usable. This helps recover
// after an app update where native modules may be reloaded and the JS-held
// `db` reference becomes invalid.
async function isConnectionAlive(): Promise<boolean> {
  if (!db) return false;
  try {
    // Simple lightweight query to validate connection
    // Use getFirstAsync for consistency with other calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).getFirstAsync('SELECT 1 as ok', []);
    return true;
  } catch (err) {
    logError('juzDbService', 'Connection health check failed', err);
    return false;
  }
}

const isDev = __DEV__;

function log(tag: string, message: string, ...args: any[]): void {
  if (isDev) {
    console.log(`[${tag}]`, message, ...args);
  }
}

function logError(tag: string, message: string, error?: any): void {
  console.error(`[${tag}]`, message, error);
}

async function loadAssetPath(): Promise<string> {
  if (ASSET_PATH) {
    return ASSET_PATH;
  }
  try {
    // For binary files like .sqlite3, use Asset.fromModule with require
    // But specify it as a module reference. Use a single-level relative path
    // from the `services` directory to the project's `assets` folder.
    const asset = Asset.fromModule(require('../assets/database/AlQurandb.sqlite3'));

    if (!asset) {
      throw new Error('Unable to resolve AlQurandb.sqlite3 asset');
    }

    log('juzDbService', 'Asset module found, downloading...');
    await asset.downloadAsync();
    ASSET_PATH = asset.localUri || asset.uri;
    log('juzDbService', 'Asset loaded:', ASSET_PATH);
    return ASSET_PATH;
  } catch (err) {
    logError('juzDbService', 'Failed to load asset path', err);

    // Fallback: try to load from app bundle directly
    try {
      const bundlePath = `${FileSystem.documentDirectory}../AlQurandb.sqlite3`;
      const info = await FileSystem.getInfoAsync(bundlePath);
      if (info.exists) {
        ASSET_PATH = bundlePath;
        log('juzDbService', 'Fallback: Found asset at bundle path:', ASSET_PATH);
        return ASSET_PATH;
      }
    } catch (fallbackErr) {
      logError('juzDbService', 'Fallback also failed', fallbackErr);
    }

    throw new Error('Unable to resolve AlQurandb.sqlite3 asset.');
  }
}

async function ensureSqliteDirectory(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
      log('juzDbService', 'Created SQLite directory:', SQLITE_DIR);
    }
  } catch (err) {
    logError('juzDbService', 'Error creating SQLite directory', err);
    throw err;
  }
}

async function copyDatabaseFile(): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
    if (!fileInfo.exists) {
      const assetPath = await loadAssetPath();
      log('juzDbService', 'Copying DB from', assetPath, 'to', DB_PATH);
      await FileSystem.copyAsync({
        from: assetPath,
        to: DB_PATH,
      });
      log('juzDbService', 'Successfully copied DB to SQLite directory');

      // CRITICAL: Android needs time for file system to sync
      // Without this, SQLite may try to open the file before it's fully written
      if (Platform.OS === 'android') {
        log('juzDbService', 'Android detected - waiting for file system sync...');
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Validate the copied file
      const copiedInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!copiedInfo.exists) {
        throw new Error('Database file does not exist after copy');
      }
      if (copiedInfo.size === 0) {
        throw new Error('Database file is empty after copy');
      }
      log('juzDbService', 'Database copy validated:', {
        exists: copiedInfo.exists,
        size: copiedInfo.size,
      });
    } else {
      log('juzDbService', 'DB already exists in SQLite directory');
    }
  } catch (err) {
    logError('juzDbService', 'Error during database copy/check', err);
    throw err;
  }
}

async function ensureDbCopied(): Promise<void> {
  if (isInitialized) {
    return;
  }
  try {
    await ensureSqliteDirectory();
    await copyDatabaseFile();
    isInitialized = true;
    log('juzDbService', 'Database initialization completed');
  } catch (err) {
    logError('juzDbService', 'Failed to ensure database is copied', err);
    throw err;
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // If we already have a valid db connection, return it
  if (db) {
    const alive = await isConnectionAlive();
    if (alive) {
      // Removed repetitive log - only log on first init or errors
      return db;
    }
    logError('juzDbService', 'Previous DB connection appears dead — resetting JS state');
    try {
      db.closeSync();
    } catch (e) {
      // ignore close errors
    }
    db = null;
    isInitialized = false;
  }

  // If initialization is already in progress, wait for it
  if (isInitializing && initPromise) {
    log('juzDbService', 'Database initialization already in progress, waiting...');
    return initPromise;
  }

  // Start new initialization
  isInitializing = true;
  initPromise = initializeDatabase();

  try {
    const database = await initPromise;
    db = database;
    return database;
  } catch (error) {
    // Reset state on failure
    db = null;
    isInitialized = false;
    throw error;
  } finally {
    isInitializing = false;
    initPromise = null;
  }
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  log('juzDbService', 'Starting database initialization...');

  try {
    // Ensure DB is copied to the file system
    await ensureDbCopied();

    // Try to open database with retry logic
    let database: SQLite.SQLiteDatabase | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        log('juzDbService', `Attempting to open database (attempt ${attempt}/3)...`);

        // Use async version for better Android compatibility
        database = await SQLite.openDatabaseAsync(DB_NAME);

        // Validate database is readable with a test query
        const testResult = await database.getFirstAsync<{ ok: number }>(
          'SELECT 1 as ok'
        );

        if (!testResult || testResult.ok !== 1) {
          throw new Error('Database validation failed - test query returned unexpected result');
        }

        // Verify verses table exists and has data
        const verseCount = await database.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM verses LIMIT 1'
        );

        log('juzDbService', 'Database opened and validated successfully:', {
          testQuery: testResult,
          hasVerses: verseCount && verseCount.count > 0,
        });

        // Success!
        isInitialized = true;
        break;

      } catch (err) {
        lastError = err as Error;
        logError('juzDbService', `Database open attempt ${attempt} failed:`, err);

        // Close any partially opened connection
        if (database) {
          try {
            database.closeSync();
          } catch (e) {
            // ignore
          }
          database = null;
        }

        if (attempt < 3) {
          // Exponential backoff: 500ms, 1000ms
          const delay = 500 * attempt;
          log('juzDbService', `Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!database) {
      const errorMsg = `Failed to open database after 3 attempts. Last error: ${lastError?.message || 'Unknown error'}`;
      logError('juzDbService', errorMsg);

      // Show user-facing error on device
      Alert.alert(
        '❌ Database Error',
        'Unable to load Quran database. Please restart the app. If the problem persists, try reinstalling the app.\n\nError: ' + (lastError?.message || 'Unknown'),
        [{ text: 'OK' }]
      );

      throw new Error(errorMsg);
    }

    return database;

  } catch (error) {
    logError('juzDbService', 'Database initialization failed completely:', error);

    // Show critical error to user
    if (error instanceof Error && !error.message.includes('Failed to open database')) {
      Alert.alert(
        '❌ Critical Database Error',
        'Cannot initialize Quran database. Please restart the app.\n\nError: ' + error.message,
        [{ text: 'OK' }]
      );
    }

    throw error;
  }
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.closeSync();
      db = null;
      log('juzDbService', 'Database closed');
    } catch (err) {
      logError('juzDbService', 'Error closing database', err);
    }
  }
}

/**
 * Reset the database state in JS. Useful when the native layer reloads and
 * the existing connection becomes invalid (for example after an app update).
 */
export function resetDatabase(): void {
  if (db) {
    try {
      db.closeSync();
    } catch (err) {
      logError('juzDbService', 'Error closing database during reset', err);
    }
  }
  db = null;
  isInitialized = false;
  log('juzDbService', 'Database reset complete');
}

export interface JuzVerse {
  verse_id: number;
  chapter_id: number;
  verse_number: number;
  ayah: string;
  translation?: string;
  transliteration?: string;
  page_id?: number;
  part_id?: number;
}

export async function fetchVersesForJuz(juzId: number): Promise<JuzVerse[]> {
  log('juzDbService', 'fetchVersesForJuz called with juzId:', juzId);
  try {
    const database = await getDatabase();
    log('juzDbService', 'Database connection obtained');
    const sql = `
      SELECT 
        v.id as verse_id, 
        v.chapter_id, 
        v.number as verse_number, 
        v.content as ayah, 
        v.page_id as page_id,
        v.part_id as part_id,
        MAX(CASE WHEN i.collection_id = 2 THEN i.content ELSE NULL END) as translation, 
        MAX(CASE WHEN i.collection_id = 3 THEN i.content ELSE NULL END) as transliteration 
      FROM verses v 
      LEFT JOIN items i ON v.id = i.verse_id 
      WHERE v.part_id = ? 
      GROUP BY v.id 
      ORDER BY v.page_id, v.chapter_id, v.number
    `;
    log('juzDbService', 'Executing SQL query with juzId:', juzId);
    const rows = await database.getAllAsync<JuzVerse>(sql, [juzId]);
    log('juzDbService', `Query returned ${rows.length} verses`);

    if (!rows || rows.length === 0) {
      throw new Error(`No verses found for Juz ${juzId} in database`);
    }

    return rows;
  } catch (error) {
    const errorMsg = `Failed to fetch verses for Juz ${juzId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logError('juzDbService', 'Error fetching verses for juz', error);

    // Show user-friendly error
    Alert.alert(
      '❌ Error Loading Juz',
      `Cannot load Juz ${juzId}. Please try again.\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
      [{ text: 'OK' }]
    );

    throw new Error(errorMsg);
  }
}

export async function fetchVerseById(verseId: number): Promise<JuzVerse | null> {
  log('juzDbService', 'fetchVerseById called with verseId:', verseId);
  try {
    const database = await getDatabase();
    const sql = `
      SELECT 
        v.id as verse_id, 
        v.chapter_id, 
        v.number as verse_number, 
        v.content as ayah, 
        v.page_id as page_id,
        v.part_id as part_id,
        MAX(CASE WHEN i.collection_id = 2 THEN i.content ELSE NULL END) as translation, 
        MAX(CASE WHEN i.collection_id = 3 THEN i.content ELSE NULL END) as transliteration 
      FROM verses v 
      LEFT JOIN items i ON v.id = i.verse_id 
      WHERE v.id = ? 
      GROUP BY v.id
    `;
    const result = await database.getFirstAsync<JuzVerse>(sql, [verseId]);
    return result || null;
  } catch (error) {
    logError('juzDbService', 'Error fetching verse by ID', error);
    throw new Error(`Failed to fetch verse ${verseId}`);
  }
}

export async function fetchVersesByIds(verseIds: number[]): Promise<JuzVerse[]> {
  log('juzDbService', 'fetchVersesByIds called with count:', verseIds.length);
  if (verseIds.length === 0) return [];

  try {
    const database = await getDatabase();
    const placeholders = verseIds.map(() => '?').join(',');
    const sql = `
      SELECT 
        v.id as verse_id, 
        v.chapter_id, 
        v.number as verse_number, 
        v.content as ayah, 
        v.page_id as page_id,
        v.part_id as part_id,
        MAX(CASE WHEN i.collection_id = 2 THEN i.content ELSE NULL END) as translation, 
        MAX(CASE WHEN i.collection_id = 3 THEN i.content ELSE NULL END) as transliteration 
      FROM verses v 
      LEFT JOIN items i ON v.id = i.verse_id 
      WHERE v.id IN (${placeholders})
      GROUP BY v.id
    `;
    const rows = await database.getAllAsync<JuzVerse>(sql, verseIds);
    return rows;
  } catch (error) {
    logError('juzDbService', 'Error fetching verses by IDs', error);
    throw new Error(`Failed to fetch verses batch`);
  }
}

export async function fetchVersesByChapter(chapterId: number): Promise<JuzVerse[]> {
  log('juzDbService', 'fetchVersesByChapter called with chapterId:', chapterId);
  try {
    const database = await getDatabase();
    const sql = `
      SELECT 
        v.id as verse_id, 
        v.chapter_id, 
        v.number as verse_number, 
        v.content as ayah, 
        v.page_id as page_id,
        v.part_id as part_id,
        MAX(CASE WHEN i.collection_id = 2 THEN i.content ELSE NULL END) as translation, 
        MAX(CASE WHEN i.collection_id = 3 THEN i.content ELSE NULL END) as transliteration 
      FROM verses v 
      LEFT JOIN items i ON v.id = i.verse_id 
      WHERE v.chapter_id = ? 
      GROUP BY v.id 
      ORDER BY v.number
    `;
    const rows = await database.getAllAsync<JuzVerse>(sql, [chapterId]);
    log('juzDbService', `Query returned ${rows.length} verses for chapter ${chapterId}`);

    // Sanity-check: ensure returned rows have expected chapter_id. If mismatch
    // observed frequently in runtime logs it points to a mapping/db problem.
    try {
      const mismatches = (rows || []).filter(r => r.chapter_id !== chapterId);
      if (mismatches.length > 0) {
        log('juzDbService', `⚠️ fetchVersesByChapter found ${mismatches.length} rows with unexpected chapter_id (requested=${chapterId}) - sample:`, mismatches.slice(0, 5));
      }
    } catch (e) {
      // keep quiet on inspection failures
      log('juzDbService', 'Warning: failed to validate chapter_id on returned rows', e);
    }

    if (!rows || rows.length === 0) {
      throw new Error(`No verses found for chapter ${chapterId} in database`);
    }

    return rows;
  } catch (error) {
    const errorMsg = `Failed to fetch verses for chapter ${chapterId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logError('juzDbService', 'Error fetching verses by chapter', error);

    // Show user-friendly error
    Alert.alert(
      '❌ Error Loading Surah',
      `Cannot load Surah ${chapterId}. Please try again.\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
      [{ text: 'OK' }]
    );

    throw new Error(errorMsg);
  }
}

/**
 * Wrapper kept for backwards/semantic compatibility: fetch all verses for a Surah
 * Uses the same local DB query as fetchVersesByChapter.
 */
export async function fetchVersesForSurah(surahId: number): Promise<JuzVerse[]> {
  return fetchVersesByChapter(surahId);
}

/**
 * Diagnostic: Log all tables in the SQLite DB
 */
export async function logDatabaseTables(): Promise<void> {
  const database = await getDatabase();
  try {
    const sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
    const tables = await database.getAllAsync<{ name: string }>(sql, []);
    log('juzDbService', 'Tables in DB:', tables.map(t => t.name));
  } catch (error) {
    logError('juzDbService', 'Error listing tables', error);
  }
}

/**
 * Diagnostic: return collections table contents (if present).
 * Helpful to confirm which collection_id maps to which language/translation.
 */
export async function getCollectionsMetadata(): Promise<Array<{ id: number; identifier?: string | null; language?: string | null; name?: string | null }>> {
  try {
    const database = await getDatabase();
    // Many packaged DBs include a `collections` or `collection` table. Try common names.
    const candidates = ['collections', 'collection', 'collections_meta'];
    for (const tbl of candidates) {
      try {
        const info = await database.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tbl]);
        if (info && info.length > 0) {
          // try a safe select
          const rows = await database.getAllAsync<any>(`SELECT id, identifier, language, name FROM ${tbl} LIMIT 50`, []);
          log('juzDbService', `Found collections table: ${tbl}`, rows.length);
          return rows.map(r => ({ id: r.id, identifier: r.identifier ?? r.key ?? null, language: r.language ?? null, name: r.name ?? null }));
        }
      } catch (err) {
        // continue
      }
    }
    // If no collections table, return empty
    return [];
  } catch (err) {
    logError('juzDbService', 'getCollectionsMetadata failed', err);
    return [];
  }
}

/**
 * Diagnostic: fetch a sample of items for a given collection_id so you can inspect language/content
 */
export async function getSampleItemsForCollection(collectionId: number, limit: number = 5) {
  try {
    const database = await getDatabase();
    const sql = `SELECT verse_id, content FROM items WHERE collection_id = ? LIMIT ?`;
    const rows = await database.getAllAsync<{ verse_id: number; content: string }>(sql, [collectionId, limit]);
    return rows;
  } catch (err) {
    logError('juzDbService', 'getSampleItemsForCollection failed', err);
    return [];
  }
}