import { getAllJuzDetails, getCompletedJuzList, getJuzDetail } from '@/utils/juzCalculations';
import { surahsData } from './surahs';

// Juz mapping for each surah
const surahJuzMap: { [key: number]: number | number[] } = {
  1: 1,
  2: [1, 2, 3],
  3: [3, 4],
  4: [4, 5, 6],
  5: [6, 7],
  6: [7, 8],
  7: [8, 9],
  8: [9, 10],
  9: [10, 11],
  10: 11,
  11: [11, 12],
  12: [12, 13],
  13: 13,
  14: 13,
  15: 14,
  16: 14,
  17: 15,
  18: [15, 16],
  19: 16,
  20: 16,
  21: 17,
  22: 17,
  23: 18,
  24: 18,
  25: [18, 19],
  26: 19,
  27: [19, 20],
  28: 20,
  29: [20, 21],
  30: 21,
  31: 21,
  32: 21,
  33: [21, 22],
  34: 22,
  35: 22,
  36: [22, 23],
  37: 23,
  38: 23,
  39: [23, 24],
  40: 24,
  41: [24, 25],
  42: 25,
  43: 25,
  44: 25,
  45: 25,
  46: 26,
  47: 26,
  48: 26,
  49: 26,
  50: 26,
  51: [26, 27],
  52: 27,
  53: 27,
  54: 27,
  55: 27,
  56: 27,
  57: 27,
  58: 28,
  59: 28,
  60: 28,
  61: 28,
  62: 28,
  63: 28,
  64: 28,
  65: 28,
  66: 28,
  67: 29,
  68: 29,
  69: 29,
  70: 29,
  71: 29,
  72: 29,
  73: 29,
  74: 29,
  75: 29,
  76: 29,
  77: 29,
  78: 30,
  79: 30,
  80: 30,
  81: 30,
  82: 30,
  83: 30,
  84: 30,
  85: 30,
  86: 30,
  87: 30,
  88: 30,
  89: 30,
  90: 30,
  91: 30,
  92: 30,
  93: 30,
  94: 30,
  95: 30,
  96: 30,
  97: 30,
  98: 30,
  99: 30,
  100: 30,
  101: 30,
  102: 30,
  103: 30,
  104: 30,
  105: 30,
  106: 30,
  107: 30,
  108: 30,
  109: 30,
  110: 30,
  111: 30,
  112: 30,
  113: 30,
  114: 30
};

export interface ProgressData {
  memorizedSurahs: number[];
  memorizedJuz: number[];
  memorizedVerses: string[]; // Format: "surah:verse"
  memorizedVerseIds?: number[]; // Cumulative verse IDs (1-6236)
}

export class QuranProgressTracker {
  private userProgress: {
    memorizedSurahs: Set<number>;
    memorizedJuz: Set<number>;
    memorizedVerses: Set<string>;
    memorizedVerseIds: number[]; // Cumulative verse IDs for Juz calculations
  };

  constructor(savedProgress?: ProgressData) {
    this.userProgress = {
      memorizedSurahs: new Set(savedProgress?.memorizedSurahs || []),
      memorizedJuz: new Set(savedProgress?.memorizedJuz || []),
      memorizedVerses: new Set(savedProgress?.memorizedVerses || []),
      memorizedVerseIds: savedProgress?.memorizedVerseIds || []
    };
    // Calculate initial surah and juz completion based on provided memorized verses
    this.calculateInitialCompletion();
  }

  // New method to calculate initial surah and juz completion
  private calculateInitialCompletion() {
    // Clear existing calculated surah and juz data before recalculating
    this.userProgress.memorizedSurahs.clear();
    this.userProgress.memorizedJuz.clear();

    // Convert verse references to cumulative IDs if not already done
    if (this.userProgress.memorizedVerseIds.length === 0 && this.userProgress.memorizedVerses.size > 0) {
      const verseIds: number[] = [];
      this.userProgress.memorizedVerses.forEach(verseRef => {
        const [surahIdStr, verseNumStr] = verseRef.split(':');
        const surahId = parseInt(surahIdStr, 10);
        const verseNum = parseInt(verseNumStr, 10);
        
        // Calculate cumulative verse ID
        let cumulativeId = 0;
        for (let i = 1; i < surahId; i++) {
          const surah = surahsData.find(s => s.id === i);
          if (surah) cumulativeId += surah.versesCount;
        }
        verseIds.push(cumulativeId + verseNum);
      });
      this.userProgress.memorizedVerseIds = verseIds;
    }

    // Iterate through all surahs and check completion based on memorized verses
    surahsData.forEach(surah => {
      let allVersesMemorized = true;
      for (let verse = 1; verse <= surah.versesCount; verse++) {
        if (!this.userProgress.memorizedVerses.has(`${surah.id}:${verse}`)) {
          allVersesMemorized = false;
          break;
        }
      }
      if (allVersesMemorized) {
        this.userProgress.memorizedSurahs.add(surah.id);
      }
    });

    // Use the new Juz calculation logic based on verse ranges
    const completedJuzList = getCompletedJuzList(this.userProgress.memorizedVerseIds);
    this.userProgress.memorizedJuz = new Set(completedJuzList);
    
    console.log('[QuranProgressTracker] Juz completion calculated:', {
      completedJuz: completedJuzList.length,
      juzNumbers: completedJuzList,
      totalVerses: this.userProgress.memorizedVerseIds.length
    });
  }

  // Get total verse count (6,236 verses)
  getTotalVerses(): number {
    return surahsData.reduce((sum, surah) => sum + surah.versesCount, 0);
  }

  // Calculate progress percentages
  calculateProgress() {
    const totalSurahs = 114;
    const totalJuz = 30;
    const totalVerses = this.getTotalVerses();
    
    // Get detailed Juz information
    const juzDetails = getAllJuzDetails(this.userProgress.memorizedVerseIds);

    return {
      surahs: {
        completed: this.userProgress.memorizedSurahs.size,
        total: totalSurahs,
        percentage: Math.round((this.userProgress.memorizedSurahs.size / totalSurahs) * 100)
      },
      juz: {
        completed: this.userProgress.memorizedJuz.size,
        total: totalJuz,
        percentage: Math.round((this.userProgress.memorizedJuz.size / totalJuz) * 100),
        details: juzDetails // Add detailed Juz information
      },
      verses: {
        completed: this.userProgress.memorizedVerses.size,
        total: totalVerses,
        percentage: Math.round((this.userProgress.memorizedVerses.size / totalVerses) * 100)
      }
    };
  }

  // Mark verse as memorized
  markVerseMemorized(verseId: number): boolean {
    const surah = surahsData.find(s => {
      let startVerseId = 0;
      for (let i = 1; i < s.id; i++) {
        const prevSurah = surahsData.find(ps => ps.id === i);
        if (prevSurah) startVerseId += prevSurah.versesCount;
      }
      startVerseId += 1;
      const endVerseId = startVerseId + s.versesCount - 1;
      return verseId >= startVerseId && verseId <= endVerseId;
    });

    if (!surah) return false;

    // Calculate verse number within surah
    let startVerseId = 0;
    for (let i = 1; i < surah.id; i++) {
      const prevSurah = surahsData.find(s => s.id === i);
      if (prevSurah) startVerseId += prevSurah.versesCount;
    }
    startVerseId += 1;
    const verseNumber = verseId - startVerseId + 1;

    this.userProgress.memorizedVerses.add(`${surah.id}:${verseNumber}`);
    
    // Add to cumulative verse IDs array
    if (!this.userProgress.memorizedVerseIds.includes(verseId)) {
      this.userProgress.memorizedVerseIds.push(verseId);
    }
    
    // Check if surah is now complete
    this.checkSurahCompletion(surah.id);
    
    // Recalculate Juz completion using the new logic
    const completedJuzList = getCompletedJuzList(this.userProgress.memorizedVerseIds);
    this.userProgress.memorizedJuz = new Set(completedJuzList);
    
    return true;
  }

  // Check if surah is complete based on memorized verses
  private checkSurahCompletion(surahId: number) {
    const surah = surahsData.find(s => s.id === surahId);
    if (!surah || this.userProgress.memorizedSurahs.has(surahId)) return;

    let allVersesMemorized = true;
    for (let verse = 1; verse <= surah.versesCount; verse++) {
      if (!this.userProgress.memorizedVerses.has(`${surahId}:${verse}`)) {
        allVersesMemorized = false;
        break;
      }
    }

    if (allVersesMemorized) {
      this.userProgress.memorizedSurahs.add(surahId);
      // Juz completion is now recalculated in markVerseMemorized
    }
  }

  // Deprecated: Juz completion is now calculated using verse ranges in juzCalculations.ts
  // Kept for backward compatibility but not actively used
  private checkJuzCompletion() {
    const completedJuzList = getCompletedJuzList(this.userProgress.memorizedVerseIds);
    this.userProgress.memorizedJuz = new Set(completedJuzList);
  }

  // Get Juz progress details - now uses the new calculation method
  getJuzProgress(juzNumber: number) {
    if (juzNumber < 1 || juzNumber > 30) return null;

    return getJuzDetail(juzNumber, this.userProgress.memorizedVerseIds);
  }

  // Get Juz names (traditional names)
  private getJuzName(juzNumber: number): string {
    const juzNames: { [key: number]: string } = {
      1: "Alif Lam Meem", 2: "Sayaqool", 3: "Tilka Rusul", 4: "Lan Tana Lu", 5: "Wal Muhsanat",
      6: "La Yuhibbullah", 7: "Wa Iza Sami'u", 8: "Wa Lau Annana", 9: "Qalal Malau", 10: "Wa A'lamu",
      11: "Ya'tadhiroona", 12: "Wa Ma Min Dabbah", 13: "Wa Ma Ubarri'u", 14: "Rubama", 15: "Subhanallahi",
      16: "Qal Alam", 17: "Iqtarabat", 18: "Qad Aflaha", 19: "Wa Qalallahina", 20: "A'man Khalaq",
      21: "Utlu Ma Uhiya", 22: "Wa Man Yaqnut", 23: "Wa Mali", 24: "Faman Azlam", 25: "Ilayhi yuraddu",
      26: "Ha'a Meem", 27: "Qala Fama Khatbukum", 28: "Qad Sami'a", 29: "Tabarak", 30: "Amma"
    };
    return juzNames[juzNumber] || `Juz ${juzNumber}`;
  }

  // Save progress
  saveProgress(): ProgressData {
    return {
      memorizedSurahs: Array.from(this.userProgress.memorizedSurahs),
      memorizedJuz: Array.from(this.userProgress.memorizedJuz),
      memorizedVerses: Array.from(this.userProgress.memorizedVerses),
      memorizedVerseIds: this.userProgress.memorizedVerseIds
    };
  }

  // Check if a specific Juz is memorized
  isJuzMemorized(juzNumber: number): boolean {
    return this.userProgress.memorizedJuz.has(juzNumber);
  }
} 