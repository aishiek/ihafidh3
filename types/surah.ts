import { Verse } from './verse';
export interface Surah {
  id: number;
  name: string;
  arabicName: string;
  englishName: string;
  revelationType: 'Meccan' | 'Medinan';
  numberOfAyahs: number;
  versesCount?: number;
  readonly versesCountSafe: number;
  bismillahPre: boolean;
  bismillahArabic?: string;
  bismillahEnglish?: string;
  pages?: number[];
  juz?: number[];
}

export interface SurahWithVerses extends Surah {
  verses: Verse[];
}

export interface SurahListResponse {
  surahs: Surah[];
  currentPage: number;
  totalPages: number;
  totalSurahs: number;
}
