import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { TajweedRule, WordWithTajweed } from '../../../types/tajweed';

const DB_NAME = 'tajweed_data.db';

export class TajweedService {
  private static db: any = null;

  static async initialize(): Promise<void> {
    if (this.db) return;
    try {
      // Attempt to ensure the tajweed DB file exists in the app SQLite directory.
      // Expo's SQLite opens DBs by name from the app's DocumentDirectory/SQLite.
      const SQLITE_DIR = (FileSystem as any).documentDirectory + 'SQLite';
      const TARGET_DB_PATH = `${SQLITE_DIR}/${DB_NAME}`;

      try {
        const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
      } catch (e) {
        // ignore directory creation errors and proceed to opening by name
      }

      // If the DB file is not already present in the SQLite dir, try to copy a bundled asset.
      try {
        const targetInfo = await FileSystem.getInfoAsync(TARGET_DB_PATH);
        if (!targetInfo.exists) {
          // Statically require known asset module paths (Metro bundler forbids dynamic require)
          const candidateModules: any[] = [];
          try { candidateModules.push(require('../../../assets/database/tajweed_data.db')); } catch (_) {}
          try { candidateModules.push(require('../../../assets/database/tajweed-data.db')); } catch (_) {}
          try { candidateModules.push(require('../../../assets/database/tajweed-data.sqlite')); } catch (_) {}

          for (const ASSET_MODULE of candidateModules) {
            try {
              const asset = Asset.fromModule(ASSET_MODULE as any);
              await asset.downloadAsync();
              const assetPath = asset.localUri || asset.uri;
              if (assetPath) {
                try {
                  await FileSystem.copyAsync({ from: assetPath, to: TARGET_DB_PATH });
                  console.log('Copied tajweed DB asset to', TARGET_DB_PATH);
                  break;
                } catch (copyErr) {
                  console.warn('Failed to copy tajweed asset module', copyErr);
                }
              }
            } catch (err) {
              // asset.fromModule/download failed for this module, try next
              console.warn('tajweed asset module processing failed', err);
            }
          }
        }
      } catch (e) {
        // ignore asset copy failures
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.db = await (SQLite as any).openDatabaseAsync(DB_NAME);

      // Verify the expected table exists in the opened DB. Some packaged DBs
      // or installations may not include the tajweed table; in that case we
      // will close the DB and treat tajweed as unavailable (graceful fallback).
      try {
        // @ts-ignore
        const tbl = await this.db.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='words_tajweed' LIMIT 1",
          []
        );
        if (!tbl) {
          // Suppressed: console.warn('⚠️ tajweed table not found in DB; disabling tajweed features');
          try {
            // @ts-ignore
            await this.db.closeAsync();
          } catch (_) {
            // ignore
          }
          this.db = null;
          return;
        }
      } catch (checkErr) {
        console.warn('⚠️ Failed to verify tajweed table presence, disabling tajweed features', checkErr);
        try {
          // @ts-ignore
          await this.db.closeAsync();
        } catch (_) {}
        this.db = null;
        return;
      }

      console.log('✅ Tajweed database initialized');
    } catch (error) {
      console.error('❌ Error initializing tajweed database:', error);
      throw error;
    }
  }

  static async getWordTajweed(wordId: number): Promise<WordWithTajweed | null> {
    if (!this.db) await this.initialize();

    // If DB still not available, return null to indicate no tajweed info
    if (!this.db) return null;

    try {
      // @ts-ignore
      const result = await this.db.getFirstAsync<WordWithTajweed>(
        `SELECT 
          word_id,
          word_text,
          tajweed_codes,
          surah_number,
          ayah_number,
          position_in_ayah
        FROM words_tajweed 
        WHERE word_id = ?`,
        [wordId]
      );
      return result || null;
    } catch (error) {
      console.error(`Error fetching tajweed for word ${wordId}:`, error);
      return null;
    }
  }

  static async getWordsInRangeTajweed(firstWordId: number, lastWordId: number): Promise<WordWithTajweed[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    try {
      // @ts-ignore
      const results = await this.db.getAllAsync<WordWithTajweed>(
        `SELECT 
          word_id,
          word_text,
          tajweed_codes,
          surah_number,
          ayah_number,
          position_in_ayah
        FROM words_tajweed 
        WHERE word_id BETWEEN ? AND ? 
        ORDER BY word_id ASC`,
        [firstWordId, lastWordId]
      );
      return results || [];
    } catch (error) {
      console.error('Error fetching tajweed range:', error);
      return [];
    }
  }

  static async getWordsForAyah(surahNumber: number, ayahNumber: number): Promise<WordWithTajweed[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    try {
      // @ts-ignore
      const results = await this.db.getAllAsync<WordWithTajweed>(
        `SELECT 
          word_id,
          word_text,
          tajweed_codes,
          surah_number,
          ayah_number,
          position_in_ayah
        FROM words_tajweed
        WHERE surah_number = ? AND ayah_number = ?
        ORDER BY position_in_ayah ASC`,
        [surahNumber, ayahNumber]
      );
      return results || [];
    } catch (error) {
      console.error('Error fetching words for ayah:', error);
      return [];
    }
  }

  static getTajweedRulesFromBitmap(bitmap: number): TajweedRule[] {
    const rules: TajweedRule[] = [];
    const ruleMap = [
      TajweedRule.IKHFA,
      TajweedRule.GHUNNA,
      TajweedRule.IDHAR,
      TajweedRule.IQLAB,
      TajweedRule.IDGHAAM,
      TajweedRule.QALQALA,
      TajweedRule.SUKUN,
    ];

    for (let i = 0; i < ruleMap.length; i++) {
      if ((bitmap & (1 << i)) !== 0) {
        rules.push(ruleMap[i]);
      }
    }

    return rules;
  }

  static async getWordsByTajweedRule(surahNumber: number, rule: TajweedRule): Promise<WordWithTajweed[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    const ruleBit = [
      TajweedRule.IKHFA,
      TajweedRule.GHUNNA,
      TajweedRule.IDHAR,
      TajweedRule.IQLAB,
      TajweedRule.IDGHAAM,
      TajweedRule.QALQALA,
      TajweedRule.SUKUN,
    ].indexOf(rule);

    try {
      // @ts-ignore
      const results = await this.db.getAllAsync<WordWithTajweed>(
        `SELECT 
          word_id,
          word_text,
          tajweed_codes,
          surah_number,
          ayah_number,
          position_in_ayah
        FROM words_tajweed 
        WHERE surah_number = ? AND (tajweed_codes & ?) != 0
        ORDER BY word_id ASC`,
        [surahNumber, 1 << ruleBit]
      );
      return results || [];
    } catch (error) {
      console.error('Error fetching tajweed by rule:', error);
      return [];
    }
  }

  static async close(): Promise<void> {
    if (this.db) {
      try {
        // @ts-ignore
        await this.db.closeAsync();
      } catch (_) {
        // ignore
      }
      this.db = null;
    }
  }
}
