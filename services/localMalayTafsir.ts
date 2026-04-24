import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { TafsirResult } from './tafsirApi';

const LOCAL_DB_NAME = 'quran-id-simple.db';
const DOCUMENT_DB_DIR = `${FileSystem.documentDirectory}SQLite`;
const DOCUMENT_DB_PATH = `${DOCUMENT_DB_DIR}/${LOCAL_DB_NAME}`;

let db: any = null;
let initialized = false;

async function copyBundledDbIfNeeded(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DOCUMENT_DB_PATH);
    if (info.exists) return;
    let assetModule: any = null;
    try {
      assetModule = require('../assets/database/quran-id-simple.db');
    } catch (_) {
      assetModule = null;
    }
    if (!assetModule) {
      console.warn('[localMalayTafsir] bundled DB asset not found. Ensure the DB is placed under /assets/database and included in the bundle.');
      return;
    }
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    await FileSystem.makeDirectoryAsync(DOCUMENT_DB_DIR, { intermediates: true }).catch(() => {});
    const source = asset.localUri || asset.uri;
    if (!source) {
      console.warn('[localMalayTafsir] asset has no localUri/uri after download');
      return;
    }
    await FileSystem.copyAsync({ from: source, to: DOCUMENT_DB_PATH });
    console.log('[localMalayTafsir] copied bundled DB to', DOCUMENT_DB_PATH);
  } catch (e) {
    console.warn('[localMalayTafsir] copyBundledDbIfNeeded error', e);
  }
}

function openDb(dbPathOrName?: string): void {
  if (db) return;
  try {
    if (Platform.OS === 'web') {
      console.warn('[localMalayTafsir] sqlite not available on web');
      db = null;
      return;
    }
    const sqliteAny = (SQLite as any) || {};
    if (dbPathOrName && typeof dbPathOrName === 'string' && typeof sqliteAny.openDatabase === 'function') {
      try {
        db = sqliteAny.openDatabase(dbPathOrName);
        return;
      } catch (e) {
        console.warn('[localMalayTafsir] openDatabase(path) failed', e);
      }
    }
    if (typeof sqliteAny.openDatabaseSync === 'function') {
      db = sqliteAny.openDatabaseSync(LOCAL_DB_NAME);
    } else if (typeof sqliteAny.openDatabase === 'function') {
      db = sqliteAny.openDatabase(LOCAL_DB_NAME);
    } else {
      console.warn('[localMalayTafsir] sqlite open functions not available');
      db = null;
    }
  } catch (e) {
    console.error('[localMalayTafsir] openDb failed', e);
    db = null;
  }
}

export async function initLocalMalayDb(): Promise<void> {
  if (initialized) return;
  const sqliteAny = (SQLite as any) || {};
  if (Platform.OS === 'web' || (typeof sqliteAny.openDatabase !== 'function' && typeof sqliteAny.openDatabaseSync !== 'function')) {
    console.warn('[localMalayTafsir] sqlite not available on this platform; local Malay tafsir disabled');
    initialized = true;
    return;
  }
  await copyBundledDbIfNeeded();
  openDb();
  initialized = true;
}

const resultCache = new Map<string, TafsirResult | null>();

export async function getMalayTafsir(surah: number, ayah: number): Promise<TafsirResult | null> {
  const key = `${surah}:${ayah}`;
  if (resultCache.has(key)) return resultCache.get(key) || null;
  try {
    if (!initialized) await initLocalMalayDb();
    if (!db) {
      resultCache.set(key, null);
      return null;
    }
    // Query: find a row where ayah_key matches "surah:ayah"
    const ayahKey = `${surah}:${ayah}`;
    // Use correct table and column names for Malay DB
    const sql = 'SELECT text FROM translation WHERE ayah_key = ? LIMIT 1';
    const params = [ayahKey];
    console.debug('[localMalayTafsir] SQL:', sql, 'params:', params);
    if (db.getAllAsync) {
      const rows = await db.getAllAsync(sql, params).catch(() => []);
      const row = rows && rows[0];
      console.debug('[localMalayTafsir] Raw DB row:', row);
      if (row && row.text) {
        const res: TafsirResult = {
          resourceId: 0,
          resourceName: 'Malay Tafsir',
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
            console.debug('[localMalayTafsir] Raw DB row:', r);
            if (r && r.text) {
              const res: TafsirResult = {
                resourceId: 0,
                resourceName: 'Malay Tafsir',
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
            console.warn('[localMalayTafsir] query error', err);
            resolve(null);
            return true;
          }
        );
      });
    });
  } catch (e) {
    console.error('[localMalayTafsir] getMalayTafsir error', e);
    resultCache.set(key, null);
    return null;
  }
}

export async function closeLocalMalayDb(): Promise<void> {
  db = null;
  initialized = false;
}
