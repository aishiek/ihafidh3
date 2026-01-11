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
  // Retry wrapper to make local DB access more resilient to transient
  // failures (for example: stale native handles after an app update).
  async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 500
  ): Promise<T> {
    let lastError: any = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        log(`Attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err);
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt); // exponential backoff
          log(`Retrying in ${delay}ms...`);
          // eslint-disable-next-line no-await-in-loop
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }
    throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError?.message ?? lastError}`);
  }

  return withRetry<LocalVerseRow | null>(async () => {
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
    // Removed repetitive log - only log on errors
    const row = await db.getFirstAsync<LocalVerseRow>(sql, [surahNumber, verseNumber]);
    return row || null;
    } catch (err) {
      log('Local DB fetch failed inside withRetry', err instanceof Error ? err.message : err);
      // Re-throw to allow withRetry to handle retries
      throw err;
    }
  }, 3, 500);
}
