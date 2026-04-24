// Diagnostic: check DB presence, row count, and a sample row
export async function debugTamilTafsirDb(): Promise<void> {
  try {
    if (!initialized) await initLocalTamilDb();
    if (!db) {
      console.warn('[localTamilTafsir] debug: DB not initialized');
      return;
    }
    db.transaction((tx: any) => {
      tx.executeSql(
        'SELECT COUNT(*) as count FROM tafsir',
        [],
        (_: any, resultSet: any) => {
          const count = resultSet?.rows?._array?.[0]?.count;
          console.log('[localTamilTafsir] debug: tafsir row count =', count);
        },
        (_: any, err: any) => {
          console.warn('[localTamilTafsir] debug: count query error', err);
          return true;
        }
      );
      tx.executeSql(
        'SELECT * FROM tafsir WHERE ayah_key = ? LIMIT 1',
        ['2:1'],
        (_: any, resultSet: any) => {
          const row = resultSet?.rows?._array?.[0];
          if (row) {
            console.log('[localTamilTafsir] debug: sample row for surah 2 ayah 1:', row);
          } else {
            console.warn('[localTamilTafsir] debug: no row for surah 2 ayah 1');
          }
        },
        (_: any, err: any) => {
          console.warn('[localTamilTafsir] debug: sample row query error', err);
          return true;
        }
      );
    });
  } catch (e) {
    console.error('[localTamilTafsir] debug: error', e);
  }
}
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
// Use legacy import to keep getInfoAsync/copyAsync behavior stable on SDK 54
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { TafsirResult } from './tafsirApi';

// Local Tamil tafsir DB helper
// The DB file may be committed under `/database/tamil-mokhtasar.db` or placed under `assets/`.
// At runtime we copy the bundled asset to the app document directory and open it with expo-sqlite.

const LOCAL_DB_NAME = 'tamil-mokhtasar.db';
const DOCUMENT_DB_DIR = `${FileSystem.documentDirectory}SQLite`;
const DOCUMENT_DB_PATH = `${DOCUMENT_DB_DIR}/${LOCAL_DB_NAME}`;

let db: any = null;
let initialized = false;

async function copyBundledDbIfNeeded(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DOCUMENT_DB_PATH);
    if (info.exists) return;

    // Try to resolve the asset from known project locations. Prefer `database/` module if available.
    let assetModule: any = null;
    try {
      // This will work if the DB file is available to the Metro bundler as a module.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      assetModule = require('../database/tamil-mokhtasar.db');
    } catch (_) {
      try {
        // Fall back to assets folder
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        assetModule = require('../assets/database/tamil-mokhtasar.db');
      } catch (__) {
        assetModule = null;
      }
    }

    if (!assetModule) {
      console.warn('[localTamilTafsir] bundled DB asset not found. Ensure the DB is placed under /database or /assets/database and included in the bundle.');
      return;
    }

    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();

    // Ensure directory exists
    await FileSystem.makeDirectoryAsync(DOCUMENT_DB_DIR, { intermediates: true }).catch(() => {});

    const source = asset.localUri || asset.uri;
    if (!source) {
      console.warn('[localTamilTafsir] asset has no localUri/uri after download');
      return;
    }

    await FileSystem.copyAsync({ from: source, to: DOCUMENT_DB_PATH });
    console.log('[localTamilTafsir] copied bundled DB to', DOCUMENT_DB_PATH);
  } catch (e) {
    console.warn('[localTamilTafsir] copyBundledDbIfNeeded error', e);
  }
}

function openDb(dbPathOrName?: string): void {
  if (db) return;
  try {
    // Skip on web or when sqlite is not available
    if (Platform.OS === 'web') {
      console.warn('[localTamilTafsir] sqlite not available on web');
      db = null;
      return;
    }

    const sqliteAny = (SQLite as any) || {};
    // If a file path is provided and the sqlite module exposes openDatabase, attempt to open by path
    if (dbPathOrName && typeof dbPathOrName === 'string' && typeof sqliteAny.openDatabase === 'function') {
      try {
        db = sqliteAny.openDatabase(dbPathOrName);
        return;
      } catch (e) {
        console.warn('[localTamilTafsir] openDatabase(path) failed', e);
      }
    }

    // Otherwise fallback to opening by name if available
    if (typeof sqliteAny.openDatabaseSync === 'function') {
      db = sqliteAny.openDatabaseSync(LOCAL_DB_NAME);
    } else if (typeof sqliteAny.openDatabase === 'function') {
      db = sqliteAny.openDatabase(LOCAL_DB_NAME);
    } else {
      console.warn('[localTamilTafsir] sqlite open functions not available');
      db = null;
    }
  } catch (e) {
    console.error('[localTamilTafsir] openDb failed', e);
    db = null;
  }
}

export async function initLocalTamilDb(): Promise<void> {
  if (initialized) return;
  // If sqlite is not available on this platform, bail out early
  const sqliteAny = (SQLite as any) || {};
  if (Platform.OS === 'web' || (typeof sqliteAny.openDatabase !== 'function' && typeof sqliteAny.openDatabaseSync !== 'function')) {
    console.warn('[localTamilTafsir] sqlite not available on this platform; local Tamil tafsir disabled');
    initialized = true;
    return;
  }
  // Attempt to copy a bundled DB to the document directory where sqlite can open it
  await copyBundledDbIfNeeded();
  // After copying the bundled DB to the app's SQLite directory, open by name.
  // Passing the full file path to expo-sqlite is not supported reliably across
  // runtimes; opening by the database name ensures the native module looks
  // inside the app's SQLite directory for the file we copied.
  openDb();
  initialized = true;
}

// Minimal cache to avoid repeated DB hits for same ayah
const resultCache = new Map<string, TafsirResult | null>();

export async function getTamilTafsir(surah: number, ayah: number): Promise<TafsirResult | null> {
  const key = `${surah}:${ayah}`;
  if (resultCache.has(key)) return resultCache.get(key) || null;
  try {
    if (!initialized) await initLocalTamilDb();
    if (!db) {
      resultCache.set(key, null);
      return null;
    }

    // Query: find a row where ayah_key matches, but support groupings (ranges).
    // Surah 2:4 may point to group_ayah_key 2:3 where the actual text is stored.
    const ayahKey = `${surah}:${ayah}`;
    const sql = `
      SELECT text FROM tafsir 
      WHERE ayah_key = (SELECT COALESCE(group_ayah_key, ayah_key) FROM tafsir WHERE ayah_key = ?) 
         OR ayah_key = ?
      LIMIT 1
    `;
    const params = [ayahKey, ayahKey];
  console.debug('[localTamilTafsir] SQL:', sql, 'params:', params);

    // Some sqlite wrappers provide async helpers (getAllAsync). Prefer them if available.
    if (db.getAllAsync) {
      const rows = await db.getAllAsync(sql, params).catch(() => []);
      const row = rows && rows[0];
      console.debug('[localTamilTafsir] Raw DB row:', row);
      if (row && row.text) {
        const res: TafsirResult = {
          resourceId: 0,
          resourceName: 'Tamil Tafsir',
          verseKey: ayahKey,
          text: String(row.text),
        };
        resultCache.set(key, res);
        return res;
      }
      resultCache.set(key, null);
      return null;
    }

    // legacy sync path: execute SQL and build result via Promise wrapper
    return new Promise((resolve) => {
      db.transaction((tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_: any, resultSet: any) => {
            const r = resultSet?.rows?._array?.[0];
            console.debug('[localTamilTafsir] Raw DB row:', r);
            if (r && r.text) {
              const res: TafsirResult = {
                resourceId: 0,
                resourceName: 'Tamil Tafsir',
                verseKey: ayahKey,
                text: String(r.text),
              };
              resultCache.set(key, res);
              resolve(res);
            } else {
              resultCache.set(key, null);
              resolve(null);
            }
          },
          (_: any, err: any) => {
            console.warn('[localTamilTafsir] query error', err);
            resolve(null);
            return true;
          }
        );
      });
    });
  } catch (e) {
    console.error('[localTamilTafsir] getTamilTafsir error', e);
    resultCache.set(key, null);
    return null;
  }
}

export async function closeLocalTamilDb(): Promise<void> {
  // expo-sqlite does not provide explicit close; leave as noop for now
  db = null;
  initialized = false;
}
