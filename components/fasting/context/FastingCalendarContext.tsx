/**
 * FastingCalendar Context
 * Integrated with iHafidh2's mixed state management system
 */

import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import { FastingCalendarService } from '@/services/fasting/calendarService';
import { FastingNotificationService } from '@/services/fasting/notificationService';
import {
  CalendarDay,
  FastingAppSettings,
  FastingCalendarAction,
  FastingCalendarState,
  FastingContextType,
  FastingIntention,
  FastingNotificationSettings,
  FastingType
} from '@/types/fasting';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { AppState } from 'react-native';

// Default notification settings
// Default reminder time: evening of the day before the fast (around Maghrib/Isha),
// so the user has time to make niyyah and prepare suhoor before Fajr.
// See services/fasting/notificationService.ts EVENING_FALLBACK_TIME for the
// matching fallback used when a user-configured time would land too late.
const getDefaultNotificationSettings = (): FastingNotificationSettings => ({
  enabled: true,
  defaultTime: '19:00',
  defaultBeforeDays: 1,
  fastingTypes: Object.values(FastingType).reduce((acc, type) => {
    // Include ALL fasting types now (Ramadan included) for notifications
    return {
      ...acc,
      [type]: {
        enabled: true,
        time: '19:00',
        beforeDays: 1
      }
    };
  }, {} as Record<FastingType, { enabled: boolean; time: string; beforeDays: number }>)
});

// Fills in any missing fastingTypes entries with defaults, so a partially-saved
// or older settings blob never leaves a type silently unconfigured.
const mergeNotificationSettings = (
  notifications?: Partial<FastingNotificationSettings>
): FastingNotificationSettings => {
  const defaults = getDefaultNotificationSettings();
  return {
    ...defaults,
    ...(notifications || {}),
    fastingTypes: {
      ...defaults.fastingTypes,
      ...(notifications?.fastingTypes || {})
    }
  };
};

// Initial state
const initialState: FastingCalendarState = {
  settings: {
    theme: 'light',
    colorScheme: 'blue',
    location: {
      country: 'Singapore',
      city: 'Singapore'
    },
    hijriAdjustment: 0,
    notifications: getDefaultNotificationSettings(),
    language: 'en'
  },
  currentMonth: new Date(),
  calendarDays: [],
  fastingIntentions: {},
  isLoading: false,
  error: null
};

// Reducer function
function fastingCalendarReducer(state: FastingCalendarState, action: FastingCalendarAction): FastingCalendarState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CALENDAR_DAYS':
      return { ...state, calendarDays: action.payload };
    case 'SET_CURRENT_MONTH':
      return { ...state, currentMonth: action.payload };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_FASTING_INTENTION':
      return {
        ...state,
        fastingIntentions: {
          ...state.fastingIntentions,
          [action.payload.date]: action.payload
        }
      };
    case 'LOAD_FASTING_INTENTIONS':
      return { ...state, fastingIntentions: action.payload };
    default:
      return state;
  }
}

// Context
const FastingCalendarContext = createContext<FastingContextType | null>(null);

// Provider component
export function FastingCalendarProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(fastingCalendarReducer, initialState);

  // True once persisted settings have been read from storage (or confirmed absent).
  // Gates the first notification schedule so it never runs against default settings
  // while the user's actual saved preferences are still loading.
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Initialize unified theme integration
  const unifiedTheme = useUnifiedTheme('auto');

  // Sync theme changes from unified theme to fasting context
  useEffect(() => {
    if (state.settings.theme !== unifiedTheme.themeMode ||
      state.settings.colorScheme !== unifiedTheme.colorScheme) {

      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: {
          theme: unifiedTheme.themeMode === 'system' ? 'light' : unifiedTheme.themeMode,
          colorScheme: unifiedTheme.colorScheme
        }
      });
    }
  }, [unifiedTheme.themeMode, unifiedTheme.colorScheme]);

  const loadCalendarData = async (month: Date) => {
    // NOTE: this only loads the days shown in the calendar UI. Device notification
    // scheduling is handled separately by scheduleUpcomingFastingNotifications, so
    // that browsing the calendar (past/future months) never touches, or wipes,
    // reminders that were already scheduled for other months. See that function
    // for why it's decoupled from whichever month happens to be on screen.
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const days = await FastingCalendarService.generateCalendarDays(
        month,
        state.settings.location,
        state.settings.hijriAdjustment
      );

      dispatch({ type: 'SET_CALENDAR_DAYS', payload: days });
    } catch (error) {
      console.error('Error loading fasting calendar data:', error);

      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        dispatch({ type: 'SET_ERROR', payload: 'API rate limit exceeded. Please try again in a few minutes.' });
      } else {
        dispatch({ type: 'SET_ERROR', payload: 'Error loading calendar data. Using offline mode.' });
      }

      // Generate fallback calendar with basic fasting days
      try {
        const fallbackDays = FastingCalendarService.generateFallbackCalendarDays(month);
        dispatch({ type: 'SET_CALENDAR_DAYS', payload: fallbackDays });
      } catch (fallbackError) {
        console.error('Error generating fallback calendar:', fallbackError);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Fetches a single month's days for notification purposes, falling back to the
  // offline generator (Monday/Thursday + Ayyamul Bidh only) if the Hijri API call fails,
  // so a network hiccup never means "no reminders" for that month.
  const fetchMonthDaysForNotifications = async (month: Date): Promise<CalendarDay[]> => {
    try {
      return await FastingCalendarService.generateCalendarDays(
        month,
        state.settings.location,
        state.settings.hijriAdjustment
      );
    } catch (error) {
      console.warn('[FastingNotifications] Falling back to offline calendar for', month.toDateString(), error);
      return FastingCalendarService.generateFallbackCalendarDays(month);
    }
  };

  // Refreshes device-scheduled fasting reminders for a rolling window (the real current
  // month + next month), independent of whatever month is currently displayed in the
  // calendar UI. Previously, notifications were (re)scheduled as a side effect of
  // loadCalendarData for whichever month the user had navigated to, which meant: (a)
  // browsing to a different month cancelled and replaced ALL scheduled fasting
  // notifications with just that month's days, silently wiping out any other month's
  // reminders, and (b) once the currently-displayed month passed, no further months
  // ever got scheduled unless the user happened to reopen the calendar screen. Driving
  // this off "today", not "state.currentMonth", fixes both.
  const scheduleUpcomingFastingNotifications = async (notificationSettings: FastingNotificationSettings) => {
    if (!notificationSettings?.enabled) {
      return;
    }

    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [thisMonthDays, nextMonthDays] = await Promise.all([
        fetchMonthDaysForNotifications(thisMonthStart),
        fetchMonthDaysForNotifications(nextMonthStart),
      ]);

      await FastingNotificationService.scheduleFastingReminders(
        [...thisMonthDays, ...nextMonthDays],
        mergeNotificationSettings(notificationSettings)
      );
    } catch (error) {
      console.error('Error scheduling fasting notifications:', error);
    }
  };

  const setFastingIntention = async (intention: FastingIntention) => {
    dispatch({ type: 'SET_FASTING_INTENTION', payload: intention });

    try {
      await AsyncStorage.setItem(
        `fasting_intention_${intention.date}`,
        JSON.stringify(intention)
      );
    } catch (error) {
      console.error('Error saving fasting intention:', error);
    }
  };

  const updateSettings = async (settings: Partial<FastingAppSettings>) => {
    const newSettings = { ...state.settings, ...settings };
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });

    try {
      await AsyncStorage.setItem('fasting_app_settings', JSON.stringify(newSettings));

      // Reschedule notifications if notification settings changed
      if (settings.notifications) {
        try {
          if (settings.notifications.enabled === false) {
            // If notifications were disabled, cancel all scheduled notifications immediately.
            await FastingNotificationService.cancelFastingNotifications();
          }
          // If notifications are (still) enabled, the settings-change effect below
          // (driven by state.settings.notifications) picks up the new settings and
          // reschedules the full rolling window automatically — no need to duplicate
          // that call here, and doing so against state.calendarDays would only cover
          // whichever month happens to be on screen.
        } catch (error) {
          console.error('Error updating fasting notifications:', error);
        }
      }

      // Sync theme changes to unified theme if they came from fasting settings
      if (settings.theme || settings.colorScheme) {
        console.log('🔄 Syncing fasting theme changes to unified theme');
        if (settings.theme && unifiedTheme.themeMode !== settings.theme) {
          unifiedTheme.setTheme(settings.theme);
        }
        if (settings.colorScheme && unifiedTheme.colorScheme !== settings.colorScheme) {
          unifiedTheme.setColorScheme(settings.colorScheme);
        }
      }
    } catch (error) {
      console.error('Error saving fasting settings:', error);
    }
  };

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await AsyncStorage.getItem('fasting_app_settings');
        if (settings) {
          const parsedSettings = JSON.parse(settings);

          // Ensure notification settings are properly initialized
          const updatedSettings = {
            ...parsedSettings,
            notifications: mergeNotificationSettings(parsedSettings.notifications)
          };

          dispatch({ type: 'UPDATE_SETTINGS', payload: updatedSettings });
        }
      } catch (error) {
        console.error('Error loading fasting settings:', error);
      } finally {
        // Mark settings as loaded whether or not saved settings existed, so the
        // notification-scheduling effect (which waits on this) always proceeds —
        // it just proceeds with defaults if nothing was saved.
        setSettingsLoaded(true);
      }
    };

    const loadFastingIntentions = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const intentionKeys = keys.filter(key => key.startsWith('fasting_intention_'));
        const intentions: Record<string, FastingIntention> = {};

        for (const key of intentionKeys) {
          const intentionData = await AsyncStorage.getItem(key);
          if (intentionData) {
            const intention = JSON.parse(intentionData);
            intentions[intention.date] = intention;
          }
        }

        dispatch({ type: 'LOAD_FASTING_INTENTIONS', payload: intentions });
      } catch (error) {
        console.error('Error loading fasting intentions:', error);
      }
    };

    loadSettings();
    loadFastingIntentions();
  }, []);

  // Load calendar data (display only) when month, location, or hijri adjustment changes
  useEffect(() => {
    console.log('📅 Calendar reload triggered - Hijri Adjustment:', state.settings.hijriAdjustment);
    loadCalendarData(state.currentMonth);
  }, [state.currentMonth, state.settings.location, state.settings.hijriAdjustment]);

  // Initialize notification service
  useEffect(() => {
    FastingNotificationService.initialize();
  }, []);

  // Refresh the rolling notification window once settings have loaded, and again
  // whenever location, Hijri adjustment, or notification settings change. This is the
  // single source of truth for (re)scheduling fasting reminders — deliberately not
  // tied to state.currentMonth (see scheduleUpcomingFastingNotifications above).
  useEffect(() => {
    if (!settingsLoaded) return;
    scheduleUpcomingFastingNotifications(state.settings.notifications);
  }, [settingsLoaded, state.settings.location, state.settings.hijriAdjustment, state.settings.notifications]);

  // Re-check on app foreground so the rolling window stays current even across a long
  // background stint, without requiring the user to reopen the Fasting Calendar screen.
  useEffect(() => {
    if (!settingsLoaded) return;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        scheduleUpcomingFastingNotifications(state.settings.notifications);
      }
    });
    return () => { try { sub.remove(); } catch { } };
  }, [settingsLoaded, state.settings.location, state.settings.hijriAdjustment, state.settings.notifications]);

  const contextValue: FastingContextType = {
    state,
    dispatch,
    loadCalendarData,
    setFastingIntention,
    updateSettings,
  };

  return (
    <FastingCalendarContext.Provider value={contextValue}>
      {children}
    </FastingCalendarContext.Provider>
  );
}

// Hook to use the fasting calendar context
export function useFastingCalendar(): FastingContextType {
  const context = useContext(FastingCalendarContext);
  if (!context) {
    throw new Error('useFastingCalendar must be used within a FastingCalendarProvider');
  }
  return context;
}

// Hook to get fasting context for mixed state management
export function useFastingContext() {
  const context = useContext(FastingCalendarContext);
  return context; // Can be null if not within provider
}

// Export context for bridge integration
export { FastingCalendarContext };
