import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Favourite {
  id: number;
  surahId: number;
  surahName: string;
  verseNumber: number;
  arabicText: string;
  translation: string;
  createdAt: string;
  source: 'surah' | 'juz';
  juzNumber?: number;
}

interface FavouriteState {
  favourites: Favourite[];
  favouritesSet: Set<number>; // For quick lookup
  addFavourite: (verseId: number, surahId: number, surahName: string, verseNumber: number, arabicText: string, translation: string, source: 'surah' | 'juz', juzNumber?: number) => void;
  removeFavourite: (verseId: number) => void;
  isFavourited: (verseId: number) => boolean;
  clearAllFavourites: () => void;
}

export const useFavouriteStore = create<FavouriteState>()(
  persist(
    (set, get) => ({
      favourites: [],
      favouritesSet: new Set(),

      addFavourite: (verseId, surahId, surahName, verseNumber, arabicText, translation, source, juzNumber) => {
        const favourite: Favourite = {
          id: verseId,
          surahId,
          surahName,
          verseNumber,
          arabicText,
          translation,
          createdAt: new Date().toISOString(),
          source,
          juzNumber
        };

        set((state) => {
          const isExisting = state.favourites.some(f => f.id === verseId);
          if (isExisting) return state;

          const newFavourites = [...state.favourites, favourite];
          
          // ANALYTICS: Favourite added
          const { logAnalyticsEvent, getCommonParams } = require('@/utils/analyticsHelper');
          logAnalyticsEvent('favourite_added', {
            verse_id: verseId,
            surah_id: surahId,
            surah_name: surahName,
            verse_number: verseNumber,
            source: source || 'unknown',
            juz_number: juzNumber || null,
            ...getCommonParams(),
          });

          return {
            favourites: newFavourites,
            favouritesSet: new Set(newFavourites.map(f => f.id))
          };
        });
      },

      removeFavourite: (verseId) => {
        set((state) => {
          const item = state.favourites.find(f => f.id === verseId);
          const newFavourites = state.favourites.filter(f => f.id !== verseId);

          // ANALYTICS: Favourite removed
          const { logAnalyticsEvent, getCommonParams } = require('@/utils/analyticsHelper');
          logAnalyticsEvent('favourite_removed', {
            verse_id: verseId,
            surah_id: item?.surahId || null,
            surah_name: item?.surahName || 'unknown',
            verse_number: item?.verseNumber || null,
            ...getCommonParams(),
          });

          return {
            favourites: newFavourites,
            favouritesSet: new Set(newFavourites.map(f => f.id))
          };
        });
      },

      isFavourited: (verseId) => {
        return get().favouritesSet.has(verseId);
      },

      clearAllFavourites: () => {
        set({
          favourites: [],
          favouritesSet: new Set()
        });
      }
    }),
    {
      name: 'favourite-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
