import { surahsData } from '@/data/surahs';
import { Surah, Verse } from '@/types';
import { QueueItem } from '@/utils/WriteBackQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let db: SQLite.SQLiteDatabase | null = null;

// Provide a safe getter for legacy code at bottom expecting getDb()
export async function getDb(): Promise<any> {
  if (!db || Platform.OS === 'web') {
    return {
      transaction: async (fn: any) => { try { await fn({ executeSql: () => {} }); } catch {} },
      executeSql: async () => [{ rows: { _array: [] } }],
    };
  }
  return db;
}

const DATABASE_NAME = 'quran.db';
const DATABASE_VERSION = '1.0';
const PREFETCH_PROGRESS_KEY = 'prefetch_progress';
const FAILED_VERSES_KEY = 'failed_verses';

// Initialize database
export const initDatabase = async (): Promise<void> => {
  if (Platform.OS === 'web' || db) return;
  try {
    if (!SQLite || !SQLite.openDatabaseSync) {
      console.warn('[sqlite] module unavailable - skipping DB init');
      return;
    }
    db = SQLite.openDatabaseSync(DATABASE_NAME);
    await createTables();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

// Create tables
const createTables = async (): Promise<void> => {
  if (!db) return;
  try {
    if (!db.execAsync) { console.warn('[sqlite] execAsync unavailable'); return; }
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS verses (
        id INTEGER PRIMARY KEY,
        surahId INTEGER NOT NULL,
        verseNumber INTEGER NOT NULL,
        arabicText TEXT NOT NULL,
        translation TEXT NOT NULL,
        audioUrl TEXT,
        juzNumber INTEGER,
        hizbNumber INTEGER,
        pageNumber INTEGER,
        UNIQUE(surahId, verseNumber)
      );
      CREATE TABLE IF NOT EXISTS memorization_status (
        surahId INTEGER NOT NULL,
        verseNumber INTEGER NOT NULL,
        isMemorized BOOLEAN NOT NULL DEFAULT 0,
        lastReviewed DATETIME,
        PRIMARY KEY (surahId, verseNumber)
      );
      CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surahId);
      CREATE INDEX IF NOT EXISTS idx_verses_juz ON verses(juzNumber);
      CREATE INDEX IF NOT EXISTS idx_memorization_surah ON memorization_status(surahId);
    `);
    console.log('Database tables and indexes created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
};

// Get all surahs
export const getAllSurahs = async (): Promise<Surah[]> => {
  return surahsData;
};

// Get surah by ID
export const getSurahById = async (id: number): Promise<Surah | null> => {
  return surahsData.find(s => s.id === id) || null;
};

// Cache verses
export const cacheVerses = async (verses: Verse[]): Promise<void> => {
  if (!db || Platform.OS === 'web' || verses.length === 0) return;
  try {
    if (!db.runAsync) { console.warn('[sqlite] runAsync unavailable'); return; }
    for (const verse of verses) {
      await db.runAsync(
        `INSERT OR REPLACE INTO verses (
          id, surahId, verseNumber, arabicText, translation, 
          audioUrl, juzNumber, hizbNumber, pageNumber
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          verse.id,
          verse.surahId,
            verse.verseNumber,
          verse.arabicText,
          verse.translation,
          verse.audioUrl || '',
          verse.juzNumber || 0,
          verse.hizbNumber || 0,
          verse.pageNumber || 0
        ]
      ).catch(e => console.warn('[sqlite] insert failed', e));
    }
  } catch (error) {
    console.error('Error caching verses:', error);
  }
};

// Get cached verses
// Helper function to handle Bismillah verses in database operations
export const handleBismillahVerse = async (surahId: number): Promise<Verse | null> => {
  if (!db || Platform.OS === 'web') return null;
  
  // Skip for Surah Al-Fatiha (1) and At-Tawbah (9)
  if (surahId === 1 || surahId === 9) return null;
  
  try {
    // Check if Bismillah verse exists in database
    const result = await db.getFirstAsync(
      'SELECT * FROM verses WHERE surahId = ? AND verseNumber = 0',
      [surahId]
    );
    
    if (result) {
      return {
        id: -surahId, // Consistent negative ID for Bismillah verses
        surahId,
        verseNumber: 0,
        arabicText: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
        audioUrl: `https://verses.quran.com/Alafasy/001000.mp3`,
        juzNumber: 0,
        hizbNumber: 0,
        pageNumber: 0
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error handling Bismillah verse for surah ${surahId}:`, error);
    return null;
  }
};

// Update getCachedVerses to handle Bismillah
export const getCachedVerses = async (
  surahId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<Verse[]> => {
  if (!db || Platform.OS === 'web') return [];
  try {
    if (!db.getAllAsync) { console.warn('[sqlite] getAllAsync unavailable'); return []; }
    const offset = (page - 1) * pageSize;
    const result = await db.getAllAsync(
      'SELECT * FROM verses WHERE surahId = ? ORDER BY verseNumber LIMIT ? OFFSET ?',
      [surahId, pageSize, offset]
    ).catch(e => { console.warn('[sqlite] query failed', e); return []; });
    // Explicitly type verses array to satisfy Verse shape (audioUrl optional in our Verse interface)
    const verses: Verse[] = (result as any[]).map((row: any) => ({
      id: row.id,
      surahId: row.surahId,
      verseNumber: row.verseNumber,
      arabicText: row.arabicText,
      translation: row.translation,
      audioUrl: row.audioUrl || undefined,
      juzNumber: row.juzNumber,
      hizbNumber: row.hizbNumber,
      pageNumber: row.pageNumber
    }));
    if (page === 1 && surahId !== 1 && surahId !== 9) {
      const bismillahVerse = await handleBismillahVerse(surahId);
      if (bismillahVerse) verses.unshift(bismillahVerse as Verse);
    }
    return verses;
  } catch (error) {
    console.error('Error getting cached verses:', error);
    return [];
  }
};

// Get verses by surah ID with caching
export const getVersesBySurah = async (
  surahId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<Verse[]> => {
  try {
    const cachedVerses = await getCachedVerses(surahId, page, pageSize);
    if (cachedVerses.length > 0) {
      return cachedVerses;
    }
    return [];
  } catch (error) {
    console.error(`Error getting verses for surah ${surahId}:`, error);
    return [];
  }
};

// Check if surah is cached
export const isSurahCached = async (surahId: number): Promise<boolean> => {
  if (!db || Platform.OS === 'web') return false;
  try {
    if (!db.getFirstAsync) { console.warn('[sqlite] getFirstAsync unavailable'); return false; }
    const result = await db.getFirstAsync('SELECT COUNT(*) as count FROM verses WHERE surahId = ?', [surahId]) as { count: number } | null;
    return (result?.count || 0) > 0;
  } catch (error) {
    console.error(`Error checking if surah ${surahId} is cached:`, error);
    return false;
  }
};

// Check if surah is fully cached
export const isSurahFullyCached = async (surahId: number): Promise<boolean> => {
  if (!db || Platform.OS === 'web') return false;
  const surah = surahsData.find(s => s.id === surahId);
  if (!surah) return false;
  try {
    if (!db.getFirstAsync) { console.warn('[sqlite] getFirstAsync unavailable'); return false; }
    const result = await db.getFirstAsync('SELECT COUNT(*) as count FROM verses WHERE surahId = ?', [surahId]) as { count: number } | null;
    return (result?.count || 0) >= surah.versesCount;
  } catch (error) {
    console.error(`Error checking if surah ${surahId} is fully cached:`, error);
    return false;
  }
};

// Get prefetch progress
export const getPrefetchProgress = async (): Promise<{ completed: number, total: number }> => {
  try {
    const progressStr = await AsyncStorage.getItem(PREFETCH_PROGRESS_KEY);
    if (progressStr) return JSON.parse(progressStr);
    return { completed: 0, total: 6236 };
  } catch {
    return { completed: 0, total: 6236 };
  }
};

// Update prefetch progress
export const updatePrefetchProgress = async (completed: number, total: number = 6236): Promise<void> => {
  try {
    await AsyncStorage.setItem(PREFETCH_PROGRESS_KEY, JSON.stringify({ completed, total }));
  } catch (error) {
    console.error('Error updating prefetch progress:', error);
  }
};

// Check if database is prefetched
export const isDatabasePrefetched = async (): Promise<boolean> => {
  try {
    const progress = await getPrefetchProgress();
    return progress.completed >= progress.total;
  } catch (error) {
    return false;
  }
};

// Failed verses management
export const getFailedVerses = async (): Promise<{ surahId: number, verseNumber: number }[]> => {
  try {
    const failedStr = await AsyncStorage.getItem(FAILED_VERSES_KEY);
    return failedStr ? JSON.parse(failedStr) : [];
  } catch (error) {
    return [];
  }
};

export const addFailedVerse = async (surahId: number, verseNumber: number): Promise<void> => {
  try {
    const failed = await getFailedVerses();
    const exists = failed.some(v => v.surahId === surahId && v.verseNumber === verseNumber);
    if (!exists) {
      failed.push({ surahId, verseNumber });
      await AsyncStorage.setItem(FAILED_VERSES_KEY, JSON.stringify(failed));
    }
  } catch (error) {
    console.error('Error adding failed verse:', error);
  }
};

export const removeFailedVerse = async (surahId: number, verseNumber: number): Promise<void> => {
  try {
    const failed = await getFailedVerses();
    const filtered = failed.filter(v => !(v.surahId === surahId && v.verseNumber === verseNumber));
    await AsyncStorage.setItem(FAILED_VERSES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing failed verse:', error);
  }
};

export const clearFailedVerses = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(FAILED_VERSES_KEY);
  } catch (error) {
    console.error('Error clearing failed verses:', error);
  }
};

// Clear cache
export const clearCache = async (): Promise<void> => {
  if (!db || Platform.OS === 'web') return;
  try {
    if (db.execAsync) await db.execAsync('DELETE FROM verses');
    await AsyncStorage.multiRemove([PREFETCH_PROGRESS_KEY, FAILED_VERSES_KEY]);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

// Close database
export const closeDatabase = async (): Promise<void> => {
  if (db && Platform.OS !== 'web') {
    try {
      if (db.closeAsync) await db.closeAsync();
      db = null;
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
};

// Get verse memorization status
export const getVerseMemorizationStatus = async (
  surahId: number,
  verseNumber: number
): Promise<boolean> => {
  if (!db || Platform.OS === 'web') return false;
  
  try {
    const result = await db.getFirstAsync(
      'SELECT isMemorized FROM memorization_status WHERE surahId = ? AND verseNumber = ?',
      [surahId, verseNumber]
    ) as { isMemorized: number } | null;
    
    return result?.isMemorized === 1;
  } catch (error) {
    console.error('Error getting verse memorization status:', error);
    return false;
  }
};

// Set verse memorization status
export const setVerseMemorizationStatus = async (
  surahId: number,
  verseNumber: number,
  isMemorized: boolean
): Promise<void> => {
  if (!db || Platform.OS === 'web') return;
  
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO memorization_status (surahId, verseNumber, isMemorized, lastReviewed)
       VALUES (?, ?, ?, datetime('now'))`,
      [surahId, verseNumber, isMemorized ? 1 : 0]
    );
  } catch (error) {
    console.error('Error setting verse memorization status:', error);
  }
};

// Mark all verses in a surah as memorized or unmemorized
export const markAllVersesMemorized = async (surahId: number, isMemorized: boolean): Promise<void> => {
  if (!db || Platform.OS === 'web') return;

  try {
    const surah = surahsData.find(s => s.id === surahId);
    if (!surah || !db?.withTransactionAsync || !db?.runAsync) return;

    // Create a list of all verse numbers for the surah
    const verseNumbers = Array.from({ length: surah.versesCount }, (_, i) => i + 1);

    // Batch insert/replace operations
    await db.withTransactionAsync(async () => {
      for (const verseNumber of verseNumbers) {
        if (!db) break; // safeguard
        await db.runAsync(
          `INSERT OR REPLACE INTO memorization_status (surahId, verseNumber, isMemorized, lastReviewed)
           VALUES (?, ?, ?, datetime('now'))`,
          [surahId, verseNumber, isMemorized ? 1 : 0]
        );
      }
    });

  } catch (error) {
    console.error(`Error marking all verses in surah ${surahId} as memorized:`, error);
    throw error; // Re-throw to be caught by the caller
  }
};

// Get memorization progress for a specific Juz
export const getJuzProgress = async (juzNumber: number): Promise<{ memorized: number, total: number, progress: number }> => {
  if (!db || Platform.OS === 'web') {
    return { memorized: 0, total: 0, progress: 0 };
  }

  try {
    if (!db.getAllAsync) return { memorized: 0, total: 0, progress: 0 };
    // Get all verses in the specified Juz
    const versesInJuz: any[] = await db.getAllAsync(
      'SELECT surahId, verseNumber FROM verses WHERE juzNumber = ?',
      [juzNumber]
    );

    if (versesInJuz.length === 0) {
      return { memorized: 0, total: 0, progress: 0 };
    }

    // Get memorization status for these verses using a simpler approach
    let memorizedCount = 0;
    
    for (const verse of versesInJuz) {
      if (!db.getFirstAsync) continue;
      const result = await db.getFirstAsync(
        'SELECT isMemorized FROM memorization_status WHERE surahId = ? AND verseNumber = ?',
        [(verse as any).surahId, (verse as any).verseNumber]
      ) as { isMemorized: number } | null;
      
      if (result?.isMemorized === 1) {
        memorizedCount++;
      }
    }

    const totalCount = versesInJuz.length;
    const progress = totalCount > 0 ? (memorizedCount / totalCount) * 100 : 0;

    return {
      memorized: memorizedCount,
      total: totalCount,
      progress: Math.round(progress),
    };

  } catch (error) {
    console.error(`Error getting progress for Juz ${juzNumber}:`, error);
    return { memorized: 0, total: 0, progress: 0 };
  }
};


// Get download status for a surah
export const getSurahDownloadStatus = async (surahId: number): Promise<{
  isDownloaded: boolean;
  isFullyDownloaded: boolean;
  downloadedVerses: number;
  totalVerses: number;
}> => {
  if (!db || Platform.OS === 'web') {
    return {
      isDownloaded: false,
      isFullyDownloaded: false,
      downloadedVerses: 0,
      totalVerses: 0
    };
  }
  
  try {
    const surah = surahsData.find(s => s.id === surahId);
    if (!surah) {
      return {
        isDownloaded: false,
        isFullyDownloaded: false,
        downloadedVerses: 0,
        totalVerses: 0
      };
    }

    const result = await db.getFirstAsync(
      'SELECT COUNT(*) as count FROM verses WHERE surahId = ?',
      [surahId]
    ) as { count: number } | null;
    
    const downloadedVerses = result?.count || 0;
    
    return {
      isDownloaded: downloadedVerses > 0,
      isFullyDownloaded: downloadedVerses >= surah.versesCount,
      downloadedVerses,
      totalVerses: surah.versesCount
    };
  } catch (error) {
    console.error('Error getting surah download status:', error);
    return {
      isDownloaded: false,
      isFullyDownloaded: false,
      downloadedVerses: 0,
      totalVerses: 0
    };
  }
}; 

export async function bulkUpdateVerses(batch: QueueItem[]) {
  const dbInstance = await getDb();
  if (!dbInstance?.transaction) return;
  await dbInstance.transaction(async (tx: any) => {
    for (const { verseId, state, type } of batch) {
      try {
        if (type === 'memorized') {
          await tx.executeSql?.('UPDATE verses SET memorized = ? WHERE id = ?', [state ? 1 : 0, verseId]);
        } else if (type === 'revised') {
          await tx.executeSql?.('UPDATE verses SET revised = ? WHERE id = ?', [state ? 1 : 0, verseId]);
        }
      } catch (e) { console.warn('[sqlite] bulkUpdateVerses item failed', e); }
    }
  });
}

// Utility to get all memorized/revised verse IDs for cache warm-up
export async function getAllMemorizedVerseIds(): Promise<number[]> {
  const dbInstance = await getDb();
  try {
    const res = await dbInstance.executeSql?.('SELECT id FROM verses WHERE memorized = 1');
    return res?.[0]?.rows?._array?.map((row: any) => row.id) || [];
  } catch { return []; }
}

export async function getAllRevisedVerseIds(): Promise<number[]> {
  const dbInstance = await getDb();
  try {
    const res = await dbInstance.executeSql?.('SELECT id FROM verses WHERE revised = 1');
    return res?.[0]?.rows?._array?.map((row: any) => row.id) || [];
  } catch { return []; }
}