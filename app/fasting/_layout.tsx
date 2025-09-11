/**
 * Fasting Layout
 * Provides FastingCalendar context to all fasting-related screens
 */

import React from 'react';
import { Stack } from 'expo-router';
import { FastingCalendarProvider } from '@/components/fasting/context/FastingCalendarContext';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';

export default function FastingLayout() {
  const { theme } = useUnifiedTheme('auto');

  return (
    <FastingCalendarProvider>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerShadowVisible: false,
          headerBackTitleVisible: false,
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
    </FastingCalendarProvider>
  );
}
