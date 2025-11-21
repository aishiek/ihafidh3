import JUZ_MAPPING from '@/data/juzMapping';
import { surahsData } from '@/data/surahs';

/**
 * Normalize surah name to handle spelling variations between juzMapping and surahs data
 */
const surahNameAliases: Record<string, string> = {
  'Al-Mujadilah': 'Al-Mujadila',
  'As-Saff': 'As-Saf',
  // Add other known variations as needed
};

function normalizeSurahName(name: string): string {
  return surahNameAliases[name] || name;
}

/**
 * Convert a verse reference like "Al-Baqarah:142" to a cumulative verse ID (1-6236)
 */
export function verseRefToCumulativeId(verseRef: string): number {
  const [surahName, verseNumStr] = verseRef.split(':');
  const verseNum = parseInt(verseNumStr, 10);
  
  // Try to find surah by name, with normalization
  const normalizedName = normalizeSurahName(surahName);
  const surah = surahsData.find(s => 
    s.name === surahName || 
    s.englishName === surahName ||
    s.name === normalizedName ||
    s.englishName === normalizedName
  );
  
  if (!surah) {
    console.warn(`Surah not found: ${surahName}${normalizedName !== surahName ? ` (normalized: ${normalizedName})` : ''}`);
    return -1;
  }
  
  // Calculate cumulative verse ID
  let cumulativeId = 0;
  for (let i = 1; i < surah.id; i++) {
    const prevSurah = surahsData.find(s => s.id === i);
    if (prevSurah) {
      cumulativeId += prevSurah.versesCount;
    }
  }
  
  return cumulativeId + verseNum;
}

/**
 * Convert cumulative verse ID to surah:verse format
 */
export function cumulativeIdToVerseRef(verseId: number): string {
  let remainingVerses = verseId;
  
  for (const surah of surahsData) {
    if (remainingVerses <= surah.versesCount) {
      return `${surah.id}:${remainingVerses}`;
    }
    remainingVerses -= surah.versesCount;
  }
  
  return '';
}

/**
 * Get the verse range (start and end cumulative IDs) for a specific Juz
 */
export function getJuzVerseRange(juzNumber: number): { start: number; end: number } | null {
  if (juzNumber < 1 || juzNumber > 30) return null;
  
  const juzInfo = JUZ_MAPPING[juzNumber];
  if (!juzInfo) return null;
  
  const startId = verseRefToCumulativeId(juzInfo.start);
  const endId = verseRefToCumulativeId(juzInfo.end);
  
  if (startId === -1 || endId === -1) return null;
  
  return { start: startId, end: endId };
}

/**
 * Check if a Juz is complete based on memorized verse IDs (cumulative 1-6236)
 */
export function isJuzComplete(juzNumber: number, memorizedVerseIds: number[]): boolean {
  const range = getJuzVerseRange(juzNumber);
  if (!range) return false;
  
  const memorizedSet = new Set(memorizedVerseIds);
  
  // Check if all verses in the range are memorized
  for (let verseId = range.start; verseId <= range.end; verseId++) {
    if (!memorizedSet.has(verseId)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get detailed Juz progress information
 */
export interface JuzDetail {
  juzNumber: number;
  name: string;
  totalVerses: number;
  memorizedVerses: number;
  isComplete: boolean;
  percentage: number;
  startVerse: string;
  endVerse: string;
  surahs: string[];
}

export function getJuzDetail(juzNumber: number, memorizedVerseIds: number[]): JuzDetail | null {
  if (juzNumber < 1 || juzNumber > 30) return null;
  
  const juzInfo = JUZ_MAPPING[juzNumber];
  const range = getJuzVerseRange(juzNumber);
  
  if (!juzInfo || !range) return null;
  
  const memorizedSet = new Set(memorizedVerseIds);
  const totalVerses = range.end - range.start + 1;
  let memorizedCount = 0;
  
  for (let verseId = range.start; verseId <= range.end; verseId++) {
    if (memorizedSet.has(verseId)) {
      memorizedCount++;
    }
  }
  
  const juzNames: { [key: number]: string } = {
    1: "Alif Lam Meem", 2: "Sayaqool", 3: "Tilka Rusul", 4: "Lan Tana Lu", 5: "Wal Muhsanat",
    6: "La Yuhibbullah", 7: "Wa Iza Sami'u", 8: "Wa Lau Annana", 9: "Qalal Malau", 10: "Wa A'lamu",
    11: "Ya'tadhiroona", 12: "Wa Ma Min Dabbah", 13: "Wa Ma Ubarri'u", 14: "Rubama", 15: "Subhanallahi",
    16: "Qal Alam", 17: "Iqtarabat", 18: "Qad Aflaha", 19: "Wa Qalallahina", 20: "A'man Khalaq",
    21: "Utlu Ma Uhiya", 22: "Wa Man Yaqnut", 23: "Wa Mali", 24: "Faman Azlam", 25: "Ilayhi yuraddu",
    26: "Ha'a Meem", 27: "Qala Fama Khatbukum", 28: "Qad Sami'a", 29: "Tabarak", 30: "Amma"
  };
  
  return {
    juzNumber,
    name: juzNames[juzNumber] || `Juz ${juzNumber}`,
    totalVerses,
    memorizedVerses: memorizedCount,
    isComplete: memorizedCount === totalVerses,
    percentage: Math.round((memorizedCount / totalVerses) * 100),
    startVerse: juzInfo.start,
    endVerse: juzInfo.end,
    surahs: juzInfo.surahs
  };
}

/**
 * Calculate all completed Juz numbers
 */
export function getCompletedJuzList(memorizedVerseIds: number[]): number[] {
  const completedJuz: number[] = [];
  
  for (let juzNum = 1; juzNum <= 30; juzNum++) {
    if (isJuzComplete(juzNum, memorizedVerseIds)) {
      completedJuz.push(juzNum);
    }
  }
  
  return completedJuz;
}

/**
 * Get detailed progress for all 30 Juz
 */
export function getAllJuzDetails(memorizedVerseIds: number[]): JuzDetail[] {
  const details: JuzDetail[] = [];
  
  for (let juzNum = 1; juzNum <= 30; juzNum++) {
    const detail = getJuzDetail(juzNum, memorizedVerseIds);
    if (detail) {
      details.push(detail);
    }
  }
  
  return details;
}

/**
 * Check if Juz 30 (Juz Amma) is complete
 */
export function isJuz30Complete(memorizedVerseIds: number[]): boolean {
  return isJuzComplete(30, memorizedVerseIds);
}

/**
 * Get Juz 30 progress details
 */
export function getJuz30Progress(memorizedVerseIds: number[]): { 
  memorized: number; 
  total: number; 
  percentage: number; 
  isComplete: boolean;
} {
  const detail = getJuzDetail(30, memorizedVerseIds);
  
  if (!detail) {
    return { memorized: 0, total: 0, percentage: 0, isComplete: false };
  }
  
  return {
    memorized: detail.memorizedVerses,
    total: detail.totalVerses,
    percentage: detail.percentage,
    isComplete: detail.isComplete
  };
}
