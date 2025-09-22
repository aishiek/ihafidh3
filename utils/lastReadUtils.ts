import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_READ_SURAH_KEY = 'lastReadSurahId';
const LAST_READ_VERSE_KEY = 'lastReadVerseId';

export const saveLastRead = async (surahId: number, verseId: number): Promise<void> => {
  try {
    await AsyncStorage.multiSet([
      [LAST_READ_SURAH_KEY, surahId.toString()],
      [LAST_READ_VERSE_KEY, verseId.toString()],
    ]);
  } catch (error) {
    console.error('Error saving last read verse:', error);
  }
};

export const getLastRead = async (): Promise<{ surahId: number | null; verseId: number | null }> => {
  try {
    const [surahId, verseId] = await AsyncStorage.multiGet([LAST_READ_SURAH_KEY, LAST_READ_VERSE_KEY]);
    return {
      surahId: surahId[1] ? parseInt(surahId[1], 10) : null,
      verseId: verseId[1] ? parseInt(verseId[1], 10) : null,
    };
  } catch (error) {
    console.error('Error retrieving last read verse:', error);
    return { surahId: null, verseId: null };
  }
};

export const clearLastRead = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([LAST_READ_SURAH_KEY, LAST_READ_VERSE_KEY]);
  } catch (error) {
    console.error('Error clearing last read verse:', error);
  }
};
