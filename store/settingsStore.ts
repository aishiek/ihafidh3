import { AppSettings } from '@/types';
import {logAnalyticsEvent } from '@/utils/analyticsHelper';
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

export type SadaqahTrigger =
  | 'first_quiz' | 'fifth_quiz' | 'tenth_quiz' | 'twentieth_quiz'
  | 'juz_completed' | 'badge_unlocked'
  | 'surah_completed' | 'streak_milestone';

export interface ReviewPromptState {
  hasRated: boolean;             // true = never show again
  lastShownAt: number | null;    // timestamp ms
  shownCount: number;            // lifetime impressions
  lastDismissedAt: number | null;
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
  // Cross-screen walkthrough replay signal (set in Settings → read by Read on focus)
  walkthroughReplayPending: boolean;
  setWalkthroughReplayPending: (pending: boolean) => void;
  // Cross-screen force-show UpdateModal signal (set in Settings → consumed in _layout)
  forceShowUpdateModal: boolean;
  setForceShowUpdateModal: (show: boolean) => void;
  // Mode for the force-shown UpdateModal: 'whats_new' or 'rate'
  forceShowUpdateModalMode: 'whats_new' | 'rate';
  setForceShowUpdateModalMode: (mode: 'whats_new' | 'rate') => void;
  // Review prompt tracking
  reviewPromptState: ReviewPromptState;
  setReviewPromptState: (patch: Partial<ReviewPromptState>) => void;
  // Session scoped review prompt flag
  reviewPromptSessionShown: boolean;
  setReviewPromptSessionShown: (shown: boolean) => void;
  // Global SadaqahPrompt trigger
  sadaqahPromptVisible: boolean;
  sadaqahPromptTrigger: SadaqahTrigger | null;
  pendingSadaqahPromptTrigger: SadaqahTrigger | null;
  queueSadaqahPrompt: (trigger: SadaqahTrigger) => void;
  triggerSadaqahPrompt: (trigger: SadaqahTrigger) => void;
  closeSadaqahPrompt: () => void;

  // ── First-session goal/streak hook (Sept release, item 3) ──────────────────
  // Whether the user's very first recite session has ended. Used to trigger the
  // goal/streak prompt immediately, and (item 1) to know when it's safe to ask
  // for notification permission on iOS instead of on cold open.
  hasCompletedFirstReciteSession: boolean;
  setHasCompletedFirstReciteSession: (v: boolean) => void;
  firstSessionGoalPromptShown: boolean;
  setFirstSessionGoalPromptShown: (v: boolean) => void;
  pendingFirstSessionGoalPrompt: boolean;
  queueFirstSessionGoalPrompt: () => void;
  clearFirstSessionGoalPrompt: () => void;
  dailyGoalVerses: number | null;
  setDailyGoalVerses: (v: number) => void;
  // Which reminder type (if any) the user explicitly opted into from the
  // first-session prompt — the sole exception to the item-4 7-day suppression.
  firstSessionOptedInReminderType: 'daily_verse_reminder' | 'weekly_surah_reminder' | null;
  setFirstSessionOptedInReminderType: (v: 'daily_verse_reminder' | 'weekly_surah_reminder' | null) => void;

  // ── Delayed notification permission request (Sept release, item 1) ─────────
  // Guards notification permission from ever being requested more than once,
  // and from being requested on cold open (a one-shot prompt on iOS).
  notificationPermissionRequested: boolean;
  setNotificationPermissionRequested: (v: boolean) => void;

  // ── Install-time tracking (Sept release, item 4) ────────────────────────────
  // Used to suppress non-essential notifications for the first 7 days post-install.
  installedAt: number | null;
  ensureInstalledAt: () => void;
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
        reviewPromptState: {
          hasRated: false,
          lastShownAt: null,
          shownCount: 0,
          lastDismissedAt: null,
        },

        reviewPromptSessionShown: false,
        sadaqahPromptVisible: false,
        sadaqahPromptTrigger: null,
        pendingSadaqahPromptTrigger: null,

        hasCompletedFirstReciteSession: false,
        firstSessionGoalPromptShown: false,
        pendingFirstSessionGoalPrompt: false,
        dailyGoalVerses: null,
        firstSessionOptedInReminderType: null,

        notificationPermissionRequested: false,

        installedAt: null,

        setTheme: (theme) => {
          const previous = get().theme;
          set({ theme });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'theme',
            new_value: theme,
            previous_value: previous,});
        },
        setRepeatMode: (repeatMode) => {
          const previous = get().repeatMode;
          set({ repeatMode });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'repeat_mode',
            new_value: repeatMode.toString(),
            previous_value: previous.toString(),});
        },
        setFontSizeArabic: (fontSizeArabic) => {
          const previous = get().fontSizeArabic;
          set({ fontSizeArabic });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'font_size_arabic',
            new_value: fontSizeArabic.toString(),
            previous_value: previous.toString(),});
        },
        setFontSizeTransliteration: (fontSizeTransliteration) => {
          const previous = get().fontSizeTransliteration;
          set({ fontSizeTransliteration });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'font_size_transliteration',
            new_value: fontSizeTransliteration.toString(),
            previous_value: (previous || 0).toString(),});
        },
        setFontSizeTranslation: (fontSizeTranslation) => {
          const previous = get().fontSizeTranslation;
          set({ fontSizeTranslation });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'font_size_translation',
            new_value: fontSizeTranslation.toString(),
            previous_value: previous.toString(),});
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
            previous_value: previous,});
        },
        setShowTranslation: (showTranslation) => {
          const previous = get().showTranslation;
          set({ showTranslation });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'show_translation',
            new_value: showTranslation.toString(),
            previous_value: previous.toString(),});
        },
        setShowTransliteration: (showTransliteration) => {
          const previous = get().showTransliteration;
          set({ showTransliteration });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'show_transliteration',
            new_value: showTransliteration.toString(),
            previous_value: previous.toString(),});
        },
        setReadModeLightTheme: (readModeLightTheme) => {
          const previous = get().readModeLightTheme;
          set({ readModeLightTheme });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'read_mode_light_theme',
            new_value: readModeLightTheme.toString(),
            previous_value: previous.toString(),});
        },
        setWbwEnabled: (wbwEnabled: boolean) => {
          const previous = get().wbwEnabled;
          set({ wbwEnabled });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'wbw_enabled',
            new_value: wbwEnabled.toString(),
            previous_value: previous.toString(),});
        },
        setAutoPlayAudio: (autoPlayAudio) => {
          const previous = get().autoPlayAudio;
          set({ autoPlayAudio });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'auto_play_audio',
            new_value: autoPlayAudio.toString(),
            previous_value: previous.toString(),});
        },
        setNotificationsEnabled: (notificationsEnabled) => {
          const previous = get().notificationsEnabled;
          set({ notificationsEnabled });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'notifications_enabled',
            new_value: notificationsEnabled.toString(),
            previous_value: previous.toString(),});
        },
        setReminderTime: (reminderTime) => {
          const previous = get().reminderTime;
          set({ reminderTime });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'reminder_time',
            new_value: reminderTime.toString(),
            previous_value: previous.toString(),});
        },
        setAyahDailyNotificationsEnabled: (enabled: boolean) => {
          const previous = get().ayahDailyNotificationsEnabled;
          set({ ayahDailyNotificationsEnabled: enabled });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'ayah_daily_notifications_enabled',
            new_value: enabled.toString(),
            previous_value: (previous ?? false).toString(),});
        },
        setUserName: (userName) => {
          if (__DEV__) console.log('Setting userName in store:', userName);
          const prevName = get().userName;
          set({ userName });
          if ((!prevName || prevName === 'Hafidh') && userName && userName !== 'Hafidh') {
            logAnalyticsEvent('onboarding_completed', {
              onboarding_type: 'username_setup',
            });
          }
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
          const previous = get().translationLanguage;
          set({ translationLanguage });
          
          // ANALYTICS: Translation language changed
          logAnalyticsEvent('setting_changed', {
            setting_key: 'translation_language',
            new_value: translationLanguage,
            previous_value: previous,});
        },
        setReciterIdentifier: (reciterIdentifier) => {
          // Clear audio cache when changing reciter
          clearAudioCache();
          const previous = get().reciterIdentifier;
          set({ reciterIdentifier });
          
          // ANALYTICS: Reciter changed
          logAnalyticsEvent('setting_changed', {
            setting_key: 'reciter',
            new_value: reciterIdentifier,
            previous_value: previous,});
          logAnalyticsEvent('reciter_changed', {
            reciter_identifier: reciterIdentifier,
            previous_reciter: previous,
          });
        },
        setMushafRepeatMode: (mushafRepeatMode) => {
          const previous = get().mushafRepeatMode;
          set({ mushafRepeatMode });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'mushaf_repeat_mode',
            new_value: mushafRepeatMode.toString(),
            previous_value: previous.toString(),});
        },
        setMushafInfiniteLoop: (mushafInfiniteLoop) => {
          const previous = get().mushafInfiniteLoop;
          set({ mushafInfiniteLoop });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'mushaf_infinite_loop',
            new_value: mushafInfiniteLoop.toString(),
            previous_value: previous.toString(),});
        },
        setMushafRepeatScope: (mushafRepeatScope) => {
          const previous = get().mushafRepeatScope;
          set({ mushafRepeatScope });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'mushaf_repeat_scope',
            new_value: mushafRepeatScope,
            previous_value: previous,});
        },
        setPlaybackSpeed: (playbackSpeed) => {
          set({ playbackSpeed });

          const previous = get().playbackSpeed;
          set({ playbackSpeed });
          
          // ANALYTICS: Playback speed changed
          logAnalyticsEvent('setting_changed', {
            setting_key: 'playback_speed',
            new_value: playbackSpeed.toString(),
            previous_value: previous.toString(),});
        },
        setInfiniteLoop: (infiniteLoop) => set({ infiniteLoop }),
        setNotificationSetting: (key, value) => {
          const previous = get().notificationSettings?.[key];
          set((state) => ({
            notificationSettings: {
              ...state.notificationSettings,
              [key]: value,
            },
          }));
          logAnalyticsEvent('setting_changed', {
            setting_key: `notification_${key}`,
            new_value: value.toString(),
            previous_value: (previous ?? false).toString(),});
        },
        setRevisionReminderSettings: (settings) => {
          const previous = get().revisionReminderSettings;
          set((state) => ({
            revisionReminderSettings: {
              ...state.revisionReminderSettings,
              ...settings,
            },
          }));
          logAnalyticsEvent('setting_changed', {
            setting_key: 'revision_reminder',
            new_value: JSON.stringify(settings),
            previous_value: JSON.stringify(previous),});
        },
        setPageReminderSettings: (settings) => {
          const previous = get().pageReminderSettings;
          set((state) => ({
            pageReminderSettings: {
              ...state.pageReminderSettings,
              ...settings,
            },
          }));
          logAnalyticsEvent('setting_changed', {
            setting_key: 'page_reminder',
            new_value: JSON.stringify(settings),
            previous_value: JSON.stringify(previous),});
        },
        setLastDailyAyah: (date, verse) =>
          set({ lastDailyAyahDate: date, lastDailyAyahVerse: verse }),
        setDefaultVersesPerPage: (v: number) => {
          const previous = get().defaultVersesPerPage;
          const clamped = Math.max(3, Math.min(20, Math.floor(v) || 3));
          set({ defaultVersesPerPage: clamped });
          logAnalyticsEvent('setting_changed', {
            setting_key: 'default_verses_per_page',
            new_value: clamped.toString(),
            previous_value: previous.toString(),});
        },
        lastDismissedVersion: null,
        setLastDismissedVersion: (version) => set({ lastDismissedVersion: version }),
        lastSeenVersion: null,
        setLastSeenVersion: (version) => set({ lastSeenVersion: version }),
        walkthroughReplayPending: false,
        setWalkthroughReplayPending: (pending) => set({ walkthroughReplayPending: pending }),
        forceShowUpdateModal: false,
        setForceShowUpdateModal: (show) => set({ forceShowUpdateModal: show }),
        forceShowUpdateModalMode: 'whats_new',
        setForceShowUpdateModalMode: (mode) => set({ forceShowUpdateModalMode: mode }),
        setReviewPromptState: (patch) => set((state) => ({
          reviewPromptState: { ...state.reviewPromptState, ...patch }
        })),
        setReviewPromptSessionShown: (shown) => set({ reviewPromptSessionShown: shown }),
        queueSadaqahPrompt: (trigger) => {
          const currentPending = get().pendingSadaqahPromptTrigger;
          // Don't overwrite an existing pending trigger to avoid queueing both
          if (!currentPending) {
            set({ pendingSadaqahPromptTrigger: trigger });
          }
        },
        triggerSadaqahPrompt: (trigger) => set({ sadaqahPromptVisible: true, sadaqahPromptTrigger: trigger, pendingSadaqahPromptTrigger: null }),
        closeSadaqahPrompt: () => set({ sadaqahPromptVisible: false, pendingSadaqahPromptTrigger: null }),

        setHasCompletedFirstReciteSession: (v) => set({ hasCompletedFirstReciteSession: v }),
        setFirstSessionGoalPromptShown: (v) => set({ firstSessionGoalPromptShown: v }),
        queueFirstSessionGoalPrompt: () => {
          if (!get().firstSessionGoalPromptShown) {
            set({ pendingFirstSessionGoalPrompt: true });
          }
        },
        clearFirstSessionGoalPrompt: () => set({ pendingFirstSessionGoalPrompt: false, firstSessionGoalPromptShown: true }),
        setDailyGoalVerses: (v) => set({ dailyGoalVerses: v }),
        setFirstSessionOptedInReminderType: (v) => set({ firstSessionOptedInReminderType: v }),

        setNotificationPermissionRequested: (v) => set({ notificationPermissionRequested: v }),

        ensureInstalledAt: () => {
          if (!get().installedAt) {
            set({ installedAt: Date.now() });
          }
        },
      };
    },
    {
      name: 'ihafidh-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        // Exclude transient session-only flags from persistence
        const { 
          lastDismissedVersion, 
          forceShowUpdateModal,
          forceShowUpdateModalMode,
          walkthroughReplayPending,
          reviewPromptSessionShown,
          sadaqahPromptVisible,
          sadaqahPromptTrigger,
          ...persistedState 
        } = state;
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (__DEV__) console.log('Settings store rehydrated:', state);
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
          // @ts-ignore - ensure review prompt state exists
          if (!(state as any).reviewPromptState) {
            (state as any).reviewPromptState = {
              hasRated: false,
              lastShownAt: null,
              shownCount: 0,
              lastDismissedAt: null,
            };
          }

          // ── Sept release migrations (items 1, 3, 4) ──────────────────────────
          // installedAt: back-fill for stores that predate this field.
          // lastSeenVersion is only ever non-null after a *previous* app session
          // has already run (it's set once per boot, after rehydration completes) —
          // so at rehydrate time it reliably tells us "this store already existed
          // before today" without needing a separate marker. Existing users get an
          // installedAt far enough in the past that the 7-day suppression window
          // (item 4) has already elapsed, instead of it restarting for them. A
          // genuinely fresh install has lastSeenVersion === null here, so it gets
          // a real "now" install marker.
          if (!(state as any).installedAt) {
            const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
            const isExistingUser = !!(state as any).lastSeenVersion;
            (state as any).installedAt = isExistingUser ? Date.now() - EIGHT_DAYS_MS : Date.now();
          }
          // Existing users already have (or have already declined) iOS notification
          // permission from a prior version — never re-trigger the delayed-prompt
          // flow for them. Only genuinely fresh installs (no persisted state at all,
          // handled by the store's own initial value) should see the delayed prompt.
          (state as any).notificationPermissionRequested = (state as any).notificationPermissionRequested ?? true;
          (state as any).hasCompletedFirstReciteSession = (state as any).hasCompletedFirstReciteSession ?? true;
          (state as any).firstSessionGoalPromptShown = (state as any).firstSessionGoalPromptShown ?? true;
          (state as any).pendingFirstSessionGoalPrompt = (state as any).pendingFirstSessionGoalPrompt ?? false;
        }
      },
    }
  )
);