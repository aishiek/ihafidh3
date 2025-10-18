import { initDatabase, logBasicStats, runIntegrityCheck } from '@/assets/database/QuranDatabase';
import { FastingCalendarProvider } from '@/components/fasting/context/FastingCalendarContext';
import { AyahNotificationService } from '@/services/ayahNotificationService';
import { useSettingsStore } from '@/store/settingsStore';
import { initializeAudio } from '@/utils/audioUtils';
import { getTodayCardVerse } from '@/utils/ayahOfTheDay';
import { initGlobalErrorHandlers } from '@/utils/globalErrorHandlers';
import { runTurboModuleProbe } from '@/utils/turboModuleProbe';
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
declare global { // eslint-disable-next-line no-var
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
    'UthmanTaha-Ver10': require('../assets/fonts/UthmanTaha-Ver10.otf'),
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

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = React.useState(false);
  const [fontError, setFontError] = React.useState<Error | null>(null);
  const [forceContinue, setForceContinue] = React.useState(false);
  const ayahEnabled = useSettingsStore(s => s.ayahDailyNotificationsEnabled ?? false);
  const reminderTime = useSettingsStore(s => s.reminderTime);

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
          await AyahNotificationService.scheduleDailyAyahReminder(reminderTime || '09:00');
        } else {
          await AyahNotificationService.cancelDailyAyahReminder();
        }
      } catch (e) {
        console.log('[AyahNotif] sync error', e);
      }
    })();
    return () => { active = false; };
  }, [ayahEnabled, reminderTime]);

  // Deep-link when user taps on a daily ayah notification
  React.useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data: any = response?.notification?.request?.content?.data || {};
        if (data?.type === 'daily_ayah') {
          const today = getTodayCardVerse(new Date());
          router.push(`/(tabs)/read?surahId=${today.surahId}&verseId=${today.verseNumber}`);
        }
      } catch (e) {
        console.log('[AyahNotif] deep link failed', e);
      }
    });
    return () => { try { sub.remove(); } catch {} };
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
          </View>
        </FastingCalendarProvider>
      </RootErrorBoundary>
    </SafeAreaProvider>
  );
}