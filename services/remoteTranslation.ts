import * as quranApi from './quranApi';

export async function getTranslationRemote(surah: number, verse: number, translationIdentifier: string) {
  try {
    // quranApi.fetchSingleVerse returns Verse shape; reuse it for translation extraction
    const v = await quranApi.fetchSingleVerse(surah, verse, translationIdentifier);
    return v ? v.translation : null;
  } catch (err) {
    console.warn('[remoteTranslation] failed', err);
    return null;
  }
}

export async function getTafsirRemote(surah: number, verse: number, tafsirIdentifier: string) {
  try {
    // The AlQuran cloud may have tafsir endpoints; fallback to translation field if missing
    // For now reuse fetchSingleVerse; tafsir extraction can be improved later.
    const v = await quranApi.fetchSingleVerse(surah, verse, 'en.asad');
    return v ? v.translation : null;
  } catch (err) {
    console.warn('[remoteTranslation] getTafsir failed', err);
    return null;
  }
}
