import { useThemeStore } from '@/store/themeStore';

/**
 * Hook to get the current theme primary color
 * This is a limited scope theme system that only affects:
 * - Tab icon colors
 * - Button colors 
 * - Tab choice colors
 */
export const useThemeColor = () => {
  const { colorScheme } = useThemeStore();
  
  // Get the primary color from the color scheme
  const colorSchemes = {
    blue: '#2196F3',
    green: '#4CAF50',
    purple: '#9C27B0',
    orange: '#FF9800',
  };
  
  return {
    primary: colorSchemes[colorScheme],
    primaryDark: colorSchemes[colorScheme], // Simplified for now
    primaryLight: colorSchemes[colorScheme], // Simplified for now
  };
};

/**
 * Hook to get and set color scheme
 */
export const useColorScheme = () => {
  const { colorScheme, setColorScheme } = useThemeStore();
  
  return {
    colorScheme,
    setColorScheme,
  };
};
