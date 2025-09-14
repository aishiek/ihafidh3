// Fasting layout now assumes provider is mounted at root level

import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { Stack } from 'expo-router';
import React from 'react';

export default function FastingLayout() {
  const { theme } = useUnifiedTheme('auto');

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: 'bold' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="calendar"
        options={{
          title: 'Fasting Calendar',
          headerShown: false, // We'll use custom header in the screen
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Fasting Settings',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="intentions"
        options={{
          title: 'Fasting Intentions',
        }}
      />
    </Stack>
  );
}
