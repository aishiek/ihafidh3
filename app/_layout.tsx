import { initDatabase, logBasicStats, runIntegrityCheck } from '@/assets/database/QuranDatabase';
import CelebrationModal from '@/components/CelebrationModal';
import { FastingCalendarProvider } from '@/components/fasting/context/FastingCalendarContext';
import UpdateModal from '@/components/UpdateModal';
import { LATEST_VERSION, MIN_SUPPORTED_VERSION } from '@/constants/appConfig';
import { CelebrationProvider, useCelebration } from '@/contexts/CelebrationContext';
import { FastingNotificationService } from '@/services/fasting/notificationService';
import { AyahNotificationService, EnhancedNotificationService, RevisionReminderService, initializeNotifications, requestNotificationPermissions } from '@/services/NotificationService';
import type { Badge } from '@/store/badgeStore';
import { useProgressStore } from '@/store/progressStore';
import { useSettingsStore } from '@/store/settingsStore';
import { initializeAudio } from '@/utils/audioUtils';
import { getTodayCardVerse } from '@/utils/ayahOfTheDay';
import { initGlobalErrorHandlers } from '@/utils/globalErrorHandlers';
import { fetchRemoteVersionConfig, getEffectiveVersionConfig, type RemoteVersionConfig } from '@/utils/remoteVersion';
import { runTurboModuleProbe } from '@/utils/turboModuleProbe';
import { getCurrentVersion, isVersionLower } from '@/utils/versionUtils';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
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

  const fontMap: Record<string, any> = {
    'ScheherazadeNew-Regular': require('../assets/fonts/ScheherazadeNew-Regular.ttf'),
    'ScheherazadeNew-Bold': require('../assets/fonts/ScheherazadeNew-Bold.ttf'),
    'NooreHuda-Regular': require('../assets/fonts/NooreHuda-Regular.ttf'),
    'NotoNaskhArabic-Regular': require('../assets/fonts/NotoNaskhArabic-Regular.ttf'),
  };
  if (amiriAsset) {
    fontMap['AmiriQuran-Regular'] = amiriAsset;
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
  const [currentVersion, setCurrentVersion] = React.useState<string>('0.0.0');
  const [latestVersion, setLatestVersion] = React.useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = React.useState<string[] | undefined>(undefined);
  const [iosAppIdOverride, setIosAppIdOverride] = React.useState<string | null>(null);
  const [androidPkgOverride, setAndroidPkgOverride] = React.useState<string | null>(null);
  const ayahEnabled = useSettingsStore(s => s.ayahDailyNotificationsEnabled ?? false);
  const reminderTime = useSettingsStore(s => s.reminderTime);
  const notificationSettings = useSettingsStore(s => s.notificationSettings);
  const revisionReminderSettings = useSettingsStore(s => s.revisionReminderSettings);
  
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

  // Sync daily Ayah notification schedule with settings
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (ayahEnabled) {
          await AyahNotificationService.scheduleDailyReminder(reminderTime || '09:00');
        } else {
          await AyahNotificationService.cancelDailyReminder();
        }
      } catch (e) {
        console.log('[AyahNotif] sync error', e);
      }
    })();
    return () => { active = false; };
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
    return () => { try { sub.remove(); } catch {} };
  }, []);

  const applyRemoteVersion = React.useCallback((remote: RemoteVersionConfig, version: string) => {
    try {
      console.log('[version] Applying remote - current:', version, 'min:', remote.min_supported, 'latest:', remote.latest, 'force:', remote.force);
      
      setLatestVersion(remote.latest || LATEST_VERSION);
      setReleaseNotes(remote.release_notes);
      setIosAppIdOverride(remote.ios_app_id_override ?? null);
      setAndroidPkgOverride(remote.android_package_id_override ?? null);
      
      const mustUpdate = isVersionLower(version, remote.min_supported || MIN_SUPPORTED_VERSION) || !!remote.force;
      const softUpdate = !mustUpdate && isVersionLower(version, remote.latest || LATEST_VERSION);
      
      console.log('[version] Remote check - mustUpdate:', mustUpdate, 'softUpdate:', softUpdate);
      
      // Only show modal if there's actually an update needed
      if (mustUpdate || softUpdate) {
        setForcedUpdate(mustUpdate);
        setShowUpdatePrompt(true);
      } else {
        // Hide modal when versions match
        setShowUpdatePrompt(false);
      }
    } catch (e) {
      console.log('[version] apply remote failed', e);
    }
  }, []);

  // Deep-link when user taps on a daily ayah notification
  React.useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data: any = response?.notification?.request?.content?.data || {};
        
        // Handle all notification types
        switch (data?.type) {
          case 'daily_ayah':
          case 'daily-ayah':
            const today = getTodayCardVerse(new Date());
            try { router.replace(`/(tabs)/read?surahId=${today.surahId}&verseId=${today.verseNumber}`); } catch { router.push(`/(tabs)/read?surahId=${today.surahId}&verseId=${today.verseNumber}`); }
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
            // User tapped on revision reminder - go to stats/revision page
            try { router.replace('/(tabs)/stats'); } catch { router.push('/(tabs)/stats'); }
            break;
          default:
            console.log('[NotificationDeepLink] Unknown type:', data?.type);
        }
      } catch (e) {
        console.log('[NotificationDeepLink] deep link failed', e);
      }
    });
    return () => { try { sub.remove(); } catch {} };
  }, []);

  // Background notification handler - executes when notifications fire (even if app is backgrounded)
  React.useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(async (notification) => {
      try {
        const data: any = notification?.request?.content?.data || {};
        
        // Handle revision check notification
        if (data?.type === 'revision-check' && data?.action === 'check-and-notify') {
          console.log('[RevisionReminder] Daily check triggered at 9 PM');
          
          // Get current threshold from settings
          const settings = useSettingsStore.getState();
          const daysThreshold = settings.revisionReminderSettings?.daysThreshold || 3;
          
          // Execute the actual check and send notification if needed
          await RevisionReminderService.checkAndNotifyRevisionNeeded(daysThreshold);
        }
      } catch (e) {
        console.error('[NotificationReceived] Handler failed:', e);
      }
    });
    
    return () => { try { subscription.remove(); } catch {} };
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
        }
      } catch (e) {
        console.log('[db] lifecycle handler error', e);
      }
    };
    const sub = AppState.addEventListener('change', onStateChange);
    return () => { try { sub.remove(); } catch {} };
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
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
            <UpdateModal
              visible={showUpdatePrompt}
              forced={forcedUpdate}
              currentVersion={currentVersion}
              latestVersion={latestVersion}
              onClose={() => setShowUpdatePrompt(false)}
              releaseNotes={releaseNotes}
              iosAppIdOverride={iosAppIdOverride}
              androidPackageIdOverride={androidPkgOverride}
            />
            <CelebrationModal
              visible={celebrationVisible}
              type={celebrationType}
              customMessage={customMessage}
              badgeName={badgeName}
              onComplete={hideCelebration}
            />
          </View>
        </FastingCalendarProvider>
      </RootErrorBoundary>
    </SafeAreaProvider>
  );
}

// Main export wraps everything in the CelebrationProvider
export default function RootLayout() {
  return (
    <CelebrationProvider>
      <RootLayoutContent />
    </CelebrationProvider>
  );
}