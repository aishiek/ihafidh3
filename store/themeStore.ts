import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'blue' | 'green' | 'purple' | 'orange';

export interface ThemeColors {
  // Core colors
  primary: string;
  primaryDark: string;
  primaryLight: string;
  
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  inactive: string;
  
  // UI colors
  border: string;
  divider: string;
  card: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Special colors
  memorized: string;
  inProgress: string;
  notStarted: string;
  
  // Read Mode specific colors
  readModeParchmentBG: string;
  readModeParchmentTexture: string;
  readModeCharcoalText: string;
  readModeDeepBG: string;
  readModeGoldAsset: string;
}

const colorSchemes = {
  blue: {
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#42A5F5',
  },
  green: {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    primaryLight: '#66BB6A',
  },
  purple: {
    primary: '#9C27B0',
    primaryDark: '#7B1FA2',
    primaryLight: '#AB47BC',
  },
  orange: {
    primary: '#FF9800',
    primaryDark: '#F57C00',
    primaryLight: '#FFB74D',
  },
};

const lightTheme = (scheme: ColorScheme): ThemeColors => ({
  ...colorSchemes[scheme],
  
  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  backgroundTertiary: '#E0E0E0',
  
  // Text colors
  text: '#212121',
  textSecondary: '#757575',
  textTertiary: '#9E9E9E',
  inactive: '#8E8E93',
  
  // UI colors
  border: '#E0E0E0',
  divider: '#BDBDBD',
  card: '#FFFFFF',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Special colors
  memorized: '#4CAF50',
  inProgress: '#FF9800',
  notStarted: '#9E9E9E',
  
  // Read Mode specific colors
  readModeParchmentBG: '#F5F2E9',
  readModeParchmentTexture: '#EBE4D0',
  readModeCharcoalText: '#2B2519',
  readModeDeepBG: '#080A10',
  readModeGoldAsset: '#D4AF37',
});

const darkTheme = (scheme: ColorScheme): ThemeColors => ({
  ...colorSchemes[scheme],
  
  // Background colors
  background: '#1a1a1a',
  backgroundSecondary: '#333333',
  backgroundTertiary: '#555555',
  
  // Text colors
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textTertiary: '#888888',
  inactive: '#636366',
  
  // UI colors
  border: '#555555',
  divider: '#666666',
  card: '#333333',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Special colors
  memorized: '#4CAF50',
  inProgress: '#FF9800',
  notStarted: '#666666',
  
  // Read Mode specific colors
  readModeParchmentBG: '#F5F2E9',
  readModeParchmentTexture: '#EBE4D0',
  readModeCharcoalText: '#2B2519',
  readModeDeepBG: '#080A10',
  readModeGoldAsset: '#D4AF37',
});

interface ThemeState {
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  theme: ThemeColors;
  
  setThemeMode: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  getTheme: () => ThemeColors;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'dark',
      colorScheme: 'blue',
      theme: darkTheme('blue'),
      
      setThemeMode: (mode: ThemeMode) => {
        const { colorScheme } = get();
        const theme = mode === 'dark' ? darkTheme(colorScheme) : lightTheme(colorScheme);
        set({ themeMode: mode, theme });
      },
      
      setColorScheme: (scheme: ColorScheme) => {
        const { themeMode } = get();
        const theme = themeMode === 'dark' ? darkTheme(scheme) : lightTheme(scheme);
        set({ colorScheme: scheme, theme });
      },
      
      getTheme: () => {
        const { themeMode, colorScheme } = get();
        return themeMode === 'dark' ? darkTheme(colorScheme) : lightTheme(colorScheme);
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
); 