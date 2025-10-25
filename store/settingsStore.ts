import { AppSettings } from '@/types';
import { clearAudioCache } from '@/utils/audioCacheUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2 | 2.5 | 3 | 3.5 | 4 | 5 | 7;

export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 1;

export const PLAYBACK_SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25];

// Keep 'tajweed' in the type for backward compatibility with existing storage
type ArabicFont = 'default' | 'uthman-taha' | 'scheherazade' | 'scheherazade-bold' | 'indo-pak' | 'amiri-quran' | 'tajweed';

export interface SettingsState extends AppSettings {
  userName: string;
  userEmail: string;
  quizVerseCount: number;
  translationLanguage: string;
  reciterIdentifier: string;
  showTransliteration: boolean;
  arabicFont: ArabicFont;
  playbackSpeed: PlaybackSpeed;
  infiniteLoop: boolean;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setRepeatMode: (mode: number) => void;
  setFontSizeArabic: (size: number) => void;
  setFontSizeTransliteration: (size: number) => void;
  setFontSizeTranslation: (size: number) => void;
  setArabicFont: (font: ArabicFont) => void;
  setShowTranslation: (show: boolean) => void;
  setShowTransliteration: (show: boolean) => void;
  setAutoPlayAudio: (autoPlay: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setUserName: (name: string) => void;
  setUserEmail: (email: string) => void;
  setQuizVerseCount: (count: number) => void;
  setTranslationLanguage: (language: string) => void;
  setReciterIdentifier: (identifier: string) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setInfiniteLoop: (enabled: boolean) => void;
  // Daily Ayah notification controls
  ayahDailyNotificationsEnabled?: boolean;
  setAyahDailyNotificationsEnabled?: (enabled: boolean) => void;
}

// Initialize store with values from AsyncStorage
const initializeStore = async (set: any) => {
  try {
    const [userName, userEmail] = await Promise.all([
      AsyncStorage.getItem('user_name'),
      AsyncStorage.getItem('user_email')
    ]);
    
    if (userName) {
      console.log('Initializing store with values from AsyncStorage:', { userName });
      set({ 
        userName: userName || '',
      });
    }
    if (userEmail) {
      set({ userEmail: userEmail || '' });
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
    userEmail: '',
      quizVerseCount: 5,
      translationLanguage: 'en.sahih',
      reciterIdentifier: 'ar.alafasy',
      arabicFont: 'default',
      playbackSpeed: DEFAULT_PLAYBACK_SPEED,
      infiniteLoop: false,
  ayahDailyNotificationsEnabled: false,
      
      setTheme: (theme) => set({ theme }),
      setRepeatMode: (repeatMode) => set({ repeatMode }),
      setFontSizeArabic: (fontSizeArabic) => set({ fontSizeArabic }),
      setFontSizeTransliteration: (fontSizeTransliteration) => set({ fontSizeTransliteration }),
      setFontSizeTranslation: (fontSizeTranslation) => set({ fontSizeTranslation }),
      setArabicFont: (arabicFont) => {
        // Handle case where 'tajweed' might be in AsyncStorage from previous version
        const font = (arabicFont === 'tajweed') ? 'scheherazade' : 
                   (['default', 'uthman-taha', 'scheherazade', 'scheherazade-bold', 'indo-pak', 'amiri-quran'].includes(arabicFont) 
                     ? arabicFont 
                     : 'default');
        set({ arabicFont: font });
      },
      setShowTranslation: (showTranslation) => set({ showTranslation }),
      setShowTransliteration: (showTransliteration) => set({ showTransliteration }),
      setAutoPlayAudio: (autoPlayAudio) => set({ autoPlayAudio }),
        setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
        setReminderTime: (reminderTime) => set({ reminderTime }),
  setAyahDailyNotificationsEnabled: (enabled: boolean) => set({ ayahDailyNotificationsEnabled: enabled }),
              setUserName: (userName) => {
        console.log('Setting userName in store:', userName);
        set({ userName });
      },
      setUserEmail: (userEmail) => {
        // Basic email validation
        if (userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
          console.warn('Invalid email format');
          return;
        }
        AsyncStorage.setItem('user_email', userEmail || '');
        set({ userEmail: userEmail || '' });
      },
      setQuizVerseCount: (quizVerseCount) => set({ quizVerseCount }),
      setTranslationLanguage: (translationLanguage) => set({ translationLanguage }),
      setReciterIdentifier: (reciterIdentifier) => {
        // Clear audio cache when changing reciter
        clearAudioCache();
        set({ reciterIdentifier });
      },
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
      setInfiniteLoop: (infiniteLoop) => set({ infiniteLoop }),
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
          // @ts-ignore add new field default
          (state as any).userEmail = (state as any).userEmail || '';
          state.theme = state.theme || 'light';
          state.repeatMode = state.repeatMode || 1;
          state.fontSizeArabic = state.fontSizeArabic || 24;
          state.fontSizeTranslation = state.fontSizeTranslation || 16;
          // @ts-ignore add new field default
          (state as any).fontSizeTransliteration = (state as any).fontSizeTransliteration || 14;
          // @ts-ignore extend persisted state
          (state as any).arabicFont = (state as any).arabicFont || 'uthman-taha';
          state.showTranslation = state.showTranslation ?? true;
          // @ts-ignore extend persisted state
          (state as any).showTransliteration = (state as any).showTransliteration ?? false;
          state.autoPlayAudio = state.autoPlayAudio ?? false;
          state.notificationsEnabled = state.notificationsEnabled ?? false;
          state.reminderTime = state.reminderTime || '09:00';
          // @ts-ignore extend persisted state for ayah notifications
          (state as any).ayahDailyNotificationsEnabled = (state as any).ayahDailyNotificationsEnabled ?? false;
          state.quizVerseCount = state.quizVerseCount || 5;
          state.translationLanguage = state.translationLanguage || 'en.sahih';
          // Default reciter
          // @ts-ignore - extend persisted state
          (state as any).reciterIdentifier = (state as any).reciterIdentifier || 'ar.alafasy';
          // Default playback settings
          state.playbackSpeed = state.playbackSpeed || DEFAULT_PLAYBACK_SPEED;
          state.infiniteLoop = state.infiniteLoop || false;
        }
      },
    }
  )
);