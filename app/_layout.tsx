import { FastingCalendarProvider } from '@/components/fasting/context/FastingCalendarContext';
import { useFonts } from 'expo-font';
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
          <Text style={{ color: 'white', fontSize: 16, marginBottom: 8 }}>Something went wrong.</Text>
          <Text style={{ color: '#f87171', fontSize: 12, paddingHorizontal: 16, textAlign: 'center' }}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Scheherazade': require('../assets/fonts/ScheherazadeNew-Regular.ttf'),
    'Scheherazade-Bold': require('../assets/fonts/ScheherazadeNew-Bold.ttf'),
    'NooreHuda': require('../assets/fonts/NooreHuda-Regular.ttf'),
  });

  // Log early to confirm JS bundle executed
  React.useEffect(() => {
    console.log('RootLayout mounted: fontsLoaded=', fontsLoaded);
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ marginTop: 12, color: '#fff' }}>Loading…</Text>
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