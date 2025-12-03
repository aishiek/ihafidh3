// TurboModule probe: attempts early calls to critical native modules to surface which one crashes.
// Each probe is isolated with timeout & error capture.
/* eslint-disable no-console */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
// expo-notifications is optional in this project (we use Firebase + Notifee).
// Load at runtime if present to avoid plugin resolution/build-time errors when the module is not installed.
let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch (e) { /* not installed or not available in this build */ }
import { openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';
// Optional modules (may not be installed) loaded via dynamic require to avoid build-time errors
let SecureStore: any; try { SecureStore = require('expo-secure-store'); } catch {}
let FileSystem: any; try { FileSystem = require('expo-file-system'); } catch {}
let Device: any; try { Device = require('expo-device'); } catch {}
let Application: any; try { Application = require('expo-application'); } catch {}
let Network: any; try { Network = require('expo-network'); } catch {}
// Reanimated probe (defensive require, since direct import may initialize native parts)
let Reanimated: any = null; try { Reanimated = require('react-native-reanimated'); } catch {}

export interface ProbeResult { name: string; ok: boolean; durationMs: number; error?: string; }

async function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ${ms}ms in ${tag}`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function runSingle(name: string, fn: () => Promise<any>): Promise<ProbeResult> {
  const start = Date.now();
  try {
    await withTimeout(fn(), 2500, name);
    return { name, ok: true, durationMs: Date.now() - start };
  } catch (e: any) {
    return { name, ok: false, durationMs: Date.now() - start, error: e?.message || String(e) };
  }
}

async function persistResults(results: ProbeResult[]) {
  try {
    const payload = { ts: Date.now(), results };
    await AsyncStorage.setItem('__IH_LAST_PROBE__', JSON.stringify(payload));
  } catch (e) {
    console.log('[probe] persist error', e);
  }
}

export async function getLastProbe(): Promise<{ ts: number; results: ProbeResult[] } | null> {
  try {
    const raw = await AsyncStorage.getItem('__IH_LAST_PROBE__');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function runTurboModuleProbe(): Promise<ProbeResult[]> {
  const tasks: Array<Promise<ProbeResult>> = [];

  // Storage & DB
  tasks.push(runSingle('AsyncStorage.getAllKeys', async () => { try { await AsyncStorage.getAllKeys(); } catch {} }));
  tasks.push(runSingle('SQLite.openDatabaseSync', async () => { try { openDatabaseSync('diag.db'); } catch {} }));
  if (SecureStore) tasks.push(runSingle('SecureStore.getItemAsync', async () => { try { await SecureStore.getItemAsync('nonexistent'); } catch {} }));
  if (FileSystem) tasks.push(runSingle('FileSystem.documentDirectory', async () => { try { if (!FileSystem.documentDirectory) throw new Error('no documentDirectory'); } catch {} }));

  // Fonts / Notifications / Location
  tasks.push(runSingle('Font.isLoaded(dummy)', async () => { try { (Font as any).isLoaded && (Font as any).isLoaded('ScheherazadeNew-Regular'); } catch {} }));
  if (Notifications) {
    tasks.push(runSingle('Notifications.getPermissionsAsync', async () => { try { await Notifications.getPermissionsAsync(); } catch {} }));
    tasks.push(runSingle('Notifications.getDevicePushTokenAsync', async () => { try { await Notifications.getDevicePushTokenAsync(); } catch {} }));
  }
  tasks.push(runSingle('Location.getProviderStatusAsync', async () => { try { await Location.getProviderStatusAsync(); } catch {} }));

  // Device / App / Network (optional)
  if (Device) tasks.push(runSingle('Device.info', async () => { try { Device.osName && Device.modelName; } catch {} }));
  if (Application) tasks.push(runSingle('Application.nativeVersion', async () => { try { Application.nativeApplicationVersion; } catch {} }));
  if (Network) tasks.push(runSingle('Network.getNetworkStateAsync', async () => { try { await Network.getNetworkStateAsync(); } catch {} }));

  // Haptics (iOS only)
  if (Platform.OS === 'ios') {
    tasks.push(runSingle('Haptics.impactAsync', async () => { try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }));
  }

  // Reanimated probe
  if (Reanimated) {
    tasks.push(runSingle('Reanimated.installCheck', async () => {
      try {
        if (typeof Reanimated.call === 'function') { /* noop */ }
      } catch {}
    }));
  }

  const results = await Promise.all(tasks);
  console.log('[probe] TurboModule results:', results);
  persistResults(results);
  return results;
}
