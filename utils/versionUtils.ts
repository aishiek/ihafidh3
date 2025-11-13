import { ANDROID_PACKAGE_ID, IOS_APP_STORE_ID } from '@/constants/appConfig';
import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';

export type VersionInfo = {
  version: string; // e.g. 1.3.1
  build: string | null; // e.g. 24 (android) or CFBundleVersion
};

export function getCurrentVersion(): VersionInfo {
  const version = Application.nativeApplicationVersion || '0.0.0';
  const build = Application.nativeBuildVersion || null;
  return { version, build };
}

// Compare dotted semantic-ish versions: 1.2.10 vs 1.2.2
// Returns -1 if a < b, 0 if equal, 1 if a > b
export function compareVersions(a: string, b: string): number {
  const pa = (a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = (b || '0').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

export function isVersionLower(current: string, min: string): boolean {
  return compareVersions(current, min) < 0;
}

export async function openStorePage(opts?: { androidPackageId?: string; iosAppId?: string; urlOverride?: string }) {
  try {
    if (opts?.urlOverride) {
      return Linking.openURL(opts.urlOverride);
    }
    if (Platform.OS === 'android') {
      const pkg = opts?.androidPackageId || ANDROID_PACKAGE_ID || Application.applicationId;
      const marketUrl = `market://details?id=${pkg}`;
      const webUrl = `https://play.google.com/store/apps/details?id=${pkg}`;
      const canOpen = await Linking.canOpenURL(marketUrl);
      if (canOpen) return Linking.openURL(marketUrl);
      return Linking.openURL(webUrl);
    } else if (Platform.OS === 'ios') {
      // itms-apps deep link works best when we have an app id
      const appId = opts?.iosAppId || IOS_APP_STORE_ID;
      if (appId) {
        const itmsUrl = `itms-apps://itunes.apple.com/app/id${appId}`;
        const canOpen = await Linking.canOpenURL(itmsUrl);
        if (canOpen) return Linking.openURL(itmsUrl);
        return Linking.openURL(`https://apps.apple.com/app/id${appId}`);
      }
      // Fallback: open developer search or generic App Store (developer SHOULD set IOS_APP_STORE_ID)
      return Linking.openURL('itms-apps://apps.apple.com');
    }
  } catch (e) {
    console.warn('[version] openStorePage failed', e);
  }
}
