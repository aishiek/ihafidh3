import { initDatabase, logBasicStats, runIntegrityCheck } from '@/assets/database/QuranDatabase';
import AnnouncementModal, { AnnouncementConfig } from '@/components/AnnouncementModal';
import AutoRotateBanner from '@/components/AutoRotateBanner';
import CelebrationModal from '@/components/CelebrationModal';
import { FastingCalendarProvider } from '@/components/fasting/context/FastingCalendarContext';
import FirstSessionGoalPrompt from '@/components/FirstSessionGoalPrompt';
import ReviewSoftPrompt from '@/components/ReviewSoftPrompt';
import SadaqahPrompt from '@/components/SadaqahPrompt';
import UpdateModal from '@/components/UpdateModal';
import { LATEST_VERSION, MIN_SUPPORTED_VERSION } from '@/constants/appConfig';
import { CelebrationProvider, useCelebration } from '@/contexts/CelebrationContext';
import { AnnouncementService } from '@/services/AnnouncementService';
import { FastingNotificationService } from '@/services/fasting/notificationService';
import { AyahNotificationService, EnhancedNotificationService, RevisionReminderService, initializeNotifications, requestNotificationPermissions } from '@/services/NotificationService';
import { PushNotificationService } from '@/services/PushNotificationService';
import type { Badge } from '@/store/badgeStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useProgressStore } from '@/store/progressStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getScreenNameFromPath, logAnalyticsEvent, logScreenView, setUserProperties } from '@/utils/analyticsHelper';
import { initializeAudio } from '@/utils/audioUtils';
import { getTodayCardVerse } from '@/utils/ayahOfTheDay';
import { initGlobalErrorHandlers } from '@/utils/globalErrorHandlers';
import { isNotificationTypeAllowedDuringSuppression } from '@/utils/notificationSuppression';
import { fetchRemoteVersionConfig, getEffectiveVersionConfig, type RemoteVersionConfig } from '@/utils/remoteVersion';
import { canPromptNative, trackAppOpenAndCheckTrigger, shouldShowReviewPrompt, openReview } from '@/utils/reviewPrompt';
import { runTurboModuleProbe } from '@/utils/turboModuleProbe';
import { getCurrentVersion, isVersionLower } from '@/utils/versionUtils';
import notifee, { EventType } from '@notifee/react-native';
import * as Font from 'expo-font';
import { CopilotProvider } from 'react-native-copilot';
import { Stack, router, usePathname } from 'expo-router';
import { prefetchAllTajweedChapters } from '@/services/quranComTajweedService';
import React, { Component, ReactNode, useEffect } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initPersistenceGuard } from '../utils/persistenceGuard';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL: notifee background event handler.
// Per notifee docs, this MUST be registered outside of any React component.
// If registered inside a useEffect it can silently fail on Android (app hangs).
// ─────────────────────────────────────────────────────────────────────────────
let _bgNavPending: any = null; // store data until router is ready

notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('[Notifee] Background event (module-level):', EventType[type]);
  if (type === EventType.PRESS) {
    // Store the notification data; the component will pick it up via getInitialNotification
    // The router isn't ready at module-level, so we just log here.
    // getInitialNotification() in the component handles the actual navigation.
    _bgNavPending = detail.notification?.data ?? null;
    console.log('[Notifee] Background press queued for cold-start handler');
  }
});

// Initialize global handlers ASAP
initGlobalErrorHandlers();

// Simple Error Boundary to surface JS errors instead of silent native crash
class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: any) {
    console.log('RootErrorBoundary caught error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
          <Text style={{ color: 'white', fontSize: 16, marginBottom: 8, fontFamily: 'ScheherazadeNew-Bold' }}>Something went wrong.</Text>
          <Text style={{ color: '#f87171', fontSize: 12, paddingHorizontal: 16, textAlign: 'center', fontFamily: 'ScheherazadeNew-Regular' }}>
            {this.state.error.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Persist font load state across Fast Refresh using global flag
declare global {
  var __IHAFIDH_FONTS_LOADED: boolean | undefined;
}

let __fontsLoadedSingleton = global.__IHAFIDH_FONTS_LOADED === true;
let __fontLoadPromise: Promise<void> | null = null;
async function loadAppFontsOnce() {
  if (__fontsLoadedSingleton) return;
  if (__fontLoadPromise) return __fontLoadPromise;

  // Try to include Amiri Quran if bundled. Guard require so missing asset won't crash.
  let amiriAsset: any | null = null;
  try {
    // @ts-ignore: Metro resolve guarded
    amiriAsset = require('../assets/fonts/AmiriQuran-Regular.ttf');
  } catch (e: any) {
    console.warn('[fonts] AmiriQuran-Regular.ttf not found in assets/fonts – skipping optional font');
  }

  // Try to include KFGQPC Uthmanic Hafs font if bundled (TTF format for best cross-platform support).
  let kfgqpcAsset: any | null = null;
  try {
    // @ts-ignore: Metro resolve guarded
    kfgqpcAsset = require('../assets/fonts/UthmanicHafs1.otf');
  } catch (e: any) {
    console.warn('[fonts] UthmanicHafs1.otf not found in assets/fonts – skipping optional font');
  }

  const fontMap: Record<string, any> = {
    'ScheherazadeNew-Regular': require('../assets/fonts/ScheherazadeNew-Regular.ttf'),
    'ScheherazadeNew-Bold': require('../assets/fonts/ScheherazadeNew-Bold.ttf'),
    'NooreHuda-Regular': require('../assets/fonts/NooreHuda-Regular.ttf'),
    'NotoNaskhArabic-Regular': require('../assets/fonts/NotoNaskhArabic-Regular.ttf'),
    'KFGQPC-Uthman-Taha': require('../assets/fonts/UthmanTaha-Ver10.otf'),
  };
  if (amiriAsset) {
    fontMap['AmiriQuran-Regular'] = amiriAsset;
  }
  if (kfgqpcAsset) {
    fontMap['KFGQPC-Uthmanic-Hafs'] = kfgqpcAsset;
  }

  const toLoad: Record<string, any> = {};
  for (const k of Object.keys(fontMap)) {
    // Only queue fonts that are not yet registered
    if (!(Font as any).isLoaded || !(Font as any).isLoaded(k)) {
      toLoad[k] = fontMap[k];
    }
  }
  // If everything already registered, mark as loaded and skip
  if (Object.keys(toLoad).length === 0) {
    __fontsLoadedSingleton = true;
    global.__IHAFIDH_FONTS_LOADED = true;
    return;
  }
  __fontLoadPromise = (async () => {
    try {
      await Font.loadAsync(toLoad);
      __fontsLoadedSingleton = true;
      global.__IHAFIDH_FONTS_LOADED = true;
      console.log('[fonts] Loaded (first time / missing subset).');
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/CTFontManagerError|already been registered|Font registration was unsuccessful/i.test(msg)) {
        console.warn('[fonts] Duplicate or benign registration issue, continuing:', msg);
        __fontsLoadedSingleton = true;
        global.__IHAFIDH_FONTS_LOADED = true;
      } else {
        console.error('[fonts] Fatal font load error:', e);
        throw e;
      }
    }
  })();
  return __fontLoadPromise;
}


// Separate component to use celebration hook (must be inside provider)
function RootLayoutContent() {
  const [fontsLoaded, setFontsLoaded] = React.useState(false);
  const [fontError, setFontError] = React.useState<Error | null>(null);
  const [forceContinue, setForceContinue] = React.useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = React.useState(false);
  const [forcedUpdate, setForcedUpdate] = React.useState(false);
  const [showAnnouncement, setShowAnnouncement] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState<AnnouncementConfig | null>(null);
  const [showReviewSoftPrompt, setShowReviewSoftPrompt] = React.useState(false);
  const [currentVersion, setCurrentVersion] = React.useState('2.2.0');
  const [latestVersion, setLatestVersion] = React.useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = React.useState<string[] | undefined>(undefined);
  const [iosAppIdOverride, setIosAppIdOverride] = React.useState<string | null>(null);
  const [androidPkgOverride, setAndroidPkgOverride] = React.useState<string | null>(null);
  const ayahEnabled = useSettingsStore(s => s.ayahDailyNotificationsEnabled ?? false);
  const reminderTime = useSettingsStore(s => s.reminderTime);
  const notificationSettings = useSettingsStore(s => s.notificationSettings);
  const revisionReminderSettings = useSettingsStore(s => s.revisionReminderSettings);
  const lastSeenVersion = useSettingsStore(s => s.lastSeenVersion);
  const setLastSeenVersion = useSettingsStore(s => s.setLastSeenVersion);
  const forceShowUpdateModal = useSettingsStore(s => s.forceShowUpdateModal);
  const setForceShowUpdateModal = useSettingsStore(s => s.setForceShowUpdateModal);
  const forceShowUpdateModalMode = useSettingsStore(s => s.forceShowUpdateModalMode);
  const setForceShowUpdateModalMode = useSettingsStore(s => s.setForceShowUpdateModalMode);

  const reviewPromptState = useSettingsStore(s => s.reviewPromptState);
  const reviewPromptSessionShown = useSettingsStore(s => s.reviewPromptSessionShown);
  const setReviewPromptState = useSettingsStore(s => s.setReviewPromptState);
  const setReviewPromptSessionShown = useSettingsStore(s => s.setReviewPromptSessionShown);
  const sadaqahPromptVisible = useSettingsStore(s => s.sadaqahPromptVisible);
  const sadaqahPromptTrigger = useSettingsStore(s => s.sadaqahPromptTrigger);
  const pendingSadaqahPromptTrigger = useSettingsStore(s => s.pendingSadaqahPromptTrigger);
  const triggerSadaqahPrompt = useSettingsStore(s => s.triggerSadaqahPrompt);
  const queueSadaqahPrompt = useSettingsStore(s => s.queueSadaqahPrompt);
  const closeSadaqahPrompt = useSettingsStore(s => s.closeSadaqahPrompt);

  // First-session goal/streak prompt (item 3) + delayed notification permission (item 1)
  const pendingFirstSessionGoalPrompt = useSettingsStore(s => s.pendingFirstSessionGoalPrompt);
  const clearFirstSessionGoalPrompt = useSettingsStore(s => s.clearFirstSessionGoalPrompt);
  const setDailyGoalVerses = useSettingsStore(s => s.setDailyGoalVerses);
  const setFirstSessionOptedInReminderType = useSettingsStore(s => s.setFirstSessionOptedInReminderType);
  const notificationPermissionRequested = useSettingsStore(s => s.notificationPermissionRequested);
  const setNotificationPermissionRequested = useSettingsStore(s => s.setNotificationPermissionRequested);
  const [showFirstSessionGoalPrompt, setShowFirstSessionGoalPrompt] = React.useState(false);
  const hasCompletedFirstReciteSession = useSettingsStore(s => s.hasCompletedFirstReciteSession);
  const arabicFont = useSettingsStore(s => s.arabicFont);

  // Warm the tajweed disk cache for offline use. Tajweed users only, 20s after
  // launch so it stays out of the way of startup and first render.
  useEffect(() => {
    if (arabicFont !== 'tajweed') return;
    const t = setTimeout(() => { void prefetchAllTajweedChapters(); }, 20000);
    return () => clearTimeout(t);
  }, [arabicFont]);

  // "What's New" button in Settings sets forceShowUpdateModal → show modal immediately
  React.useEffect(() => {
    if (forceShowUpdateModal) {
      setForceShowUpdateModal(false);
      setForcedUpdate(false);   // treat as soft/announcement, not a forced upgrade
      setShowUpdatePrompt(true);
    }
  }, [forceShowUpdateModal]);

  // Global celebration hook - available on all screens
  const {
    celebrationVisible,
    celebrationType,
    customMessage,
    badgeName,
    showCelebration,
    hideCelebration
  } = useCelebration();

  const pathname = usePathname();

  // Smart, deadlock-proof Sadaqah / Review prompt trigger queue processor
  // Avoids iOS native UIViewController modal collision freeze right after celebrations or quizzes
  React.useEffect(() => {
    if (!pendingSadaqahPromptTrigger || sadaqahPromptVisible) return;

    const isHomeScreen = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    const anyModalOpen = celebrationVisible || showAnnouncement || showUpdatePrompt || showReviewSoftPrompt || forcedUpdate;

    // Only present when user is safely on the Home screen and NO other modal/celebration is open
    if (isHomeScreen && !anyModalOpen) {
      const timer = setTimeout(() => {
        // Double check state before triggering to avoid race conditions
        const latestPending = useSettingsStore.getState().pendingSadaqahPromptTrigger;
        if (latestPending && !useSettingsStore.getState().sadaqahPromptVisible) {
          triggerSadaqahPrompt(latestPending);
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [pendingSadaqahPromptTrigger, sadaqahPromptVisible, pathname, celebrationVisible, showAnnouncement, showUpdatePrompt, showReviewSoftPrompt, forcedUpdate, triggerSadaqahPrompt]);

  // First-session goal/streak prompt queue processor (item 3). Same
  // deadlock-avoidance pattern as the Sadaqah queue above: only present once
  // the user is safely on Home with no other modal/celebration open.
  React.useEffect(() => {
    if (!pendingFirstSessionGoalPrompt || showFirstSessionGoalPrompt) return;

    const isHomeScreen = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    const anyModalOpen = celebrationVisible || showAnnouncement || showUpdatePrompt || showReviewSoftPrompt || forcedUpdate || sadaqahPromptVisible;

    if (isHomeScreen && !anyModalOpen) {
      const timer = setTimeout(() => {
        const stillPending = useSettingsStore.getState().pendingFirstSessionGoalPrompt;
        if (stillPending) setShowFirstSessionGoalPrompt(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [pendingFirstSessionGoalPrompt, showFirstSessionGoalPrompt, pathname, celebrationVisible, showAnnouncement, showUpdatePrompt, showReviewSoftPrompt, forcedUpdate, sadaqahPromptVisible]);

  const setBadgeCelebrationCallback = useProgressStore((s) => s.setBadgeCelebrationCallback);

  const totalTimeSeconds = useProgressStore(s => s.timeSpent.total);
  const totalRef = React.useRef<number>(totalTimeSeconds);

  // Watch total tracked time and trigger review soft prompt when crossing 3 hours (10800s)
  React.useEffect(() => {
    const prev = totalRef.current || 0;
    const nowTotal = totalTimeSeconds || 0;
    if (prev < 10800 && nowTotal >= 10800) {
      (async () => {
        try {
          const ok = await canPromptNative();
          if (ok) setShowReviewSoftPrompt(true);
        } catch (e) {
          console.log('[review] 3-hour prompt failed', e);
        }
      })();
    }
    totalRef.current = nowTotal;
  }, [totalTimeSeconds]);

  // ==========================================
  // ANALYTICS: App Lifecycle - App Open
  // ==========================================
  React.useEffect(() => {
    logAnalyticsEvent('app_open');
    // Track consecutive opens and show the soft review prompt on the 7th consecutive day
    (async () => {
      try {
        const should = await trackAppOpenAndCheckTrigger();
        if (should) setShowReviewSoftPrompt(true);
      } catch (e) {
        console.log('[review] track open failed', e);
      }
    })();
  }, []);

  // ==========================================
  // ANALYTICS: User Properties (Segmentation)
  // ==========================================
  React.useEffect(() => {
    const initUserProperties = async () => {
      // Ensure hydration is complete to avoid sending 0s for user properties on cold launch
      const isHydrated = () => 
        useProgressStore.persist.hasHydrated() && 
        useSettingsStore.persist.hasHydrated();

      if (!isHydrated()) {
        const interval = setInterval(() => {
          if (isHydrated()) {
            clearInterval(interval);
            const { syncFirebaseUserProperties } = require('@/utils/analyticsHelper');
            syncFirebaseUserProperties();
          }
        }, 100);
        setTimeout(() => clearInterval(interval), 5000); // Failsafe
      } else {
        const { syncFirebaseUserProperties } = require('@/utils/analyticsHelper');
        syncFirebaseUserProperties();
      }
    };

    initUserProperties();
  }, []);

  React.useEffect(() => {
    let mounted = true;
    loadAppFontsOnce()
      .then(() => { if (mounted) setFontsLoaded(true); })
      .catch(err => { if (mounted) { setFontError(err instanceof Error ? err : new Error(String(err))); setFontsLoaded(true); } });

    const to = setTimeout(() => {
      if (mounted && !fontsLoaded) {
        console.warn('[fonts] Timeout waiting (4s) – forcing continue');
        setForceContinue(true);
      }
    }, 4000);
    return () => { mounted = false; clearTimeout(to); };
  }, [fontsLoaded]);

  // Initialize audio session early to honor iOS background audio settings
  React.useEffect(() => {
    initializeAudio().catch(e => console.log('[audio] init failed', e));
    let mounted = true;

    const checkForAnnouncements = async () => {
      try {
        // Small startup delay to avoid interrupting initial animation/flow
        await new Promise(resolve => setTimeout(resolve, 3000));
        if (!mounted) return;

        // Don't show generic announcements if a forced update is already pending
        if (forcedUpdate) {
          console.log('[App] Forced update pending, skipping announcement check');
          return;
        }

        const ann = await AnnouncementService.getAnnouncementToDisplay();
        if (ann && mounted) {
          setAnnouncement(ann);
          setShowAnnouncement(true);
          console.log('[App] Showing announcement:', ann.id);
        }
      } catch (e) {
        console.error('[App] Announcement check failed:', e);
      }
    };

    checkForAnnouncements();

    return () => { mounted = false; };

  }, []);

  // Initialize the notification CHANNELS/plumbing at startup (item 1: this does
  // NOT request the OS permission — creating Android channels and internal state
  // is safe pre-permission and must happen regardless).
  React.useEffect(() => {
    (async () => {
      try {
        await initializeNotifications();
      } catch (e) {
        console.error('[App] Notification initialization failed', e);
      }
    })();
  }, []);

  // ==========================================
  // Item 1: Delay the iOS notification permission prompt.
  // ==========================================
  // iOS enforces a ONE-SHOT permission prompt — if the user taps "Don't Allow"
  // once, we can never ask again without them going to Settings manually. So we
  // must not ask on cold open (a stranger asking a favor before we've done
  // anything for them). Instead we ask only once the user has a genuine reason
  // to say yes: either their first recite session has ended, or they've been
  // through (or skipped) the first-session goal prompt — whichever comes first.
  // `notificationPermissionRequested` guards this to fire exactly once ever.
  React.useEffect(() => {
    if (notificationPermissionRequested) return;
    if (!hasCompletedFirstReciteSession) return;

    (async () => {
      try {
        setNotificationPermissionRequested(true); // set first: never re-prompt even on failure
        const granted = await requestNotificationPermissions();
        if (!granted) {
          console.log('[App] Notification permissions not granted');
        }
        // Fasting notification service needs the same OS permission; initialize
        // it right after so it's ready as soon as the user enables a reminder.
        await FastingNotificationService.initialize();
      } catch (e) {
        console.error('[App] Delayed notification permission request failed', e);
      }
    })();
  }, [notificationPermissionRequested, hasCompletedFirstReciteSession]);

  React.useEffect(() => {
    // Kick off probe shortly after mount (non-blocking)
    const t = setTimeout(() => {
      runTurboModuleProbe().catch(e => console.log('[probe] unexpected failure', e));
    }, 500); // allow initial bridge setup
    return () => clearTimeout(t);
  }, []);

  // Initialize Firebase Cloud Messaging for push notifications
  const notificationsEnabled = useSettingsStore(s => s.notificationsEnabled);

  React.useEffect(() => {
    // Initialize immediately (no delay) to ensure subscriptions persist
    console.log('[_layout] Initializing push notifications...');
    console.log('[_layout] Daily Reminders (Fasting):', notificationsEnabled ? 'ENABLED' : 'DISABLED');
    console.log('[_layout] Daily Ayah:', ayahEnabled ? 'ENABLED' : 'DISABLED');

    PushNotificationService.initialize()
      .then(() => {
        console.log('[_layout] Push service initialized, syncing subscriptions...');
        // Item 4: suppress non-essential push topics for the first 7 days after
        // install, except the specific reminder the user explicitly opted into
        // from the first-session goal prompt.
        const fastingAllowed = isNotificationTypeAllowedDuringSuppression('fasting');
        const ayahAllowed = isNotificationTypeAllowedDuringSuppression('daily_ayah');
        if (!fastingAllowed || !ayahAllowed) {
          console.log('[_layout] Item 4: suppressing non-opted-in push topics during first-week window', { fastingAllowed, ayahAllowed });
        }
        // Use 'notificationsEnabled' for Fasting (as general daily reminder)
        PushNotificationService.syncFastingSubscription(notificationsEnabled && fastingAllowed);
        // Use 'ayahEnabled' for Daily Ayah
        PushNotificationService.syncAyahSubscription((ayahEnabled ?? false) && ayahAllowed);
        console.log('[_layout] ✅ Subscription sync complete');
      })
      .catch(e =>
        console.error('[_layout] ❌ Initialization failed:', e)
      );
  }, [notificationsEnabled, ayahEnabled]);

  // Sync enhanced notification settings
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Daily Ayah is handled via Push Notifications (FCM). 
        // Local scheduling was removed to prevent duplicates. We cancel any existing local ones here.
        await AyahNotificationService.cancelDailyReminder();


        // Daily Verse Reminder — item 4: suppressed for the first 7 days unless
        // this is the exact reminder type the user opted into on first session.
        if (notificationSettings?.dailyVerseReminder && isNotificationTypeAllowedDuringSuppression('daily_verse_reminder')) {
          await EnhancedNotificationService.scheduleDailyVerseReminder();
        } else {
          await EnhancedNotificationService.cancelDailyVerseReminder();
        }

        // Weekly Surahs Reminder — same item 4 suppression rule.
        if (notificationSettings?.weeklySurahsReminder && isNotificationTypeAllowedDuringSuppression('weekly_surah_reminder')) {
          await EnhancedNotificationService.scheduleWeeklySurahReminder();
        } else {
          await EnhancedNotificationService.cancelWeeklySurahReminder();
        }

        // Hifdh Planner - check for overdue items (placeholder logic)
        if (notificationSettings?.hifdhPlannerReminder) {
          // In a real implementation, you would check for overdue items from your store
          // For now, we just log that the feature is enabled
          console.log('[NotificationSync] Hifdh planner reminder enabled');
        }
      } catch (e) {
        console.log('[NotificationSync] error', e);
      }
    })();
    return () => { active = false; };
  }, [notificationSettings, reminderTime]);

  // Sync revision reminder settings (surah-level)
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Item 4: suppressed for the first 7 days post-install, same as the other
        // non-essential reminder types.
        if (revisionReminderSettings.enabled && isNotificationTypeAllowedDuringSuppression('revision_reminder')) {
          console.log('[RevisionReminder] Scheduling daily surah revision check at 9 PM');
          await RevisionReminderService.scheduleDailyRevisionCheck();
          // Also check immediately on app startup if enabled
          await RevisionReminderService.checkAndNotifyRevisionNeeded(revisionReminderSettings.daysThreshold);
        } else {
          console.log('[RevisionReminder] Disabled or suppressed - cancelling reminders');
          await RevisionReminderService.cancelRevisionReminders();
        }
      } catch (e) {
        console.log('[RevisionReminder] sync error', e);
      }
    })();
    return () => { active = false; };
  }, [revisionReminderSettings]);

  // Set up global badge celebration callback
  React.useEffect(() => {
    const handleBadgeCelebration = (badge: Badge, isHafidh: boolean) => {
      console.log('[RootLayout] Badge unlocked globally:', badge.name, 'isHafidh:', isHafidh);

      const celebType = isHafidh ? 'hafidh-badge' : 'badge-unlocked';

      // Use setTimeout to ensure it triggers after any state updates
      setTimeout(() => {
        showCelebration(celebType, undefined, badge.name);
        // If this is the user's first unlocked badge, consider showing the soft review prompt
        try {
          const unlocked = useBadgeStore.getState().getUnlockedBadges();
          if (unlocked && unlocked.length === 1) {
            (async () => {
              try {
                const ok = await canPromptNative();
                if (ok) setShowReviewSoftPrompt(true);
              } catch (e) {
                console.log('[review] first-badge prompt failed', e);
              }
            })();
          }
        } catch (e) {
          console.log('[review] error checking first badge', e);
        }
      }, 100);
    };

    setBadgeCelebrationCallback(handleBadgeCelebration);

    return () => {
      setBadgeCelebrationCallback(null);
    };
  }, [setBadgeCelebrationCallback, showCelebration]);

  // Version gate: prompt update if current version is lower than minimum supported
  React.useEffect(() => {
    try {
      const { version } = getCurrentVersion();
      setCurrentVersion(version);
      try { setLastSeenVersion && setLastSeenVersion(version); } catch { }
      console.log('[version] Current version:', version, 'MIN:', MIN_SUPPORTED_VERSION, 'LATEST:', LATEST_VERSION);

      // Initial local check (fast fallback before remote arrives)
      const mustUpdateLocal = isVersionLower(version, MIN_SUPPORTED_VERSION);
      const softUpdateLocal = !mustUpdateLocal && isVersionLower(version, LATEST_VERSION);

      console.log('[version] Local check - mustUpdate:', mustUpdateLocal, 'softUpdate:', softUpdateLocal);

      if (mustUpdateLocal || softUpdateLocal) {
        setForcedUpdate(mustUpdateLocal);
        setLatestVersion(LATEST_VERSION);
        setShowUpdatePrompt(true);
      }

      // Remote override
      (async () => {
        const remote = await fetchRemoteVersionConfig(false) || await getEffectiveVersionConfig();
        console.log('[version] Remote config:', remote);
        applyRemoteVersion(remote, version);
      })();
    } catch (e) {
      console.log('[version] check failed', e);
    }
  }, []);

  // Re-check on foreground if remote changed (cache TTL handled in util)
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        try {
          const { version } = getCurrentVersion();
          const remote = await fetchRemoteVersionConfig(false) || await getEffectiveVersionConfig();
          applyRemoteVersion(remote, version);
        } catch (e) {
          console.log('[version] foreground check failed', e);
        }
      }
    });
    return () => { try { sub.remove(); } catch { } };
  }, []);

  const lastDismissedVersion = useSettingsStore(s => s.lastDismissedVersion);
  const setLastDismissedVersion = useSettingsStore(s => s.setLastDismissedVersion);

  const applyRemoteVersion = React.useCallback((remote: RemoteVersionConfig, version: string) => {
    try {
      console.log('[version] Applying remote - current:', version, 'min:', remote.min_supported, 'latest:', remote.latest, 'force:', remote.force);

      const latest = remote.latest || LATEST_VERSION;
      setLatestVersion(latest);
      setReleaseNotes(remote.release_notes);
      setIosAppIdOverride(remote.ios_app_id_override ?? null);
      setAndroidPkgOverride(remote.android_package_id_override ?? null);

      // If user's last seen version already matches the remote latest, assume they updated and suppress the prompt
      if (lastSeenVersion && lastSeenVersion === latest) {
        console.log('[version] lastSeenVersion matches latest; suppressing update prompt');
        setShowUpdatePrompt(false);
        return;
      }

      const isUpdate = isVersionLower(version, latest);
      const isForce = !!remote.force;

      // Critical update: Current < Min Supported
      const isCritical = isVersionLower(version, remote.min_supported || MIN_SUPPORTED_VERSION);

      // Show announcement only if explicitly intended for non-update cases (disabled for now to avoid redundant popups on latest version)
      const isAnnouncement = false;

      console.log('[version] Check:', { isUpdate, isCritical, isAnnouncement, lastSeen: lastSeenVersion, latest });

      if (isCritical) {
        setForcedUpdate(true);
        setShowUpdatePrompt(true);
      } else if (isUpdate) {
        // Only show soft prompt if not dismissed for this specific version
        if (lastDismissedVersion !== latest) {
          setForcedUpdate(isForce);
          setShowUpdatePrompt(true);
        } else {
          setShowUpdatePrompt(false);
        }
      } else if (isAnnouncement) {
        // Special case: Billboard/Announcement for latest version users
        // Only show once per version
        if (lastDismissedVersion !== latest) {
          setForcedUpdate(false); // Announcements are not 'forced' updates
          setShowUpdatePrompt(true);
        } else {
          setShowUpdatePrompt(false);
        }
      } else {
        // No update available and no announcement intended for latest version users
        setShowUpdatePrompt(false);
      }
    } catch (e) {
      console.log('[version] apply remote failed', e);
    }
  }, [lastDismissedVersion, lastSeenVersion]);

  // Guard to prevent double navigation (e.g. foreground tap + getInitialNotification both firing).
  const navHandledRef = React.useRef(false);

  // Handle notification interactions (Deep Linking)
  const handleNotificationInteraction = React.useCallback((data: any, source?: string) => {
    if (!data) return;

    // Deduplicate: if we already navigated for this launch, skip.
    if (navHandledRef.current) {
      console.log('[NotificationInteraction] Already handled, skipping duplicate from:', source);
      return;
    }
    navHandledRef.current = true;
    // Reset after 2s so live foreground taps still work.
    setTimeout(() => { navHandledRef.current = false; }, 2000);

    console.log('[NotificationInteraction] Handling from:', source, 'data:', data);

    // ANALYTICS: notification_open (P3)
    try {
      logAnalyticsEvent('notification_open', {
        notification_type: data.type || 'unknown',
        target_screen: data.target || (data.type?.includes('ayah') ? 'home' : 'read'),
        surah_number: data.surahId || 0,
      });
    } catch { /* analytics must never crash */ }

    // Navigate — use replace only; do NOT fall through to push on error
    // (try/catch fallback was causing double navigation which hung the app).
    try {
      switch (data.type) {
        case 'daily_ayah':
        case 'daily-ayah': {
          if (data.target === 'index' || data.highlightAyah) {
            const surahId = data.surahId || getTodayCardVerse(new Date()).surahId;
            const verseId = data.verseNumber || getTodayCardVerse(new Date()).verseNumber;
            router.replace(`/(tabs)?highlightAyah=1&surahId=${surahId}&verseId=${verseId}` as any);
          } else {
            const today = getTodayCardVerse(new Date());
            router.replace(`/(tabs)/read?surahId=${today.surahId}&verseId=${today.verseNumber}` as any);
          }
          break;
        }
        case 'fasting_reminder':
          router.replace('/moon-phases' as any);
          break;
        case 'announcement':
        case 'greeting':
        case 'promotion':
        case 'update':
          router.replace('/(tabs)' as any);
          break;
        case 'daily-verse-reminder':
          router.replace('/(tabs)/read' as any);
          break;
        case 'weekly-surah-reminder':
          router.replace('/(tabs)/stats' as any);
          break;
        case 'hifdh-overdue':
          router.replace('/(tabs)' as any);
          break;
        case 'revision-needed':
          router.replace('/(tabs)/stats' as any);
          break;
        default:
          console.log('[NotificationInteraction] Unknown type:', data.type);
          // Navigate to home on unknown type rather than hang
          router.replace('/(tabs)' as any);
      }
    } catch (navError) {
      console.warn('[NotificationInteraction] Navigation failed:', navError);
      // Reset guard so a manual retry still works
      navHandledRef.current = false;
    }
  }, []);

  // Notifee Foreground Event Listener (handles taps while app is in foreground).
  // Only ONE listener is registered here. The module-level onBackgroundEvent handles
  // backgrounded/killed state. Do NOT register onForegroundEvent inside NotificationService.ts.
  React.useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      console.log('[Notifee] Foreground event:', EventType[type]);
      if (type === EventType.PRESS) {
        handleNotificationInteraction(detail.notification?.data, 'foreground');
      }
    });
    return () => {
      // Always unsubscribe on unmount to prevent stale listeners stacking up.
      try { unsubscribe(); } catch (e) { /* ignore */ }
    };
  // handleNotificationInteraction is stable (empty deps useCallback), so this is safe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cold Start / Background-kill Handling (app opened by tapping a notification).
  // Run ONCE on mount only. getInitialNotification() returns the tapped notification
  // when the app was killed or in the background (the module-level onBackgroundEvent
  // cannot navigate directly, so we pick up the intent here).
  React.useEffect(() => {
    (async () => {
      try {
        const initialNotification = await notifee.getInitialNotification();
        if (initialNotification) {
          console.log('[NotificationColdStart] App opened from notification:', initialNotification.notification?.id);
          // Small delay to ensure the router is mounted and ready before navigating.
          setTimeout(() => {
            handleNotificationInteraction(
              initialNotification.notification?.data,
              'cold-start'
            );
          }, 300);
        }
      } catch (e) {
        console.log('[NotificationColdStart] Failed:', e);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty - run once on mount only

  // Item 4: make sure installedAt is set as early as possible for a fresh
  // install (store migration also backfills this on rehydrate; this is a
  // harmless redundant safety net — ensureInstalledAt no-ops if already set).
  React.useEffect(() => {
    useSettingsStore.getState().ensureInstalledAt();
  }, []);

  // Persistence guard and DB lifecycle management
  React.useEffect(() => {
    // Initialize guard to snapshot and monitor critical persisted stores
    initPersistenceGuard();

    // Ensure DB is initialized once app is ready (native only)
    if (Platform.OS !== 'web') {
      initDatabase().catch(e => console.log('[db] init failed', e));
    }

    const onStateChange = async (next: AppStateStatus) => {
      try {
        if (Platform.OS === 'web') return;
        if (next === 'active') {
          await initDatabase();
          await runIntegrityCheck('[foreground]');
          await logBasicStats('[foreground]');

          // ANALYTICS: App foregrounded
          logAnalyticsEvent('app_foregrounded');
        } else if (next === 'background') {
          // ANALYTICS: App backgrounded
          logAnalyticsEvent('app_backgrounded');
        }
      } catch (e) {
        console.log('[db] lifecycle handler error', e);
      }
    };
    const sub = AppState.addEventListener('change', onStateChange);
    return () => { try { sub.remove(); } catch { } };
  }, []);

  // ==========================================
  // ANALYTICS: Screen View Tracking
  // Expo Router exposes its NavigationContainer ref via useNavigationContainerRef.
  // We mirror the NavigationContainer onStateChange pattern from the Firebase docs,
  // ==========================================
  // Analytics: Automatic Screen Tracking
  // ==========================================
  React.useEffect(() => {
    if (pathname) {
      const screenName = getScreenNameFromPath(pathname);
      logScreenView(screenName).catch(() => {});
    }
  }, [pathname]);

  React.useEffect(() => {
    // Manually track the initial screen to ensure the SDK is aware of the 
    // correct context immediately on startup.
    logScreenView('home').catch(() => {});
  }, []);

  try {
    if (!fontsLoaded && !forceContinue) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={{ marginTop: 12, color: '#fff', fontFamily: 'ScheherazadeNew-Regular', fontSize: 16 }}>Loading…</Text>
          {fontError ? (
            <Text style={{ marginTop: 8, color: '#f87171', fontSize: 12, fontFamily: 'ScheherazadeNew-Regular', paddingHorizontal: 20, textAlign: 'center' }}>
              Font error: {fontError.message}
            </Text>
          ) : null}
        </View>
      );
    }
  } catch (e) {
    console.log('[render-protect] caught error during font gate render', e);
  }

  return (
    <SafeAreaProvider>
      <RootErrorBoundary>
        <FastingCalendarProvider>
          <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
            <AutoRotateBanner />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen 
                name="read-mode" 
                options={{ 
                  presentation: 'fullScreenModal',
                  animation: 'fade',
                  headerShown: false 
                }} 
              />
            </Stack>
            <UpdateModal
              // Prioritize forced updates over announcements
              visible={showUpdatePrompt && (forcedUpdate || !showAnnouncement)}
              forced={forcedUpdate}
              currentVersion={currentVersion}
              latestVersion={latestVersion}
              mode={forceShowUpdateModalMode}
              onClose={() => {
                if (latestVersion) {
                  setLastDismissedVersion(latestVersion);
                }
                setShowUpdatePrompt(false);
                // Delay mode reset to avoid flickering during fade-out
                setTimeout(() => {
                  setForceShowUpdateModalMode('whats_new');
                }, 500);
              }}
              releaseNotes={releaseNotes}
              iosAppIdOverride={iosAppIdOverride}
              androidPackageIdOverride={androidPkgOverride}
            />
            <AnnouncementModal
              // Only show announcements if there is no forced update currently showing
              visible={showAnnouncement && !forcedUpdate}
              announcement={announcement}
              onClose={async () => {
                if (announcement) await AnnouncementService.markAsSeen(announcement.id);
                setShowAnnouncement(false);
                setAnnouncement(null);
              }}
            />
            <CelebrationModal
              visible={celebrationVisible}
              type={celebrationType}
              customMessage={customMessage}
              badgeName={badgeName}
              onComplete={() => {
                hideCelebration();
                if (celebrationType === 'badge-unlocked' || badgeName) {
                  // After celebration, check if we should show the review prompt
                  setTimeout(() => {
                    if (shouldShowReviewPrompt(reviewPromptState, reviewPromptSessionShown)) {
                      queueSadaqahPrompt('badge_unlocked');
                    }
                  }, 1500);
                }
              }}
            />
            <ReviewSoftPrompt visible={showReviewSoftPrompt} onClose={() => setShowReviewSoftPrompt(false)} />
            <FirstSessionGoalPrompt
              visible={showFirstSessionGoalPrompt}
              onClose={(goalVerses, wantsReminder) => {
                setShowFirstSessionGoalPrompt(false);
                clearFirstSessionGoalPrompt();

                if (goalVerses !== null) {
                  setDailyGoalVerses(goalVerses);
                }

                if (wantsReminder) {
                  // This is the ONE reminder type allowed through the item-4
                  // 7-day suppression window, since the user explicitly asked for it.
                  setFirstSessionOptedInReminderType('daily_verse_reminder');
                  try {
                    useSettingsStore.getState().setNotificationSetting('dailyVerseReminder', true);
                  } catch (e) {
                    console.log('[FirstSessionGoalPrompt] Failed to enable daily verse reminder setting', e);
                  }
                }

                // Item 1: this is the "genuine reason to say yes" moment — the
                // permission-request effect above fires now that
                // hasCompletedFirstReciteSession is true.
              }}
            />
            <SadaqahPrompt
              visible={sadaqahPromptVisible}
              trigger={sadaqahPromptTrigger || 'first_quiz'}
              onOutcome={async (outcome, neverAskAgain) => {
                closeSadaqahPrompt();
                setReviewPromptSessionShown(true);

                // Item 10: two-path pre-gate.
                //   thumbs up   → native review flow (Apple/Play).
                //   thumbs down → in-app feedback screen. The native review
                //     dialog is NEVER invoked on this path — Apple prohibits
                //     gating their own prompt this way, but choosing whether
                //     to invoke it at all based on sentiment is allowed.
                if (outcome === 'up') {
                  setReviewPromptState({ hasRated: true });
                  await openReview();
                } else if (outcome === 'down') {
                  // Not "hasRated" — they may still rate later once things
                  // improve. Just avoid re-prompting again this session.
                  setReviewPromptState({
                    lastShownAt: Date.now(),
                    lastDismissedAt: Date.now(),
                    shownCount: (reviewPromptState.shownCount || 0) + 1,
                  });
                  router.push('/feedback' as any);
                } else {
                  // dismissed without picking a sentiment
                  if (neverAskAgain) {
                    setReviewPromptState({ hasRated: true }); // treat "never ask again" as hasRated so we don't ask
                  } else {
                    setReviewPromptState({
                      lastShownAt: Date.now(),
                      lastDismissedAt: Date.now(),
                      shownCount: (reviewPromptState.shownCount || 0) + 1
                    });
                  }
                }
              }}
            />
          </View>
        </FastingCalendarProvider>
      </RootErrorBoundary>
    </SafeAreaProvider>
  );
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Main export wraps everything in the CelebrationProvider and GestureHandlerRootView
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CelebrationProvider>
        <RootLayoutContent />
      </CelebrationProvider>
    </GestureHandlerRootView>
  );
}