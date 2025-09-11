import { Verse } from '@/types';
import { surahsData } from '@/data/surahs';
import { fetchVersesBySurah, fetchSingleVerse } from '@/services/quranApi';
import { useSettingsStore } from '@/store/settingsStore';

// Verse counts for each surah
const surahVerseCounts = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, // 1-10
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135, // 11-20
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, // 21-30
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85, // 31-40
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, // 41-50
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13, // 51-60
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, // 61-70
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42, // 71-80
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, // 81-90
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11, // 91-100
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, // 101-110
  5, 4, 5, 6 // 111-114
];
    
// Calculate verse ID from surah and verse number
export function calculateVerseId(surahId: number, verseNumber: number): number {
  let id = 0;
  for (let i = 0; i < surahId - 1; i++) {
    id += surahVerseCounts[i];
  }
  return id + verseNumber;
}

// Find verse details from verse ID
export function findVerseById(verseId: number): { surahId: number, verseNumber: number } {
  let currentVerseId = 0;
  for (let i = 0; i < surahVerseCounts.length; i++) {
    const surahStartId = currentVerseId + 1;
    const surahEndId = currentVerseId + surahVerseCounts[i];
    
    if (verseId >= surahStartId && verseId <= surahEndId) {
      return {
        surahId: i + 1,
        verseNumber: verseId - currentVerseId
      };
    }
    currentVerseId += surahVerseCounts[i];
  }
  return { surahId: 1, verseNumber: 1 }; // Default to first verse if not found
}

// Get verses by IDs (for quiz and revision)
export async function getVersesByIds(ids: number[]): Promise<Verse[]> {
  if (ids.length === 0) return [];
  
  try {
    console.log(`Getting verses by IDs: ${ids.join(', ')}`);
    const verses: Verse[] = [];
    
    for (const id of ids) {
      const { surahId, verseNumber } = findVerseById(id);
      const surah = surahsData.find(s => s.id === surahId);
      
      if (surah) {
        // Try to fetch the verse from the API
        const verse = await fetchSingleVerse(surahId, verseNumber, 'en.asad', useSettingsStore.getState().reciterIdentifier);
        if (verse) {
          verses.push(verse);
        } else {
          // If API fetch fails, create a placeholder verse
          verses.push({
            id,
            surahId,
            verseNumber,
            arabicText: '', // These would be fetched from the API
            translation: '', // These would be fetched from the API
            juzNumber: Math.ceil(id / (6236 / 30)) // Approximate juz number
          });
        }
      }
    }
    
    return verses;
  } catch (error) {
    console.error('Error fetching verses by IDs:', error);
    return [];
  }
}

// Get verses by surah and verse number range
export function getVerseRange(verses: Verse[], surahId: number, startVerse: number, endVerse: number): Verse[] {
  return verses.filter(verse => 
    verse.surahId === surahId && 
    verse.verseNumber >= startVerse && 
    verse.verseNumber <= endVerse
  );
}

// Get total pages for a set of verses
export function getTotalPages(totalVerses: number, pageSize: number): number {
  return Math.ceil(totalVerses / pageSize);
}