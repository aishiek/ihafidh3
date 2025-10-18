import {
    cacheVerses,
    getAllSurahs,
    getFailedVerses,
    getPrefetchProgress,
    initDatabase,
    isDatabasePrefetched,
    isSurahFullyCached,
    removeFailedVerse,
    updatePrefetchProgress
} from '@/assets/database/QuranDatabase';
import { surahsData } from '@/data/surahs';
import { fetchVersesBySurah } from '@/services/quranApi';
import { Surah, Verse } from '@/types';
import { create } from 'zustand';

interface MemorizedVerse {
  surahId: number;
  verseNumber: number;
}

interface QuranState {
  surahs: Surah[];
  currentSurah: Surah | null;
  currentVerse: Verse | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  versesCache: Record<string, Verse[]>;
  isPrefetching: boolean;
  prefetchProgress: { completed: number; total: number };
  failedVerses: { surahId: number; verseNumber: number }[];
  isLoadingFailedVerses: boolean;
  currentPrefetchVerse: string;
  memorizedVerses: MemorizedVerse[];
  lastViewedSurahId: number | null;
  setLastViewedSurahId: (id: number | null) => void;
  getLastViewedSurahId: () => number | null;
  
  initializeDatabase: () => Promise<void>;
  fetchSurahs: () => Promise<void>;
  fetchVersesBySurah: (surahId: number, page: number, pageSize: number) => Promise<Verse[]>;
  setCurrentSurah: (surah: Surah | null) => void;
  setCurrentVerse: (verse: Verse | null) => void;
  clearError: () => void;
  clearCache: () => void;
  startPrefetching: () => Promise<void>;
  stopPrefetching: () => void;
  checkPrefetchStatus: () => Promise<void>;
  retryFailedVerses: () => Promise<void>;
  getFailedVersesCount: () => Promise<number>;
  checkSurahCacheStatus: (surahId: number) => Promise<boolean>;
}

export const useQuranStore = create<QuranState>((set, get) => ({
  surahs: surahsData,
  currentSurah: null,
  currentVerse: null,
  isLoading: false,
  error: null,
  isInitialized: false,
  versesCache: {},
  isPrefetching: false,
  prefetchProgress: { completed: 0, total: 6236 },
  failedVerses: [],
  isLoadingFailedVerses: false,
  currentPrefetchVerse: '',
  memorizedVerses: [],
  lastViewedSurahId: null,
  setLastViewedSurahId: (id) => set({ lastViewedSurahId: id }),
  getLastViewedSurahId: () => get().lastViewedSurahId,
  
  initializeDatabase: async () => {
    const state = get();
    if (state.isInitialized) {
      console.log("Database already initialized");
      return;
    }
    
    try {
      console.log("Initializing Quran database...");
      set({ isLoading: true, error: null });
      
      console.log("Initializing SQLite database...");
      await initDatabase();
      console.log("Database initialized successfully");
      
      set({ isInitialized: true, isLoading: false });
      
      // Silently check prefetch status without logging
      try {
        const isPrefetched = await isDatabasePrefetched();
        if (!isPrefetched) {
          const progress = await getPrefetchProgress();
          set({ prefetchProgress: progress });
        } else {
          set({ prefetchProgress: { completed: 6236, total: 6236 } });
        }
        
        const failedVerses = await getFailedVerses();
        set({ failedVerses });
      } catch (error) {
        // Silently handle prefetch check errors
      }
      
    } catch (error) {
      console.error("Database initialization failed:", error);
      set({ 
        error: 'Failed to initialize database. Using API mode.', 
        isInitialized: true,
        isLoading: false,
        surahs: surahsData
      });
    }
  },
  
  fetchSurahs: async () => {
    try {
      set({ isLoading: true, error: null });
      
      if (!get().isInitialized) {
        await get().initializeDatabase();
      }
      
      const surahs = await getAllSurahs();
      set({ surahs, isLoading: false });
    } catch (error) {
      set({ 
        error: 'Failed to fetch surahs. Using offline data.', 
        isLoading: false, 
        surahs: surahsData
      });
    }
  },
  
  fetchVersesBySurah: async (surahId: number, page: number, pageSize: number): Promise<Verse[]> => {
    try {
      const response = await fetch(
        `https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,en.sahih?offset=${(page - 1) * pageSize}&limit=${pageSize}`
      );
      const data = await response.json();
      
      if (data.code === 200 && data.data.length >= 2) {
        const arabicVerses = data.data[0].ayahs;
        const englishVerses = data.data[1].ayahs;
        
        return arabicVerses.map((arabic: any, index: number) => ({
          id: arabic.numberInSurah,
          surahId,
          verseNumber: arabic.numberInSurah,
          arabicText: arabic.text,
          translation: englishVerses[index].text
        }));
      }
      return [];
    } catch (error) {
      console.error('Error fetching verses:', error);
      return [];
    }
  },
  
  setCurrentSurah: (surah) => {
    set({ currentSurah: surah });
  },
  
  setCurrentVerse: (verse) => {
    set({ currentVerse: verse });
  },
  
  clearError: () => {
    set({ error: null });
  },
  
  clearCache: () => {
    set({ versesCache: {} });
  },
  
  checkPrefetchStatus: async () => {
    try {
      // Check if database is already prefetched
      const isPrefetched = await isDatabasePrefetched();
      
      if (!isPrefetched) {
        // Get current progress
        const progress = await getPrefetchProgress();
        set({ prefetchProgress: progress });
      } else {
        set({ prefetchProgress: { completed: 6236, total: 6236 } });
      }
      
      // Load failed verses
      const failedVerses = await getFailedVerses();
      set({ failedVerses });
    } catch (error) {
    }
  },
  
  startPrefetching: async () => {
    set({ isPrefetching: false, currentPrefetchVerse: 'Prefetch not available' });
  },
  
  stopPrefetching: () => {
    if (get().isPrefetching) {
      set({ isPrefetching: false, currentPrefetchVerse: 'Download stopped' });
    }
  },
  
  retryFailedVerses: async () => {
    if (get().isPrefetching || get().isLoadingFailedVerses) {
      return;
    }
    
    try {
      const failedVerses = get().failedVerses;
      if (failedVerses.length === 0) {
        return;
      }
      
      set({ isLoadingFailedVerses: true });
      
      const successfulVerses: Verse[] = [];
      const stillFailedVerses: { surahId: number; verseNumber: number }[] = [];
      
      // Process failed verses with retry logic
      for (const { surahId, verseNumber } of failedVerses) {
        try {
          let versesResult = await fetchVersesBySurah(surahId, 1, 1);
          let verses: Verse[] = [];
          if (versesResult && typeof versesResult === 'object' && 'verses' in versesResult && Array.isArray(versesResult.verses)) {
            verses = versesResult.verses as Verse[];
          } else if (Array.isArray(versesResult)) {
            verses = versesResult as Verse[];
          }
          if (verses.length > 0) {
            successfulVerses.push(verses[0]);
            await removeFailedVerse(surahId, verseNumber);
          } else {
            stillFailedVerses.push({ surahId, verseNumber });
          }
        } catch (error) {
          stillFailedVerses.push({ surahId, verseNumber });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Cache successful verses
      if (successfulVerses.length > 0) {
        await cacheVerses(successfulVerses);
      }
      
      // Update progress
      const progress = await getPrefetchProgress();
      const newCompleted = progress.completed + successfulVerses.length;
      await updatePrefetchProgress(newCompleted, progress.total);
      
      set({
        isLoadingFailedVerses: false,
        failedVerses: stillFailedVerses,
        prefetchProgress: { completed: newCompleted, total: progress.total }
      });
    } catch (error) {
      set({ 
        isLoadingFailedVerses: false,
        error: 'Failed to retry verses. Please try again later.'
      });
    }
  },
  
  getFailedVersesCount: async () => {
    const failedVerses = await getFailedVerses();
    return failedVerses.length;
  },
  
  checkSurahCacheStatus: async (surahId: number) => {
    return isSurahFullyCached(surahId);
  }
}));