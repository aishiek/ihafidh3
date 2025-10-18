import { getDatabase } from './juzDbService';

export interface LocalVerseRow {
  verse_id: number;
  chapter_id: number;
  verse_number: number;
  ayah: string;
  translation?: string | null;
  transliteration?: string | null;
  page_id?: number | null;
  part_id?: number | null;
}

function log(tag: string, ...args: any[]) {
  if (__DEV__) console.log(`[verseDbService] ${tag}`, ...args);
}

/**
 * Fetch a verse from the local bundled SQLite database using the same
 * pattern used in Juz-mode. Returns null if DB not available or verse not found.
 */
export async function getVerseFromLocalDB(surahNumber: number, verseNumber: number): Promise<LocalVerseRow | null> {
  try {
    const db = await getDatabase();
    const sql = `
      SELECT
        v.id as verse_id,
        v.chapter_id,
        v.number as verse_number,
        v.content as ayah,
        v.page_id as page_id,
        v.part_id as part_id,
        MAX(CASE WHEN i.collection_id = 2 THEN i.content ELSE NULL END) as translation,
        MAX(CASE WHEN i.collection_id = 3 THEN i.content ELSE NULL END) as transliteration
      FROM verses v
      LEFT JOIN items i ON v.id = i.verse_id
      WHERE v.chapter_id = ? AND v.number = ?
      GROUP BY v.id
      LIMIT 1
    `;
    log('Querying local DB for', surahNumber, verseNumber);
    const row = await db.getFirstAsync<LocalVerseRow>(sql, [surahNumber, verseNumber]);
    if (!row) return null;
    return row;
  } catch (err) {
    log('Local DB fetch failed', err instanceof Error ? err.message : err);
    return null;
  }
}
