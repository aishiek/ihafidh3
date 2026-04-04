import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { BISMILLAH_WBW } from '@/constants/basmalah';

/** Bump when replacing assets/database/wbw_translations.db so devices recopy from the bundle. */
const DB_NAME = 'wbw_translations_v2.db';
const SQLITE_DIR = FileSystem.documentDirectory + 'SQLite';
const DB_PATH = SQLITE_DIR + '/' + DB_NAME;

let db: SQLite.SQLiteDatabase | null = null;
// FIX 4: Use a promise-based singleton lock instead of a boolean flag.
// If two cards call getWBWForVerse() simultaneously (common on FlashList mount),
// a boolean flag allows both to enter the init path. The promise lock ensures
// init runs exactly once and all concurrent callers await the same operation.
let dbInitPromise: Promise<void> | null = null;

export interface WBWWord {
  en: string;
  ta: string;
  ms: string;
  id: string;
  word_index: number;
}

/**
 * Strips HTML tags from a string
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
}

/**
 * Initializes the WBW database by copying it from assets if necessary.
 * Thread-safe: concurrent calls all wait on the same promise.
 */
async function ensureDbPrepared(): Promise<void> {
  if (db) return; // already initialized — fast path
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
        }

        const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
        if (!fileInfo.exists) {
          console.log('[wbwDbService] Copying WBW database...');
          const asset = Asset.fromModule(require('../assets/database/wbw_translations.db'));
          await asset.downloadAsync();
          const source = asset.localUri || asset.uri;
          if (!source) throw new Error('WBW asset not found');

          await FileSystem.copyAsync({ from: source, to: DB_PATH });

          if (Platform.OS === 'android') {
            // Give Android time to flush the file to disk before opening
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        db = await SQLite.openDatabaseAsync(DB_NAME);
        console.log('[wbwDbService] WBW Database initialized');
      } catch (error) {
        // Reset promise so the next call can retry after a failure
        dbInitPromise = null;
        console.error('[wbwDbService] Initialization error:', error);
        throw error;
      }
    })();
  }
  return dbInitPromise;
}


/**
 * Fetches all word translations for a specific verse
 */
export async function getWBWForVerse(
  surahId: number,
  verseNumber: number
): Promise<WBWWord[]> {
  try {
    await ensureDbPrepared();
    if (!db) return [];

    // Catch Basmalah (Verse 0) before hitting DB
    if (verseNumber === 0) {
      return BISMILLAH_WBW;
    }

    const query = 'SELECT word_index, en, id, ta FROM translations WHERE surah = ? AND ayah = ? ORDER BY CAST(word_index AS INTEGER) ASC';
    const rows = await db.getAllAsync(query, [surahId, verseNumber]) as any[];

    if (!rows || rows.length === 0) {
      console.warn(`[wbwDbService] No WBW data found for ${surahId}:${verseNumber}`);
      return [];
    }

    return rows.map(row => ({
      word_index: parseInt(row.word_index, 10),
      en: stripHtml(row.en),
      id: row.id || '',
      ta: row.ta || '',
      // Note: ms (Malay) is not in this DB, using id (Indonesian) as fallback
      // as they are often very similar for simple word translations.
      ms: row.id || '', 
    }));
  } catch (error) {
    console.error('[wbwDbService] getWBWForVerse error:', error);
    return [];
  }
}

/**
 * Fetches a single word translation (legacy support)
 */
export async function getWBWWord(
  surahId: number,
  verseNumber: number,
  wordIndex: number
): Promise<WBWWord | null> {
  const allWords = await getWBWForVerse(surahId, verseNumber);
  return allWords.find(w => w.word_index === wordIndex) || null;
}