import { surahsData } from '@/data/surahs';
import { Surah, Verse } from '@/types';
import { getOrSetInstallDate } from '@/utils/installDate';
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
    await applyPragmas();
    await createTables();
    await runIntegrityCheck('[init]');
    
    // Run backfill for existing users (will auto-skip if already done)
    console.log('[init] Checking for activity data backfill...');
    await backfillVerseActivitiesFromMemorization();
    
    await logBasicStats('[init]');
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

// Best-effort pragmas to improve reliability/perf
const applyPragmas = async (): Promise<void> => {
  if (!db) return;
  try {
    if (!db.execAsync) return;
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA temp_store = MEMORY;
    `);
  } catch (e) {
    console.warn('[sqlite] Failed to apply PRAGMAs', e);
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
      CREATE TABLE IF NOT EXISTS audio_cache (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        localPath TEXT NOT NULL,
        remoteUrl TEXT NOT NULL,
        downloadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        fileSize INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surahId);
      CREATE INDEX IF NOT EXISTS idx_verses_juz ON verses(juzNumber);
      CREATE INDEX IF NOT EXISTS idx_memorization_surah ON memorization_status(surahId);
      CREATE INDEX IF NOT EXISTS idx_audio_cache_type ON audio_cache(type);
      -- Verse activities: log every memorized or revised action with date
      CREATE TABLE IF NOT EXISTS verse_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verseId INTEGER NOT NULL,
        surahId INTEGER NOT NULL,
        verseNumber INTEGER NOT NULL,
        activityType TEXT NOT NULL CHECK(activityType IN ('memorized','revised')),
        activityDate TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_va_date ON verse_activities(activityDate);
      CREATE INDEX IF NOT EXISTS idx_va_type ON verse_activities(activityType);
      CREATE INDEX IF NOT EXISTS idx_va_verse ON verse_activities(verseId);
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

// Compute global verse id from surah and verse number (1-indexed)
function computeGlobalVerseId(surahId: number, verseNumber: number): number {
  let start = 0;
  for (let i = 1; i < surahId; i++) {
    const s = surahsData.find(ss => ss.id === i);
    if (s) start += s.versesCount;
  }
  return start + verseNumber;
}

// Parse global verse ID back to surah and verse number
function parseGlobalVerseId(globalVerseId: number): { surahId: number; verseNumber: number } {
  let accumulated = 0;
  for (let i = 1; i <= 114; i++) {
    const surah = surahsData.find(s => s.id === i);
    if (!surah) continue;
    
    if (globalVerseId <= accumulated + surah.versesCount) {
      return {
        surahId: i,
        verseNumber: globalVerseId - accumulated
      };
    }
    accumulated += surah.versesCount;
  }
  return { surahId: 1, verseNumber: 1 }; // Fallback
}

// One-time backfill: create verse_activities rows for already memorized verses
const BACKFILL_FLAG = 'va_backfill_done_v3'; // Updated flag to force re-run with better debugging
async function backfillVerseActivitiesFromMemorization(): Promise<void> {
  if (!db || Platform.OS === 'web') return;
  try {
    const done = await AsyncStorage.getItem(BACKFILL_FLAG);
    if (done === '1') {
      console.log('[backfill] Already completed, skipping');
      return;
    }
    if (!db.getAllAsync || !db.getFirstAsync || !db.runAsync || !db.withTransactionAsync) return;

    console.log('[backfill] Starting verse activities backfill...');
    const installDate = await getOrSetInstallDate(); // YYYY-MM-DD
    console.log('[backfill] Install date:', installDate);    // Try to read per-verse memorization dates persisted by progress store
    let memDates: Record<number, string> = {};
    try {
      const raw = await AsyncStorage.getItem('progress-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        const maybe = parsed?.state?.memorizedVerseDates;
        if (maybe && typeof maybe === 'object') memDates = maybe as Record<number, string>;
      }
    } catch {}

    const rows = await db!.getAllAsync(
      `SELECT surahId, verseNumber, isMemorized, lastReviewed
       FROM memorization_status
       WHERE isMemorized = 1`
    ).catch(() => [] as any[]);

    console.log(`[backfill] Found ${(rows as any[]).length} memorized verses in memorization_status`);

    if (!rows || (rows as any[]).length === 0) {
      console.log('[backfill] No memorized verses found, marking as done');
      await AsyncStorage.setItem(BACKFILL_FLAG, '1');
      return;
    }

    // Pre-compute per-surah completion and khatam date (latest per-verse date if available)
    const bySurah: Record<number, number[]> = {};
    for (const r of rows as any[]) {
      const s = Number(r.surahId); const v = Number(r.verseNumber);
      if (!s || !v) continue;
      (bySurah[s] ||= []).push(v);
    }
    const surahKhatamDate: Record<number, string | undefined> = {};
    for (const sIdStr of Object.keys(bySurah)) {
      const sId = Number(sIdStr);
      const surahMeta = surahsData.find(s => s.id === sId);
      if (!surahMeta) continue;
      const memCount = bySurah[sId].length;
      if (memCount === surahMeta.versesCount) {
        // Determine latest date among memDates for verses in this surah
        let latest: string | undefined;
        let latestTs = -Infinity;
        // find the starting global id for this surah
        let start = 0;
        for (let i = 1; i < sId; i++) { const s = surahsData.find(ss => ss.id === i); if (s) start += s.versesCount; }
        for (let vn = 1; vn <= surahMeta.versesCount; vn++) {
          const gid = start + vn;
          const ds = memDates[gid];
          if (ds) {
            const ts = Date.parse(ds);
            if (!isNaN(ts) && ts > latestTs) { latestTs = ts; latest = ds; }
          }
        }
        surahKhatamDate[sId] = latest; // may be undefined if no per-verse dates
      }
    }

    await db!.withTransactionAsync(async () => {
      let processedCount = 0;
      let skippedCount = 0;
      
      for (const r of rows as any[]) {
        const surahId = Number(r.surahId);
        const verseNumber = Number(r.verseNumber);
        if (!surahId || !verseNumber) continue;
        const verseId = computeGlobalVerseId(surahId, verseNumber);

        const exists = await db!.getFirstAsync(
          `SELECT id FROM verse_activities WHERE verseId = ? AND activityType = 'memorized' LIMIT 1`,
          [verseId]
        ).catch(() => null as any);
        if (exists) {
          skippedCount++;
          continue;
        }

        // Determine activityDate priority:
        // 1) Per-verse memorized date from progress store
        // 2) Surah khatam date (latest date among verses in surah)
        // 3) lastReviewed from DB
        // 4) Install date
        let activityDate = memDates[verseId] || '';
        if (!activityDate) activityDate = surahKhatamDate[surahId] || '';
        if (!activityDate && r.lastReviewed) {
          try {
            const d = new Date(r.lastReviewed);
            if (!isNaN(d.getTime())) {
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              activityDate = `${yyyy}-${mm}-${dd}`;
            }
          } catch {}
        }
        if (!activityDate) activityDate = installDate;

        await db!.runAsync(
          `INSERT INTO verse_activities (verseId, surahId, verseNumber, activityType, activityDate)
           VALUES (?, ?, ?, 'memorized', ?)`,
          [verseId, surahId, verseNumber, activityDate]
        ).catch(() => {});
        
        processedCount++;
      }
      
      console.log(`[backfill] Processed ${processedCount} verses, skipped ${skippedCount} existing`);
    });

    // Verify final counts
    const finalCount = await db!.getFirstAsync(
      `SELECT COUNT(*) as count FROM verse_activities WHERE activityType = 'memorized'`
    ).catch(() => ({ count: 0 }));
    console.log(`[backfill] Final verse_activities count: ${(finalCount as any).count}`);

    await AsyncStorage.setItem(BACKFILL_FLAG, '1');
    console.log('[backfill] Backfill completed successfully');
  } catch (e) {
    console.warn('[sqlite] backfillVerseActivitiesFromMemorization failed', e);
  }
}

// Debug function to check data consistency (can be called from console)
export const debugVerseActivityCounts = async (): Promise<void> => {
  if (!db || Platform.OS === 'web') return;
  try {
    const memCount = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM memorization_status WHERE isMemorized = 1`
    ).catch(() => ({ count: 0 }));
    const activityCount = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM verse_activities WHERE activityType = 'memorized'`
    ).catch(() => ({ count: 0 }));
    const revisionCount = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM verse_activities WHERE activityType = 'revised'`
    ).catch(() => ({ count: 0 }));
    const todayCount = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM verse_activities WHERE activityDate = ?`,
      [fmtDate(new Date())]
    ).catch(() => ({ count: 0 }));
    const todayMem = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM verse_activities WHERE activityDate = ? AND activityType = 'memorized'`,
      [fmtDate(new Date())]
    ).catch(() => ({ count: 0 }));
    const todayRev = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM verse_activities WHERE activityDate = ? AND activityType = 'revised'`,
      [fmtDate(new Date())]
    ).catch(() => ({ count: 0 }));
    const recentDates = await db.getAllAsync(
      `SELECT DISTINCT activityDate, activityType, COUNT(*) as count FROM verse_activities 
       WHERE activityDate >= date('now', '-7 days') 
       GROUP BY activityDate, activityType 
       ORDER BY activityDate DESC`
    ).catch(() => []);
    const backfillFlag = await AsyncStorage.getItem(BACKFILL_FLAG);
    
    console.log('=== VERSE ACTIVITY DEBUG ===');
    console.log('Memorized verses in memorization_status:', (memCount as any).count);
    console.log('Memorized activities in verse_activities:', (activityCount as any).count);
    console.log('Revision activities in verse_activities:', (revisionCount as any).count);
    console.log('Today\'s total activities:', (todayCount as any).count);
    console.log('Today\'s memorized activities:', (todayMem as any).count);
    console.log('Today\'s revision activities:', (todayRev as any).count);
    console.log('Recent activities by date:');
    (recentDates as any[]).forEach(row => {
      console.log(`  ${row.activityDate}: ${row.activityType} = ${row.count}`);
    });
    console.log('Backfill flag status:', backfillFlag);
    console.log('Install date:', await getOrSetInstallDate());
    console.log('Current date:', fmtDate(new Date()));
    console.log('===========================');
  } catch (e) {
    console.error('Debug check failed:', e);
  }
};

// Debug function to reset backfill flag and trigger re-run
export const resetBackfillFlag = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(BACKFILL_FLAG);
    console.log('Backfill flag reset. Call initializeDatabase() to re-run backfill.');
  } catch (e) {
    console.error('Failed to reset backfill flag:', e);
  }
};

// Force backfill to run immediately (for debugging)
export const forceBackfillNow = async (): Promise<void> => {
  try {
    console.log('[force-backfill] Forcing backfill to run now...');
    await AsyncStorage.removeItem(BACKFILL_FLAG);
    await backfillVerseActivitiesFromMemorization();
    console.log('[force-backfill] Backfill force-run completed');
  } catch (e) {
    console.error('[force-backfill] Failed:', e);
  }
};

// Debug function to test revision activity logging
export const testRevisionLogging = async (): Promise<void> => {
  try {
    console.log('Testing revision activity logging...');
    
    // Log a few test revisions for the first 5 verses
    const testVerseIds = [1, 2, 3, 4, 5];
    await bulkLogRevisions(testVerseIds);
    
    // Check if they were inserted
    const count = await db?.getFirstAsync(
      `SELECT COUNT(*) as count FROM verse_activities WHERE activityType = 'revised'`
    ).catch(() => ({ count: 0 }));
    
    console.log(`Test complete. Total revision activities: ${(count as any).count}`);
  } catch (e) {
    console.error('Test revision logging failed:', e);
  }
};

// Optimized bulk operation for marking multiple verses as memorized with batch activity logging
export const bulkMarkVersesMemorized = async (verseIds: number[], isMemorized: boolean = true): Promise<void> => {
  if (!db || Platform.OS === 'web' || verseIds.length === 0) return;
  try {
    const activityDate = fmtDate(new Date());
    
    await db.withTransactionAsync(async () => {
      // Batch update memorization_status
      for (const verseId of verseIds) {
        const { surahId, verseNumber } = parseGlobalVerseId(verseId);
        await db!.runAsync(
          `INSERT OR REPLACE INTO memorization_status (surahId, verseNumber, isMemorized, lastReviewed)
           VALUES (?, ?, ?, ?)`,
          [surahId, verseNumber, isMemorized ? 1 : 0, activityDate]
        );
        
        // Batch insert activity logs only for memorization (not unmarking)
        if (isMemorized) {
          // Check if activity already exists for this specific date to avoid duplicates
          const exists = await db!.getFirstAsync(
            `SELECT id FROM verse_activities WHERE verseId = ? AND activityType = 'memorized' AND activityDate = ? LIMIT 1`,
            [verseId, activityDate]
          );
          
          if (!exists) {
            await db!.runAsync(
              `INSERT INTO verse_activities (verseId, surahId, verseNumber, activityType, activityDate)
               VALUES (?, ?, ?, 'memorized', ?)`,
              [verseId, surahId, verseNumber, activityDate]
            );
          }
        }
      }
    });
    
    console.log(`[bulk] Successfully processed ${verseIds.length} verses (memorized: ${isMemorized})`);
  } catch (e) {
    console.error('[bulk] bulkMarkVersesMemorized failed:', e);
  }
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

// Get verses by Juz number (no Bismillah injection)
export const getVersesByJuzFromDb = async (
  juzNumber: number,
  page: number = 1,
  pageSize: number = 20
): Promise<Verse[]> => {
  if (!db || Platform.OS === 'web') return [];
  try {
    if (!db.getAllAsync) { console.warn('[sqlite] getAllAsync unavailable'); return []; }
    const offset = (page - 1) * pageSize;
    const rows = await db.getAllAsync(
      'SELECT * FROM verses WHERE juzNumber = ? ORDER BY id LIMIT ? OFFSET ?',
      [juzNumber, pageSize, offset]
    ).catch(e => { console.warn('[sqlite] query failed', e); return []; });
    const verses: Verse[] = (rows as any[]).map((row: any) => ({
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
    return verses;
  } catch (error) {
    console.error(`Error getting verses for Juz ${juzNumber}:`, error);
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

// Integrity and diagnostics
export const runIntegrityCheck = async (tag: string = ''): Promise<boolean> => {
  if (!db || Platform.OS === 'web') return false;
  try {
    if (!db.getFirstAsync) return false;
    const res = await db.getFirstAsync(`PRAGMA integrity_check;`) as any;
    const value = res?.integrity_check || res?.["integrity_check"] || Object.values(res || {})[0];
    const ok = String(value).toLowerCase() === 'ok';
    if (!ok) console.warn(`[sqlite] integrity_check failed ${tag}:`, res);
    else console.log(`[sqlite] integrity_check ok ${tag}`);
    return ok;
  } catch (e) {
    console.warn('[sqlite] integrity_check threw', e);
    return false;
  }
};

export const logBasicStats = async (tag: string = ''): Promise<void> => {
  if (!db || Platform.OS === 'web') return;
  try {
    if (!db.getFirstAsync) return;
    const verses = await db.getFirstAsync('SELECT COUNT(*) as c FROM verses');
    const mem = await db.getFirstAsync('SELECT COUNT(*) as c FROM memorization_status');
    const aud = await db.getFirstAsync('SELECT COUNT(*) as c FROM audio_cache');
  const act = await db.getFirstAsync('SELECT COUNT(*) as c FROM verse_activities');
    const v = (verses as any)?.c ?? (verses as any)?.["c"] ?? 0;
    const m = (mem as any)?.c ?? (mem as any)?.["c"] ?? 0;
    const a = (aud as any)?.c ?? (aud as any)?.["c"] ?? 0;
    const ac = (act as any)?.c ?? (act as any)?.["c"] ?? 0;
    console.log(`[sqlite] stats ${tag} verses=${v} memorization=${m} audio=${a} activities=${ac}`);
  } catch (e) {
    console.warn('[sqlite] logBasicStats failed', e);
  }
};

// ---- Verse activity logging and querying ----
export type VerseActivityType = 'memorized' | 'revised';

const fmtDate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
};

function computeSurahAndNumber(verseId: number): { surahId: number; verseNumber: number } {
  let start = 0;
  for (let i=0;i<surahsData.length;i++){
    const s = surahsData[i];
    if (verseId <= start + s.versesCount) {
      return { surahId: s.id, verseNumber: verseId - start };
    }
    start += s.versesCount;
  }
  return { surahId: 1, verseNumber: verseId };
}

export const logVerseActivity = async (verseId: number, activityType: VerseActivityType, date?: string): Promise<void> => {
  if (!db || Platform.OS === 'web') return;
  try {
    if (!db.runAsync) return;
    const { surahId, verseNumber } = computeSurahAndNumber(verseId);
    const activityDate = date || fmtDate(new Date());
    await db.runAsync(
      `INSERT INTO verse_activities (verseId, surahId, verseNumber, activityType, activityDate) VALUES (?, ?, ?, ?, ?)`,
      [verseId, surahId, verseNumber, activityType, activityDate]
    ).catch(e => console.warn('[sqlite] logVerseActivity insert failed', e));
  } catch (e) {
    console.warn('[sqlite] logVerseActivity failed', e);
  }
};

// Helper function for logging individual verse revisions
export const logVerseRevision = async (verseId: number, date?: string): Promise<void> => {
  await logVerseActivity(verseId, 'revised', date);
};

// Helper function for logging individual verse memorization
export const logVerseMemorization = async (verseId: number, date?: string): Promise<void> => {
  await logVerseActivity(verseId, 'memorized', date);
};

// Optimized bulk revision logging for multiple verses
export const bulkLogRevisions = async (verseIds: number[], date?: string): Promise<void> => {
  if (!db || Platform.OS === 'web' || verseIds.length === 0) return;
  try {
    const activityDate = date || fmtDate(new Date());
    
    await db.withTransactionAsync(async () => {
      for (const verseId of verseIds) {
        const { surahId, verseNumber } = parseGlobalVerseId(verseId);
        
        await db!.runAsync(
          `INSERT INTO verse_activities (verseId, surahId, verseNumber, activityType, activityDate)
           VALUES (?, ?, ?, 'revised', ?)`,
          [verseId, surahId, verseNumber, activityDate]
        ).catch(() => {}); // Allow duplicates for revisions (can revise multiple times per day)
      }
    });
    
    console.log(`[bulk] Successfully logged ${verseIds.length} verse revisions`);
  } catch (e) {
    console.error('[bulk] bulkLogRevisions failed:', e);
  }
};

export const getVerseActivitiesBetween = async (startDate: string, endDate: string): Promise<{ activityDate: string; activityType: VerseActivityType; count: number }[]> => {
  if (!db || Platform.OS === 'web') return [];
  try {
    if (!db.getAllAsync) return [];
    const rows = await db.getAllAsync(
      `SELECT activityDate, activityType, COUNT(*) as count
       FROM verse_activities
       WHERE activityDate >= ? AND activityDate <= ?
       GROUP BY activityDate, activityType
       ORDER BY activityDate ASC`,
      [startDate, endDate]
    ).catch(() => []);
    return (rows as any[]).map(r => ({ activityDate: r.activityDate, activityType: r.activityType as VerseActivityType, count: Number(r.count) }));
  } catch (e) {
    console.warn('[sqlite] getVerseActivitiesBetween failed', e);
    return [];
  }
};

export const getVerseActivityBreakdown = async (startDate: string, endDate: string): Promise<{ memorized: number; revised: number }> => {
  const rows = await getVerseActivitiesBetween(startDate, endDate);
  let memorized = 0, revised = 0;
  rows.forEach(r => { if (r.activityType === 'memorized') memorized += r.count; else if (r.activityType === 'revised') revised += r.count; });
  return { memorized, revised };
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

// Set verse memorization status with proper activity logging
export const setVerseMemorizationStatus = async (
  surahId: number,
  verseNumber: number,
  isMemorized: boolean
): Promise<void> => {
  if (!db || Platform.OS === 'web') return;
  
  try {
    // Check if verse was already memorized to distinguish new memorization vs revision
    const wasAlreadyMemorized = await getVerseMemorizationStatus(surahId, verseNumber);
    
    await db.runAsync(
      `INSERT OR REPLACE INTO memorization_status (surahId, verseNumber, isMemorized, lastReviewed)
       VALUES (?, ?, ?, datetime('now'))`,
      [surahId, verseNumber, isMemorized ? 1 : 0]
    );
    
    // Log appropriate activity
    const verseId = computeGlobalVerseId(surahId, verseNumber);
    if (isMemorized && !wasAlreadyMemorized) {
      // New memorization
      await logVerseActivity(verseId, 'memorized');
    } else if (isMemorized && wasAlreadyMemorized) {
      // This is a revision of already memorized verse
      await logVerseActivity(verseId, 'revised');
    }
    // Note: If unmarking (isMemorized = false), we don't log any activity
    
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
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Batch insert/replace operations
    await db.withTransactionAsync(async () => {
      for (const verseNumber of verseNumbers) {
        if (!db) break; // safeguard
        await db.runAsync(
          `INSERT OR REPLACE INTO memorization_status (surahId, verseNumber, isMemorized, lastReviewed)
           VALUES (?, ?, ?, datetime('now'))`,
          [surahId, verseNumber, isMemorized ? 1 : 0]
        );
        
        // Also log activity if marking as memorized
        if (isMemorized) {
          const verseId = computeGlobalVerseId(surahId, verseNumber);
          // Check if activity already exists to avoid duplicates
          const exists = await db.getFirstAsync(
            `SELECT id FROM verse_activities WHERE verseId = ? AND activityType = 'memorized' AND activityDate = ? LIMIT 1`,
            [verseId, today]
          ).catch(() => null);
          if (!exists) {
            await db.runAsync(
              `INSERT INTO verse_activities (verseId, surahId, verseNumber, activityType, activityDate)
               VALUES (?, ?, ?, 'memorized', ?)`,
              [verseId, surahId, verseNumber, today]
            ).catch(() => {});
          }
        }
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

// Audio cache functions
export const cacheAudioFile = async (id: string, type: 'bismillah' | 'verse', localPath: string, remoteUrl: string, fileSize?: number): Promise<void> => {
  if (!db || Platform.OS === 'web') return;
  try {
    if (!db.runAsync) { console.warn('[sqlite] runAsync unavailable'); return; }
    await db.runAsync(
      `INSERT OR REPLACE INTO audio_cache (id, type, localPath, remoteUrl, fileSize) VALUES (?, ?, ?, ?, ?)`,
      [id, type, localPath, remoteUrl, fileSize || 0]
    );
    console.log(`Audio cached: ${id} (${type})`);
  } catch (error) {
    console.error('Error caching audio file:', error);
  }
};

export const getCachedAudioPath = async (id: string): Promise<string | null> => {
  if (!db || Platform.OS === 'web') return null;
  try {
    if (!db.getFirstAsync) { console.warn('[sqlite] getFirstAsync unavailable'); return null; }
    const result = await db.getFirstAsync('SELECT localPath FROM audio_cache WHERE id = ?', [id]) as { localPath: string } | null;
    return result?.localPath || null;
  } catch (error) {
    console.error('Error getting cached audio path:', error);
    return null;
  }
};

export const isAudioCached = async (id: string): Promise<boolean> => {
  const path = await getCachedAudioPath(id);
  return path !== null;
};

export async function getAllRevisedVerseIds(): Promise<number[]> {
  const dbInstance = await getDb();
  try {
    const res = await dbInstance.executeSql?.('SELECT id FROM verses WHERE revised = 1');
    return res?.[0]?.rows?._array?.map((row: any) => row.id) || [];
  } catch { return []; }
}