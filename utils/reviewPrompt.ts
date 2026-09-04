import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { ReviewPromptState } from '@/store/settingsStore';
import { ANDROID_PACKAGE_ID, IOS_APP_STORE_ID } from '@/constants/appConfig';
// Lazily require 'react-native-in-app-review' to avoid bundler errors when
// the native module isn't installed in development or CI environments.
function getInAppReview(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-in-app-review');
    return mod;
  } catch (e) {
    return null;
  }
}

const KEY_LAST_PROMPT = 'last_review_prompt';
const KEY_REMIND_UNTIL = 'review_remind_until';
const KEY_CONSEC_OPEN_COUNT = 'review_consec_open_count';
const KEY_LAST_OPEN_DAY = 'review_last_open_day';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function now() { return Date.now(); }

export async function canPromptNative(): Promise<boolean> {
  try {
    const InAppReview = getInAppReview();
    if (!InAppReview || typeof InAppReview.isAvailable !== 'function') return false;
    if (!InAppReview.isAvailable()) return false;

    const last = await AsyncStorage.getItem(KEY_LAST_PROMPT);
    if (last && now() - parseInt(last, 10) < THIRTY_DAYS_MS) return false;

    const remind = await AsyncStorage.getItem(KEY_REMIND_UNTIL);
    if (remind && now() < parseInt(remind, 10)) return false;

    return true;
  } catch (e) {
    console.log('[review] canPromptNative failed', e);
    return false;
  }
}

export async function requestNativeReview(): Promise<boolean> {
  try {
    const InAppReview = getInAppReview();
    if (!InAppReview || typeof InAppReview.RequestInAppReview !== 'function') return false;
    const available = InAppReview.isAvailable();
    if (!available) return false;

    const res = await InAppReview.RequestInAppReview();
    if (res) {
      await AsyncStorage.setItem(KEY_LAST_PROMPT, now().toString());
    }
    return !!res;
  } catch (e) {
    console.log('[review] requestNativeReview failed', e);
    return false;
  }
}

export async function remindMeIn(days = 7) {
  try {
    const until = now() + days * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(KEY_REMIND_UNTIL, String(until));
  } catch (e) {
    console.log('[review] remindMeIn failed', e);
  }
}

export async function openFeedbackEmail(email = 'support@ihafidh.app', subject?: string, body?: string) {
  try {
    const params: string[] = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    const url = `mailto:${email}${query}`;
    await Linking.openURL(url);
  } catch (e) {
    console.log('[review] openFeedbackEmail failed', e);
  }
}

function isoDay(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

export async function trackAppOpenAndCheckTrigger(): Promise<boolean> {
  try {
    const today = isoDay();
    const lastDay = await AsyncStorage.getItem(KEY_LAST_OPEN_DAY);
    const consecRaw = await AsyncStorage.getItem(KEY_CONSEC_OPEN_COUNT);
    let consec = consecRaw ? parseInt(consecRaw, 10) : 0;

    if (lastDay === today) {
      // already counted for today
    } else {
      // determine if yesterday
      const yesterday = isoDay(Date.now() - 24 * 60 * 60 * 1000);
      if (lastDay === yesterday) {
        consec = consec + 1;
      } else {
        consec = 1;
      }
      await AsyncStorage.setItem(KEY_LAST_OPEN_DAY, today);
      await AsyncStorage.setItem(KEY_CONSEC_OPEN_COUNT, String(consec));
    }

    // Success moment: 7 consecutive opens
    if (consec >= 7) {
      const ok = await canPromptNative();
      return ok;
    }
    return false;
  } catch (e) {
    console.log('[review] trackAppOpenAndCheckTrigger failed', e);
    return false;
  }
}

export async function resetConsecutiveOpens() {
  try {
    await AsyncStorage.removeItem(KEY_CONSEC_OPEN_COUNT);
    await AsyncStorage.removeItem(KEY_LAST_OPEN_DAY);
  } catch (e) {
    console.log('[review] resetConsecutiveOpens failed', e);
  }
}

// ─── NEW IN-APP REVIEW FLOW ─────────────────────────────────────────────

const IOS_APP_ID = IOS_APP_STORE_ID || '6752505055';
const ANDROID_PKG = ANDROID_PACKAGE_ID || 'com.ihafidh';

export function shouldShowReviewPrompt(
  state: ReviewPromptState,
  sessionShownFlag: boolean
): boolean {
  if (state.hasRated) return false;
  if (sessionShownFlag) return false;

  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  if (state.lastShownAt && now() - state.lastShownAt < FOURTEEN_DAYS_MS) {
    return false;
  }

  return true;
}

export async function openReview(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
      } else {
        await Linking.openURL(
          `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`
        );
      }
    } catch (e) {
      console.log('[review] iOS openReview failed', e);
      await Linking.openURL(
        `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`
      );
    }
  } else {
    try {
      const marketUrl = `market://details?id=${ANDROID_PKG}&showAllReviews=true`;
      const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PKG}`;
      const canOpen = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(canOpen ? marketUrl : webUrl);
    } catch (e) {
      console.log('[review] Android openReview failed', e);
    }
  }
}
