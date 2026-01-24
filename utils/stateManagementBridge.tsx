/**
 * State Management Bridge Utilities
 * These utilities help bridge between Zustand (iHafidh2) and Context (FastingCalendar) systems
 */

import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';

// Bridge Context type for providing FastingCalendar context to iHafidh2 components
export interface BridgeContextType {
  fastingContext?: any; // Will be typed properly when FastingCalendar is integrated
  features: {
    fastingCalendar: boolean;
    moonPhases: boolean;
    qiblaFinder: boolean;
  };
}

// Hook that automatically provides the right theme based on current feature
export const useContextAwareTheme = (currentFeature?: 'quran' | 'fasting' | 'general', fastingContext?: any) => {
  // Use FastingCalendar context if we're in fasting features and it's available
  const shouldUseFastingContext = currentFeature === 'fasting' && fastingContext;
  
  return useUnifiedTheme('auto', shouldUseFastingContext ? fastingContext : undefined);
};

// Data migration utilities
export class StateMigrationUtils {
  /**
   * Migrate theme settings from FastingCalendar Context to iHafidh2 Zustand
   */
  static migrateThemeFromContext(contextSettings: any, zustandThemeStore: any, zustandSettingsStore: any) {
    if (!contextSettings) return;

    try {
      // Migrate theme mode
      if (contextSettings.theme) {
        zustandSettingsStore.setTheme(contextSettings.theme);
        zustandThemeStore.setThemeMode(contextSettings.theme);
      }

      // Migrate color scheme
      if (contextSettings.colorScheme) {
        zustandThemeStore.setColorScheme(contextSettings.colorScheme);
      }

      console.log('✅ Theme migration from Context to Zustand completed');
    } catch (error) {
      console.error('❌ Theme migration failed:', error);
    }
  }

  /**
   * Migrate settings from iHafidh2 Zustand to FastingCalendar Context
   */
  static async migrateThemeToContext(
    zustandThemeStore: any, 
    zustandSettingsStore: any, 
    contextUpdateSettings: (settings: any) => Promise<void>
  ) {
    try {
      const themeSettings = {
        theme: zustandSettingsStore.theme,
        colorScheme: zustandThemeStore.colorScheme,
      };

      await contextUpdateSettings(themeSettings);
      console.log('✅ Theme migration from Zustand to Context completed');
    } catch (error) {
      console.error('❌ Theme migration failed:', error);
    }
  }

  /**
   * Synchronize settings between both systems
   */
  static async synchronizeThemeSettings(
    zustandThemeStore: any,
    zustandSettingsStore: any,
    fastingContext: any
  ) {
    if (!fastingContext) return;

    try {
      // Get current settings from both systems
      const zustandTheme = zustandSettingsStore.theme;
      const zustandColorScheme = zustandThemeStore.colorScheme;
      const contextTheme = fastingContext.state.settings.theme;
      const contextColorScheme = fastingContext.state.settings.colorScheme;

      // Determine which system has the most recent changes
      // For simplicity, we'll use Zustand as the source of truth
      if (zustandTheme !== contextTheme || zustandColorScheme !== contextColorScheme) {
        await fastingContext.updateSettings({
          theme: zustandTheme === 'system' ? 'light' : zustandTheme, // Context doesn't support system
          colorScheme: zustandColorScheme,
        });
      }

      console.log('✅ Theme synchronization completed');
    } catch (error) {
      console.error('❌ Theme synchronization failed:', error);
    }
  }
}

// Hook for handling feature-specific state
export const useFeatureState = <T,>(
  featureName: string,
  zustandStore: () => T,
  contextData?: any,
  preferContext = false
) => {
  const zustandState = zustandStore();
  
  // Return context data if preferred and available, otherwise return Zustand state
  if (preferContext && contextData) {
    return {
      state: contextData,
      source: 'context' as const,
      isHybrid: true,
    };
  }
  
  return {
    state: zustandState,
    source: 'zustand' as const,
    isHybrid: false,
  };
};

// Helper function for creating hybrid functionality that works with both systems
export const createHybridSelector = <ZustandState extends unknown, ContextState extends unknown, ReturnType extends unknown>(
  zustandSelector: (state: ZustandState) => ReturnType,
  contextSelector: (state: ContextState) => ReturnType,
  preferContext = false
) => {
  return (zustandState: ZustandState, contextState?: ContextState): ReturnType => {
    if (preferContext && contextState) {
      return contextSelector(contextState);
    }
    return zustandSelector(zustandState);
  };
};

// Theme synchronization utilities
export const ThemeSync = {
  /**
   * Create a synchronization function for automatic theme updates
   */
  createSyncFunction: (fastingContext?: any) => {
    return (zustandTheme: any, zustandSettings: any) => {
      if (!fastingContext) return;
      
      // Check if synchronization is needed
      const needsSync = 
        fastingContext.state.settings.theme !== zustandSettings.theme ||
        fastingContext.state.settings.colorScheme !== zustandTheme.colorScheme;
      
      if (needsSync) {
        fastingContext.updateSettings({
          theme: zustandSettings.theme === 'system' ? 'light' : zustandSettings.theme,
          colorScheme: zustandTheme.colorScheme,
        }).catch((error: any) => {
          console.error('Theme sync failed:', error);
        });
      }
    };
  },

  /**
   * One-way sync from Zustand to Context
   */
  syncToContext: async (zustandState: any, fastingContext: any) => {
    if (!fastingContext) return;
    
    try {
      await fastingContext.updateSettings({
        theme: zustandState.theme === 'system' ? 'light' : zustandState.theme,
        colorScheme: zustandState.colorScheme,
      });
    } catch (error) {
      console.error('Failed to sync theme to context:', error);
    }
  },

  /**
   * One-way sync from Context to Zustand
   */
  syncToZustand: (contextState: any, zustandTheme: any, zustandSettings: any) => {
    if (!contextState) return;
    
    try {
      zustandSettings.setTheme(contextState.settings.theme);
      zustandTheme.setColorScheme(contextState.settings.colorScheme);
    } catch (error) {
      console.error('Failed to sync theme to zustand:', error);
    }
  },
};

// Feature integration utilities
export const FeatureIntegration = {
  /**
   * Check if a feature should use Context vs Zustand
   */
  shouldUseContext: (feature: string, contextAvailable: boolean): boolean => {
    const contextFeatures = ['fasting', 'calendar', 'moon-phases'];
    return contextFeatures.includes(feature) && contextAvailable;
  },

  /**
   * Get the appropriate state source for a feature
   */
  getStateSource: (feature: string, contextAvailable: boolean): 'zustand' | 'context' => {
    return FeatureIntegration.shouldUseContext(feature, contextAvailable) ? 'context' : 'zustand';
  },

  /**
   * Create a feature-aware data selector
   */
  createFeatureSelector: <T extends unknown>(
    feature: string,
    zustandSelector: () => T,
    contextSelector: () => T | undefined
  ) => {
    return (contextAvailable: boolean): T => {
      if (FeatureIntegration.shouldUseContext(feature, contextAvailable)) {
        const contextData = contextSelector();
        if (contextData !== undefined) {
          return contextData;
        }
      }
      return zustandSelector();
    };
  },
};

// Export utility types for type safety
export type StateSource = 'zustand' | 'context' | 'hybrid';
export type FeatureType = 'fasting' | 'quran' | 'general';

// Configuration for mixed state management
export const MixedStateConfig = {
  // Features that prefer Context API
  contextFeatures: ['fasting', 'calendar', 'moon-phases', 'qibla'] as const,
  
  // Features that prefer Zustand
  zustandFeatures: ['quran', 'quiz', 'stats', 'progress'] as const,
  
  // Features that can use either (hybrid)
  hybridFeatures: ['settings', 'theme', 'navigation'] as const,
  
  // Get the preferred state management for a feature
  getPreferredStateManagement: (feature: string): StateSource => {
    if (MixedStateConfig.contextFeatures.includes(feature as any)) return 'context';
    if (MixedStateConfig.zustandFeatures.includes(feature as any)) return 'zustand';
    return 'hybrid';
  },
};
/**
 * State Management Bridge Utilities
 * These utilities help bridge between Zustand (iHafidh2) and Context (FastingCalendar) systems
 */

import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';

// Bridge Context type for providing FastingCalendar context to iHafidh2 components
export interface BridgeContextType {
  fastingContext?: any; // Will be typed properly when FastingCalendar is integrated
  features: {
    fastingCalendar: boolean;
    moonPhases: boolean;
    qiblaFinder: boolean;
  };
}

// Hook that automatically provides the right theme based on current feature
export const useContextAwareTheme = (currentFeature?: 'quran' | 'fasting' | 'general', fastingContext?: any) => {
  // Use FastingCalendar context if we're in fasting features and it's available
  const shouldUseFastingContext = currentFeature === 'fasting' && fastingContext;
  
  return useUnifiedTheme('auto', shouldUseFastingContext ? fastingContext : undefined);
};

// Data migration utilities
export class StateMigrationUtils {
  /**
   * Migrate theme settings from FastingCalendar Context to iHafidh2 Zustand
   */
  static migrateThemeFromContext(contextSettings: any, zustandThemeStore: any, zustandSettingsStore: any) {
    if (!contextSettings) return;

    try {
      // Migrate theme mode
      if (contextSettings.theme) {
        zustandSettingsStore.setTheme(contextSettings.theme);
        zustandThemeStore.setThemeMode(contextSettings.theme);
      }

      // Migrate color scheme
      if (contextSettings.colorScheme) {
        zustandThemeStore.setColorScheme(contextSettings.colorScheme);
      }

      console.log('✅ Theme migration from Context to Zustand completed');
    } catch (error) {
      console.error('❌ Theme migration failed:', error);
    }
  }

  /**
   * Migrate settings from iHafidh2 Zustand to FastingCalendar Context
   */
  static async migrateThemeToContext(
    zustandThemeStore: any, 
    zustandSettingsStore: any, 
    contextUpdateSettings: (settings: any) => Promise<void>
  ) {
    try {
      const themeSettings = {
        theme: zustandSettingsStore.theme,
        colorScheme: zustandThemeStore.colorScheme,
      };

      await contextUpdateSettings(themeSettings);
      console.log('✅ Theme migration from Zustand to Context completed');
    } catch (error) {
      console.error('❌ Theme migration failed:', error);
    }
  }

  /**
   * Synchronize settings between both systems
   */
  static async synchronizeThemeSettings(
    zustandThemeStore: any,
    zustandSettingsStore: any,
    fastingContext: any
  ) {
    if (!fastingContext) return;

    try {
      // Get current settings from both systems
      const zustandTheme = zustandSettingsStore.theme;
      const zustandColorScheme = zustandThemeStore.colorScheme;
      const contextTheme = fastingContext.state.settings.theme;
      const contextColorScheme = fastingContext.state.settings.colorScheme;

      // Determine which system has the most recent changes
      // For simplicity, we'll use Zustand as the source of truth
      if (zustandTheme !== contextTheme || zustandColorScheme !== contextColorScheme) {
        await fastingContext.updateSettings({
          theme: zustandTheme === 'system' ? 'light' : zustandTheme, // Context doesn't support system
          colorScheme: zustandColorScheme,
        });
      }

      console.log('✅ Theme synchronization completed');
    } catch (error) {
      console.error('❌ Theme synchronization failed:', error);
    }
  }
}

// Hook for handling feature-specific state
export const useFeatureState = <T,>(
  featureName: string,
  zustandStore: () => T,
  contextData?: any,
  preferContext = false
) => {
  const zustandState = zustandStore();
  
  // Return context data if preferred and available, otherwise return Zustand state
  if (preferContext && contextData) {
    return {
      state: contextData,
      source: 'context' as const,
      isHybrid: true,
    };
  }
  
  return {
    state: zustandState,
    source: 'zustand' as const,
    isHybrid: false,
  };
};

// Helper function for creating hybrid functionality that works with both systems
export const createHybridSelector = <ZustandState extends unknown, ContextState extends unknown, ReturnType extends unknown>(
  zustandSelector: (state: ZustandState) => ReturnType,
  contextSelector: (state: ContextState) => ReturnType,
  preferContext = false
) => {
  return (zustandState: ZustandState, contextState?: ContextState): ReturnType => {
    if (preferContext && contextState) {
      return contextSelector(contextState);
    }
    return zustandSelector(zustandState);
  };
};

// Theme synchronization utilities
export const ThemeSync = {
  /**
   * Create a synchronization function for automatic theme updates
   */
  createSyncFunction: (fastingContext?: any) => {
    return (zustandTheme: any, zustandSettings: any) => {
      if (!fastingContext) return;
      
      // Check if synchronization is needed
      const needsSync = 
        fastingContext.state.settings.theme !== zustandSettings.theme ||
        fastingContext.state.settings.colorScheme !== zustandTheme.colorScheme;
      
      if (needsSync) {
        fastingContext.updateSettings({
          theme: zustandSettings.theme === 'system' ? 'light' : zustandSettings.theme,
          colorScheme: zustandTheme.colorScheme,
        }).catch((error: any) => {
          console.error('Theme sync failed:', error);
        });
      }
    };
  },

  /**
   * One-way sync from Zustand to Context
   */
  syncToContext: async (zustandState: any, fastingContext: any) => {
    if (!fastingContext) return;
    
    try {
      await fastingContext.updateSettings({
        theme: zustandState.theme === 'system' ? 'light' : zustandState.theme,
        colorScheme: zustandState.colorScheme,
      });
    } catch (error) {
      console.error('Failed to sync theme to context:', error);
    }
  },

  /**
   * One-way sync from Context to Zustand
   */
  syncToZustand: (contextState: any, zustandTheme: any, zustandSettings: any) => {
    if (!contextState) return;
    
    try {
      zustandSettings.setTheme(contextState.settings.theme);
      zustandTheme.setColorScheme(contextState.settings.colorScheme);
    } catch (error) {
      console.error('Failed to sync theme to zustand:', error);
    }
  },
};

// Feature integration utilities
export const FeatureIntegration = {
  /**
   * Check if a feature should use Context vs Zustand
   */
  shouldUseContext: (feature: string, contextAvailable: boolean): boolean => {
    const contextFeatures = ['fasting', 'calendar', 'moon-phases'];
    return contextFeatures.includes(feature) && contextAvailable;
  },

  /**
   * Get the appropriate state source for a feature
   */
  getStateSource: (feature: string, contextAvailable: boolean): 'zustand' | 'context' => {
    return FeatureIntegration.shouldUseContext(feature, contextAvailable) ? 'context' : 'zustand';
  },

  /**
   * Create a feature-aware data selector
   */
  createFeatureSelector: <T extends unknown>(
    feature: string,
    zustandSelector: () => T,
    contextSelector: () => T | undefined
  ) => {
    return (contextAvailable: boolean): T => {
      if (FeatureIntegration.shouldUseContext(feature, contextAvailable)) {
        const contextData = contextSelector();
        if (contextData !== undefined) {
          return contextData;
        }
      }
      return zustandSelector();
    };
  },
};

// Export utility types for type safety
export type StateSource = 'zustand' | 'context' | 'hybrid';
export type FeatureType = 'fasting' | 'quran' | 'general';

// Configuration for mixed state management
export const MixedStateConfig = {
  // Features that prefer Context API
  contextFeatures: ['fasting', 'calendar', 'moon-phases', 'qibla'] as const,
  
  // Features that prefer Zustand
  zustandFeatures: ['quran', 'quiz', 'stats', 'progress'] as const,
  
  // Features that can use either (hybrid)
  hybridFeatures: ['settings', 'theme', 'navigation'] as const,
  
  // Get the preferred state management for a feature
  getPreferredStateManagement: (feature: string): StateSource => {
    if (MixedStateConfig.contextFeatures.includes(feature as any)) return 'context';
    if (MixedStateConfig.zustandFeatures.includes(feature as any)) return 'zustand';
    return 'hybrid';
  },
};
