import { cacheVerses, getCachedVerses, isSurahCached } from '@/database/QuranDatabase';
import { fetchSingleVerse, fetchVersesBySurah } from '@/services/quranApi';
import { useSettingsStore } from '@/store/settingsStore';
import { Verse } from '@/types';

// Constants for Bismillah
const BISMILLAH_ARABIC = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
const BISMILLAH_TRANSLATION = 'In the name of Allah, the Entirely Merciful, the Especially Merciful.';
const BISMILLAH_AUDIO_URL = 'https://verses.quran.com/Bismillah.mp3';

// Utility: Determines if a surah should have Bismillah
function shouldHaveBismillah(surahId: number): boolean {
  return surahId !== 1 && surahId !== 9;
}

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
  return text.replace(/\s+/g, '').startsWith(BISMILLAH_ARABIC.replace(/\s+/g, ''));
}

// Utility: Strip Bismillah from beginning of a verse, if applicable
function stripBismillahFromVerse(verse: Verse, surahId: number): Verse {
  if (
    shouldHaveBismillah(surahId) &&
    verse.verseNumber === 1 &&
    startsWithBismillah(verse.arabicText)
  ) {
    const trimmed = verse.arabicText.slice(BISMILLAH_ARABIC.length).trimStart();
    return {
      ...verse,
      arabicText: trimmed,
    };
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
export async function getVersesBySurah(
  surahId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<Verse[]> {
  try {
    const cachedVerses = await getCachedVerses(surahId, page, pageSize);
    let verses: Verse[];

    if (cachedVerses.length > 0) {
      verses = cachedVerses;
    } else {
      const apiResult = await fetchVersesBySurah(surahId, page, pageSize);
      const apiVerses: Verse[] = Array.isArray(apiResult) ? apiResult : apiResult.verses;
      await cacheVerses(apiVerses);
      verses = apiVerses;
    }

    // Process verses
    const processed = verses.map((v) => {
      // First strip Bismillah text if needed
      const strippedVerse = stripBismillahFromVerse(v, surahId);
      // Then append Bismillah audio flag if it's the first verse
      return appendBismillahAudio(strippedVerse, surahId);
    });

    // Inject Bismillah at the top only for the first page
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
      const strippedVerse = stripBismillahFromVerse(found, surahId);
      return appendBismillahAudio(strippedVerse, surahId);
    }

    const apiVerse = await fetchSingleVerse(surahId, verseNumber, 'en.asad', useSettingsStore.getState().reciterIdentifier);
    if (apiVerse) {
      await cacheVerses([apiVerse]);
      const strippedVerse = stripBismillahFromVerse(apiVerse, surahId);
      return appendBismillahAudio(strippedVerse, surahId);
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
    console.log(`Juz functionality not yet implemented.`);
    return [];
  } catch (error) {
    console.error(`Error fetching verses for juz ${juzNumber}:`, error);
    return [];
  }
}
