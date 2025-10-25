import { Verse } from './verse';

export interface ReadScreenParams {
  surahId?: string;
  verseId?: string;
}

export interface VerseItemProps {
  verse: Verse;
  isMemorized: boolean;
  isRevised: boolean;
  onMemorizeToggle: () => void;
  onRevisionToggle: () => void;
  onPlayAudio: () => void;
}

export interface FetchVersesResponse {
  verses: Verse[];
  currentPage: number;
  totalPages: number;
  totalVerses: number;
}

export interface AudioStatus {
  isPlaying: boolean;
  isPaused: boolean;
  didJustFinish: boolean;
  error?: string;
  currentUrl?: string;
  repeatCount?: number;
  maxRepeats?: number;
}
