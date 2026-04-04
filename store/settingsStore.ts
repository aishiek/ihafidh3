import { AppSettings } from '@/types';
import { getCommonParams, logAnalyticsEvent } from '@/utils/analyticsHelper';
import { clearAudioCache } from '@/utils/audioCacheUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2 | 2.5 | 3 | 3.5 | 4 | 5 | 7;

export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 1;

export const PLAYBACK_SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25];

// Keep 'tajweed' in the type for backward compatibility with existing storage
type ArabicFont = 'default' | 'uthman-taha' | 'scheherazade' | 'scheherazade-bold' | 'indo-pak' | 'amiri-quran' | 'noto-naskh' | 'tajweed';

// Notification settings interface
export interface NotificationSettings {
  dailyAyah: boolean;
  dailyVerseReminder: boolean;
  weeklySurahsReminder: boolean;
  hifdhPlannerReminder: boolean;
  revisionReminder: boolean; // Remind to revise memorized verses
}

export interface RevisionReminderSettings {
  enabled: boolean;
  daysThreshold: number; // Days after memorization to remind (default 3)
}

export interface PageReminderSettings {
  enabled: boolean;
}

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
  mushafRepeatMode: number;
  mushafInfiniteLoop: boolean;
  mushafRepeatScope: 'page' | 'verse';
  notificationSettings: NotificationSettings;
  revisionReminderSettings: RevisionReminderSettings;
  pageReminderSettings: PageReminderSettings;
  readModeLightTheme: boolean;
  setReadModeLightTheme: (value: boolean) => void;
  wbwEnabled: boolean;
  setWbwEnabled: (value: boolean) => void;
  // Default number of verses per page used by Page Mode (global setting)
  defaultVersesPerPage: number;
  lastDailyAyahDate: string | null;
  lastDailyAyahVerse: { surahId: number; verseNumber: number } | null;
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
  setMushafRepeatMode: (mode: number) => void;
  setMushafInfiniteLoop: (enabled: boolean) => void;
  setMushafRepeatScope: (scope: 'page' | 'verse') => void;
  setNotificationSetting: (key: keyof NotificationSettings, value: boolean) => void;
  setRevisionReminderSettings: (settings: Partial<RevisionReminderSettings>) => void;
  setPageReminderSettings: (settings: Partial<PageReminderSettings>) => void;
  setLastDailyAyah: (date: string, verse: { surahId: number; verseNumber: number }) => void;
  setDefaultVersesPerPage: (v: number) => void;
  // Daily Ayah notification controls
  ayahDailyNotificationsEnabled?: boolean;
  setAyahDailyNotificationsEnabled?: (enabled: boolean) => void;
  // Version update tracking
  lastDismissedVersion: string | null;
  setLastDismissedVersion: (version: string) => void;
  // Last app version seen by the user (used to detect successful upgrades)
  lastSeenVersion: string | null;
  setLastSeenVersion: (version: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => {
      return {
        theme: 'dark',
        repeatMode: 1,
        fontSizeArabic: 24,
        fontSizeTranslation: 16,
        fontSizeTransliteration: 14,
        showTranslation: true,
        showTransliteration: false,
        autoPlayAudio: false,
        notificationsEnabled: true,
        reminderTime: '09:00',
        userName: '',
        userEmail: '',
        quizVerseCount: 5,
        translationLanguage: 'en.sahih',
        reciterIdentifier: 'ar.alafasy',
        arabicFont: 'default',
        playbackSpeed: DEFAULT_PLAYBACK_SPEED,
        infiniteLoop: false,
        mushafRepeatMode: 1,
        mushafInfiniteLoop: false,
        mushafRepeatScope: 'verse',
        ayahDailyNotificationsEnabled: true,
        notificationSettings: {
          dailyAyah: false,
          dailyVerseReminder: false,
          weeklySurahsReminder: false,
          hifdhPlannerReminder: false,
          revisionReminder: false,
        },
        revisionReminderSettings: {
          enabled: false, // Disabled by default as requested
          daysThreshold: 3, // Default 3 days
        },
        pageReminderSettings: {
          enabled: false, // Disabled by default
        },
        readModeLightTheme: false, // Default to dark theme in read mode
        wbwEnabled: false, // Default to disabled
        lastDailyAyahDate: null,
        lastDailyAyahVerse: null,
        // default Verses per page for Page Mode
        defaultVersesPerPage: 15,

        setTheme: (theme) => {
          const previous = get().theme;
          set({ theme });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'theme',
            new_value: theme,
            previous_value: previous,
            ...getCommonParams(),
          });
        },
        setRepeatMode: (repeatMode) => {
          const previous = get().repeatMode;
          set({ repeatMode });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'repeat_mode',
            new_value: repeatMode.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
        setFontSizeArabic: (fontSizeArabic) => {
          const previous = get().fontSizeArabic;
          set({ fontSizeArabic });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'font_size_arabic',
            new_value: fontSizeArabic.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
        setFontSizeTransliteration: (fontSizeTransliteration) => {
          const previous = get().fontSizeTransliteration;
          set({ fontSizeTransliteration });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'font_size_transliteration',
            new_value: fontSizeTransliteration.toString(),
            previous_value: (previous || 0).toString(),
            ...getCommonParams(),
          });
        },
        setFontSizeTranslation: (fontSizeTranslation) => {
          const previous = get().fontSizeTranslation;
          set({ fontSizeTranslation });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'font_size_translation',
            new_value: fontSizeTranslation.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
        setArabicFont: (arabicFont) => {
          const font = (
            ['default', 'uthman-taha', 'scheherazade', 'scheherazade-bold', 'tajweed', 'indo-pak', 'amiri-quran', 'noto-naskh'].includes(arabicFont)
              ? arabicFont
              : 'default'
          );
          set({ arabicFont: font });

          const previous = get().arabicFont;
          set({ arabicFont: font });
          
          // ANALYTICS: Arabic font changed
          logAnalyticsEvent('setting_changed', {
            setting_key: 'arabic_font',
            new_value: font,
            previous_value: previous,
            ...getCommonParams(),
          });
        },
        setShowTranslation: (showTranslation) => {
          const previous = get().showTranslation;
          set({ showTranslation });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'show_translation',
            new_value: showTranslation.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
        setShowTransliteration: (showTransliteration) => {
          const previous = get().showTransliteration;
          set({ showTransliteration });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'show_transliteration',
            new_value: showTransliteration.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
        setReadModeLightTheme: (readModeLightTheme) => {
          const previous = get().readModeLightTheme;
          set({ readModeLightTheme });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'read_mode_light_theme',
            new_value: readModeLightTheme.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
        setWbwEnabled: (wbwEnabled: boolean) => {
          const previous = get().wbwEnabled;
          set({ wbwEnabled });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'wbw_enabled',
            new_value: wbwEnabled.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
        setAutoPlayAudio: (autoPlayAudio) => {
          const previous = get().autoPlayAudio;
          set({ autoPlayAudio });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'auto_play_audio',
            new_value: autoPlayAudio.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
        setNotificationsEnabled: (notificationsEnabled) => {
          const previous = get().notificationsEnabled;
          set({ notificationsEnabled });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'notifications_enabled',
            new_value: notificationsEnabled.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
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
        setTranslationLanguage: (translationLanguage) => {
          set({ translationLanguage });

          const previous = get().translationLanguage;
          set({ translationLanguage });
          
          // ANALYTICS: Translation language changed
          logAnalyticsEvent('setting_changed', {
            setting_key: 'translation_language',
            new_value: translationLanguage,
            previous_value: previous,
            ...getCommonParams(),
          });
        },
        setReciterIdentifier: (reciterIdentifier) => {
          // Clear audio cache when changing reciter
          clearAudioCache();
          set({ reciterIdentifier });

          const previous = get().reciterIdentifier;
          set({ reciterIdentifier });
          
          // ANALYTICS: Reciter changed
          logAnalyticsEvent('setting_changed', {
            setting_key: 'reciter',
            new_value: reciterIdentifier,
            previous_value: previous,
            ...getCommonParams(),
          });
        },
        setMushafRepeatMode: (mushafRepeatMode) => set({ mushafRepeatMode }),
        setMushafInfiniteLoop: (mushafInfiniteLoop) => set({ mushafInfiniteLoop }),
        setMushafRepeatScope: (mushafRepeatScope) => set({ mushafRepeatScope }),
        setPlaybackSpeed: (playbackSpeed) => {
          set({ playbackSpeed });

          const previous = get().playbackSpeed;
          set({ playbackSpeed });
          
          // ANALYTICS: Playback speed changed
          logAnalyticsEvent('setting_changed', {
            setting_key: 'playback_speed',
            new_value: playbackSpeed.toString(),
            previous_value: previous.toString(),
            ...getCommonParams(),
          });
        },
        setInfiniteLoop: (infiniteLoop) => set({ infiniteLoop }),
        setNotificationSetting: (key, value) =>
          set((state) => ({
            notificationSettings: {
              ...state.notificationSettings,
              [key]: value,
            },
          })),
        setRevisionReminderSettings: (settings) =>
          set((state) => ({
            revisionReminderSettings: {
              ...state.revisionReminderSettings,
              ...settings,
            },
          })),
        setPageReminderSettings: (settings) =>
          set((state) => ({
            pageReminderSettings: {
              ...state.pageReminderSettings,
              ...settings,
            },
          })),
        setLastDailyAyah: (date, verse) =>
          set({ lastDailyAyahDate: date, lastDailyAyahVerse: verse }),
        setDefaultVersesPerPage: (v: number) => {
          const clamped = Math.max(3, Math.min(20, Math.floor(v) || 3));
          set({ defaultVersesPerPage: clamped });
        },
        lastDismissedVersion: null,
        setLastDismissedVersion: (version) => set({ lastDismissedVersion: version }),
        lastSeenVersion: null,
        setLastSeenVersion: (version) => set({ lastSeenVersion: version }),
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
          // Ensure revision reminder settings exist
          if (!state.revisionReminderSettings) {
            state.revisionReminderSettings = {
              enabled: false,
              daysThreshold: 3,
            };
          }
          // Ensure page reminder settings exist
          if (!(state as any).pageReminderSettings) {
            (state as any).pageReminderSettings = {
              enabled: false,
            };
          }
          // @ts-ignore add new field default
          (state as any).fontSizeTransliteration = (state as any).fontSizeTransliteration || 14;
          // @ts-ignore extend persisted state - use default (ScheherazadeNew) as fallback
          (state as any).arabicFont = (state as any).arabicFont || 'default';
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
          // @ts-ignore - mushaf repeat settings
          (state as any).mushafRepeatMode = (state as any).mushafRepeatMode || 1;
          // @ts-ignore - mushaf infinite loop
          (state as any).mushafInfiniteLoop = (state as any).mushafInfiniteLoop || false;
          // Initialize notification settings with defaults
          // @ts-ignore - extend persisted state
          (state as any).notificationSettings = (state as any).notificationSettings || {
            dailyAyah: false,
            dailyVerseReminder: false,
            weeklySurahsReminder: false,
            hifdhPlannerReminder: false,
          };
          // @ts-ignore - extend persisted state
          (state as any).lastDailyAyahDate = (state as any).lastDailyAyahDate || null;
          // @ts-ignore - extend persisted state
          (state as any).lastDailyAyahVerse = (state as any).lastDailyAyahVerse || null;
          // Ensure persisted default verses per page exists
          // @ts-ignore - extend persisted state
          (state as any).defaultVersesPerPage = (state as any).defaultVersesPerPage || 15;
          // @ts-ignore - extend persisted state
          (state as any).lastDismissedVersion = (state as any).lastDismissedVersion || null;
          // @ts-ignore - persisted last seen app version
          (state as any).lastSeenVersion = (state as any).lastSeenVersion || null;
        }
      },
    }
  )
);