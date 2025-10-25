/**
 * Type representing the available tabs in the Read screen
 */
export type ReadTab = 'surah' | 'juz';

/**
 * Represents the state related to Surah view
 */
export interface SurahViewState {
  /** Currently selected surah data */
  selectedSurah?: {
    id: number;
    name: string;
    versesCount: number;
    // Add other surah properties as needed
  } | null;
  
  /** List of verses for the current surah */
  verses: Array<{
    id: number;
    surahId: number;
    verseNumber: number;
    arabicText: string;
    translation: string;
    audioUrl?: string;
    // Add other verse properties as needed
  }>;
  
  /** Loading states */
  isLoading: boolean;
  isLoadingMore: boolean;
  loadingError: string | null;
  
  /** Pagination */
  currentPage: number;
  hasMoreVerses: boolean;
  totalVersesInSurah: number;
  
  /** Last viewed surah ID for persistence */
  lastViewedSurahId?: number | null;
}

/**
 * Represents the state related to Juz view
 */
export interface JuzViewState {
  /** Currently selected juz number */
  selectedJuz?: number | null;
  
  /** List of verses in the current juz */
  juzVerses: Array<{
    id: string;
    text: string;
    // Add other juz verse properties as needed
  }>;
  
  /** Loading states */
  isJuzLoading: boolean;
  juzLoadingError: string | null;
}

/**
 * Represents the audio playback state
 */
export interface AudioState {
  /** Verse audio state */
  isPlayingAudio: boolean;
  
  /** Surah audio state */
  isPlayingSurah: boolean;
  isSurahPaused: boolean;
  
  /** Audio progress and controls */
  currentAudioUrl?: string;
  currentVerseId?: number;
  isRepeatOn: boolean;
  repeatCount: number;
}

/**
 * Represents navigation-related state
 */
export interface NavigationState {
  /** Current active tab */
  tab: ReadTab;
  
  /** Search functionality */
  searchQuery: string;
  
  /** Scroll position for surah list */
  scrollOffset: number;
  
  /** Navigation flags */
  isNavigatingBack: boolean;
  suppressNextAutoOpen: boolean;
}

/**
 * Represents the memorization status of a surah
 */
export interface SurahStatus {
  /** Whether the surah is fully memorized */
  isMemorized: boolean;
  
  /** Whether the surah is fully revised */
  isRevised: boolean;
  
  /** Number of memorized verses */
  memorizedCount: number;
  
  /** Number of revised verses */
  revisedCount: number;
  
  /** Total verses in the surah */
  totalVerses: number;
  
  /** Progress percentage (0-100) */
  progress: number;
}

/**
 * Represents the state of the progress modal
 */
export type ProgressActionType = 'mark-memorized' | 'unmark-memorized' | 'mark-revised' | 'unmark-revised' | null;

export interface ProgressModalState {
  /** Whether the modal is visible */
  isVisible: boolean;
  
  /** Current progress action */
  action?: ProgressActionType;
  
  /** Progress count */
  count: number;
  
  /** Total items to process */
  total: number;
  
  /** Error message if any */
  error?: string;
}

/**
 * Complete state type for the Read screen
 */
export interface ReadScreenState extends 
  SurahViewState, 
  JuzViewState, 
  AudioState, 
  NavigationState, 
  ProgressModalState {
  // Any additional global state can be added here
}
