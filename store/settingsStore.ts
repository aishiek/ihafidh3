import { AppSettings } from '@/types';
import { clearAudioCache } from '@/utils/audioCacheUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SettingsState extends AppSettings {
  userName: string;
  quizVerseCount: number;
  translationLanguage: string;
  reciterIdentifier: string;
  showTransliteration: boolean;
  arabicFont: 'default' | 'scheherazade' | 'scheherazade-bold' | 'tajweed' | 'indo-pak';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setRepeatMode: (mode: number) => void;
  setFontSizeArabic: (size: number) => void;
  setFontSizeTransliteration: (size: number) => void;
  setFontSizeTranslation: (size: number) => void;
  setArabicFont: (font: 'default' | 'scheherazade' | 'scheherazade-bold' | 'tajweed' | 'indo-pak') => void;
  setShowTranslation: (show: boolean) => void;
  setShowTransliteration: (show: boolean) => void;
  setAutoPlayAudio: (autoPlay: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setUserName: (name: string) => void;
  setQuizVerseCount: (count: number) => void;
  setTranslationLanguage: (language: string) => void;
  setReciterIdentifier: (identifier: string) => void;
}

// Initialize store with values from AsyncStorage
const initializeStore = async (set: any) => {
  try {
    const [userName] = await Promise.all([
      AsyncStorage.getItem('user_name')
    ]);
    
    if (userName) {
      console.log('Initializing store with values from AsyncStorage:', { userName });
      set({ 
        userName: userName || '',
      });
    }
  } catch (error) {
    console.error('Error initializing settings store:', error);
  }
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => {
      // Initialize store when created
      initializeStore(set);
      
      return {
      theme: 'dark',
      repeatMode: 1,
      fontSizeArabic: 24,
      fontSizeTranslation: 16,
      fontSizeTransliteration: 14,
      showTranslation: true,
      showTransliteration: false,
      autoPlayAudio: false,
        notificationsEnabled: false,
        reminderTime: '09:00',
      userName: '',
      quizVerseCount: 5,
      translationLanguage: 'en.sahih',
      reciterIdentifier: 'ar.alafasy',
      arabicFont: 'default',
      
      setTheme: (theme) => set({ theme }),
      setRepeatMode: (repeatMode) => set({ repeatMode }),
      setFontSizeArabic: (fontSizeArabic) => set({ fontSizeArabic }),
      setFontSizeTransliteration: (fontSizeTransliteration) => set({ fontSizeTransliteration }),
      setFontSizeTranslation: (fontSizeTranslation) => set({ fontSizeTranslation }),
      setArabicFont: (arabicFont) => set({ arabicFont }),
      setShowTranslation: (showTranslation) => set({ showTranslation }),
      setShowTransliteration: (showTransliteration) => set({ showTransliteration }),
      setAutoPlayAudio: (autoPlayAudio) => set({ autoPlayAudio }),
        setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
        setReminderTime: (reminderTime) => set({ reminderTime }),
              setUserName: (userName) => {
        console.log('Setting userName in store:', userName);
        set({ userName });
      },
      setQuizVerseCount: (quizVerseCount) => set({ quizVerseCount }),
      setTranslationLanguage: (translationLanguage) => set({ translationLanguage }),
      setReciterIdentifier: (reciterIdentifier) => {
        set({ reciterIdentifier });
        clearAudioCache();
      },
      };
    },
    {
      name: 'ihafidh-settings',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        console.log('Settings store rehydrated:', state);
        if (state) {
          // Ensure all properties have default values
          state.userName = state.userName || '';
          state.theme = state.theme || 'light';
          state.repeatMode = state.repeatMode || 1;
          state.fontSizeArabic = state.fontSizeArabic || 24;
          state.fontSizeTranslation = state.fontSizeTranslation || 16;
          // @ts-ignore add new field default
          (state as any).fontSizeTransliteration = (state as any).fontSizeTransliteration || 14;
          // @ts-ignore extend persisted state
          (state as any).arabicFont = (state as any).arabicFont || 'default';
          state.showTranslation = state.showTranslation ?? true;
          // @ts-ignore extend persisted state
          (state as any).showTransliteration = (state as any).showTransliteration ?? false;
          state.autoPlayAudio = state.autoPlayAudio ?? false;
          state.notificationsEnabled = state.notificationsEnabled ?? false;
          state.reminderTime = state.reminderTime || '09:00';
          state.quizVerseCount = state.quizVerseCount || 5;
          state.translationLanguage = state.translationLanguage || 'en.sahih';
          // Default reciter
          // @ts-ignore - extend persisted state
          (state as any).reciterIdentifier = (state as any).reciterIdentifier || 'ar.alafasy';
        }
      },
    }
  )
);