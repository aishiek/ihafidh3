import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = 'ihafidh_user_id';
const USER_NAME_KEY = 'ihafidh_user_name';

const isExpoGo = Constants.appOwnership === 'expo';

let analyticsModule: any = null;

// Debounce mechanism to reduce console warnings
let lastWarningTime = 0;
const WARNING_DEBOUNCE_MS = 5000; // Only show warnings every 5 seconds

const logAnalyticsWarning = (message: string) => {
  const now = Date.now();
  if (now - lastWarningTime > WARNING_DEBOUNCE_MS) {
    console.warn(message);
    lastWarningTime = now;
  }
};

// Attempt to obtain a secure getRandomValues implementation (priority: expo-crypto -> globalThis.crypto -> fallback)
let getRandomValuesFn: ((arr: Uint8Array) => Uint8Array) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const maybeCrypto = require('expo-crypto');
  if (maybeCrypto?.getRandomValues) {
    getRandomValuesFn = maybeCrypto.getRandomValues;
  }
} catch {/* silent */}

if (!getRandomValuesFn && globalThis?.crypto?.getRandomValues) {
  getRandomValuesFn = (arr: Uint8Array) => globalThis.crypto.getRandomValues!(arr);
}

function fillRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (getRandomValuesFn) {
    return getRandomValuesFn(bytes);
  }
  // Fallback (not cryptographically strong, but acceptable for non-security user id)
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

// Lightweight UUID v4 generator with graceful fallback
function generateUUIDv4(): string {
  const bytes = fillRandomBytes(16);
  // Per RFC 4122 set version and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xxxxxx
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push((bytes[i] + 0x100).toString(16).substring(1));
  }
  return (
    hex[0] + hex[1] + hex[2] + hex[3] + '-' +
    hex[4] + hex[5] + '-' +
    hex[6] + hex[7] + '-' +
    hex[8] + hex[9] + '-' +
    hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15]
  );
}

// Initialize analytics - disabled to prevent crashes
function initializeAnalytics() {
  // Analytics disabled to prevent Firebase crashes
  analyticsModule = null;
  console.log('📊 Analytics initialized (crash-safe mode)');
}

// Initialize analytics on module load
initializeAnalytics();

export async function ensureUserId() {
  let userId = await AsyncStorage.getItem(USER_ID_KEY);
  if (!userId) {
    try {
      userId = generateUUIDv4();
    } catch (e) {
      console.warn('UUID generation failed, falling back to timestamp-based id', e);
      userId = 'uid-' + Date.now().toString(36);
    }
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  }
  if (!isExpoGo && analyticsModule?.setUserId) {
    await analyticsModule.setUserId(userId);
  }
  return userId;
}

export async function setUserName(name: string) {
  await AsyncStorage.setItem(USER_NAME_KEY, name);
  if (analyticsModule) {
    if (isExpoGo && analyticsModule.setUserProperties) {
      await analyticsModule.setUserProperties({ user_name: name });
    } else if (analyticsModule.setUserProperty) {
      await analyticsModule.setUserProperty('user_name', name);
    }
  } else {
    logAnalyticsWarning('Analytics module is not available. Skipping setUserName.');
  }
}

export async function logBadgeEarned(badgeName: string) {
  await ensureUserId();
  if (analyticsModule && analyticsModule.logEvent) {
    if (isExpoGo) {
      await analyticsModule.logEvent('badge_earned', { badge_name: badgeName });
    } else {
      await analyticsModule.logEvent('badge_earned', { badge_name: badgeName });
    }
  } else {
    logAnalyticsWarning('Analytics module is not available. Skipping logBadgeEarned.');
  }
}

export async function logAyahMemorized(count: number, scope: 'daily' | 'weekly') {
  await ensureUserId();
  if (analyticsModule && analyticsModule.logEvent) {
    if (isExpoGo) {
      await analyticsModule.logEvent('ayah_memorized', { count, scope });
    } else {
      await analyticsModule.logEvent('ayah_memorized', { count, scope });
    }
  } else {
    logAnalyticsWarning('Analytics module is not available. Skipping logAyahMemorized.');
  }
}

export async function logAyahRevised(count: number) {
  await ensureUserId();
  if (analyticsModule && analyticsModule.logEvent) {
    await analyticsModule.logEvent('ayah_revised', { count });
  } else {
    logAnalyticsWarning('Analytics module is not available. Skipping logAyahRevised.');
  }
}

export async function logSurahRevised(surahId: number, scope: 'weekly') {
  await ensureUserId();
  if (analyticsModule && analyticsModule.logEvent) {
    if (isExpoGo) {
      await analyticsModule.logEvent('surah_revised', { surah_id: surahId, scope });
    } else {
      await analyticsModule.logEvent('surah_revised', { surah_id: surahId, scope });
    }
  } else {
    logAnalyticsWarning('Analytics module is not available. Skipping logSurahRevised.');
  }
}