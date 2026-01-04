// App-wide configuration for version gating and store links
// Adjust these values when you release a new minimum-supported version.

export const MIN_SUPPORTED_VERSION = '2.0.3'; // Local fallback minimum supported version
export const LATEST_VERSION = '2.0.3'; // Local fallback latest version for soft prompts

// Store metadata
// Android package id is read from android/app/build.gradle -> applicationId
export const ANDROID_PACKAGE_ID = 'com.ihafidh';

// iOS App Store id (numeric). Set this after your app is on the App Store.
// Example: '1234567890'
export const IOS_APP_STORE_ID: string | null = null;

// Remote version JSON (GitHub Pages or any HTTPS endpoint). Example:
export const REMOTE_VERSION_URL: string | null = 'https://aishiek.github.io/version.json';

// Remote config cache TTL (ms). We re-fetch when stale.
export const REMOTE_VERSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
