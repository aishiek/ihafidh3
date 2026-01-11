import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NavigationState {
  // Scroll position tracking for Surah list
  surahListScrollY: number;
  lastViewedSurahNumber: number | null;
  
  // Scroll position tracking for Juz list
  juzListScrollY: number;
  lastViewedJuzNumber: number | null;
  
  // Actions
  setSurahListScrollY: (position: number) => void;
  setLastViewedSurah: (surahNumber: number) => void;
  setJuzListScrollY: (position: number) => void;
  setLastViewedJuz: (juzNumber: number) => void;
  clearScrollPositions: () => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      // Initialize scroll tracking
      surahListScrollY: 0,
      lastViewedSurahNumber: null,
      juzListScrollY: 0,
      lastViewedJuzNumber: null,
      
      // Actions for Surah
      setSurahListScrollY: (position) => {
        set({ surahListScrollY: position });
      },
      
      setLastViewedSurah: (surahNumber) => {
        set({ lastViewedSurahNumber: surahNumber });
      },
      
      // Actions for Juz
      setJuzListScrollY: (position) => {
        set({ juzListScrollY: position });
      },
      
      setLastViewedJuz: (juzNumber) => {
        set({ lastViewedJuzNumber: juzNumber });
      },
      
      // Clear both positions
      clearScrollPositions: () => {
        set({ 
          surahListScrollY: 0, 
          lastViewedSurahNumber: null,
          juzListScrollY: 0,
          lastViewedJuzNumber: null,
        });
      },
    }),
    {
      name: 'navigation-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
