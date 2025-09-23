import { useEffect, useRef } from 'react';
// Firebase analytics removed for compliance
// import analytics from '@react-native-firebase/analytics';
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
      // Analytics disabled for compliance
      // await analytics().setUserId(userId);

      const userName = await AsyncStorage.getItem(USER_NAME_KEY);
      if (userName) {
        // Analytics disabled for compliance
        // await analytics().setUserProperty('user_name', userName);
      }

      initialized.current = true;
    };

    init();
  }, []);

  const logBadgeEarned = async (badgeName: string) => {
    // Analytics disabled for compliance
    // await analytics().logEvent('badge_earned', {
    //   badge_name: badgeName,
    // });
  };

  const logAyahMemorized = async (count: number, scope: 'daily' | 'weekly') => {
    // Analytics disabled for compliance
    // await analytics().logEvent('ayah_memorized', {
    //   count,
    //   scope, // 'daily' or 'weekly'
    // });
  };

  const logAyahRevised = async (count: number) => {
    // Analytics disabled for compliance
    // await analytics().logEvent('ayah_revised', {
    //   count, // per day
    // });
  };

  const logSurahRevised = async (surahId: number, scope: 'weekly') => {
    // Analytics disabled for compliance
    // await analytics().logEvent('surah_revised', {
    //   surah_id: surahId,
    //   scope,
    // });
  };

  const setUserName = async (name: string) => {
    await AsyncStorage.setItem(USER_NAME_KEY, name);
    // Analytics disabled for compliance
    // await analytics().setUserProperty('user_name', name);
  };

  return {
    logBadgeEarned,
    logAyahMemorized,
    logAyahRevised,
    logSurahRevised,
    setUserName,
  };
};
