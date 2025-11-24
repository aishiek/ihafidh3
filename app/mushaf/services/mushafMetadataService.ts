import { openDatabaseAsync } from 'expo-sqlite';
import type { MushafInfo, MushafPageRow } from '../types/mushaf.types';

export async function initMushafDB() {
  // Opens (or creates) the MushafLayout.db in app sandbox using the async API
  const db = await openDatabaseAsync('MushafLayout.db');
  return db;
}

export async function getMushafInfo(db: any): Promise<MushafInfo | null> {
  const row = await db.getFirstAsync('SELECT * FROM info LIMIT 1');
  if (!row) return null;
  return {
    name: row.name,
    number_of_pages: row.number_of_pages,
    lines_per_page: row.lines_per_page,
    font_name: row.font_name,
  };
}

export async function getPageInfo(db: any, pageNumber: number): Promise<MushafPageRow | null> {
  const row = await db.getFirstAsync('SELECT * FROM pages WHERE page_number = ?', [pageNumber]);
  if (!row) return null;
  return row as MushafPageRow;
}

export async function getPageRange(db: any, startPage: number, endPage: number): Promise<MushafPageRow[]> {
  const rows = await db.getAllAsync('SELECT * FROM pages WHERE page_number BETWEEN ? AND ?', [startPage, endPage]);
  return (rows || []) as MushafPageRow[];
}

export async function getWordsInRange(db: any, firstId: number, lastId: number): Promise<{ id: number; text: string, tajweed_rule?: string }[]> {
  if (!db) return [];
  const rows = await db.getAllAsync('SELECT id, text, tajweed_rule FROM items WHERE id BETWEEN ? AND ? ORDER BY id ASC', [firstId, lastId]);
  return (rows || []) as { id: number; text: string, tajweed_rule?: string }[];
}

export interface PageMetadata {
  pageNumber: number;
  surahNumber: number | null;
  surahName: string | null;
  juzNumber: number | null;
}

export async function getPageMetadata(db: any, pageNumber: number): Promise<PageMetadata> {
  if (!db) {
    return {
      pageNumber,
      surahNumber: null,
      surahName: null,
      juzNumber: null,
    };
  }

  try {
    // Get the first line of the page to determine surah
    const row = await db.getFirstAsync(
      'SELECT surah_number, juz_number FROM pages WHERE page_number = ? ORDER BY line_number ASC LIMIT 1',
      [pageNumber]
    );

    if (!row) {
      return {
        pageNumber,
        surahNumber: null,
        surahName: null,
        juzNumber: null,
      };
    }

    // Import surah data to get the name
    const { surahsData } = await import('../../../data/surahs');
    const surahInfo = surahsData.find((s: any) => s.id === row.surah_number);

    return {
      pageNumber,
      surahNumber: row.surah_number || null,
      surahName: surahInfo?.name || null,
      juzNumber: row.juz_number || null,
    };
  } catch (error) {
    console.error('[getPageMetadata] Error:', error);
    return {
      pageNumber,
      surahNumber: null,
      surahName: null,
      juzNumber: null,
    };
  }
}
