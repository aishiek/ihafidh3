import * as Font from 'expo-font';
import { FastingCalendarProvider } from '@/components/fasting/context/FastingCalendarContext';
import { Stack } from 'expo-router';
import React, { Component, ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

let __fontsLoadedSingleton = false;
let __fontLoadPromise: Promise<void> | null = null;
async function loadAppFontsOnce() {
  if (__fontsLoadedSingleton) return;
  if (__fontLoadPromise) return __fontLoadPromise;
  __fontLoadPromise = (async () => {
    try {
      await Font.loadAsync({
        'ScheherazadeNew-Regular': require('../assets/fonts/ScheherazadeNew-Regular.ttf'),
        'ScheherazadeNew-Bold': require('../assets/fonts/ScheherazadeNew-Bold.ttf'),
        'NooreHuda-Regular': require('../assets/fonts/NooreHuda-Regular.ttf'),
      });
      __fontsLoadedSingleton = true;
      console.log('[fonts] Loaded (first time).');
    } catch (e: any) {
      const msg = String(e?.message || e);
      // iOS CTFontManagerError 104 often means already registered; treat as success
      if (/CTFontManagerError|already been registered|Font registration was unsuccessful/i.test(msg)) {
        console.warn('[fonts] Duplicate / benign registration issue, continuing:', msg);
        __fontsLoadedSingleton = true; // allow app to proceed
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