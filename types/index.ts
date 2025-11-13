export interface Surah {
  id: number;
  name: string;
  arabicName: string;
  englishName: string;
  englishNameTranslation?: string;
  revelationType: string;
  versesCount: number;
  audioUrl?: string;
}

export interface Verse {
  id: number;
  surahId: number;
  surahNumber?: number;
  verseNumber: number;
  arabicText: string;
  tajweedText?: string;
  translation: string;
  transliteration?: string;
  audioUrl?: string;
  juzNumber?: number;
  hizbNumber?: number;
  pageNumber?: number;
  isMarkedForRevision?: boolean;
  lastRevisedDate?: string;
  surah?: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    numberOfAyahs: number;
    revelationType: string;
  };
  hasBismillahPrefix?: boolean;
}

export interface QuizQuestion {
  id: string;
  verseId: number;
  surahId: number;
  verseNumber: number;
  arabicText: string;
  translation: string;
  options: string[];
  correctOption: number;
  type: 'multiple-choice' | 'fill-in-blank' | 'true-false';
}

export interface RevisionItem {
  id: number;
  verseId: number;
  surahId: number;
  verseNumber: number;
  dueDate: string;
  interval: number;
  ease: number;
  repetitions: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  total: number;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
  inactive: string;
  success: string;
  warning: string;
  error: string;
  memorized: string;
  inProgress: string;
  successBackground: string;
  errorBackground: string;
}

export type ThemeType = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeType;
  fontSizeArabic: number;
  fontSizeTransliteration: number;
  fontSizeTranslation: number;
  arabicFont: 'default' | 'uthman-taha' | 'scheherazade' | 'scheherazade-bold' | 'tajweed' | 'indo-pak' | 'amiri-quran' | 'noto-naskh';
  showTranslation: boolean;
  showTransliteration?: boolean;
  autoPlayAudio: boolean;
  repeatMode: number;
  notificationsEnabled: boolean;
  reminderTime: string;
  quizVerseCount: number;
}

export interface JuzData {
  id: number;
  name: string;
  startSurah: number;
  startVerse: number;
  endSurah: number;
  endVerse: number;
  versesCount: number;
}

export interface HizbData {
  id: number;
  juzId: number;
  startSurah: number;
  startVerse: number;
  endSurah: number;
  endVerse: number;
  versesCount: number;
}

export interface PageData {
  id: number;
  startSurah: number;
  startVerse: number;
  endSurah: number;
  endVerse: number;
  versesCount: number;
}

