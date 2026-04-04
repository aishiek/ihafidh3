import { cacheVerses, getCachedVerses, isSurahCached } from '@/assets/database/QuranDatabase';
import {
  BISMILLAH_ARABIC,
  BISMILLAH_AUDIO_URL,
  BISMILLAH_TRANSLATION_EN as BISMILLAH_TRANSLATION,
  shouldHaveBismillah
} from '@/constants/basmalah';
import { fetchVersesForJuz } from '@/services/juzDbService';
import { fetchSingleVerse, fetchVersesBySurah } from '@/services/quranApi';
import { useSettingsStore } from '@/store/settingsStore';
import { Verse } from '@/types';

// Utility: Get Bismillah audio URL based on reciter

// Utility: Get Bismillah audio URL based on reciter
function getBismillahAudioUrl(): string {
  return BISMILLAH_AUDIO_URL;
}

// Utility: Create a standalone Bismillah verse
function createBismillahVerse(surahId: number): Verse {
  return {
    // Use a negative sentinel ID to avoid clashing with real verse IDs (which are positive)
    id: -surahId,
    surahId,
    verseNumber: 0, // Virtual verse (not from API)
    arabicText: BISMILLAH_ARABIC,
    translation: BISMILLAH_TRANSLATION,
    audioUrl: getBismillahAudioUrl(),
  };
}

// Utility: Robust matching for Bismillah at beginning of verse
function startsWithBismillah(text: string): boolean {
  return /^\s*بِسْمِ\s+[ٱا]للَّهِ\s+[ٱا]لرَّحْمَٰنِ\s+[ٱا]لرَّحِيمِ/u.test(text);
}

// Utility: Strip Bismillah from beginning of a verse, if applicable
function stripBismillahFromVerse(verse: Verse, surahId: number): Verse {
  if (shouldHaveBismillah(surahId) && verse.verseNumber === 1) {
    // Find the end of "Ar-Rahim" and strip everything up to and including it
    // This is much more robust than matching the entire phrase exactly
    const bismillahMatch = verse.arabicText.match(/^.*?[ٱا]لرَّحِيمِ[\s\u00A0]*/u);
    if (bismillahMatch) {
      return {
        ...verse,
        arabicText: verse.arabicText.substring(bismillahMatch[0].length).trim(),
      };
    }
  }
  return verse;
}

// Utility: Append Bismillah audio to first verse audio
function appendBismillahAudio(verse: Verse, surahId: number): Verse {
  if (shouldHaveBismillah(surahId) && verse.verseNumber === 1) {
    // We don't actually modify the audio URL here, as we'll handle the playback
    // in the audio player by playing Bismillah first, then the verse
    return {
      ...verse,
      hasBismillahPrefix: true, // Add a flag to indicate this verse should play Bismillah first
    };
  }
  return verse;
}

// Main API: Get verses for a Surah, with optional Bismillah prepended
import { fetchVersesForSurah } from '@/services/juzDbService';

export async function getVersesBySurah(
  surahId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<Verse[]> {
  try {
    // 1. Fetch from the robust local SQLite database
    const rawVerses = await fetchVersesForSurah(surahId);

    // 2. Map to the common Verse type
    const verses: Verse[] = rawVerses.map(rv => ({
      id: rv.verse_id,
      surahId: rv.chapter_id,
      verseNumber: rv.verse_number,
      arabicText: rv.ayah,
      translation: rv.translation || '',
      transliteration: rv.transliteration,
      juzNumber: rv.part_id,
    }));

    // 3. Apply stripping and audio logic
    const processed = verses.map((v) => stripBismillahFromVerse(v, surahId));

    // 4. Inject Bismillah as Verse 0 on the first page
    if (shouldHaveBismillah(surahId) && page === 1) {
      const bismillahVerse = createBismillahVerse(surahId);
      return [bismillahVerse, ...processed];
    }

    return processed;
  } catch (error) {
    console.error(`Error fetching verses for surah ${surahId}:`, error);
    throw error;
  }
}

// Lookup single verse (used for audio player or verse-by-verse view)
export async function getVerseByKey(
  surahId: number,
  verseNumber: number
): Promise<Verse | null> {
  try {
    if (shouldHaveBismillah(surahId) && verseNumber === 0) {
      return createBismillahVerse(surahId);
    }

    const cachedVerses = await getCachedVerses(surahId, 1, 1000);
    const found = cachedVerses.find((v) => v.verseNumber === verseNumber);
    if (found) {
      return stripBismillahFromVerse(found, surahId);
    }

    const apiVerse = await fetchSingleVerse(surahId, verseNumber, 'en.asad', useSettingsStore.getState().reciterIdentifier);
    if (apiVerse) {
      await cacheVerses([apiVerse]);
      return stripBismillahFromVerse(apiVerse, surahId);
    }

    return null;
  } catch (error) {
    console.error(`Error fetching verse ${surahId}:${verseNumber}`, error);
    return null;
  }
}

// Helper: Check if entire surah is already cached
export async function isSurahFullyCached(surahId: number): Promise<boolean> {
  return isSurahCached(surahId);
}

// Helper: Prefetch all verses for a surah
export async function prefetchSurah(surahId: number): Promise<boolean> {
  try {
    if (await isSurahCached(surahId)) return true;

    const apiResult = await fetchVersesBySurah(surahId, 1, 1000);
    const verses: Verse[] = Array.isArray(apiResult) ? apiResult : apiResult.verses;

    if (verses.length > 0) {
      await cacheVerses(verses);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error prefetching surah ${surahId}:`, error);
    return false;
  }
}

// Stub for future Juz support
export async function getVersesByJuz(
  juzNumber: number,
  page: number = 1,
  pageSize: number = 10
): Promise<Verse[]> {
  try {
    // Load ayah + translation + transliteration from local DB
    const allRows = await fetchVersesForJuz(juzNumber);
    if (!Array.isArray(allRows) || allRows.length === 0) return [];

    // paginate locally
    const startIdx = (page - 1) * pageSize;
    const slice = allRows.slice(startIdx, startIdx + pageSize);

    // helper to compute global verse id for consistency with the rest of the app
    const counts = [
      7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
      112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53,
      89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12,
      12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
      30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
    ];
    const computeGlobalId = (surahId: number, verseNumber: number) =>
      counts.slice(0, surahId - 1).reduce((a, b) => a + b, 0) + verseNumber;

    // Build Verse objects; defer audio to on-demand playback
    const enriched: Verse[] = [];
    await Promise.all(
      slice.map(async (row) => {
        const surahId = Number(row.chapter_id);
        const verseNumber = Number(row.verse_number);
        const baseId = computeGlobalId(surahId, verseNumber);
        enriched.push({
          id: baseId,
          surahId,
          verseNumber,
          // `ayah` (original Arabic text) is returned by the JuzVerse query
          arabicText: (row.ayah as string) || '',
          translation: (row.translation as string) || '',
          transliteration: (row.transliteration as string) || undefined,
          audioUrl: undefined,
          // prefer DB-provided part_id/page_id when available
          juzNumber: row.part_id ? Number(row.part_id) : juzNumber,
          pageNumber: row.page_id ? Number(row.page_id) : undefined,
        } as Verse);
      })
    );

    // keep order by verse id
    enriched.sort((a, b) => a.id - b.id);
    return enriched;
  } catch (error) {
    console.error(`Error fetching verses for juz ${juzNumber}:`, error);
    return [];
  }
}
