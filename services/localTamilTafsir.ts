import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { TafsirResult } from './tafsirApi';

// Local Tamil tafsir DB helper
// Assumes `assets/database/tamil-mokhtasar.db` is placed as 'tamil-mokhtasar.db' in the app's DB directory

const LOCAL_DB_NAME = 'tamil-mokhtasar.db';

let db: any = null;
let initialized = false;

function openDb(): void {
  if (db) return;
  try {
    if ((SQLite as any).openDatabaseSync) {
      db = (SQLite as any).openDatabaseSync(LOCAL_DB_NAME);
    } else if ((SQLite as any).openDatabase) {
      db = (SQLite as any).openDatabase(LOCAL_DB_NAME);
    } else {
      db = null;
    }
  } catch (e) {
    console.error('[localTamilTafsir] openDb failed', e);
    db = null;
  }
}

export async function initLocalTamilDb(): Promise<void> {
  if (initialized || Platform.OS === 'web') return;
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

    // Some sqlite wrappers provide async helpers (getAllAsync). Prefer them if available.
    if (db.getAllAsync) {
      const rows = await db.getAllAsync(
        'SELECT tafsir_text as text, scholar FROM tamil_tafsir WHERE surah = ? AND ayah = ? LIMIT 1',
        [surah, ayah]
      ).catch(() => []);
      const row = rows && rows[0];
      if (row && row.text) {
        const res: TafsirResult = {
          resourceId: 0,
          resourceName: row.scholar || 'Tamil Tafsir',
          verseKey: `${surah}:${ayah}`,
          text: String(row.text),
        };
        resultCache.set(key, res);
        return res;
      }
      resultCache.set(key, null);
      return null;
    }

    // sync path: execute SQL and build result
    let found: TafsirResult | null = null;
    db.transaction((tx: any) => {
      tx.executeSql(
        'SELECT tafsir_text as text, scholar FROM tamil_tafsir WHERE surah = ? AND ayah = ? LIMIT 1',
        [surah, ayah],
        (_: any, resultSet: any) => {
          const r = resultSet?.rows?._array?.[0];
          if (r && r.text) {
            found = {
              resourceId: 0,
              resourceName: r.scholar || 'Tamil Tafsir',
              verseKey: `${surah}:${ayah}`,
              text: String(r.text),
            };
          }
        },
        (_: any, err: any) => {
          console.warn('[localTamilTafsir] query error', err);
          return true;
        }
      );
    });

    resultCache.set(key, found);
    return found;
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
