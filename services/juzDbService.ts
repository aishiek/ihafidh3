import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'AlQurandb.sqlite3';
const SQLITE_DIR = FileSystem.documentDirectory + 'SQLite';
const DB_PATH = SQLITE_DIR + '/' + DB_NAME;

let ASSET_PATH: string | null = null;
let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;

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
  if (!db) {
    await ensureDbCopied();
    log('juzDbService', 'Opening database by name:', DB_NAME);
    try {
      db = SQLite.openDatabaseSync(DB_NAME);
      log('juzDbService', 'Database opened successfully');
    } catch (err) {
      logError('juzDbService', 'Failed to open database', err);
      db = null;
      throw new Error('Failed to open database');
    }
  }
  return db;
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
    return rows;
  } catch (error) {
    logError('juzDbService', 'Error fetching verses for juz', error);
    throw new Error(`Failed to fetch verses for Juz ${juzId}`);
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
    return rows;
  } catch (error) {
    logError('juzDbService', 'Error fetching verses by chapter', error);
    throw new Error(`Failed to fetch verses for chapter ${chapterId}`);
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