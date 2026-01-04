import { AVAILABLE_LAYOUTS, LayoutMetadata, PageLayout } from '@/types/layout';
import getLogger from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';
import { checkLayoutStatus } from './mushafDownloadService';

// --- CONSTANTS ---
const ASSET_DB_MODULES: Record<string, any> = {
  'qpc-hafs-15-lines.db': require('../../../assets/database/qpc-hafs-15-lines.db'),
  'qpc-nastaleeq-15-lines.db': require('../../../assets/database/qpc-nastaleeq-15-lines.db'),
  'qudratullah-indopak-15-lines.db': require('../../../assets/database/qudratullah-indopak-15-lines.db'),
  'qudratullah-indopak-nastaleeq.db': require('../../../assets/database/qudratullah-indopak-nastaleeq.db'),
  'indopak-nastaleeq.db': require('../../../assets/database/indopak-nastaleeq.db'),
};

const STORAGE_KEY_ACTIVE_LAYOUT = 'ACTIVE_MUSHAF_LAYOUT';
// Fix: Use proper path joining for cross-platform compatibility
const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;
// Use the packaged Hafs DB as the canonical words fallback so verse->audio
// mappings are consistent with the canonical Quran audio CDN ordering.
// This avoids mismatches where a merged/indopak words DB mapped ids differently
// and caused Warsh layout pages to resolve to a different surah:ayah than expected.
const WORDS_DB_NAME = 'qpc-hafs-15-lines.db';

// Exported for testing/verification only — confirms which packaged words DB will
// be used as the centralized fallback when an active layout lacks a words table.
export function getConfiguredWordsDbName(): string {
  return WORDS_DB_NAME;
}

const logger = getLogger('LayoutService');

export class LayoutService {
  private static activeDb: any = null;
  private static activeLayoutId: string | null = null;
  private static activeDbName: string | null = null;
  // A secondary handle ONLY used if the active DB is NOT the words DB
  private static separateWordsDb: any = null;
  // Track filename for separateWordsDb so we can detect reuse/avoid double-opens
  private static separateWordsDbName: string | null = null;

  // Database change notification listeners (other modules can subscribe)
  private static dbChangeListeners: Array<() => void> = [];
  
  // Track if we're currently initializing to prevent concurrent init
  private static isInitializing: boolean = false;
  private static initPromise: Promise<boolean> | null = null;

  // --- THE CRITICAL FIX: OPERATION LOCK ---
  // If this is true, NO ONE is allowed to open databases
  private static isSwappingLayout: boolean = false;

  // Track ongoing copy operations to prevent race conditions
  private static pendingCopies: Map<string, Promise<void>> = new Map();

  private static async ensureSqliteDir() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
        logger.info('Created SQLite dir', SQLITE_DIR);

        // Small delay for Android filesystem propagation
        if (Platform.OS === 'android') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      logger.error('Failed to create SQLite directory', error);
      throw error;
    }
  }

  private static async copyDbToSqliteIfNeeded(dbFileName: string): Promise<void> {
    const targetPath = `${SQLITE_DIR}/${dbFileName}`;

    logger.debug(`[copyDbToSqliteIfNeeded] Starting for ${dbFileName}`);
    logger.debug(`[copyDbToSqliteIfNeeded] Target path: ${targetPath}`);
    logger.debug(`[copyDbToSqliteIfNeeded] Platform: ${Platform.OS}`);

    // If there's already a pending copy for this file, wait for it
    if (this.pendingCopies.has(dbFileName)) {
      logger.debug('[copyDbToSqliteIfNeeded] Waiting for pending copy to finish for ' + dbFileName);
      await this.pendingCopies.get(dbFileName);
      return;
    }

    const promise = (async () => {
      try {
        // Check if target already exists and is valid
        const targetInfo = await FileSystem.getInfoAsync(targetPath);

        if (targetInfo.exists) {
          logger.debug(`[copyDbToSqliteIfNeeded] Target DB exists, validating...`);

          // Validate the existing DB
          const isValid = await this.validateDatabase(dbFileName, targetPath);
          if (isValid) {
            logger.debug(`[copyDbToSqliteIfNeeded] Target DB is valid, no copy needed`);
            return;
          }

          // If invalid, delete it
          logger.info(`[copyDbToSqliteIfNeeded] Target DB is invalid, removing...`);
          try {
            await FileSystem.deleteAsync(targetPath, { idempotent: true });
          } catch (delErr) {
            logger.warn('Failed to delete invalid DB', delErr);
          }
        }

        // Try cache first
        const cachePath = `${MUSHAF_CACHE_DIR}/${dbFileName}`;
        logger.debug(`[copyDbToSqliteIfNeeded] Checking cache: ${cachePath}`);

        const cacheInfo = await FileSystem.getInfoAsync(cachePath);

        if (cacheInfo.exists) {
          logger.debug(`[copyDbToSqliteIfNeeded] Copying from cache...`);
          try {
            await FileSystem.copyAsync({ from: cachePath, to: targetPath });

            // Verify the copied file
            const copiedInfo = await FileSystem.getInfoAsync(targetPath);
            if (copiedInfo.exists && copiedInfo.size && copiedInfo.size > 0) {
              logger.debug(`[copyDbToSqliteIfNeeded] Successfully copied from cache (${copiedInfo.size} bytes)`);
              return;
            } else {
              logger.warn(`[copyDbToSqliteIfNeeded] Copied file appears invalid`);
              throw new Error('Copied file validation failed');
            }
          } catch (copyErr) {
            logger.error('Failed to copy from cache, trying packaged asset:', copyErr);
            // Continue to fallback
          }
        }

        // Fallback to packaged asset
        logger.debug(`[copyDbToSqliteIfNeeded] Attempting packaged asset fallback...`);
        const ASSET_MODULE = ASSET_DB_MODULES[dbFileName];

        if (!ASSET_MODULE) {
          throw new Error(`No static asset registered for ${dbFileName}`);
        }

        const asset = Asset.fromModule(ASSET_MODULE);
        await asset.downloadAsync();

        const assetPath = asset.localUri || asset.uri;
        if (!assetPath) {
          throw new Error('Packaged DB has no uri');
        }

        logger.debug(`[copyDbToSqliteIfNeeded] Copying from asset: ${assetPath}`);
        await FileSystem.copyAsync({ from: assetPath, to: targetPath });

        // Verify the copied file
        const finalInfo = await FileSystem.getInfoAsync(targetPath);
        if (!finalInfo.exists || !finalInfo.size || finalInfo.size === 0) {
          throw new Error('Asset copy validation failed');
        }

        logger.debug(`[copyDbToSqliteIfNeeded] Successfully copied from asset (${finalInfo.size} bytes)`);
      } catch (error) {
        logger.error(`[copyDbToSqliteIfNeeded] Failed to ensure DB present`, error);
        throw error;
      } finally {
        // Remove pending copy entry
        this.pendingCopies.delete(dbFileName);
      }
    })();

    this.pendingCopies.set(dbFileName, promise);
    await promise;
  }

  /**
   * Validate that a database file exists and has the required table
   */
  private static async validateDatabase(dbFileName: string, dbPath: string): Promise<boolean> {
    let testDb: any = null;
    try {
      // Check file exists and has size
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      if (!fileInfo.exists || !fileInfo.size || fileInfo.size === 0) {
        logger.warn(`[validateDatabase] File missing or empty: ${dbPath}`);
        return false;
      }

      // Try to open the database
      testDb = await (SQLite as any).openDatabaseAsync(dbFileName);

      // Determine expected table
      const expectedTable = dbFileName === 'indopak-nastaleeq.db' ? 'words' : 'pages';

      // Check if the expected table exists
      const row = await testDb.getFirstAsync(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`,
        [expectedTable]
      );

      if (row && row.name === expectedTable) {
        logger.debug(`[validateDatabase] DB valid, has ${expectedTable} table`);
        return true;
      } else {
        logger.warn(`[validateDatabase] DB missing ${expectedTable} table`);
        return false;
      }
    } catch (error) {
      logger.warn(`[validateDatabase] Validation failed for ${dbFileName}:`, error);
      return false;
    } finally {
      if (testDb) {
        try {
          await testDb.closeAsync();
        } catch (e) {
          logger.warn('[validateDatabase] Error closing test DB', e);
        }
      }
    }
  }

  /**
   * Waits if a layout switch is in progress.
   * This prevents "Get Words" from crashing the app during a switch.
   */
  private static async waitForLock() {
    if (!this.isSwappingLayout) return;
    
    logger.debug('[LayoutService] Waiting for DB Lock...');
    let attempts = 0;
    while (this.isSwappingLayout && attempts < 20) {
      await new Promise(r => setTimeout(r, 200)); // Wait 200ms
      attempts++;
    }
    if (this.isSwappingLayout) {
      logger.warn('[LayoutService] Lock timed out, proceeding anyway (risk of crash)');
    }
  }

  static async setActiveLayout(layoutId: string): Promise<boolean> {
    try {
      logger.debug(`[setActiveLayout] Setting layout: ${layoutId}`);

      const layout = AVAILABLE_LAYOUTS.find((l) => l.layout_id === layoutId);
      if (!layout) {
        logger.warn('Layout not found', layoutId);
        return false;
      }

      // Verify layout assets are installed
      try {
        const status = await checkLayoutStatus(layoutId);
        if (status !== 'ready') {
          logger.warn('Layout not installed, cannot activate', layoutId);
          return false;
        }
      } catch (e) {
        logger.error('Failed checking layout status for activation', e);
        return false;
      }

      // CRITICAL GUARD: If the requested layout is already active and we have a valid connection,
      // don't re-initialize (avoid close/open race that causes Android failures).
      if (this.activeLayoutId === layoutId && this.activeDb) {
        logger.debug('[setActiveLayout] Already active - skipping', layoutId);
        return true;
      }

      // Close previous DB (we only close if switching layouts)
      if (this.activeDb) {
        logger.debug('[setActiveLayout] Closing previous DB');
        try {
          await this.activeDb.closeAsync();
        } catch (e) {
          logger.warn('[setActiveLayout] Error closing previous DB', e);
        }
        this.activeDb = null;
      }

      // Ensure sqlite dir and copy DB
      await this.ensureSqliteDir();
      await this.copyDbToSqliteIfNeeded(layout.dbFileName);

      // Add delay for Android to ensure file system operations complete
      if (Platform.OS === 'android') {
        // Keep a short delay on Android after file copy to allow filesystem to settle.
        // Android needs ~100-200ms after a copy before a newly-copied sqlite file is safe
        // to open. Set to 150ms as a conservative middle-ground.
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // If we already have a separateWordsDb that matches the file we are about to open,
      // reuse it as the active DB to avoid creating a duplicate connection to the same file.
      if (this.separateWordsDb && this.separateWordsDbName === layout.dbFileName) {
        logger.debug('[setActiveLayout] Reusing existing separate words DB as active DB for', layout.dbFileName);

        // Close old activeDb already closed above; promote separateWordsDb
        this.activeDb = this.separateWordsDb;
        this.activeDbName = this.separateWordsDbName;
        this.separateWordsDb = null;
        this.separateWordsDbName = null;
        this.activeLayoutId = layoutId;

        await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_LAYOUT, layoutId);
        this.notifyDatabaseChange();
        logger.debug('Set active layout successfully (reused separate words DB)', layoutId);
        return true;
      }

      // Open DB by name
      logger.debug(`[setActiveLayout] Opening database: ${layout.dbFileName}`);
      this.activeDb = await (SQLite as any).openDatabaseAsync(layout.dbFileName);
      this.activeLayoutId = layoutId;
      this.activeDbName = layout.dbFileName;

      // Check if this DB has the words table
      const hasWords = await this.checkHasWordsTable(this.activeDb);

      if (!hasWords) {
        logger.debug(`[setActiveLayout] Active DB ${layout.dbFileName} missing words table. Opening fallback...`);
        // Ensure the fallback DB is available
        // Fallback to the packaged Hafs DB (canonical ordering) for words lookup
        // when the active layout DB does not contain a words table.
        const fallbackDbName = 'qpc-hafs-15-lines.db';
        logger.info(`[setActiveLayout] Using words fallback DB: ${fallbackDbName}`);
        await this.ensureSqliteDir();
        await this.copyDbToSqliteIfNeeded(fallbackDbName);

        // Open fallback DB for words
        if (this.separateWordsDbName !== fallbackDbName) {
          if (this.separateWordsDb) {
            try { await this.separateWordsDb.closeAsync(); } catch (e) { }
          }
          this.separateWordsDb = await (SQLite as any).openDatabaseAsync(fallbackDbName);
          this.separateWordsDbName = fallbackDbName;
        }
      } else {
        // Active DB has words, so we don't need a separate one
        if (this.separateWordsDb) {
          try { await this.separateWordsDb.closeAsync(); } catch (e) { }
          this.separateWordsDb = null;
          this.separateWordsDbName = null;
        }
      }

      await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_LAYOUT, layoutId);

      // Notify subscribers that the active database has changed. Consumers should re-init
      // any cached DB references when they receive the notification.
      this.notifyDatabaseChange();

      logger.debug('Set active layout successfully', layoutId);
      return true;
    } catch (error) {
      logger.error('Error setting active layout', error);
      return false;
    }
  }

  static async getWordsDb(): Promise<any> {
    // 1. SAFETY: Wait if we are in the middle of a switch
    await this.waitForLock();

    // 2. Reuse active DB if it is the words DB (merged qudratullah-indopak)
    // This prevents the double-open crash.
    if (this.activeDb && this.activeDbName === WORDS_DB_NAME) {
      return this.activeDb;
    }

    // 3. Reuse existing separate connection
    if (this.separateWordsDb) {
      return this.separateWordsDb;
    }

    // 4. Open separate connection (ONLY if active is NOT the words DB)
    try {
      logger.debug('[getWordsDb] Opening separate words connection - using WORDS_DB_NAME=' + WORDS_DB_NAME);
      await this.ensureSqliteDir();
      await this.copyDbToSqliteIfNeeded(WORDS_DB_NAME);
      
      this.separateWordsDb = await (SQLite as any).openDatabaseAsync(WORDS_DB_NAME);
      logger.debug('[getWordsDb] separateWordsDb opened for ' + WORDS_DB_NAME);
      return this.separateWordsDb;
    } catch (e) {
      logger.error('Failed to open words DB', e);
      return null;
    }
  }

  private static async checkHasWordsTable(db: any): Promise<boolean> {
    try {
      const row = await db.getFirstAsync(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='words' LIMIT 1`
      );
      return !!row;
    } catch (e) {
      return false;
    }
  }

  /**
   * Internal helper to close everything safely.
   * Does NOT notify listeners (prevents loop).
   */
  private static async closeAllConnectionsInternal() {
    if (this.activeDb) {
      try { await this.activeDb.closeAsync(); } catch (e) {}
      this.activeDb = null;
    }
    
    // IMPORTANT: Check if separateWordsDb is a different object before closing
    if (this.separateWordsDb) {
       // If we aliased them, don't double close
       if (this.separateWordsDb !== this.activeDb) {
          try { await this.separateWordsDb.closeAsync(); } catch (e) {}
       }
       this.separateWordsDb = null;
    }
    
    this.activeLayoutId = null;
    this.activeDbName = null;
  }

  static async closeActiveLayout(): Promise<void> {
    const prevActiveDb = this.activeDb;
    if (prevActiveDb) {
      try {
        await this.activeDb.closeAsync();
      } catch (e) {
        logger.warn('[closeActiveLayout] Error closing DB', e);
      }
      this.activeDb = null;
      this.activeLayoutId = null;
      this.activeDbName = null;
      try {
        this.notifyDatabaseChange();
      } catch (e) {
        logger.debug('[closeActiveLayout] error notifying db change', e);
      }
    }

    // Close separate words DB if present and it's not the same object as the active DB we just closed
    if (this.separateWordsDb && this.separateWordsDb !== prevActiveDb) {
      try {
        await this.separateWordsDb.closeAsync();
      } catch (e) {
        logger.warn('[closeActiveLayout] Error closing separate words DB', e);
      }
      this.separateWordsDb = null;
      this.separateWordsDbName = null;
    }
  }

  // --- STANDARD GETTERS ---

  /**
   * Get the currently active database connection.
   * This allows other services to use the same connection instead of opening new ones.
   * CRITICAL for Android - prevents "multiple connections to same DB" issue.
   */
  static getActiveDb(): any {
    if (!this.activeDb) {
      logger.warn('[getActiveDb] No active database connection. Call initializeDefaultLayout() first.');
    }
    return this.activeDb;
  }

  static async getActiveLayoutId(): Promise<string> {
    try {
      const layoutId = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_LAYOUT);
      return layoutId || 'indopak_15';
    } catch (error) {
      logger.error('Error getting active layout id', error);
      return 'indopak_15';
    }
  }
  
  static async getActiveLayout(): Promise<LayoutMetadata | null> {
    const id = await this.getActiveLayoutId();
    return AVAILABLE_LAYOUTS.find((l) => l.layout_id === id) || null;
  }

  // --- LISTENERS ---
  
  /**
   * Subscribe to database changes (layout switches, re-initialization).
   * Returns an unsubscribe function.
   */
  static onDatabaseChange(callback: () => void): () => void {
    this.dbChangeListeners.push(callback);
    logger.debug('[onDatabaseChange] Listener registered, total:', this.dbChangeListeners.length);
    return () => {
      const i = this.dbChangeListeners.indexOf(callback);
      if (i > -1) this.dbChangeListeners.splice(i, 1);
      logger.debug('[onDatabaseChange] Listener removed, total:', this.dbChangeListeners.length);
    };
  }

  /**
   * Notify registered listeners about database swap.
   */
  private static notifyDatabaseChange(): void {
    try {
      if (this.dbChangeListeners.length === 0) return;
      logger.debug('[notifyDatabaseChange] Notifying', this.dbChangeListeners.length, 'listeners');
      this.dbChangeListeners.forEach(cb => {
        try { cb(); } catch (err) { logger.error('[notifyDatabaseChange] listener error', err); }
      });
    } catch (err) {
      logger.error('[notifyDatabaseChange] Error while notifying listeners', err);
    }
  }

  // --- INITIALIZATION ---
  
  static async initializeDefaultLayout(): Promise<boolean> {
    // Prevent concurrent initialization
    if (this.isInitializing && this.initPromise) {
      logger.debug('[initializeDefaultLayout] Already initializing, waiting...');
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const id = await this.getActiveLayoutId();
        logger.debug('[initializeDefaultLayout] Initializing layout:', id);
        const result = await this.setActiveLayout(id);
        return result;
      } catch (error) {
        logger.error('Error initializing default layout', error);
        return false;
      } finally {
        this.isInitializing = false;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  // ... (Keep your existing queries: getVersesForWordRange, getPageLayout, etc.)
  // Just ensure they check `if (!this.activeDb) return ...` at the start.
  
  /**
   * Query the words table for distinct surah/ayah pairs within a word-id range.
   * The words table is now in the same database as pages.
   */
  static async getVersesForWordRange(firstId: number, lastId: number): Promise<Array<{ surah: number; ayah: number }>> {
    try {
      const db = this.separateWordsDb || this.activeDb;
      if (!db) {
        logger.warn('[getVersesForWordRange] No active database');
        return [];
      }

      const rows = await db.getAllAsync(
        `SELECT DISTINCT surah, ayah FROM words WHERE id BETWEEN ? AND ? ORDER BY surah ASC, ayah ASC`,
        [firstId, lastId]
      );

      return (rows || []).map((r: { surah: number; ayah: number }) => ({
        surah: r.surah,
        ayah: r.ayah
      }));
    } catch (e) {
      logger.error('getVersesForWordRange failed', e);
      return [];
    }
  }

  static async getPageLayout(pageNumber: number): Promise<PageLayout[]> {
    if (!this.activeDb) {
      logger.warn('No active DB selected');
      return [];
    }

    try {
      const rows = await this.activeDb.getAllAsync(
        `SELECT 
          page_number,
          line_number,
          line_type,
          is_centered,
          first_word_id,
          last_word_id,
          surah_number
        FROM pages
        WHERE page_number = ?
        ORDER BY line_number ASC`,
        [pageNumber]
      );
      return rows || [];
    } catch (error) {
      logger.error('Error fetching page layout', error);
      return [];
    }
  }

  static async getPageRange(startPage: number, endPage: number): Promise<Map<number, PageLayout[]>> {
    if (!this.activeDb) {
      logger.warn('No active DB selected');
      return new Map();
    }

    try {
      const rows = await this.activeDb.getAllAsync(
        `SELECT 
          page_number,
          line_number,
          line_type,
          is_centered,
          first_word_id,
          last_word_id,
          surah_number
        FROM pages
        WHERE page_number BETWEEN ? AND ?
        ORDER BY page_number ASC, line_number ASC`,
        [startPage, endPage]
      );

      const pageMap = new Map<number, PageLayout[]>();
      (rows || []).forEach((r: PageLayout) => {
        if (!pageMap.has(r.page_number)) pageMap.set(r.page_number, []);
        pageMap.get(r.page_number)!.push(r);
      });
      return pageMap;
    } catch (error) {
      logger.error('Error fetching page range', error);
      return new Map();
    }
  }

  static async getSurahStartPage(surahNumber: number): Promise<number> {
    if (!this.activeDb) {
      logger.warn('No active DB selected');
      return 1;
    }

    try {
      const res = await this.activeDb.getFirstAsync(
        `SELECT MIN(page_number) as page_number FROM pages WHERE surah_number = ? AND line_type = 'surah_name' LIMIT 1`,
        [surahNumber]
      );
      return res?.page_number || 1;
    } catch (error) {
      logger.error('Error getting surah start page', error);
      return 1;
    }
  }

  static async getSurahForPage(pageNumber: number): Promise<{ surah_number: number; start_page: number } | null> {
    if (!this.activeDb) {
      logger.warn('No active DB selected for getSurahForPage');
      return null;
    }

    try {
      const sql = `SELECT surah_number, start_page FROM (
          SELECT surah_number, MIN(page_number) AS start_page
          FROM pages
          WHERE line_type = 'surah_name'
          GROUP BY surah_number
        ) WHERE start_page <= ? ORDER BY start_page DESC LIMIT 1`;

      const res = await this.activeDb.getFirstAsync(sql, [pageNumber]);
      if (!res) return null;
      return { surah_number: res.surah_number, start_page: res.start_page };
    } catch (error) {
      logger.error('Error getting surah for page', error);
      return null;
    }
  }

  static async getSurahPages(surahNumber: number): Promise<number[]> {
    if (!this.activeDb) {
      logger.warn('No active DB selected');
      return [];
    }

    try {
      const rows = await this.activeDb.getAllAsync(
        `SELECT DISTINCT page_number FROM pages WHERE surah_number = ? ORDER BY page_number ASC`,
        [surahNumber]
      );
      return (rows || []).map((r: { page_number: number }) => r.page_number);
    } catch (error) {
      logger.error('Error getting surah pages', error);
      return [];
    }
  }

  static async getTotalPages(): Promise<number> {
    if (!this.activeDb) {
      logger.warn('No active DB selected');
      return 0;
    }

    try {
      const res = await this.activeDb.getFirstAsync(`SELECT MAX(page_number) as total FROM pages`);
      return res?.total || 0;
    } catch (error) {
      logger.error('Error getting total pages', error);
      return 0;
    }
  }
  
  // Reuse existing query methods (getPageLayout, etc.) but add a check:
  // if (this.isSwappingLayout) return []; 
}

export default LayoutService;