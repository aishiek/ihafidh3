export interface Verse {
  id: number;
  surahId: number;
  verseNumber: number;
  arabicText: string;
  translation: string;
  audioUrl?: string;
  isMemorized?: boolean;
  isRevised?: boolean;
}

export interface VerseStatus {
  status: 'not_started' | 'memorized' | 'revised';
  last_updated?: string;
}

export interface RevisedVerse {
  verseId: number;
  revisionDate: string;
}

export interface RevisionTracker {
  verseId: number;
  date: string;
}

export interface QuizResult {
  id: string;
  date: string;
  verseIds: number[];
  score: number;
  totalQuestions: number;
  correct: number;
  surahId?: number;
  juzNumber?: number;
}

export interface TimeSpent {
  total: number;
  daily: Record<string, number>;
}

export interface Badges {
  [key: string]: boolean;
}

export interface RevisionSchedule {
  versesPerDay: number;
  surahsPerWeek: number[];
  completedToday: number[];
  completedThisWeek: number[];
  lastResetDate: string | null;
}
