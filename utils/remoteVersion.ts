import { LATEST_VERSION, MIN_SUPPORTED_VERSION, REMOTE_VERSION_TTL_MS, REMOTE_VERSION_URL } from '@/constants/appConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RemoteVersionConfig {
  min_supported: string;        // Users below must update
  latest: string;               // Latest available; soft prompt if current < latest
  force?: boolean;              // If true, treat as forced even if >= min_supported < latest
  release_notes?: string[];     // Optional list of notes displayed in modal
  android_package_id_override?: string; // Override for store link package id
  ios_app_id_override?: string; // Numeric App Store ID override
  timestamp?: string;           // ISO timestamp of the config
}

const STORAGE_KEY = 'remote_version_config';
const STORAGE_TS_KEY = 'remote_version_config_ts';

function nowMs() { return Date.now(); }

export async function fetchRemoteVersionConfig(force = false): Promise<RemoteVersionConfig | null> {
  try {
    if (!REMOTE_VERSION_URL) return null;

    // Check cache first unless force
    if (!force) {
      const tsStr = await AsyncStorage.getItem(STORAGE_TS_KEY);
      const ts = tsStr ? parseInt(tsStr, 10) : 0;
      if (ts && nowMs() - ts < REMOTE_VERSION_TTL_MS) {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached) {
          try { return JSON.parse(cached) as RemoteVersionConfig; } catch {}
        }
      }
    }

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 8000); // 8s timeout
    const resp = await fetch(REMOTE_VERSION_URL, { signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } });
    clearTimeout(to);
    if (!resp.ok) throw new Error('Remote version fetch failed');
    const json = await resp.json();

    // Basic validation
    if (!json || typeof json !== 'object' || !json.min_supported || !json.latest) {
      throw new Error('Invalid remote version schema');
    }

    const config: RemoteVersionConfig = {
      min_supported: String(json.min_supported),
      latest: String(json.latest),
      force: !!json.force,
      release_notes: Array.isArray(json.release_notes) ? json.release_notes.map(String) : undefined,
      android_package_id_override: json.android_package_id_override ? String(json.android_package_id_override) : undefined,
      ios_app_id_override: json.ios_app_id_override ? String(json.ios_app_id_override) : undefined,
      timestamp: json.timestamp ? String(json.timestamp) : new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    await AsyncStorage.setItem(STORAGE_TS_KEY, String(nowMs()));
    return config;
  } catch (e) {
    console.warn('[remoteVersion] fetch failed', e);
    return null;
  }
}

export async function getEffectiveVersionConfig(): Promise<RemoteVersionConfig> {
  // Attempt cached value even if stale for fallback
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      try { return JSON.parse(cached) as RemoteVersionConfig; } catch {}
    }
  } catch {}
  // Fallback to local constants
  return {
    min_supported: MIN_SUPPORTED_VERSION,
    latest: LATEST_VERSION,
    force: false,
    release_notes: undefined,
    timestamp: new Date().toISOString(),
  };
}
