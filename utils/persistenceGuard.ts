import { useActivityStore } from '@/store/activityStore';
import { useProgressStore } from '@/store/progressStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple persistence guard that snapshots critical stores and restores if they are unexpectedly empty.
// This is a defensive layer against rare storage wipes or migrations gone wrong.

const SNAPSHOT_PREFIX = '__ihafidh_snapshot__';
const SNAPSHOT_KEYS = {
  progress: `${SNAPSHOT_PREFIX}progress-storage`,
  activity: `${SNAPSHOT_PREFIX}activity-storage`,
};

async function snapshotIfHealthy(): Promise<void> {
  try {
    // Snapshot progress store
    const progressRaw = await AsyncStorage.getItem('progress-storage');
    if (progressRaw) {
      await AsyncStorage.setItem(SNAPSHOT_KEYS.progress, progressRaw);
    }
    // Snapshot activity store
    const activityRaw = await AsyncStorage.getItem('activity-storage');
    if (activityRaw) {
      await AsyncStorage.setItem(SNAPSHOT_KEYS.activity, activityRaw);
    }
  } catch (e) {
    // non-fatal
  }
}

async function maybeRestoreFromSnapshot(): Promise<void> {
  try {
    const progressRaw = await AsyncStorage.getItem('progress-storage');
    const activityRaw = await AsyncStorage.getItem('activity-storage');

    // Define "empty" heuristics: missing or trivially small JSON
    const looksEmpty = (s: string | null) => !s || s.length < 10;

    // Try to restore progress if empty
    if (looksEmpty(progressRaw)) {
      const snap = await AsyncStorage.getItem(SNAPSHOT_KEYS.progress);
      if (snap && !looksEmpty(snap)) {
        await AsyncStorage.setItem('progress-storage', snap);
        // Trigger state rehydration by writing a no-op
        try { useProgressStore.persist.rehydrate(); } catch {}
        console.log('[guard] restored progress-storage from snapshot');
      }
    }

    // Try to restore activity if empty
    if (looksEmpty(activityRaw)) {
      const snap = await AsyncStorage.getItem(SNAPSHOT_KEYS.activity);
      if (snap && !looksEmpty(snap)) {
        await AsyncStorage.setItem('activity-storage', snap);
        try { useActivityStore.persist.rehydrate(); } catch {}
        console.log('[guard] restored activity-storage from snapshot');
      }
    }
  } catch (e) {
    // non-fatal
  }
}

// Public entrypoint: call once on app start
export function initPersistenceGuard(): void {
  // Take an early snapshot in case the app is healthy right now
  snapshotIfHealthy().catch(() => {});

  // Also try a best-effort restore if current storage appears empty
  maybeRestoreFromSnapshot().catch(() => {});

  // Periodic snapshots (lightweight) – at most once every app session minute
  let last = 0;
  const interval = setInterval(() => {
    const now = Date.now();
    if (now - last > 60_000) {
      last = now;
      snapshotIfHealthy().catch(() => {});
    }
  }, 60_000);

  // Expose a teardown for tests (not used in app)
  (initPersistenceGuard as any)._teardown = () => clearInterval(interval);
}
