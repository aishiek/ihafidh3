import { AVAILABLE_LAYOUTS, LayoutMetadata, PageLayout } from '@/types/layout';
import getLogger from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';
import { checkLayoutStatus } from './mushafDownloadService';

// Statically require packaged DB assets so Metro can resolve them at bundle time.
const ASSET_DB_MODULES: Record<string, any> = {
  'qpc-hafs-15-lines.db': require('../../../assets/database/qpc-hafs-15-lines.db'),
  'qpc-nastaleeq-15-lines.db': require('../../../assets/database/qpc-nastaleeq-15-lines.db'),
  'qudratullah-indopak-nastaleeq.db': require('../../../assets/database/qudratullah-indopak-nastaleeq.db'),
  'indopak-nastaleeq.db': require('../../../assets/database/indopak-nastaleeq.db'),
};

const STORAGE_KEY_ACTIVE_LAYOUT = 'ACTIVE_MUSHAF_LAYOUT';
const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;
const FALLBACK_DB_NAME = 'qudratullah-indopak-nastaleeq.db';

const logger = getLogger('LayoutService');

export class LayoutService {
  private static activeDb: any = null;
  private static activeLayoutId: string | null = null;
  private static activeDbName: string | null = null;

  private static separateWordsDb: any = null;
  private static separateWordsDbName: string | null = null;

  private static dbChangeListeners: Array<() => void> = [];

  // --- CRITICAL FIX: The Lock ---
  // If true, NO ONE is allowed to open/read databases.
  private static isSwappingLayout: boolean = false;

  private static async ensureSqliteDir() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
        // Android propagation delay
        if (Platform.OS === 'android') await new Promise(r => setTimeout(r, 100));
      }
    } catch (error) {
      logger.error('Failed to create SQLite directory', error);
    }
  }

  private static async copyDbToSqliteIfNeeded(dbFileName: string): Promise<void> {
    const targetPath = `${SQLITE_DIR}/${dbFileName}`;
    try {
      const targetInfo = await FileSystem.getInfoAsync(targetPath);

      // If valid, skip copy
      if (targetInfo.exists && targetInfo.size && targetInfo.size > 0) return;

      logger.debug(`[copyDb] Copying ${dbFileName}...`);

      // 1. Try Cache
      const cachePath = `${MUSHAF_CACHE_DIR}/${dbFileName}`;
      const cacheInfo = await FileSystem.getInfoAsync(cachePath);
      if (cacheInfo.exists) {
        await FileSystem.copyAsync({ from: cachePath, to: targetPath });
        return;
      }

      // 2. Try Assets
      const ASSET_MODULE = ASSET_DB_MODULES[dbFileName];
      if (ASSET_MODULE) {
        const asset = Asset.fromModule(ASSET_MODULE);
        await asset.downloadAsync();
        await FileSystem.copyAsync({ from: asset.localUri || asset.uri, to: targetPath });
      } else {
        throw new Error(`No asset found for ${dbFileName}`);
      }
    } catch (error) {
      logger.error(`[copyDb] Failed for ${dbFileName}`, error);
      throw error;
    }
  }

  /**
   * THE FIX: Wait for the layout swap to finish.
   * Prevents UI from crashing the DB connection during a swap.
   */
  private static async waitForLock() {
    if (!this.isSwappingLayout) return;

    // Check every 100ms if the swap is done
    let attempts = 0;
    while (this.isSwappingLayout && attempts < 50) { // Wait max 5 seconds
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
  }

  static async setActiveLayout(layoutId: string): Promise<boolean> {
    // 1. Acquire Lock
    if (this.isSwappingLayout) return false;
    this.isSwappingLayout = true;

    try {
      logger.debug(`[setActiveLayout] Switching to: ${layoutId}`);
      const layout = AVAILABLE_LAYOUTS.find((l) => l.layout_id === layoutId);
      if (!layout) throw new Error('Layout not found');

      // Check status
      const status = await checkLayoutStatus(layoutId);
      if (status !== 'ready') {
        logger.warn('Layout not installed');
        return false;
      }

      // Optimization: Already active?
      if (this.activeLayoutId === layoutId && this.activeDb) {
        this.isSwappingLayout = false;
        return true;
      }

      // 2. Clean Slate: Close EVERYTHING before touching files
      // This prevents the "locked" error on Android.
      await this.closeAllInternal();

      // 3. Prepare Files
      await this.ensureSqliteDir();
      await this.copyDbToSqliteIfNeeded(layout.dbFileName);

      // Android Safety Pause (Crucial for FS locks to release)
      if (Platform.OS === 'android') {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // 4. Open New DB
      this.activeDb = await (SQLite as any).openDatabaseAsync(layout.dbFileName);
      this.activeDbName = layout.dbFileName;
      this.activeLayoutId = layoutId;

      // WAL Mode helps concurrency
      try { await this.activeDb.execAsync('PRAGMA journal_mode = WAL;'); } catch (e) { }

      // 5. Check for words table / Handle Fallback
      const hasWords = await this.checkHasWordsTable(this.activeDb);

      if (!hasWords) {
        logger.debug('[setActiveLayout] Active DB missing words. Preparing fallback...');
        await this.copyDbToSqliteIfNeeded(FALLBACK_DB_NAME);

        if (Platform.OS === 'android') await new Promise(r => setTimeout(r, 100));

        this.separateWordsDb = await (SQLite as any).openDatabaseAsync(FALLBACK_DB_NAME);
        this.separateWordsDbName = FALLBACK_DB_NAME;

        // WAL Mode for fallback
        try { await this.separateWordsDb.execAsync('PRAGMA journal_mode = WAL;'); } catch (e) { }
      }

      await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_LAYOUT, layoutId);
      this.notifyDatabaseChange();
      return true;

    } catch (error) {
      logger.error('Error setting active layout', error);
      // Emergency Cleanup
      await this.closeAllInternal();
      return false;
    } finally {
      // 6. Release Lock
      this.isSwappingLayout = false;
    }
  }

  private static async closeAllInternal() {
    if (this.activeDb) {
      try { await this.activeDb.closeAsync(); } catch (e) { }
      this.activeDb = null;
    }
    if (this.separateWordsDb) {
      // Only close if it's a different object instance
      if (this.separateWordsDb !== this.activeDb) {
        try { await this.separateWordsDb.closeAsync(); } catch (e) { }
      }
      this.separateWordsDb = null;
    }
    this.activeLayoutId = null;
    this.activeDbName = null;
    this.separateWordsDbName = null;
  }

  static async getWordsDb(): Promise<any> {
    // 1. SAFETY: Wait here if a swap is happening!
    await this.waitForLock();

    // 2. Return valid connections
    if (this.separateWordsDb) return this.separateWordsDb;

    // If active DB is set and has words (checked during init), return it
    if (this.activeDb && this.activeDbName !== FALLBACK_DB_NAME) {
      // We assume if separateWordsDb is null, activeDb handles it
      return this.activeDb;
    }

    // 3. Last Resort: If we are here, something is wrong, but don't try to open 
    // files blindly. Just return activeDb and hope for the best to avoid crashes.
    return this.activeDb;
  }

  // --- Getters & Helpers ---

  static async getVersesForWordRange(firstId: number, lastId: number): Promise<Array<{ surah: number; ayah: number }>> {
    const db = await this.getWordsDb(); // This now waits for lock
    if (!db) return [];
    try {
      const rows = await db.getAllAsync(
        `SELECT DISTINCT surah, ayah FROM words WHERE id BETWEEN ? AND ? ORDER BY surah ASC, ayah ASC`,
        [firstId, lastId]
      );
      return (rows || []).map((r: any) => ({ surah: r.surah, ayah: r.ayah }));
    } catch (e) { return []; }
  }

  private static async checkHasWordsTable(db: any): Promise<boolean> {
    try {
      const row = await db.getFirstAsync(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='words' LIMIT 1`
      );
      return !!row;
    } catch (e) { return false; }
  }

  static async getActiveLayoutId(): Promise<string> {
    return this.activeLayoutId || (await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_LAYOUT)) || 'indopak_15';
  }

  static async getActiveLayout(): Promise<LayoutMetadata | null> {
    const id = await this.getActiveLayoutId();
    return AVAILABLE_LAYOUTS.find((l) => l.layout_id === id) || null;
  }

  static onDatabaseChange(callback: () => void): () => void {
    this.dbChangeListeners.push(callback);
    return () => {
      const i = this.dbChangeListeners.indexOf(callback);
      if (i > -1) this.dbChangeListeners.splice(i, 1);
    };
  }

  private static notifyDatabaseChange(): void {
    this.dbChangeListeners.forEach(cb => { try { cb(); } catch (e) { } });
  }

  static async initializeDefaultLayout(): Promise<boolean> {
    if (this.activeDb) return true;
    return this.setActiveLayout(await this.getActiveLayoutId());
  }

  static getActiveDb(): any {
    // If locked, return null safely. Consumer handles graceful degradation.
    if (this.isSwappingLayout) return null;
    return this.activeDb;
  }

  // Wrapper for external closing
  static async closeActiveLayout(): Promise<void> {
    this.isSwappingLayout = true;
    await this.closeAllInternal();
    this.notifyDatabaseChange();
    this.isSwappingLayout = false;
  }

  // Passthrough queries (ensure they check for activeDb)
  static async getPageLayout(pageNumber: number): Promise<PageLayout[]> {
    await this.waitForLock(); // Wait for DB
    if (!this.activeDb) return [];
    try {
      return await this.activeDb.getAllAsync(
        `SELECT page_number, line_number, line_type, is_centered, first_word_id, last_word_id, surah_number FROM pages WHERE page_number = ? ORDER BY line_number ASC`,
        [pageNumber]
      );
    } catch (e) { return []; }
  }

  static async getPageRange(startPage: number, endPage: number): Promise<Map<number, PageLayout[]>> {
    await this.waitForLock();
    if (!this.activeDb) return new Map();

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
    await this.waitForLock();
    if (!this.activeDb) return 1;

    try {
      // Strategy 1: Look for surah header (standard)
      const res = await this.activeDb.getFirstAsync(
        `SELECT page_number FROM pages WHERE surah_number = ? AND line_type = 'surah_name' LIMIT 1`,
        [surahNumber]
      );
      if (res?.page_number) return res.page_number;

      // Strategy 2: Look for ANY line belonging to this surah (min page)
      const resMin = await this.activeDb.getFirstAsync(
        `SELECT MIN(page_number) as page_number FROM pages WHERE surah_number = ?`,
        [surahNumber]
      );
      if (resMin?.page_number) return resMin.page_number;

      // Strategy 3: Hardcoded fallback
      const layout = await this.getActiveLayout();
      if (layout) {
        // Import static data lazily
        const { surahsData } = require('../../../data/surahs');
        const surah = surahsData.find((s: any) => s.id === surahNumber);
        if (surah) return surah.pageNumber;
      }

      return 1;
    } catch (error) {
      logger.error('Error getting surah start page', error);
      return 1;
    }
  }

  static async getSurahForPage(pageNumber: number): Promise<{ surah_number: number; start_page: number } | null> {
    await this.waitForLock();
    if (!this.activeDb) return null;

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
    await this.waitForLock();
    if (!this.activeDb) return [];

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
    await this.waitForLock();
    if (!this.activeDb) return 0;

    try {
      const res = await this.activeDb.getFirstAsync(`SELECT MAX(page_number) as total FROM pages`);
      return res?.total || 0;
    } catch (error) {
      logger.error('Error getting total pages', error);
      return 0;
    }
  }
}

export default LayoutService;
