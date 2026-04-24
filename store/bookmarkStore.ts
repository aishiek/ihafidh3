import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { create } from 'zustand';

export interface BookmarkItem {
  id?: number; // row id (autoincrement)
  verseId: number;
  surahId: number;
  surahName: string;
  verseNumber: number;
  arabicText: string; // truncated to 50 chars before insert
  translation: string; // truncated to 100 chars before insert
  createdAt: string; // ISO string
  source?: 'surah' | 'juz'; // where the bookmark was created
  juzNumber?: number; // juz number if source is 'juz'
}

interface BookmarkState {
  bookmarks: BookmarkItem[];
  bookmarksSet: Set<number>;
  initialized: boolean;
  initializeDatabase: () => Promise<void>;
  reloadBookmarks: () => Promise<void>;
  cleanupOldBookmarks: (days?: number) => Promise<void>; // optional cleanup
  addBookmark: (
    verseId: number,
    surahId: number,
    surahName: string,
    verseNumber: number,
    arabicText: string,
    translation: string,
    source?: 'surah' | 'juz',
    juzNumber?: number
  ) => Promise<void>;
  removeBookmark: (verseId: number) => Promise<void>;
  isBookmarked: (verseId: number) => boolean;
  getBookmarks: () => BookmarkItem[];
  clearAllBookmarks: () => Promise<void>;
}

let db: SQLite.SQLiteDatabase | null = null;

type PendingAdd = {
  verseId: number;
  surahId: number;
  surahName: string;
  verseNumber: number;
  arabicText: string;
  translation: string;
  source?: 'surah' | 'juz';
  juzNumber?: number;
  resolve: () => void;
  reject: (e: any) => void;
};
let pendingAdds: PendingAdd[] = [];
let flushTimer: any = null;

const esc = (s: string) => (s || '').replace(/'/g, "''");

const scheduleFlushAdds = async () => {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    const batch = pendingAdds;
    pendingAdds = [];
    flushTimer = null;
    if (batch.length === 0) return;
    try {
      const ok = await ensureSchema();
      if (!ok || !db) {
        batch.forEach(b => b.reject(new Error('DB unavailable')));
        return;
      }
      // Build single transaction string
      let sql = 'BEGIN;';
      for (const b of batch) {
        const sourceValue = b.source ? `'${b.source}'` : 'NULL';
        const juzValue = b.juzNumber ? `${b.juzNumber}` : 'NULL';
        sql += `INSERT OR IGNORE INTO bookmarks (verseId, surahId, surahName, verseNumber, arabicText, translation, createdAt, source, juzNumber) ` +
               `VALUES (${b.verseId}, ${b.surahId}, '${esc(b.surahName)}', ${b.verseNumber}, '${esc(b.arabicText)}', '${esc(b.translation)}', datetime('now'), ${sourceValue}, ${juzValue});`;
      }
      sql += 'COMMIT;';
      if ('execAsync' in db && typeof db.execAsync === 'function') {
        await db.execAsync(sql);
      } else if ('runAsync' in db && typeof (db as any).runAsync === 'function') {
        // Fallback: run without transaction (less optimal)
        for (const b of batch) {
          await (db as any).runAsync(
            `INSERT OR IGNORE INTO bookmarks (verseId, surahId, surahName, verseNumber, arabicText, translation, createdAt, source, juzNumber) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
            [b.verseId, b.surahId, b.surahName, b.verseNumber, b.arabicText, b.translation, b.source || null, b.juzNumber || null]
          );
        }
      }
      // Resolve all promises
      batch.forEach(b => b.resolve());
      // Refresh state from DB for accuracy (createdAt)
      await (useBookmarkStore.getState().reloadBookmarks());
    } catch (e) {
      console.warn('[bookmarkStore] batch insert failed', e);
      batch.forEach(b => b.reject(e));
    }
  }, 200);
};

const openDb = async () => {
  try {
    if (db || Platform.OS === 'web') return db;
    if (!SQLite || !SQLite.openDatabaseSync) {
      console.warn('[bookmarkStore] SQLite not available');
      return null;
    }
    db = SQLite.openDatabaseSync('quran.db');
    if (__DEV__) console.log('[bookmarkStore] Database opened');
    return db;
  } catch (e) {
    console.warn('[bookmarkStore] Failed to open DB', e);
    return null;
  }
};

const ensureSchema = async () => {
  const _db = await openDb();
  if (!_db) return false;
  try {
    // Check if table exists
    let exists = false;
    if ('getAllAsync' in _db && typeof _db.getAllAsync === 'function') {
      const rows = await _db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bookmarks'"
      );
      exists = Array.isArray(rows) && rows.length > 0;
    }

    if (!exists) {
      if ('execAsync' in _db && typeof _db.execAsync === 'function') {
        await _db.execAsync(`
          CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            verseId INTEGER UNIQUE,
            surahId INTEGER NOT NULL,
            surahName TEXT NOT NULL,
            verseNumber INTEGER NOT NULL,
            arabicText TEXT,
            translation TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            source TEXT,
            juzNumber INTEGER
          );
          CREATE INDEX IF NOT EXISTS idx_bookmarks_verseId ON bookmarks(verseId);
        `);
        if (__DEV__) console.log('[bookmarkStore] Created bookmarks table and index');
      }
    } else {
      // Table exists - check if we need to add new columns for migration
      if ('getAllAsync' in _db && typeof _db.getAllAsync === 'function') {
        const columns = await _db.getAllAsync<{ name: string }>(
          "PRAGMA table_info(bookmarks)"
        );
        const columnNames = columns.map(c => c.name);
        
        // Add source column if it doesn't exist
        if (!columnNames.includes('source')) {
          if ('execAsync' in _db && typeof _db.execAsync === 'function') {
            await _db.execAsync(`ALTER TABLE bookmarks ADD COLUMN source TEXT;`);
            if (__DEV__) console.log('[bookmarkStore] Added source column');
          }
        }
        
        // Add juzNumber column if it doesn't exist
        if (!columnNames.includes('juzNumber')) {
          if ('execAsync' in _db && typeof _db.execAsync === 'function') {
            await _db.execAsync(`ALTER TABLE bookmarks ADD COLUMN juzNumber INTEGER;`);
            if (__DEV__) console.log('[bookmarkStore] Added juzNumber column');
          }
        }
      }
      
      // Ensure index exists even on upgrades
      if ('execAsync' in _db && typeof _db.execAsync === 'function') {
        await _db.execAsync(`CREATE INDEX IF NOT EXISTS idx_bookmarks_verseId ON bookmarks(verseId);`);
      }
      if (__DEV__) console.log('[bookmarkStore] Bookmarks table exists');
    }
    return true;
  } catch (e) {
    console.warn('[bookmarkStore] ensureSchema failed', e);
    return false;
  }
};

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  bookmarksSet: new Set<number>(),
  initialized: false,

  initializeDatabase: async () => {
    if (get().initialized) return;
    try {
      const ok = await ensureSchema();
      if (!ok) {
        set({ initialized: true });
        return;
      }
      // Load existing bookmarks
      if (!db || !db.getAllAsync) {
        set({ initialized: true });
        return;
      }
      const rows = await db.getAllAsync<BookmarkItem>(
        'SELECT * FROM bookmarks ORDER BY datetime(createdAt) DESC'
      );
      const setIds = new Set((rows || []).map(r => r.verseId));
      set({ bookmarks: rows || [], bookmarksSet: setIds, initialized: true });
      if (__DEV__) console.log(`[bookmarkStore] Initialization complete (${rows?.length || 0} rows)`);
    } catch (e) {
      console.warn('[bookmarkStore] init failed', e);
      set({ initialized: true });
    }
  },

  reloadBookmarks: async () => {
    try {
      const ok = await ensureSchema();
      if (!ok) return;
      if (!db || !db.getAllAsync) return;
      const rows = await db.getAllAsync<BookmarkItem>(
        'SELECT * FROM bookmarks ORDER BY datetime(createdAt) DESC'
      );
      const setIds = new Set((rows || []).map(r => r.verseId));
      set({ bookmarks: rows || [], bookmarksSet: setIds, initialized: true });
      if (__DEV__) console.log(`[bookmarkStore] Reloaded (${rows?.length || 0} rows)`);
    } catch (e) {
      console.warn('[bookmarkStore] reload failed', e);
    }
  },

  cleanupOldBookmarks: async (days = 365) => {
    try {
      const ok = await ensureSchema();
      if (!ok || !db || !db.runAsync) return;
      await db.runAsync(
        `DELETE FROM bookmarks WHERE datetime(createdAt) < datetime('now', ?)`,
        [`-${days} days`]
      );
      if (__DEV__) console.log(`[bookmarkStore] Cleanup complete (older than ${days} days)`);
      // optional refresh
      await get().reloadBookmarks();
    } catch (e) {
      console.warn('[bookmarkStore] cleanup failed', e);
    }
  },

  addBookmark: async (
    verseId,
    surahId,
    surahName,
    verseNumber,
    arabicText,
    translation,
    source,
    juzNumber
  ) => {
    await get().initializeDatabase();
    if (!db || Platform.OS === 'web') return;

    // Prevent duplicates in memory first
    if (get().bookmarksSet.has(verseId)) return;

    const trimmedArabic = arabicText?.slice(0, 50) || '';
    const trimmedTranslation = translation?.slice(0, 100) || '';

    try {
      // Optimistically update in-memory for instant UI feedback
      set((state) => {
        const createdAt = new Date().toISOString();
        const next: BookmarkItem = { 
          verseId, 
          surahId, 
          surahName, 
          verseNumber, 
          arabicText: trimmedArabic, 
          translation: trimmedTranslation, 
          createdAt,
          source,
          juzNumber 
        };
        const already = state.bookmarksSet.has(verseId);
        if (already) return state;
        const updatedSet = new Set(state.bookmarksSet);
        updatedSet.add(verseId);
        return { bookmarks: [next, ...state.bookmarks], bookmarksSet: updatedSet };
      });

      // Queue DB write to batch operations
      await new Promise<void>((resolve, reject) => {
        pendingAdds.push({ 
          verseId, 
          surahId, 
          surahName, 
          verseNumber, 
          arabicText: trimmedArabic, 
          translation: trimmedTranslation, 
          source,
          juzNumber,
          resolve, 
          reject 
        });
        scheduleFlushAdds();
      });
      if (__DEV__) console.log('[bookmarkStore] addBookmark queued');

      // ANALYTICS: bookmark_added — aggregate stats only, no surah name to reduce noise
      const { logAnalyticsEvent} = require('@/utils/analyticsHelper');
      try {
        logAnalyticsEvent('bookmark_added', {
          surah_number: surahId ?? 0,
          verse_number: verseNumber ?? 0,
          source: source || 'unknown',
          juz_number: juzNumber || 0,
          total_count: get().bookmarksSet.size,
        });
      } catch { /* analytics must never crash */ }
    } catch (e) {
      console.warn('[bookmarkStore] add failed', e);
    }
  },

  removeBookmark: async (verseId: number) => {
    await get().initializeDatabase();
    if (!db || Platform.OS === 'web') return;
    try {
      if (!db.runAsync) return;
      await db.runAsync('DELETE FROM bookmarks WHERE verseId = ?', [verseId]);
      set((state) => {
        const updatedSet = new Set(state.bookmarksSet);
        const item = state.bookmarks.find(b => b.verseId === verseId);
        updatedSet.delete(verseId);

        // ANALYTICS: bookmark_removed — aggregate stats only, no surah name
        const { logAnalyticsEvent} = require('@/utils/analyticsHelper');
        try {
          logAnalyticsEvent('bookmark_removed', {
            surah_number: item?.surahId || 0,
            verse_number: item?.verseNumber || 0,
            source: item?.source || 'unknown',
            total_count: updatedSet.size,
          });
        } catch { /* analytics must never crash */ }

        return { bookmarks: state.bookmarks.filter(b => b.verseId !== verseId), bookmarksSet: updatedSet };
      });
    } catch (e) {
      console.warn('[bookmarkStore] remove failed', e);
    }
  },

  isBookmarked: (verseId: number) => {
    return get().bookmarksSet.has(verseId);
  },

  getBookmarks: () => {
    return [...get().bookmarks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  clearAllBookmarks: async () => {
    await get().initializeDatabase();
    if (!db || Platform.OS === 'web') return;
    try {
      if (!db.runAsync) return;
      await db.runAsync('DELETE FROM bookmarks');
      set({ bookmarks: [] });
    } catch (e) {
      console.warn('[bookmarkStore] clearAll failed', e);
    }
  },
}));

// Eager init (non-blocking)
useBookmarkStore.getState().initializeDatabase().catch(() => {});
