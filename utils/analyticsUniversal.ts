import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const USER_ID_KEY = 'ihafidh_user_id';
const USER_NAME_KEY = 'ihafidh_user_name';

const isExpoGo = Constants.appOwnership === 'expo';

let analyticsModule: any = null;

// Initialize analytics module using optional static requires to avoid dynamic import chunks
function initializeAnalytics() {
  analyticsModule = null;
  if (isExpoGo) {
    try {
      // Optional dependency for Expo Go builds
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const expoAnalytics = require('expo-firebase-analytics');
      analyticsModule = expoAnalytics?.default ?? expoAnalytics;
    } catch {
      analyticsModule = null;
    }
  } else {
    try {
      // Optional dependency for bare/production builds
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const firebaseAnalytics = require('@react-native-firebase/analytics');
      analyticsModule = firebaseAnalytics?.default ?? firebaseAnalytics;
    } catch {
      analyticsModule = null;
    }
  }
}

// Initialize analytics on module load
initializeAnalytics();

export async function ensureUserId() {
  let userId = await AsyncStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = uuidv4();
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  }
  if (!isExpoGo && analyticsModule?.setUserId) {
    await analyticsModule.setUserId(userId);
  }
  return userId;
}

export async function setUserName(name: string) {
  await AsyncStorage.setItem(USER_NAME_KEY, name);
  if (isExpoGo) {
    await analyticsModule.setUserProperties({ user_name: name });
  } else if (analyticsModule?.setUserProperty) {
    await analyticsModule.setUserProperty('user_name', name);
  }
}

export async function logBadgeEarned(badgeName: string) {
  await ensureUserId();
  if (isExpoGo) {
    await analyticsModule.logEvent('badge_earned', { badge_name: badgeName });
  } else if (analyticsModule?.logEvent) {
    await analyticsModule.logEvent('badge_earned', { badge_name: badgeName });
  }
}

export async function logAyahMemorized(count: number, scope: 'daily' | 'weekly') {
  await ensureUserId();
  if (isExpoGo) {
    await analyticsModule.logEvent('ayah_memorized', { count, scope });
  } else if (analyticsModule?.logEvent) {
    await analyticsModule.logEvent('ayah_memorized', { count, scope });
  }
}

export async function logAyahRevised(count: number) {
  await ensureUserId();
  if (isExpoGo) {
    await analyticsModule.logEvent('ayah_revised', { count });
  } else if (analyticsModule?.logEvent) {
    await analyticsModule.logEvent('ayah_revised', { count });
  }
}

export async function logSurahRevised(surahId: number, scope: 'weekly') {
  await ensureUserId();
  if (isExpoGo) {
    await analyticsModule.logEvent('surah_revised', { surah_id: surahId, scope });
  } else if (analyticsModule?.logEvent) {
    await analyticsModule.logEvent('surah_revised', { surah_id: surahId, scope });
  }
}