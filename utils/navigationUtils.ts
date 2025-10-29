import { router } from 'expo-router';

/**
 * Safely navigate back, with fallback to home if navigation stack is empty
 * Prevents "Nothing to GOBACK" errors
 */
export const safeGoBack = () => {
  try {
    if (router.canGoBack()) {
      router.back();
    } else {
      // No history to go back to, navigate to home
      router.replace('/(tabs)');
    }
  } catch (error) {
    console.warn('[Navigation] GoBack error, navigating to home:', error);
    try {
      router.replace('/(tabs)');
    } catch (fallbackError) {
      console.error('[Navigation] Critical navigation error:', fallbackError);
    }
  }
};

/**
 * Safe navigation wrapper for all router methods
 * Provides error handling for all navigation operations
 */
export const safeNavigation = {
  push: (route: string | { pathname: string; params?: any }) => {
    try {
      router.push(route as any);
    } catch (error) {
      console.error('[Navigation] Push error:', error);
    }
  },
  
  replace: (route: string | { pathname: string; params?: any }) => {
    try {
      router.replace(route as any);
    } catch (error) {
      console.error('[Navigation] Replace error:', error);
    }
  },
  
  back: () => {
    safeGoBack();
  },
  
  canGoBack: () => {
    try {
      return router.canGoBack();
    } catch (error) {
      console.warn('[Navigation] CanGoBack check failed:', error);
      return false;
    }
  }
};
