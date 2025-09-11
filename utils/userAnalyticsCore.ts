import analytics from '@react-native-firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const USER_ID_KEY = 'ihafidh_user_id';
const USER_NAME_KEY = 'ihafidh_user_name';

export async function ensureUserId() {
  let userId = await AsyncStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = uuidv4();
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  }
  await analytics().setUserId(userId);
  return userId;
}

export async function setUserName(name: string) {
  await AsyncStorage.setItem(USER_NAME_KEY, name);
  await analytics().setUserProperty('user_name', name);
}

export async function logBadgeEarned(badgeName: string) {
  await ensureUserId();
  await analytics().logEvent('badge_earned', { badge_name: badgeName });
}

export async function logAyahMemorized(count: number, scope: 'daily' | 'weekly') {
  await ensureUserId();
  await analytics().logEvent('ayah_memorized', { count, scope });
}

export async function logAyahRevised(count: number) {
  await ensureUserId();
  await analytics().logEvent('ayah_revised', { count });
}

export async function logSurahRevised(surahId: number, scope: 'weekly') {
  await ensureUserId();
  await analytics().logEvent('surah_revised', { surah_id: surahId, scope });
}
