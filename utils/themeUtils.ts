import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';
import colors, { lightTheme, darkTheme } from '@/constants/colors';
import { ThemeColors } from '@/types';

export function useTheme(): ThemeColors {
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  
  // Determine which theme to use
  let activeTheme: 'light' | 'dark';
  
  if (theme === 'system') {
    activeTheme = colorScheme === 'dark' ? 'dark' : 'light';
  } else {
    activeTheme = theme;
  }
  
  return activeTheme === 'dark' ? darkTheme : lightTheme;
}

export function useCustomColors(): ThemeColors {
  return useTheme();
}