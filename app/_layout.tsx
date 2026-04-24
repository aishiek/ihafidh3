import { initDatabase, logBasicStats, runIntegrityCheck } from '@/assets/database/QuranDatabase';
import AnnouncementModal, { AnnouncementConfig } from '@/components/AnnouncementModal';
import AutoRotateBanner from '@/components/AutoRotateBanner';
import CelebrationModal from '@/components/CelebrationModal';
import { FastingCalendarProvider } from '@/components/fasting/context/FastingCalendarContext';
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
import { fetchRemoteVersionConfig, getEffectiveVersionConfig, type RemoteVersionConfig } from '@/utils/remoteVersion';
import { canPromptNative, trackAppOpenAndCheckTrigger, shouldShowReviewPrompt, openReview } from '@/utils/reviewPrompt';
import { runTurboModuleProbe } from '@/utils/turboModuleProbe';
import { getCurrentVersion, isVersionLower } from '@/utils/versionUtils';
import notifee, { EventType } from '@notifee/react-native';
import * as Font from 'expo-font';
import { CopilotProvider } from 'react-native-copilot';
import { Stack, router, usePathname } from 'expo-router';
import React, { Component, ReactNode } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initPersistenceGuard } from '../utils/persistenceGuard';

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

// Helper function to determine user memorization level
function getMemorizationLevel(verseCount: number): string {
  if (verseCount === 0) return 'beginner';
  if (verseCount < 100) return 'novice';
  if (verseCount < 500) return 'intermediate';
  if (verseCount < 2000) return 'advanced';
  if (verseCount < 6236) return 'expert';
  return 'hafidh'; // Completed full Quran
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
  const [currentVersion, setCurrentVersion] = React.useState('2.1.2');
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
  const triggerSadaqahPrompt = useSettingsStore(s => s.triggerSadaqahPrompt);
  const closeSadaqahPrompt = useSettingsStore(s => s.closeSadaqahPrompt);

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

  // Initialize unified notification system ONCE at app startup
  React.useEffect(() => {
    (async () => {
      try {
        await initializeNotifications();
        const granted = await requestNotificationPermissions();
        if (!granted) {
          console.log('[App] Notification permissions not granted');
        }

        // Initialize fasting notification service early
        // This ensures it's ready even if user enables notifications without opening calendar
        await FastingNotificationService.initialize();
      } catch (e) {
        console.error('[App] Notification initialization failed', e);
      }
    })();
  }, []);

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
        // Sync subscriptions based on current settings
        // Use 'notificationsEnabled' for Fasting (as general daily reminder)
        PushNotificationService.syncFastingSubscription(notificationsEnabled);
        // Use 'ayahEnabled' for Daily Ayah
        PushNotificationService.syncAyahSubscription(ayahEnabled ?? false);
        console.log('[_layout] ✅ Subscription sync complete');
      })
      .catch(e =>
        console.error('[_layout] ❌ Initialization failed:', e)
      );
  }, [notificationsEnabled, ayahEnabled]);

  // Sync daily Ayah notification schedule with settings
  React.useEffect(() => {
    let mounted = true;

    const doSchedule = async () => {
      try {
        if (!mounted) return;
        if (ayahEnabled) {
          // Schedule fresh content for the next occurrence
          await AyahNotificationService.scheduleDailyReminder(reminderTime || '09:00');
        } else {
          await AyahNotificationService.cancelDailyReminder();
        }
      } catch (e) {
        console.log('[AyahNotif] sync error', e);
      }
    };

    // Initial scheduling
    void doSchedule();

    // Reschedule fresh content whenever app becomes active
    const stateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void doSchedule();
    });

    return () => { mounted = false; try { stateSub.remove(); } catch { } };
  }, [ayahEnabled, reminderTime]);

  // Sync enhanced notification settings
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Daily Ayah (using the new notification settings)
        if (notificationSettings?.dailyAyah) {
          await AyahNotificationService.scheduleDailyReminder(reminderTime || '09:00');
        }

        // Daily Verse Reminder
        if (notificationSettings?.dailyVerseReminder) {
          await EnhancedNotificationService.scheduleDailyVerseReminder();
        } else {
          await EnhancedNotificationService.cancelDailyVerseReminder();
        }

        // Weekly Surahs Reminder
        if (notificationSettings?.weeklySurahsReminder) {
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
        if (revisionReminderSettings.enabled) {
          console.log('[RevisionReminder] Scheduling daily surah revision check at 9 PM');
          await RevisionReminderService.scheduleDailyRevisionCheck();
          // Also check immediately on app startup if enabled
          await RevisionReminderService.checkAndNotifyRevisionNeeded(revisionReminderSettings.daysThreshold);
        } else {
          console.log('[RevisionReminder] Disabled - cancelling reminders');
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
        // Force refresh to bypass stale cache (temporary fix for testing)
        const remote = await fetchRemoteVersionConfig(true) || await getEffectiveVersionConfig();
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

  // Handle notification interactions (Deep Linking)
  const handleNotificationInteraction = React.useCallback((data: any) => {
    if (!data) return;
    console.log('[NotificationInteraction] Handling:', data);

    // ANALYTICS: notification_open (P3)
    // Required: notification_type, surah_number (if applicable)
    try {
      const { logAnalyticsEvent } = require('@/utils/analyticsHelper');
      logAnalyticsEvent('notification_open', {
        notification_type: data.type || 'unknown',
        surah_number: data.surahId || 0,
      });
    } catch { /* analytics must never crash */ }

    switch (data.type) {
      case 'daily_ayah':
      case 'daily-ayah': {
        if (data.target === 'index' || data.highlightAyah) {
          const surahId = data.surahId || getTodayCardVerse(new Date()).surahId;
          const verseId = data.verseNumber || getTodayCardVerse(new Date()).verseNumber;
          const qs = `?highlightAyah=1&surahId=${surahId}&verseId=${verseId}`;
          try { router.replace(`/(tabs)/index${qs}`); } catch { router.push(`/(tabs)/index${qs}`); }
        } else {
          const today = getTodayCardVerse(new Date());
          try { router.replace(`/(tabs)/read?surahId=${today.surahId}&verseId=${today.verseNumber}`); } catch { router.push(`/(tabs)/read?surahId=${today.surahId}&verseId=${today.verseNumber}`); }
        }
        break;
      }
      case 'fasting_reminder':
        // Open fasting calendar when user taps fasting notification
        try { router.replace('/moon-phases'); } catch { router.push('/moon-phases'); }
        break;
      case 'announcement':
      case 'greeting':
      case 'promotion':
      case 'update':
        // Broadcast messages - open home screen
        try { router.replace('/(tabs)/index'); } catch { router.push('/(tabs)/index'); }
        break;
      case 'daily-verse-reminder':
        try { router.replace('/(tabs)/read'); } catch { router.push('/(tabs)/read'); }
        break;
      case 'weekly-surah-reminder':
        try { router.replace('/(tabs)/stats'); } catch { router.push('/(tabs)/stats'); }
        break;
      case 'hifdh-overdue':
        try { router.replace('/(tabs)/index'); } catch { router.push('/(tabs)/index'); }
        break;
      case 'revision-needed':
        try { router.replace('/(tabs)/stats'); } catch { router.push('/(tabs)/stats'); }
        break;
      default:
        console.log('[NotificationInteraction] Unknown type:', data.type);
    }
  }, []);

  // Notifee Foreground Event Listener (Handles taps on Notifee-displayed notifications)
  React.useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      console.log('[Notifee] Foreground event:', EventType[type], detail);

      if (type === EventType.PRESS) {
        handleNotificationInteraction(detail.notification?.data);
      }
    });
    return unsubscribe;
  }, [handleNotificationInteraction]);

  // Notifee Background Event Listener (Handles taps when app is backgrounded)
  // This is critical for handling taps on notifications displayed via Notifee in onMessage
  React.useEffect(() => {
    const unsubscribe = notifee.onBackgroundEvent(async ({ type, detail }) => {
      console.log('[Notifee] Background event:', EventType[type], detail);

      if (type === EventType.PRESS) {
        // Handle navigation - this will open the app
        handleNotificationInteraction(detail.notification?.data);
      }
    });
    return unsubscribe;
  }, [handleNotificationInteraction]);

  // Cold Start Handling (App opened from quit state via notification)
  React.useEffect(() => {
    (async () => {
      try {
        const initialNotification = await notifee.getInitialNotification();
        if (initialNotification) {
          console.log('[NotificationColdStart] App opened from notification:', initialNotification);
          handleNotificationInteraction(initialNotification.notification.data);
        }
      } catch (e) {
        console.log('[NotificationColdStart] Failed:', e);
      }
    })();
  }, [handleNotificationInteraction]);

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
  const pathname = usePathname();

  React.useEffect(() => {
    if (pathname) {
      const screenName = getScreenNameFromPath(pathname);
      logScreenView(screenName).catch(() => {});
    }
  }, [pathname]);

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
                      triggerSadaqahPrompt('badge_unlocked');
                    }
                  }, 1500);
                }
              }}
            />
            <ReviewSoftPrompt visible={showReviewSoftPrompt} onClose={() => setShowReviewSoftPrompt(false)} />
            <SadaqahPrompt
              visible={sadaqahPromptVisible}
              trigger={sadaqahPromptTrigger || 'first_quiz'}
              onClose={async (didRate, neverAskAgain) => {
                closeSadaqahPrompt();
                setReviewPromptSessionShown(true);
                
                if (didRate) {
                  logAnalyticsEvent('review_prompt_tapped', { trigger: sadaqahPromptTrigger });
                  setReviewPromptState({ hasRated: true });
                  await openReview();
                } else {
                  logAnalyticsEvent('review_prompt_dismissed', { trigger: sadaqahPromptTrigger });
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