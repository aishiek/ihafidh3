import { TajweedService } from '@/app/mushaf/services/tajweedService';
import { TajweedConfig, TajweedRule } from '@/types/tajweed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'TAJWEED_CONFIG';
const DEFAULT_CONFIG: TajweedConfig = {
  enabled: true,
  highlightedRules: Object.values(TajweedRule),
  showLabels: false,
  opacity: 0.4,
  style: 'overlay',
};

export const useTajweed = () => {
  const [config, setConfig] = useState<TajweedConfig>(DEFAULT_CONFIG);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => { initialize(); }, []);

  const initialize = async () => {
    try {
      await TajweedService.initialize();
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setConfig(JSON.parse(saved));
      setInitialized(true);
    } catch (error) {
      console.error('Error initializing tajweed:', error);
      setInitialized(true);
    }
  };

  const updateConfig = async (newConfig: Partial<TajweedConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (e) { console.error('Error saving tajweed config', e); }
  };

  const toggleEnabled = () => updateConfig({ enabled: !config.enabled });
  const toggleRule = (rule: TajweedRule) => {
    const rules = config.highlightedRules.includes(rule) ? config.highlightedRules.filter((r) => r !== rule) : [...config.highlightedRules, rule];
    updateConfig({ highlightedRules: rules });
  };
  const toggleLabels = () => updateConfig({ showLabels: !config.showLabels });
  const setOpacity = (opacity: number) => updateConfig({ opacity: Math.max(0.3, Math.min(1.0, opacity)) });
  const resetToDefaults = () => updateConfig(DEFAULT_CONFIG);

  return { config, initialized, updateConfig, toggleEnabled, toggleRule, toggleLabels, setOpacity, resetToDefaults };
};
