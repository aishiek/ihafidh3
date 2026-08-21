import { useState, useEffect } from 'react';
import remoteConfig from '@react-native-firebase/remote-config';

// Community Stats is always on — no Remote Config on/off switch anymore. Every
// screen that used to gate on `enabled` can keep doing so (the field is kept for
// call-site compatibility) but it will always be `true`, so nothing needs to be
// toggled remotely to turn the feature on for users.
//
// `minThreshold` (the minimum community count before a number is shown, so a
// verse/surah with e.g. only 3 interactions doesn't display "3") is still a
// genuinely useful remote-tunable, so that part still reads from Remote Config.
export function useCommunityStatsFlag() {
  const [minThreshold, setMinThreshold] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function initRemoteConfig() {
      try {
        await remoteConfig().setDefaults({
          community_stats_min_threshold: 50,
        });

        // Set caching settings - 1 hour cache (3600 seconds) in production, 0 in development
        const fetchTimeout = 60; // seconds
        const minimumFetchInterval = __DEV__ ? 0 : 3600; // seconds

        await remoteConfig().setConfigSettings({
          minimumFetchIntervalMillis: minimumFetchInterval * 1000,
          fetchTimeMillis: fetchTimeout * 1000,
        });

        await remoteConfig().fetchAndActivate();

        if (active) {
          const remoteThreshold = remoteConfig().getValue('community_stats_min_threshold').asNumber();
          setMinThreshold(remoteThreshold);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[RemoteConfig] failed to fetch/activate min threshold, using default:', error);
        }
        // Fall back to local default if fetch fails (e.g. offline) — Community Stats
        // itself still works, this only affects the "hide small numbers" threshold.
        if (active) {
          try {
            const remoteThreshold = remoteConfig().getValue('community_stats_min_threshold').asNumber();
            setMinThreshold(remoteThreshold);
          } catch {
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

  return { enabled: true, minThreshold, loading };
}
