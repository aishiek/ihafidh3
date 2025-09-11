import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useFonts } from 'expo-font';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Scheherazade': require('../assets/fonts/ScheherazadeNew-Regular.ttf'),
    'Scheherazade-Bold': require('../assets/fonts/ScheherazadeNew-Bold.ttf'),
    'NooreHuda': require('../assets/fonts/noorehuda Regular.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}