import { useEffect, useRef } from 'react';
import analytics from '@react-native-firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const USER_ID_KEY = 'ihafidh_user_id';
const USER_NAME_KEY = 'ihafidh_user_name';

export const useAnalytics = () => {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    const init = async () => {
      let userId = await AsyncStorage.getItem(USER_ID_KEY);
      if (!userId) {
        userId = uuidv4();
        await AsyncStorage.setItem(USER_ID_KEY, userId);
      }
      await analytics().setUserId(userId);

      const userName = await AsyncStorage.getItem(USER_NAME_KEY);
      if (userName) {
        await analytics().setUserProperty('user_name', userName);
      }

      initialized.current = true;
    };

    init();
  }, []);

  const logBadgeEarned = async (badgeName: string) => {
    await analytics().logEvent('badge_earned', {
      badge_name: badgeName,
    });
  };

  const logAyahMemorized = async (count: number, scope: 'daily' | 'weekly') => {
    await analytics().logEvent('ayah_memorized', {
      count,
      scope, // 'daily' or 'weekly'
    });
  };

  const logAyahRevised = async (count: number) => {
    await analytics().logEvent('ayah_revised', {
      count, // per day
    });
  };

  const logSurahRevised = async (surahId: number, scope: 'weekly') => {
    await analytics().logEvent('surah_revised', {
      surah_id: surahId,
      scope,
    });
  };

  const setUserName = async (name: string) => {
    await AsyncStorage.setItem(USER_NAME_KEY, name);
    await analytics().setUserProperty('user_name', name);
  };

  return {
    logBadgeEarned,
    logAyahMemorized,
    logAyahRevised,
    logSurahRevised,
    setUserName,
  };
};
