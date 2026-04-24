import { useSettingsStore } from '@/store/settingsStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const WALKTHROUGH_SEEN_KEY = '@walkthrough_seen_v1';

export function useAppWalkthrough() {
  const [shouldShow, setShouldShow] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const setWalkthroughReplayPending = useSettingsStore((s) => s.setWalkthroughReplayPending);

  useEffect(() => {
    AsyncStorage.getItem(WALKTHROUGH_SEEN_KEY).then(seen => {
      setShouldShow(seen !== 'true');
      setIsReady(true);
    });
  }, []);

  const markSeen = async () => {
    await AsyncStorage.setItem(WALKTHROUGH_SEEN_KEY, 'true');
    setShouldShow(false);
  };

  /**
   * Clears the "seen" flag AND sets the cross-screen Zustand signal so that
   * the Read tab (which is already mounted) can detect the replay request when
   * it next gains focus — without relying on local component state.
   */
  const resetWalkthrough = async () => {
    await AsyncStorage.removeItem(WALKTHROUGH_SEEN_KEY);
    setShouldShow(true);
    setWalkthroughReplayPending(true);
  };

  return { shouldShow, isReady, markSeen, resetWalkthrough };
}
