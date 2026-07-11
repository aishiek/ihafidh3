import { JUZ_MAPPING } from '@/data/juzMapping';
import { surahsData } from '@/data/surahs';

export interface JuzVerseRange {
  juzNumber: number;
  startVerseId: number;
  endVerseId: number;
  totalVerses: number;
}

// Known alias mapping to handle minor romanization differences between mapping and dataset
const SURAH_NAME_ALIASES: Record<string, string> = {
  // Juz 28 mapping uses "Al-Mujadilah" while dataset uses "Al-Mujadila"
  'Al-Mujadilah': 'Al-Mujadila',
  // Juz 28 mapping uses "As-Saff" while dataset uses "As-Saf"
  'As-Saff': 'As-Saf',
};

// Convert surah name and verse number to global verse ID
function getGlobalVerseId(surahName: string, verseNumber: number): number {
  const candidateNames = [surahName, SURAH_NAME_ALIASES[surahName]].filter(Boolean) as string[];
  const surah = surahsData.find(s =>
    candidateNames.includes(s.name) ||
    candidateNames.includes(s.englishName) ||
    candidateNames.includes(s.arabicName)
  );

  if (!surah) {
    console.warn(`Surah not found: ${surahName}`);
    return 0;
  }

  let globalId = 0;
  // Add verses from all previous surahs
  for (let i = 1; i < surah.id; i++) {
    const prevSurah = surahsData.find(s => s.id === i);
    if (prevSurah) {
      globalId += prevSurah.versesCount;
    }
  }

  // Add the verse number from current surah
  return globalId + verseNumber;
}

// Get verse range for a specific Juz
export function getJuzVerseRange(juzNumber: number): JuzVerseRange {
  if (juzNumber < 1 || juzNumber > 30) {
    return { juzNumber, startVerseId: 0, endVerseId: 0, totalVerses: 0 };
  }

  const juzInfo = JUZ_MAPPING[juzNumber];
  if (!juzInfo) {
    return { juzNumber, startVerseId: 0, endVerseId: 0, totalVerses: 0 };
  }

  // Parse start and end references
  const [startSurah, startVerseStr] = juzInfo.start.split(':');
  const [endSurah, endVerseStr] = juzInfo.end.split(':');

  const startVerseNumber = parseInt(startVerseStr, 10);
  const endVerseNumber = parseInt(endVerseStr, 10);

  const startVerseId = getGlobalVerseId(startSurah, startVerseNumber);
  const endVerseId = getGlobalVerseId(endSurah, endVerseNumber);

  const totalVerses = endVerseId - startVerseId + 1;

  return {
    juzNumber,
    startVerseId,
    endVerseId,
    totalVerses
  };
}

// Get all Juz verse ranges (cached for performance)
let cachedJuzRanges: JuzVerseRange[] | null = null;

export function getAllJuzRanges(): JuzVerseRange[] {
  if (cachedJuzRanges) {
    return cachedJuzRanges;
  }

  cachedJuzRanges = Array.from({ length: 30 }, (_, i) => getJuzVerseRange(i + 1));
  return cachedJuzRanges;
}

export function getJuzForSurah(surahId: number): number {
  const surah = surahsData.find(s => s.id === surahId);
  if (!surah) return 1;
  const firstVerseGlobalId = getGlobalVerseId(surah.name, 1);
  const ranges = getAllJuzRanges();
  const found = ranges.find(r => firstVerseGlobalId >= r.startVerseId && firstVerseGlobalId <= r.endVerseId);
  return found ? found.juzNumber : 1;
}

// Calculate Juz progress from memorized and revised verses
export function calculateJuzProgress(juzNumber: number, memorizedVerses: number[], revisedVerses?: number[]): {
  memorized: number;
  revised: number;
  total: number;
  progress: number;
} {
  const range = getJuzVerseRange(juzNumber);
  if (!range.totalVerses) {
    return { memorized: 0, revised: 0, total: 0, progress: 0 };
  }

  const memorizedSet = new Set(memorizedVerses);
  const revisedSet = revisedVerses ? new Set(revisedVerses) : new Set();

  let memorizedCount = 0;
  let revisedCount = 0;

  for (let verseId = range.startVerseId; verseId <= range.endVerseId; verseId++) {
    if (memorizedSet.has(verseId)) {
      memorizedCount++;
    }
    if (revisedSet.has(verseId)) {
      revisedCount++;
    }
  }

  const progress = range.totalVerses > 0 ? Math.round((memorizedCount / range.totalVerses) * 100) : 0;

  return {
    memorized: memorizedCount,
    revised: revisedCount,
    total: range.totalVerses,
    progress
  };
}

// Calculate overall Juz statistics
export function calculateOverallJuzStats(memorizedVerses: number[]): {
  completed: number;
  inProgress: number;
  notStarted: number;
  totalJuz: number;
  percentage: number;
} {
  const ranges = getAllJuzRanges();
  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;

  for (const range of ranges) {
    const juzProgress = calculateJuzProgress(range.juzNumber, memorizedVerses);

    if (juzProgress.memorized === 0) {
      notStarted++;
    } else if (juzProgress.memorized === juzProgress.total) {
      completed++;
    } else {
      inProgress++;
    }
  }

  const percentage = Math.round((completed / 30) * 100);

  return {
    completed,
    inProgress,
    notStarted,
    totalJuz: 30,
    percentage
  };
}

// Debug function to print actual Juz verse counts
export function printJuzVerseCounts(): void {
  console.log('Juz Verse Counts:');
  for (let i = 1; i <= 30; i++) {
    const range = getJuzVerseRange(i);
    console.log(`Juz ${i}: ${range.totalVerses} verses`);
  }
}
