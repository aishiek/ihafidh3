import { AVAILABLE_LAYOUTS, LayoutMetadata, PageLayout } from '@/types/layout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { MUSHAF_CACHE_DIR } from '../utils/mushafConstants';
// Statically require packaged DB assets so Metro can resolve them at bundle time.
// These literal requires must match files under `assets/database/`.
const ASSET_DB_MODULES: Record<string, any> = {
  'qpc-hafs-15-lines.db': require('../../../assets/database/qpc-hafs-15-lines.db'),
  'qpc-v1-15-lines.db': require('../../../assets/database/qpc-v1-15-lines.db'),
  'qpc-nastaleeq-15-lines.db': require('../../../assets/database/qpc-nastaleeq-15-lines.db'),
};

// No static asset map here; if you ship packaged DBs, place them under
// `assets/databases/` and add literal requires here. For now, we only support
// copying from the cache directory and surface a clear error when the DB is
// not available.

const STORAGE_KEY_ACTIVE_LAYOUT = 'ACTIVE_MUSHAF_LAYOUT';
const SQLITE_DIR = (FileSystem as any).documentDirectory + 'SQLite';

const TAG = 'LayoutService';
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;
const log = (msg: string, ...args: any[]) => { if (DEV) console.log(`[${TAG}] ${msg}`, ...args); };
const logErr = (msg: string, err?: any) => { console.error(`[${TAG}] ${msg}`, err); };

export class LayoutService {
  private static activeDb: any = null;
  private static activeLayoutId: string | null = null;

  private static async ensureSqliteDir() {
    const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
      log('Created SQLite dir', SQLITE_DIR);
    }
  }

  private static async copyDbToSqliteIfNeeded(dbFileName: string): Promise<void> {
    // Source candidates: MUSHAF_CACHE_DIR/<dbFileName> or bundled asset under assets/database/
    const cachePath = `${MUSHAF_CACHE_DIR}/${dbFileName}`;
    const cacheUri = cachePath.startsWith('file://') ? cachePath : `file://${cachePath}`;
    const targetPath = `${SQLITE_DIR}/${dbFileName}`;

    try {
      const targetInfo = await FileSystem.getInfoAsync(targetPath);
      if (targetInfo.exists) {
        log('Target DB already exists at', targetPath);
        return;
      }

      // Prefer cache copy if present
      const cacheInfo = await FileSystem.getInfoAsync(cacheUri);
      if (cacheInfo.exists) {
        log('Copying DB from cache:', cacheUri, '->', targetPath);
        await FileSystem.copyAsync({ from: cacheUri, to: targetPath });
        return;
      }

      // Fallback to packaged asset in assets/database/<dbFileName>
      try {
        const ASSET_MODULE = ASSET_DB_MODULES[dbFileName];
        if (!ASSET_MODULE) throw new Error(`No static asset registered for ${dbFileName}`);
        const asset = Asset.fromModule(ASSET_MODULE as any);
        await asset.downloadAsync();
        const assetPath = asset.localUri || asset.uri;
        if (!assetPath) throw new Error('Packaged DB has no uri');
        log('Copying DB from asset:', assetPath, '->', targetPath);
        await FileSystem.copyAsync({ from: assetPath, to: targetPath });
        return;
      } catch (e) {
        logErr('Packaged asset fallback failed', e);
        throw new Error(`DB not found in cache or bundled asset: ${dbFileName}`);
      }
    } catch (e) {
      logErr('Failed to ensure DB present', e);
      throw e;
    }
  }

  static async setActiveLayout(layoutId: string): Promise<boolean> {
    try {
      const layout = AVAILABLE_LAYOUTS.find((l) => l.layout_id === layoutId);
      if (!layout || !layout.downloaded) {
        logErr('Layout not found or not downloaded', layoutId);
        return false;
      }

      // Close previous DB
      if (this.activeDb) {
        try { await this.activeDb.closeAsync(); } catch (_) {}
        this.activeDb = null;
      }

      // Ensure sqlite dir and copy DB
      await this.ensureSqliteDir();
      await this.copyDbToSqliteIfNeeded(layout.dbFileName);

      // Open DB by name
      this.activeDb = await (SQLite as any).openDatabaseAsync(layout.dbFileName);
      this.activeLayoutId = layoutId;

      await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_LAYOUT, layoutId);
      log('Set active layout', layoutId);
      return true;
    } catch (error) {
      logErr('Error setting active layout', error);
      return false;
    }
  }

  static async getActiveLayoutId(): Promise<string> {
    try {
      const layoutId = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_LAYOUT);
      return layoutId || 'madina_15';
    } catch (error) {
      logErr('Error getting active layout id', error);
      return 'madina_15';
    }
  }

  static async getActiveLayout(): Promise<LayoutMetadata | null> {
    const id = await this.getActiveLayoutId();
    return AVAILABLE_LAYOUTS.find((l) => l.layout_id === id) || null;
  }

  static async getPageLayout(pageNumber: number): Promise<PageLayout[]> {
    if (!this.activeDb) {
      logErr('No active DB selected');
      return [];
    }

    try {
      // @ts-ignore
      const rows = await this.activeDb.getAllAsync<PageLayout>(
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
      logErr('Error fetching page layout', error);
      return [];
    }
  }

  static async getPageRange(startPage: number, endPage: number): Promise<Map<number, PageLayout[]>> {
    if (!this.activeDb) {
      logErr('No active DB selected');
      return new Map();
    }

    try {
      // @ts-ignore
      const rows = await this.activeDb.getAllAsync<PageLayout>(
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
      logErr('Error fetching page range', error);
      return new Map();
    }
  }

  static async getSurahStartPage(surahNumber: number): Promise<number> {
    if (!this.activeDb) {
      logErr('No active DB selected');
      return 1;
    }

    try {
      // @ts-ignore
      const res = await this.activeDb.getFirstAsync<{ page_number: number }>(
        `SELECT MIN(page_number) as page_number FROM pages WHERE surah_number = ? AND line_type = 'surah_name' LIMIT 1`,
        [surahNumber]
      );
      return res?.page_number || 1;
    } catch (error) {
      logErr('Error getting surah start page', error);
      return 1;
    }
  }

  /**
   * Return the surah_number and its start_page for the surah that starts at or
   * before the given pageNumber in the currently active DB. This helps map a
   * reader position across different layout DBs.
   */
  static async getSurahForPage(pageNumber: number): Promise<{ surah_number: number; start_page: number } | null> {
    if (!this.activeDb) {
      logErr('No active DB selected for getSurahForPage');
      return null;
    }

    try {
      // Build a subquery that computes start_page per surah, then pick the
      // surah whose start_page is the largest value <= pageNumber.
      // We use a derived table because SQLite requires the aggregation first.
      const sql = `SELECT surah_number, start_page FROM (
          SELECT surah_number, MIN(page_number) AS start_page
          FROM pages
          WHERE line_type = 'surah_name'
          GROUP BY surah_number
        ) WHERE start_page <= ? ORDER BY start_page DESC LIMIT 1`;

      // @ts-ignore
      const res = await this.activeDb.getFirstAsync<{ surah_number: number; start_page: number }>(sql, [pageNumber]);
      if (!res) return null;
      return { surah_number: res.surah_number, start_page: res.start_page };
    } catch (error) {
      logErr('Error getting surah for page', error);
      return null;
    }
  }

  static async getSurahPages(surahNumber: number): Promise<number[]> {
    if (!this.activeDb) {
      logErr('No active DB selected');
      return [];
    }

    try {
      // @ts-ignore
      const rows = await this.activeDb.getAllAsync<{ page_number: number }>(
        `SELECT DISTINCT page_number FROM pages WHERE surah_number = ? ORDER BY page_number ASC`,
        [surahNumber]
      );
  return (rows || []).map((r: { page_number: number }) => r.page_number);
    } catch (error) {
      logErr('Error getting surah pages', error);
      return [];
    }
  }

  static async getTotalPages(): Promise<number> {
    if (!this.activeDb) {
      logErr('No active DB selected');
      return 0;
    }

    try {
      // @ts-ignore
      const res = await this.activeDb.getFirstAsync<{ total: number }>(`SELECT MAX(page_number) as total FROM pages`);
      return res?.total || 0;
    } catch (error) {
      logErr('Error getting total pages', error);
      return 0;
    }
  }

  static async initializeDefaultLayout(): Promise<boolean> {
    try {
      const id = await this.getActiveLayoutId();
      return await this.setActiveLayout(id);
    } catch (error) {
      logErr('Error initializing default layout', error);
      return false;
    }
  }

  static async closeActiveLayout(): Promise<void> {
    if (this.activeDb) {
      try { await this.activeDb.closeAsync(); } catch (_) {}
      this.activeDb = null;
      this.activeLayoutId = null;
    }
  }
}

export default LayoutService;
