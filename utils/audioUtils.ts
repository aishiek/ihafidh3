import { useSettingsStore, type PlaybackSpeed } from '@/store/settingsStore';
import type { Verse } from '@/types';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

export type AudioStatus = {
  isPlaying?: boolean;
  isPaused?: boolean;
  didJustFinish?: boolean;
  error?: string;
  currentUrl?: string;
  repeatCount?: number;
  maxRepeats?: number;
  fallbackUsed?: boolean;
  message?: string;
  isInfiniteLoop?: boolean;
};

// Separate audio contexts for different types of audio
// Keep Sound instances in module scope to avoid garbage collection while playing.
// Storing these references prevents the JS GC from collecting the underlying native audio objects.
let versePlayer: Audio.Sound | null = null;
let surahPlayer: Audio.Sound | null = null;
let isPlayingVerse = false;
let isPlayingSurah = false;

// Legacy global player for backward compatibility (points to verse player)
let player: Audio.Sound | null = null;
let isPlaying = false;
let repeatCount = 0;
let maxRepeats = 1;
let currentUrl = '';
let statusCallback: ((status: AudioStatus) => void) | null = null;
let isInfiniteLoop = false;
// When true, onPlaybackStatus will only forward status updates and won't perform auto-replay.
let manualRepeatModeActive = false;

// Surah-specific state
let surahStatusCallback: ((status: AudioStatus) => void) | null = null;
let isSurahManuallyPaused = false;

// Note: We now use local Bismillah file instead of remote URL

/* ---------- INIT ---------- */
export async function initializeAudio() {
  try {
    console.log('AudioUtils: Initializing audio mode...');
    
    // Configure audio mode for background playback and correct iOS/Android behavior
    // Important flags:
    // - staysActiveInBackground: allow playback when app is backgrounded / screen locked
    // - playsInSilentModeIOS: allow audio to play even if the phone ringer is silent
    // - shouldDuckAndroid: reduce other audio when playback starts (recommended on Android)
    // - playThroughEarpieceAndroid: false ensures playback uses loudspeaker by default
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    
    console.log('AudioUtils: Audio mode initialized successfully');
  } catch (err) {
    console.warn('AudioUtils: Failed to initialize audio mode:', err);
  }
}

/* ---------- URL HELPERS ---------- */
function calculateGlobalAyahId(surah: number, ayah: number) {
  const counts = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
    123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
    60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
    5, 4, 5, 6
  ];
  return counts.slice(0, surah - 1).reduce((a, b) => a + b, 0) + ayah;
}

export async function checkAudioAvailability(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}
// Supported reciters (prioritized) and default
export const SUPPORTED_RECITERS = [
  'ar.alafasy',
  'ar.abdulbasitmurattal',
  'ar.abdurrahmaansudais',
  'ar.shaatri',
  'ar.hanirifai',
];

export const DEFAULT_RECITER = 'ar.alafasy';

/**
 * Get a valid reciter identifier, with fallback to default if invalid.
 * No network calls - just validates against known list.
 */
export function getValidReciter(reciter: string | undefined): string {
  if (!reciter) return DEFAULT_RECITER;
  if (SUPPORTED_RECITERS.includes(reciter)) return reciter;
  console.warn(`AudioUtils: Reciter "${reciter}" not supported, falling back to ${DEFAULT_RECITER}`);
  return DEFAULT_RECITER;
}

// Synchronous URL builders: do NOT perform network checks. These return the primary CDN URL.
export function getAudioUrl(reciter: string | undefined, surah: number, ayah: number): string {
  const validReciter = getValidReciter(reciter);
  const globalAyah = calculateGlobalAyahId(surah, ayah);
  return `https://cdn.islamic.network/quran/audio/128/${validReciter}/${globalAyah}.mp3`;
}

export function getSurahAudioUrl(reciter: string | undefined, surah: number): string {
  const validReciter = getValidReciter(reciter);
  return `https://cdn.islamic.network/quran/audio-surah/128/${validReciter}/${surah}.mp3`;
}

// Note: generateSurahUrl and network checks removed. Use getSurahAudioUrl for synchronous URL construction.

/* ---------- CORE AUDIO ---------- */
export async function playAudio(url: string, repeats: number = 1, callback?: (status: AudioStatus) => void) {
  console.log(`AudioUtils: Starting playAudio with url: ${url}, repeats: ${repeats}`);

  await stopAudio(); // Only stop verse audio, not surah audio
  await initializeAudio();

  const { playbackSpeed, infiniteLoop } = useSettingsStore.getState();

  try {
    versePlayer = new Audio.Sound();
    player = versePlayer; // For backward compatibility

    console.log('AudioUtils: Loading verse audio from URL:', url);
    await versePlayer.loadAsync({ uri: url });

    const loadStatus = await versePlayer.getStatusAsync();
    if (!loadStatus.isLoaded) {
      throw new Error('Audio failed to load properly');
    }

    // Apply playback speed after audio is loaded
    if (loadStatus.isLoaded && playbackSpeed && playbackSpeed !== 1.0) {
      await versePlayer.setRateAsync(playbackSpeed, true);
    }

    currentUrl = url;
    maxRepeats = repeats <= 0 ? 1 : Math.max(1, repeats);
    repeatCount = 0;
    isPlaying = true;
    isPlayingVerse = true;
    isInfiniteLoop = infiniteLoop || repeats <= 0;
    statusCallback = callback || null;

  // Use manual repeat mode to avoid double-replay between onPlaybackStatus and the manual loop below.
  manualRepeatModeActive = true;
  // Set a minimal status update handler that forwards to onPlaybackStatus (which will no-op replay while manualRepeatModeActive)
  versePlayer.setOnPlaybackStatusUpdate((s: any) => onPlaybackStatus(s));

    await versePlayer.setVolumeAsync(1.0);

    // Helper that returns a promise resolving when the current play finishes
    const waitForFinish = () => new Promise<void>((resolve, reject) => {
      const handler = async (s: any) => {
        try {
          // Forward status to global handler
          onPlaybackStatus(s);

          if (s.error) {
            // Forward error and reject
            statusCallback?.({ isPlaying: false, error: s.error, currentUrl });
            versePlayer?.setOnPlaybackStatusUpdate(onPlaybackStatus);
            return reject(new Error(s.error));
          }

          if (s.didJustFinish) {
            // restore the global handler and resolve
            versePlayer?.setOnPlaybackStatusUpdate(onPlaybackStatus);
            return resolve();
          }
        } catch (e) {
          versePlayer?.setOnPlaybackStatusUpdate(onPlaybackStatus);
          return reject(e);
        }
      };

      // Temporarily attach handler that forwards to onPlaybackStatus and resolves when done
      versePlayer?.setOnPlaybackStatusUpdate(handler);
    });

    // Start first play
    console.log('AudioUtils: Starting verse audio playback');
    await versePlayer.playAsync();
    callback?.({ isPlaying: true, currentUrl: url, repeatCount: 0, maxRepeats: isInfiniteLoop ? Infinity : maxRepeats, isInfiniteLoop });

    // If infinite loop, keep waiting and replaying until stopAudio flips isInfiniteLoop
    let shouldContinue = true;

  while (shouldContinue) {
      // Wait for the current play to finish
      try {
        await waitForFinish();
      } catch (err) {
        // Playback error occurred - stop and surface error
        console.error('AudioUtils: Error while waiting for finish:', err);
        await stopAudio();
        throw err;
      }

      // Determine if we should replay
      if (isInfiniteLoop) {
        // If still infinite, reset position and play again
        try {
          await player?.setPositionAsync(0);
          await player?.playAsync();
          // notify status
          statusCallback?.({ isPlaying: true, currentUrl, repeatCount: Infinity, maxRepeats: Infinity, isInfiniteLoop: true });
          // loop continues
          shouldContinue = true;
        } catch (err) {
          console.error('AudioUtils: Failed to replay on infinite loop:', err);
          await stopAudio();
          shouldContinue = false;
        }
      } else {
        // finite repeats: replay until we've done (maxRepeats) plays
        if (repeatCount < maxRepeats - 1) {
          repeatCount++;
          try {
            await player?.setPositionAsync(0);
            await player?.playAsync();
            statusCallback?.({ isPlaying: true, currentUrl, repeatCount, maxRepeats, isInfiniteLoop: false });
            shouldContinue = true;
          } catch (err) {
            console.error('AudioUtils: Failed to replay:', err);
            await stopAudio();
            shouldContinue = false;
          }
        } else {
          // Completed requested repeats
          await stopAudio();
          shouldContinue = false;
        }
      }
    }
    // Completed playback loop - disable manual mode
    manualRepeatModeActive = false;
  } catch (error) {
    console.error('AudioUtils: Failed to play verse audio:', error);
    console.error('AudioUtils: Failed URL:', url);

    if (error instanceof Error) {
      console.error('AudioUtils: Error name:', error.name);
      console.error('AudioUtils: Error message:', error.message);
      console.error('AudioUtils: Error stack:', error.stack);
    }

    statusCallback?.({ isPlaying: false, error: `Failed to load or play audio: ${error instanceof Error ? error.message : 'Unknown error'}`, currentUrl: url });

  // Clean up state
    isPlaying = false;
    isPlayingVerse = false;
  manualRepeatModeActive = false;
    if (versePlayer) {
      try {
        await versePlayer.unloadAsync();
      } catch (unloadError) {
        console.error('AudioUtils: Error during cleanup:', unloadError);
      }
      versePlayer = null;
      player = null;
    }

    throw error;
  }
}

// Separate function for surah audio that doesn't interfere with verse audio
async function playSurahAudioInternal(url: string, callback?: (status: AudioStatus) => void) {
  console.log(`AudioUtils: Starting surah audio with url: ${url}`);
  
  await stopSurahAudio(); // Only stop surah audio, not verse audio
  await initializeAudio();

  const { playbackSpeed } = useSettingsStore.getState();
  
  try {
    surahPlayer = new Audio.Sound();
    
    console.log('AudioUtils: Loading surah audio from URL:', url);
    
    // Direct loading without timeout wrapper
    await surahPlayer.loadAsync({ uri: url });
    
    console.log('AudioUtils: Surah audio loaded, checking status...');
    
    // Apply playback speed after audio is loaded
    const status = await surahPlayer.getStatusAsync();
    if (status.isLoaded && playbackSpeed && playbackSpeed !== 1.0) {
      await surahPlayer.setRateAsync(playbackSpeed, true);
    }
    
    isPlayingSurah = true;
    isSurahManuallyPaused = false;
    surahStatusCallback = callback || null;

    surahPlayer.setOnPlaybackStatusUpdate((status: any) => {
      if (!status) return;

      if (status.isLoaded) {
        // Only update playing state if not manually paused
        if (!isSurahManuallyPaused) {
          isPlayingSurah = status.isPlaying;
        }

        surahStatusCallback?.({
          isPlaying: isPlayingSurah,
          didJustFinish: status.didJustFinish,
        });

        if (status.didJustFinish) {
          isSurahManuallyPaused = false;
          stopSurahAudio();
        }
      } else if (status.error) {
        isSurahManuallyPaused = false;
        surahStatusCallback?.({ isPlaying: false, error: status.error });
      }
    });

    console.log('AudioUtils: Starting surah audio playback');
    await surahPlayer.playAsync();
    
    callback?.({ 
      isPlaying: true, 
      currentUrl: url
    });
  } catch (error) {
    console.error('AudioUtils: Failed to play surah audio:', error);
    console.error('AudioUtils: Failed surah URL:', url);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('AudioUtils: Surah error name:', error.name);
      console.error('AudioUtils: Surah error message:', error.message);
      console.error('AudioUtils: Surah error stack:', error.stack);
    }
    
    callback?.({ 
      isPlaying: false, 
      error: `Failed to load or play surah audio: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
    
    // Clean up state
    isPlayingSurah = false;
    if (surahPlayer) {
      try {
        await surahPlayer.unloadAsync();
      } catch (unloadError) {
        console.error('AudioUtils: Error during surah cleanup:', unloadError);
      }
      surahPlayer = null;
    }
    
    throw error;
  }
}

async function onPlaybackStatus(status: any) {
  if (!status) return;
  // If manual repeat mode is active, don't perform automatic replay here.
  // The manual playback loop (playAudio) is responsible for replaying when manualRepeatModeActive === true.
  if (manualRepeatModeActive) {
    try {
      // Forward a lightweight status update to any listeners and return early.
      statusCallback?.({
        isPlaying: !!status.isPlaying,
        didJustFinish: !!status.didJustFinish,
        currentUrl,
        repeatCount: isInfiniteLoop ? Infinity : repeatCount,
        maxRepeats: isInfiniteLoop ? Infinity : maxRepeats,
        isInfiniteLoop
      });
    } catch (e) {
      console.warn('AudioUtils: onPlaybackStatus (manual mode) failed to forward status', e);
    }
    return;
  }

  if (status.isLoaded) {
    isPlaying = status.isPlaying;

    statusCallback?.({
      isPlaying,
      maxRepeats: isInfiniteLoop ? Infinity : maxRepeats,
      didJustFinish: status.didJustFinish,
    });

    if (status.didJustFinish) {
      if (isInfiniteLoop || (repeatCount < maxRepeats - 1)) {
        if (!isInfiniteLoop) {
          repeatCount++;
        }
        // Update status with current repeat count before replaying
        statusCallback?.({
          isPlaying,
          currentUrl,
          repeatCount: isInfiniteLoop ? Infinity : repeatCount,
          maxRepeats: isInfiniteLoop ? Infinity : maxRepeats,
          isInfiniteLoop
        });
        await player?.setPositionAsync(0);
        await player?.playAsync();
      } else {
        await stopAudio();
      }
    }
  } else if (status.error) {
    statusCallback?.({ isPlaying: false, error: status.error });
  }
}
export async function stopAudio() {
  try {
    // Stop verse audio
    await player?.stopAsync();
    await player?.unloadAsync();
    await versePlayer?.stopAsync();
    await versePlayer?.unloadAsync();
  } catch {}
  
  player = null;
  versePlayer = null;
  isPlaying = false;
  isPlayingVerse = false;
  currentUrl = '';
  repeatCount = 0;
  maxRepeats = 1;
  isInfiniteLoop = false;
  // Ensure manual repeat guard is cleared when stopping externally
  manualRepeatModeActive = false;
  statusCallback?.({ isPlaying: false, currentUrl: '' });
}

export async function stopSurahAudio() {
  try {
    await surahPlayer?.stopAsync();
    await surahPlayer?.unloadAsync();
  } catch {}
  
  surahPlayer = null;
  isPlayingSurah = false;
  isSurahManuallyPaused = false;
  surahStatusCallback?.({ isPlaying: false, currentUrl: '' });
}

export async function pauseAudio() {
  if (player && isPlaying) {
    await player.pauseAsync();
    isPlaying = false;
    statusCallback?.({ isPlaying: false, isPaused: true, currentUrl });
  }
}

export async function pauseSurahAudio() {
  if (surahPlayer && isPlayingSurah) {
    console.log('Pausing surah audio');
    isSurahManuallyPaused = true;
    await surahPlayer.pauseAsync();
    isPlayingSurah = false;
    surahStatusCallback?.({ isPlaying: false, isPaused: true, currentUrl: '' });
  }
}

export async function resumeSurahAudio() {
  if (surahPlayer && !isPlayingSurah && isSurahManuallyPaused) {
    try {
      const status = await surahPlayer.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        console.log('Resuming surah audio');
        isSurahManuallyPaused = false;
        await surahPlayer.playAsync();
        isPlayingSurah = true;
        surahStatusCallback?.({ isPlaying: true, isPaused: false, currentUrl: '' });
      }
    } catch (error) {
      console.error('Error resuming surah audio:', error);
    }
  }
}

export async function setPlaybackSpeed(speed: PlaybackSpeed) {
  if (player) {
    try {
      const status = await player.getStatusAsync();
      if (status.isLoaded) {
        await player.setRateAsync(speed, true);
      } else {
        console.warn('Cannot set playback speed: audio not loaded');
      }
    } catch (error) {
      console.error('Error setting playback speed:', error);
    }
  }
}

export function getCurrentPlaybackStatus(): AudioStatus {
  return {
    isPlaying,
    currentUrl,
    repeatCount,
    maxRepeats: isInfiniteLoop ? Infinity : maxRepeats,
    isInfiniteLoop,
  };
}

export async function resumeAudio() {
  if (player && !isPlaying) {
    await player.playAsync();
    isPlaying = true;
    statusCallback?.({ isPlaying: true, isPaused: false, currentUrl });
  }
}

/* ---------- HIGHER LEVEL HELPERS ---------- */
export async function playVerseWithOptionalBismillah(verse: Verse, repeats = 1, cb?: (status: AudioStatus) => void) {
  const reciter = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
  const surah = verse.surahId || verse.surahNumber || 0;
  const url = verse.audioUrl || getAudioUrl(reciter, surah, verse.verseNumber);

  console.log(`Playing verse ${verse.verseNumber} from surah ${surah}:`, {
    verseNumber: verse.verseNumber,
    url
  });

  // Simple approach: just play the verse audio directly
  await playAudio(url, repeats, cb);
}



export async function playSurah(surah: number, cb?: (status: AudioStatus) => void) {
  try {
    const reciter = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
    const url = getSurahAudioUrl(reciter, surah);
    if (url) {
      await playSurahAudioInternal(url, cb);
    }
  } catch (error) {
    console.error('AudioUtils: Surah audio disabled:', error);
    cb?.({ 
      isPlaying: false, 
      error: 'Surah audio temporarily unavailable - SSL certificate issues with CDN' 
    });
  }
}

// Alias for backward compatibility
// Backwards compatibility: expose getSurahAudioUrl under the old name
export const generateSurahAudioUrl = getSurahAudioUrl;

// Updated to use separate surah audio context
export const playSurahAudioWithFallback = async (surah: number, repeats: number = 1, cb?: (status: AudioStatus) => void) => {
  try {
    const reciter = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
    const url = getSurahAudioUrl(reciter, surah);
    if (url) {
      await playSurahAudioInternal(url, cb);
    }
  } catch (error) {
    console.error('AudioUtils: Surah audio disabled:', error);
    cb?.({ 
      isPlaying: false, 
      error: 'Surah audio temporarily unavailable - SSL certificate issues with CDN' 
    });
  }
};
