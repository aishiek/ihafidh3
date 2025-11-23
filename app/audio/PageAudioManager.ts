import { cacheAudioFile, getCachedAudioPath } from '@/assets/database/QuranDatabase';
import { useSettingsStore } from '@/store/settingsStore';
import { ensureAudioCacheDir } from '@/utils/audioCache';
import { getAudioUrl, initializeAudio, stopAudio } from '@/utils/audioUtils';
import { Audio } from 'expo-av';
// Use dynamic require for expo-file-system to avoid type/resolution issues in some runtimes
let FileSystem: any;
try {
  // prefer the legacy API bundle to avoid runtime deprecation errors
  // newer Expo versions recommend the File/Directory classes but the legacy
  // export keeps downloadAsync/getInfoAsync/makeDirectoryAsync available.
  FileSystem = require('expo-file-system/legacy');
} catch (err) {
  try {
    FileSystem = require('expo-file-system');
  } catch (error) {
    FileSystem = null;
    // swallowing here — caller will handle missing FS gracefully
  }
}

export interface VerseRef {
  surahNumber: number;
  ayahNumber: number;
  id?: number | string;
}

export interface PageAudioFile {
  verse: VerseRef;
  localPath: string;
  remoteUrl: string;
  downloaded: boolean;
  fileSize?: number;
}

export interface AudioState {
  isPlaying: boolean;
  isPaused: boolean;
  isDownloading: boolean;
  currentVerseIndex: number;
  currentRepeat: number;
  totalRepeats: number;
  downloadProgress: number; // 0-100
}

/**
 * PageAudioManager - orchestrates batch download and sequential playback for page-mode
 * Important: This reuses the app's existing audio helpers (playAudio, pauseAudio, stopAudio)
 * and the DB cache helpers (getCachedAudioPath/cacheAudioFile). It does not touch
 * the surah-level player directly.
 */
export class PageAudioManager {
  private audioFiles: PageAudioFile[] = [];
  private currentIndex = 0;
  private repeatCount = 1;
  private currentRepeat = 0;
  private isPlaying = false;
  private isPaused = false;
  // Active sound instance controlled by this manager (for pause/resume/stop)
  private currentSound: Audio.Sound | null = null;
  // Abort controller used to cancel waiting for a playAudioFile automatically
  private playbackAbortController: AbortController | null = null;

  // listener collections (multi-subscriber)
  private stateListeners = new Set<(s: AudioState) => void>();
  private verseStartListeners = new Set<(index: number, verse: VerseRef) => void>();
  private verseCompleteListeners = new Set<(index: number, verse: VerseRef) => void>();
  private pageCompleteListeners = new Set<() => void>();
  private errorListeners = new Set<(err: Error) => void>();
  private downloadProgressListeners = new Set<(progress: number) => void>();

  constructor() {}

  private makeCacheId(reciterId: string, verse: VerseRef) {
    // Use a deterministic id for caching - prefer numeric verse id when available
    if (verse.id) return String(verse.id);
    return `${reciterId || 'reciter'}_${verse.surahNumber}_${verse.ayahNumber}`;
  }

  // --- Listener management API (multi-subscriber) ---
  addStateListener(fn: (s: AudioState) => void) { this.stateListeners.add(fn); }
  removeStateListener(fn: (s: AudioState) => void) { this.stateListeners.delete(fn); }

  addVerseStartListener(fn: (index: number, verse: VerseRef) => void) { this.verseStartListeners.add(fn); }
  removeVerseStartListener(fn: (index: number, verse: VerseRef) => void) { this.verseStartListeners.delete(fn); }

  addVerseCompleteListener(fn: (index: number, verse: VerseRef) => void) { this.verseCompleteListeners.add(fn); }
  removeVerseCompleteListener(fn: (index: number, verse: VerseRef) => void) { this.verseCompleteListeners.delete(fn); }

  addPageCompleteListener(fn: () => void) { this.pageCompleteListeners.add(fn); }
  removePageCompleteListener(fn: () => void) { this.pageCompleteListeners.delete(fn); }

  addErrorListener(fn: (err: Error) => void) { this.errorListeners.add(fn); }
  removeErrorListener(fn: (err: Error) => void) { this.errorListeners.delete(fn); }

  addDownloadProgressListener(fn: (p: number) => void) { this.downloadProgressListeners.add(fn); }
  removeDownloadProgressListener(fn: (p: number) => void) { this.downloadProgressListeners.delete(fn); }

  private makeLocalPath(reciterId: string, verse: VerseRef) {
    const cacheDir = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}audio/${reciterId}/` : (FileSystem.cacheDirectory || '') + `audio/${reciterId}/`;
    return `${cacheDir}${verse.surahNumber}_${verse.ayahNumber}.mp3`;
  }

  /**
   * Download all page audio files. Will skip files already cached.
   * Reports progress via onDownloadProgress callback.
   */
  async downloadPageAudio(verses: VerseRef[], reciterId: string): Promise<PageAudioFile[]> {
    this.audioFiles = [];

    // If the runtime lacks FileSystem (rare in testing) — skip trying to download
    // and surface remote URLs so playback can continue.
    if (!FileSystem) {
      // mark all as remote-only (not downloaded) so playPage falls back to remote URLs
      this.audioFiles = verses.map((v) => ({
        verse: v,
        localPath: getAudioUrl(reciterId, v.surahNumber, v.ayahNumber),
        remoteUrl: getAudioUrl(reciterId, v.surahNumber, v.ayahNumber),
        downloaded: false,
      }));

      // notify progress/listeners
      this.downloadProgressListeners.forEach((l) => l(100));
      return this.audioFiles;
    }

    await ensureAudioCacheDir();

    const total = verses.length;
    let completed = 0;

    try {
      this.downloadProgressListeners.forEach((l) => l(0));

      for (let i = 0; i < total; i++) {
        const verse = verses[i];
        const id = this.makeCacheId(reciterId, verse);
        const remoteUrl = getAudioUrl(reciterId, verse.surahNumber, verse.ayahNumber);

        // Check DB cache first
        let localPath = await getCachedAudioPath(id);
        let exists = false;

        if (localPath) {
          try {
            const fi = await FileSystem.getInfoAsync(localPath);
            exists = !!fi.exists;
          } catch (e) { exists = false; }
        }

        if (!exists) {
          // Also check our intended local path in case DB is empty but file exists
          localPath = this.makeLocalPath(reciterId, verse);
          try {
            const dir = localPath.substring(0, localPath.lastIndexOf('/'));
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
            const info = await FileSystem.getInfoAsync(localPath);
            if (info.exists) exists = true;
          } catch (_) { exists = false; }
        }

        if (!exists) {
          try {
            // Download to localPath
            const dst = this.makeLocalPath(reciterId, verse);
            let res: any;

            try {
              res = await FileSystem.downloadAsync(remoteUrl, dst);
            } catch (e: any) {
              // Some expo runtimes surface a deprecation error — try the legacy bundle if available
              const message = typeof e?.message === 'string' ? e.message : String(e);
              if (message.includes('deprecated')) {
                try {
                  const LegacyFS = require('expo-file-system/legacy');
                  res = await LegacyFS.downloadAsync(remoteUrl, dst);
                } catch (err2) {
                  throw e; // rethrow original error if legacy path fails
                }
              } else {
                throw e;
              }
            }

            // verify
            if (res.status !== 200 && res.status !== 201) {
              throw new Error(`Failed to download ${remoteUrl} (status ${res.status})`);
            }

            const fileInfo = await FileSystem.getInfoAsync(res.uri);
            const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined;
            await cacheAudioFile(id, 'verse', res.uri, remoteUrl, size || 0).catch(() => {});
            localPath = res.uri;
            exists = true;
          } catch (err: any) {
            // mark not downloaded and pass along
            const failure: PageAudioFile = { verse, localPath: remoteUrl, remoteUrl, downloaded: false };
            this.audioFiles.push(failure);
            // If the error is the expo-file-system 'deprecated' message we avoid spamming
            // error listeners (it is noisy in some runtimes). Notify via console.warn instead.
            const msg = typeof err?.message === 'string' ? err.message : String(err);
            if (msg.includes('deprecated')) {
              console.warn('[PageAudioManager] file download skipped due to deprecated FileSystem API:', msg);
            } else {
              this.errorListeners.forEach((l) => l(err instanceof Error ? err : new Error(String(err))));
            }
            completed++;
            const progress = Math.round((completed / total) * 100);
            this.downloadProgressListeners.forEach((l) => l(progress));
            continue; // continue with next
          }
        }

        // At this point localPath should exist
        this.audioFiles.push({ verse, localPath: localPath || remoteUrl, remoteUrl, downloaded: true });

        completed++;
        const progress = Math.round((completed / total) * 100);
        this.downloadProgressListeners.forEach((l) => l(progress));
      }

      // final
      this.downloadProgressListeners.forEach((l) => l(100));
      return this.audioFiles;
    } catch (error) {
      this.errorListeners.forEach((l) => l(error as Error));
      throw error;
    }
  }

  async playPage(repeatCount = 1) {
    if (!this.audioFiles.length) throw new Error('No audio files loaded. Call downloadPageAudio first.');

    // If the global settings enable infinite loop, honor that first —
    // otherwise treat repeatCount <= 0 as a signal to repeat forever as well.
    const settingsInfinite = useSettingsStore.getState().infiniteLoop;
    if (settingsInfinite) {
      this.repeatCount = Infinity;
    } else {
      this.repeatCount = repeatCount <= 0 ? Infinity : repeatCount;
    }
    this.currentIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.updateState();

    try {
      // Delegate to a sequential playback helper that awaits each file
      await this.playSequentially();
    } catch (error) {
      this.errorListeners.forEach((l) => l(error as Error));
      this.reset();
      throw error;
    }
  }

  // Play all loaded audio files sequentially; each file will be awaited before
  // moving to the next so callers won't skip ahead.
  private async playSequentially(): Promise<void> {
    console.log('[PageAudioManager] 🎵 Starting playSequentially, total verses:', this.audioFiles.length);

    while (this.currentIndex < this.audioFiles.length && this.isPlaying) {
      const audioFile = this.audioFiles[this.currentIndex];
      const urlToPlay = audioFile.downloaded ? audioFile.localPath : audioFile.remoteUrl;

      console.log('[PageAudioManager] 🎵 Playing verse', this.currentIndex + 1, '/', this.audioFiles.length, 'ayah:', audioFile.verse.ayahNumber);

      // Notify verse start
      this.verseStartListeners.forEach((l) => l(this.currentIndex, audioFile.verse));
      this.updateState();

      // Play this verse with repeats. Finite and infinite repeat handling differ.
      if (Number.isFinite(this.repeatCount)) {
        for (this.currentRepeat = 1; this.currentRepeat <= this.repeatCount; this.currentRepeat++) {
          if (!this.isPlaying) break;

          console.log('[PageAudioManager] 🔁 Repeat', this.currentRepeat, '/', this.repeatCount);

          // MUST AWAIT here so we wait for playback to finish
          await this.playAudioFile(urlToPlay);

          // Pause between repeats (only if not last repeat)
          if (this.currentRepeat < this.repeatCount) await this.delay(300);
        }
      } else {
        // Infinite repeats — loop until isPlaying becomes false
        this.currentRepeat = 1;
        while (this.isPlaying) {
          console.log('[PageAudioManager] 🔁 Infinite repeat iteration', this.currentRepeat);
          await this.playAudioFile(urlToPlay);
          if (!this.isPlaying) break;
          await this.delay(300);
          this.currentRepeat++;
        }
      }

      console.log('[PageAudioManager] ✅ Verse complete:', this.currentIndex);

      // Notify verse complete
      this.verseCompleteListeners.forEach((l) => l(this.currentIndex, audioFile.verse));

      // Move to next verse
      this.currentIndex++;
    }

    console.log('[PageAudioManager] 🎉 Page playback complete');

    // Page complete
    if (this.currentIndex >= this.audioFiles.length) {
      this.pageCompleteListeners.forEach((l) => l());
      this.reset();
    }
  }

  // Play a single audio file and return a promise that resolves when playback finishes
  private async playAudioFile(localPath: string): Promise<void> {
    console.log('[PageAudioManager] 🔊 playAudioFile called:', localPath);

    // Create a dedicated Audio.Sound instance so page-mode playback waits exactly
    // for the file to finish — this avoids interacting with the shared playAudio
    // lifecycle which has its own repeat/loop logic.
    // Manager-level control: create an AbortController to cancel waiting for finish
    if (this.playbackAbortController) {
      try { this.playbackAbortController.abort(); } catch (_) {}
      this.playbackAbortController = null;
    }

    this.playbackAbortController = new AbortController();
    const { signal } = this.playbackAbortController;

    // Ensure global audio is initialized and shared players are stopped
    await stopAudio().catch(() => {});
    await initializeAudio().catch(() => {});

    // Allocate a local sound and set it as currentSound for manager control
    const sound = new Audio.Sound();
    this.currentSound = sound;

    try {
      await sound.loadAsync({ uri: localPath });

      // Reapply playback speed from settings
      try {
        const { playbackSpeed } = useSettingsStore.getState();
        if (playbackSpeed && playbackSpeed !== 1.0) await sound.setRateAsync(playbackSpeed, true);
      } catch (e) {
        console.warn('[PageAudioManager] failed to apply playbackSpeed', e);
      }

      let started = false;

      const waitForFinish = new Promise<void>((resolve, reject) => {
        const handler = (status: any) => {
          if (!status) return;
          if (status.error) return reject(new Error(String(status.error)));
          if (!started && status.isLoaded && status.isPlaying) started = true;
          if (started && status.didJustFinish) {
            resolve();
          }
        };

        sound.setOnPlaybackStatusUpdate(handler);

        // Abort behaviour — resolve gracefully when stopped so callers can exit
        // playback cleanly without bubbling a hard error.
        signal.addEventListener('abort', async () => {
          try {
            const st = await sound.getStatusAsync();
            if (st?.isLoaded) {
              await sound.stopAsync();
              await sound.unloadAsync();
            }
          } catch (_) {}
          // Resolve (not reject) — stop() / abort should be considered a normal exit
          // so that the sequential player stops without raising an error.
          return resolve();
        });
      });

      await sound.playAsync();
      await waitForFinish;

      try { await sound.unloadAsync(); } catch (_) {}
      console.log('[PageAudioManager] ✅ Audio finished');

    } catch (error: any) {
      // Treat abort-like errors as a normal stop rather than a hard failure.
      const msg = typeof error?.message === 'string' ? error.message : String(error);
      if (msg.includes('Playback aborted') || msg.toLowerCase().includes('aborted') || msg.includes('AbortError')) {
        console.info('[PageAudioManager] ⚪ playAudioFile aborted, treating as normal stop:', msg);
        try { await sound.unloadAsync(); } catch (_) {}
        if (this.currentSound === sound) this.currentSound = null;
        // Resolve quietly — caller will observe isPlaying/state and act accordingly.
        return;
      }

      console.error('[PageAudioManager] ❌ playAudioFile error:', error);
      try { await sound.unloadAsync(); } catch (_) {}
      // Ensure currentSound is cleared for safety
      if (this.currentSound === sound) this.currentSound = null;
      throw error;
    } finally {
      if (this.currentSound === sound) this.currentSound = null;
      // release abort controller after completion
      if (this.playbackAbortController) {
        try { this.playbackAbortController = null; } catch (_) {}
      }
    }
  }

  async pause() {
    this.isPaused = true;
    this.isPlaying = false;
    if (this.currentSound) {
      try {
        const st = await this.currentSound.getStatusAsync();
        if (st.isLoaded && st.isPlaying) await this.currentSound.pauseAsync();
      } catch (e) {
        // Fallback to shared stop if local pause fails
        console.warn('[PageAudioManager] pause failed locally, falling back to shared stop', e);
        await stopAudio().catch(() => {});
      }
    } else {
      await stopAudio().catch(() => {});
    }
    this.updateState();
  }

  async resume() {
    this.isPaused = false;
    this.isPlaying = true;
    if (this.currentSound) {
      try {
        const st = await this.currentSound.getStatusAsync();
        if (st.isLoaded && !st.isPlaying) await this.currentSound.playAsync();
      } catch (e) {
        console.warn('[PageAudioManager] resume failed:', e);
      }
    }
    this.updateState();
  }

  async stop() {
    this.isPlaying = false;

    // Abort any pending play/promise and clean up current sound
    if (this.playbackAbortController) {
      try {
        // Add a small trace so runtime logs show where abort was triggered from.
        const trace = new Error('stop() called — aborting playback').stack;
        console.debug('[PageAudioManager] stop(): aborting playback \n', trace);
        this.playbackAbortController.abort();
      } catch (_) {}
      this.playbackAbortController = null;
    }

    if (this.currentSound) {
      try {
        const s = await this.currentSound.getStatusAsync();
        if (s.isLoaded) {
          await this.currentSound.stopAsync();
          await this.currentSound.unloadAsync();
        }
      } catch (e) {
        try { await this.currentSound.unloadAsync(); } catch (_) {}
      }
      this.currentSound = null;
    }

    // Also stop any shared global player
    await stopAudio().catch(() => {});

    this.reset();
  }

  async skipToVerse(index: number) {
    if (index < 0 || index >= this.audioFiles.length) throw new Error('Invalid verse index');

    this.currentIndex = index;
    await this.stop();
    await this.playPage(this.repeatCount);
  }

  private reset() {
    this.currentIndex = 0;
    this.currentRepeat = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.updateState();
  }

  private updateState() {
    // notify listeners with current state
    const state: AudioState = {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isDownloading: false,
      currentVerseIndex: this.currentIndex,
      currentRepeat: this.currentRepeat,
      totalRepeats: this.repeatCount,
      downloadProgress: 100,
    };
    this.stateListeners.forEach((l) => l(state));
    return state;
  }

  private delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

  async cleanup() {
    await this.stop();
    this.audioFiles = [];
    // Do NOT remove listeners here — UI components are responsible for removing
    // their own listeners on unmount. Cleanup should only reset internal playback
    // state and clear downloaded file references so a fresh session may be started.
    this.currentIndex = 0;
    this.currentRepeat = 0;
    this.repeatCount = 1;
  }
}

export default PageAudioManager;

// Singleton accessor — use single manager instance across app (lazy init)
let _pageAudioManagerInstance: PageAudioManager | null = null;

export function getPageAudioManager(): PageAudioManager {
  if (!_pageAudioManagerInstance) _pageAudioManagerInstance = new PageAudioManager();
  return _pageAudioManagerInstance;
}
