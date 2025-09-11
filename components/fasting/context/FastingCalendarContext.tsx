/**
 * FastingCalendar Context
 * Integrated with iHafidh2's mixed state management system
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FastingCalendarState,
  FastingCalendarAction,
  FastingAppSettings,
  FastingLocation,
  FastingIntention,
  FastingType,
  FastingNotificationSettings,
  FastingContextType,
} from '@/types/fasting';
import { FastingApiService } from '@/services/fasting/apiService';
import { FastingCalendarService } from '@/services/fasting/calendarService';
import { FastingNotificationService } from '@/services/fasting/notificationService';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';

// Default notification settings
const getDefaultNotificationSettings = (): FastingNotificationSettings => ({
  enabled: true,
  defaultTime: '06:00',
  defaultBeforeDays: 1,
  fastingTypes: Object.values(FastingType).reduce((acc, type) => {
    if (type === FastingType.RAMADAN) return acc; // Skip RAMADAN as per requirements
    return {
      ...acc,
      [type]: {
        enabled: true,
        time: '06:00',
        beforeDays: 1
      }
    };
  }, {} as Record<FastingType, { enabled: boolean; time: string; beforeDays: number }>)
});

// Initial state
const initialState: FastingCalendarState = {
  settings: {
    theme: 'light',
    colorScheme: 'blue',
    location: {
      country: 'Saudi Arabia',
      city: 'Mecca'
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
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    
    try {
      const days = await FastingCalendarService.generateCalendarDays(
        month, 
        state.settings.location,
        state.settings.hijriAdjustment
      );
      
      dispatch({ type: 'SET_CALENDAR_DAYS', payload: days });
      
      // Schedule notifications if enabled
      if (state.settings.notifications?.enabled) {
        try {
          await FastingNotificationService.scheduleFastingReminders(days, {
            ...state.settings.notifications,
            // Ensure we have a valid fastingTypes object
            fastingTypes: {
              ...getDefaultNotificationSettings().fastingTypes,
              ...(state.settings.notifications.fastingTypes || {})
            }
          });
        } catch (error) {
          console.error('Error scheduling fasting notifications:', error);
        }
      }
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
            // If notifications were disabled, cancel all scheduled notifications
            await FastingNotificationService.cancelFastingNotifications();
          } else if (state.calendarDays.length > 0) {
            // If notifications are enabled and we have calendar data, reschedule notifications
            await FastingNotificationService.scheduleFastingReminders(
              state.calendarDays,
              newSettings.notifications
            );
          }
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
            notifications: {
              ...getDefaultNotificationSettings(),
              ...(parsedSettings.notifications || {}),
              fastingTypes: {
                ...getDefaultNotificationSettings().fastingTypes,
                ...(parsedSettings.notifications?.fastingTypes || {})
              }
            }
          };
          
          dispatch({ type: 'UPDATE_SETTINGS', payload: updatedSettings });
        }
      } catch (error) {
        console.error('Error loading fasting settings:', error);
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

  // Load calendar data when month changes
  useEffect(() => {
    loadCalendarData(state.currentMonth);
  }, [state.currentMonth, state.settings.location]);

  // Initialize notification service
  useEffect(() => {
    FastingNotificationService.initialize();
  }, []);

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
