export interface RevisionGoals {
  daily: {
    verses: number;
    pages: number;
  };
  weekly: {
    verses: number;
    surahs: string[]; // array of surah ids as strings for easy storage
    pages: number;
  };
}

export interface PageProgress {
  id: string;
  date: string;
  action: 'memorized' | 'revised';
  pageId: string;
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  verseCount: number;
  versesPerPage: number;
  createdAt: string; // ISO string
}

export interface DailyStats {
  date: string;
  versesMemorized: number;
  versesRevised: number;
  pagesMemorized: number;
  pagesRevised: number;
  totalTimeMinutes: number;
}
