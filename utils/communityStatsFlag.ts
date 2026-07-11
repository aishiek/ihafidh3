import { useState, useEffect } from 'react';
import remoteConfig from '@react-native-firebase/remote-config';

export function useCommunityStatsFlag() {
  const [enabled, setEnabled] = useState(false);
  const [minThreshold, setMinThreshold] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function initRemoteConfig() {
      try {
        // Set defaults
        await remoteConfig().setDefaults({
          community_stats_enabled: false,
          community_stats_min_threshold: 50,
        });

        // Set caching settings - 1 hour cache (3600 seconds) in production, 0 in development
        const fetchTimeout = 60; // seconds
        const minimumFetchInterval = __DEV__ ? 0 : 3600; // seconds
        
        await remoteConfig().setConfigSettings({
          minimumFetchIntervalMillis: minimumFetchInterval * 1000,
          fetchTimeMillis: fetchTimeout * 1000,
        });

        // Fetch and activate
        await remoteConfig().fetchAndActivate();

        if (active) {
          const remoteEnabled = remoteConfig().getValue('community_stats_enabled').asBoolean();
          const remoteThreshold = remoteConfig().getValue('community_stats_min_threshold').asNumber();
          
          setEnabled(remoteEnabled);
          setMinThreshold(remoteThreshold);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[RemoteConfig] failed to fetch/activate, using defaults:', error);
        }
        // Fall back to local defaults if fetch fails (e.g. offline)
        if (active) {
          try {
            const remoteEnabled = remoteConfig().getValue('community_stats_enabled').asBoolean();
            const remoteThreshold = remoteConfig().getValue('community_stats_min_threshold').asNumber();
            setEnabled(remoteEnabled);
            setMinThreshold(remoteThreshold);
          } catch {
            setEnabled(false);
            setMinThreshold(50);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initRemoteConfig();

    return () => {
      active = false;
    };
  }, []);

  return { enabled, minThreshold, loading };
}
