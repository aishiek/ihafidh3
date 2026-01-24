import { useSettingsStore } from '@/store/settingsStore';
import { useThemeStore } from '@/store/themeStore';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

// Unified theme interface that combines both systems
export interface UnifiedThemeColors {
  // Core colors (from both systems)
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
    tint: string; // Added tint property
  
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  inactive: string;
  
  // UI elements
  border: string;
  borderLight: string;
  divider: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // App-specific colors (iHafidh2)
  memorized: string;
  inProgress: string;
  notStarted: string;
}

export type ThemeSource = 'zustand' | 'context' | 'auto';
export type ColorScheme = 'blue' | 'green' | 'purple' | 'orange';
export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextData {
  theme: UnifiedThemeColors;
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  setThemeMode?: (mode: ThemeMode) => void;
  setColorScheme?: (scheme: ColorScheme) => void;
  isDark: boolean;
}

interface UnifiedThemeHook {
  theme: UnifiedThemeColors;
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  raw: {
    zustand: ReturnType<typeof useThemeStore> & ReturnType<typeof useSettingsStore>;
    context?: ThemeContextData;
  };
}

// FastingCalendar theme context type (matching AppContext structure)
interface FastingThemeContextType {
  state: {
    settings: {
      theme: 'light' | 'dark';
      colorScheme: 'blue' | 'green' | 'purple' | 'orange';
    };
  };
  updateSettings: (settings: any) => Promise<void>;
}

// Color scheme mappings for both systems
const COLOR_SCHEMES = {
  blue: {
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#42A5F5',
    secondary: '#03DAC6',
    accent: '#FF4081',
  },
  green: {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    primaryLight: '#66BB6A',
    secondary: '#8BC34A',
    accent: '#FF9800',
  },
  purple: {
    primary: '#9C27B0',
    primaryDark: '#7B1FA2',
    primaryLight: '#AB47BC',
    secondary: '#E1BEE7',
    accent: '#FF5722',
  },
  orange: {
    primary: '#FF9800',
    primaryDark: '#F57C00',
    primaryLight: '#FFB74D',
    secondary: '#FF8A65',
    accent: '#795548',
  },
};

// Theme generators for light/dark modes
const generateLightTheme = (scheme: ColorScheme): UnifiedThemeColors => ({
  ...COLOR_SCHEMES[scheme],
  
  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFAFA',
  card: '#FFFFFF',
  
  // Text colors
  text: '#212121',
  textSecondary: '#757575',
  textMuted: '#9E9E9E',
  inactive: '#8E8E93',
  
  // UI elements
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  divider: '#BDBDBD',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // App-specific colors
  memorized: '#4CAF50',
  inProgress: '#FF9800',
  notStarted: '#9E9E9E',
    tint: COLOR_SCHEMES[scheme].accent, // Set default tint using accent color
});

const generateDarkTheme = (scheme: ColorScheme): UnifiedThemeColors => ({
  ...COLOR_SCHEMES[scheme],
  
  // Backgrounds
  background: '#1a1a1a',
  backgroundSecondary: '#2a2a2a',
  surface: '#2a2a2a',
  surfaceElevated: '#3a3a3a',
  card: '#2a2a2a',
  
  // Text colors
  text: '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted: '#888888',
  inactive: '#666666',
  
  // UI elements
  border: '#333333',
  borderLight: '#444444',
  divider: '#555555',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // App-specific colors
  memorized: '#4CAF50',
  inProgress: '#FF9800',
  notStarted: '#666666',
    tint: COLOR_SCHEMES[scheme].accent, // Set default tint using accent color
});

/**
 * Unified theme hook that bridges Zustand (iHafidh2) and Context (FastingCalendar) theme systems
 * @param preferredSource - Which theme system to prefer ('zustand', 'context', or 'auto')
 * @param fastingContext - Optional FastingCalendar context for mixed state management
 */
export const useUnifiedTheme = (
  preferredSource: ThemeSource = 'auto',
  fastingContext?: FastingThemeContextType
): UnifiedThemeHook => {
  const systemColorScheme = useColorScheme();
  
  // iHafidh2 Zustand stores
  const zustandTheme = useThemeStore();
  const zustandSettings = useSettingsStore();
  
  // Use provided FastingCalendar Context or undefined
  const contextTheme = fastingContext;
  
  // Determine which theme source to use
  const effectiveSource = useMemo(() => {
    if (preferredSource === 'auto') {
      // Auto-select based on availability
      return contextTheme ? 'context' : 'zustand';
    }
    return preferredSource;
  }, [preferredSource, contextTheme]);
  
  // Get theme mode and color scheme from the preferred source
  const { themeMode, colorScheme } = useMemo(() => {
    if (effectiveSource === 'context' && contextTheme) {
      return {
        themeMode: contextTheme.state.settings.theme === 'dark' ? 'dark' : 'light' as ThemeMode,
        colorScheme: contextTheme.state.settings.colorScheme as ColorScheme,
      };
    }
    
    // Default to Zustand (iHafidh2)
    return {
      themeMode: zustandSettings.theme as ThemeMode,
      colorScheme: zustandTheme.colorScheme,
    };
  }, [effectiveSource, contextTheme, zustandSettings.theme, zustandTheme.colorScheme]);
  
  // Determine if dark mode is active
  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);
  
  // Generate unified theme colors
  const theme = useMemo(() => {
    return isDark ? generateDarkTheme(colorScheme) : generateLightTheme(colorScheme);
  }, [isDark, colorScheme]);
  
  // Unified theme setters that update both systems
  const setTheme = (mode: ThemeMode) => {
    // Update Zustand (iHafidh2)
    zustandSettings.setTheme(mode);
    zustandTheme.setThemeMode(mode);
    
    // Update Context (FastingCalendar) if available
    if (contextTheme?.updateSettings) {
      contextTheme.updateSettings({
        theme: mode === 'system' ? 'light' : mode // FastingCalendar doesn't support 'system'
      });
    }
  };
  
  const setColorScheme = (scheme: ColorScheme) => {
    // Update Zustand (iHafidh2)
    zustandTheme.setColorScheme(scheme);
    
    // Update Context (FastingCalendar) if available
    if (contextTheme?.updateSettings) {
      contextTheme.updateSettings({
        colorScheme: scheme
      });
    }
  };
  
  // Synchronization effect - keeps both systems in sync
  useEffect(() => {
    if (!contextTheme) return;
    
    // Sync from Zustand to Context when Zustand changes
    const zustandUnsubscribe = useThemeStore.subscribe(
      (state) => {
        if (contextTheme.updateSettings && contextTheme.state.settings.colorScheme !== state.colorScheme) {
          contextTheme.updateSettings({ colorScheme: state.colorScheme });
        }
      }
    );
    
    return zustandUnsubscribe;
  }, [contextTheme]);
  
  return {
    theme,
    themeMode,
    colorScheme,
    isDark,
    setTheme,
    setColorScheme,
    raw: {
      zustand: { ...zustandTheme, ...zustandSettings },
      context: contextTheme as any, // Allow flexibility for different context structures
    },
  };
};

// Helper hook for theme-aware styles
export const useThemedStyles = <T extends Record<string, any>>(
  styleGenerator: (theme: UnifiedThemeColors) => T,
  source: ThemeSource = 'auto'
) => {
  const { theme } = useUnifiedTheme(source);
  return useMemo(() => styleGenerator(theme), [theme, styleGenerator]);
};

// Helper for conditional theme source selection
export const useConditionalTheme = (condition: boolean, trueSource: ThemeSource = 'context', falseSource: ThemeSource = 'zustand') => {
  return useUnifiedTheme(condition ? trueSource : falseSource);
};
