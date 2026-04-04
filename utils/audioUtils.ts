import { useSettingsStore, type PlaybackSpeed } from '@/store/settingsStore';
import type { Verse } from '@/types';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
// NOTE: utils/ sits at the workspace root while the real implementation lives under /app/mushaf.
// Using a direct relative path avoids metro resolving '@/mushaf' to the wrong location when this
// module is required from outside the app/ directory.
import LayoutService from '../app/mushaf/services/layoutService';

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
let versePlayer: Audio.Sound | null = null;
let surahPlayer: Audio.Sound | null = null;
let isPlayingVerse = false;
export let isPlayingSurah = false;

// Legacy global player for backward compatibility (points to verse player)
let player: Audio.Sound | null = null;
let isPlaying = false;
let repeatCount = 0;
let maxRepeats = 1;
let currentUrl = '';
let statusCallback: ((status: AudioStatus) => void) | null = null;
let isInfiniteLoop = false;
let manualRepeatModeActive = false;

// FIX: Add abort controller for breaking out of infinite loops
let playbackAbortController: AbortController | null = null;

// Surah-specific state
let surahStatusCallback: ((status: AudioStatus) => void) | null = null;
let isSurahManuallyPaused = false;

/* ---------- INIT ---------- */
export async function initializeAudio() {
  try {
    if (__DEV__) {
      console.log('AudioUtils: Initializing audio mode...');
    }
    
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    
    if (__DEV__) {
      console.log('AudioUtils: Audio mode initialized successfully');
    }
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

export const SUPPORTED_RECITERS = [
  'ar.alafasy',
  'ar.abdulbasitmurattal',
  'ar.abdurrahmaansudais',
  'ar.shaatri',
  'ar.hanirifai',
  'ar.husary',
  'ar.husarymujawwad',
  'ar.hudhaify',
  'ar.ahmedajamy',
  'ar.mahermuaiqly',
  'ar.minshawi',
  'ar.shaatree',
  'ar.muhammadayyoub',
  'ar.muhammadjibreel',
];

export const DEFAULT_RECITER = 'ar.alafasy';

export function getValidReciter(reciter: string | undefined): string {
  if (!reciter) return DEFAULT_RECITER;
  if (SUPPORTED_RECITERS.includes(reciter)) return reciter;
  console.warn(`AudioUtils: Reciter "${reciter}" not supported, falling back to ${DEFAULT_RECITER}`);
  return DEFAULT_RECITER;
}

export function getAudioUrl(reciter: string | undefined, surah: number, ayah: number): string {
  const validReciter = getValidReciter(reciter);
  const globalAyah = calculateGlobalAyahId(surah, ayah);
  return `https://cdn.islamic.network/quran/audio/128/${validReciter}/${globalAyah}.mp3`;
}

export function getSurahAudioUrl(reciter: string | undefined, surah: number): string {
  const validReciter = getValidReciter(reciter);
  
  if (validReciter === 'ar.mahermuaiqly') {
    const surahPadded = surah.toString().padStart(3, '0');
    return `https://server12.mp3quran.net/maher/${surahPadded}.mp3`;
  }
  
  return `https://cdn.islamic.network/quran/audio-surah/128/${validReciter}/${surah}.mp3`;
}

/* ---------- CORE AUDIO ---------- */
export async function playAudio(url: string, repeats: number = 1, callback?: (status: AudioStatus) => void) {
  if (__DEV__) {
    console.log(`AudioUtils: Starting playAudio with url: ${url}, repeats: ${repeats}`);
  }

  // FIX: Abort any existing playback before creating new controller
  if (playbackAbortController) {
    playbackAbortController.abort();
  }
  playbackAbortController = new AbortController();
  const abortSignal = playbackAbortController.signal;

  await stopAudio();
  await initializeAudio();

  const { playbackSpeed, infiniteLoop } = useSettingsStore.getState();

  try {
    versePlayer = new Audio.Sound();
    player = versePlayer;

    if (__DEV__) {
      console.log('AudioUtils: Loading verse audio from URL:', url);
    }
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
    manualRepeatModeActive = true;

    versePlayer.setOnPlaybackStatusUpdate((s: any) => onPlaybackStatus(s));
    await versePlayer.setVolumeAsync(1.0);

    // FIX: Improved waitForFinish with better error handling
    const waitForFinish = () => new Promise<void>((resolve, reject) => {
      // FIX: Check abort signal before starting
      if (abortSignal.aborted) {
        return reject(new Error('Playback aborted'));
      }

      // Only resolve when we have actually started playback and then observe didJustFinish.
      // This prevents resolving immediately if the underlying player returns a stale didJustFinish state.
      let started = false;

      const handler = async (s: any) => {
        try {
          onPlaybackStatus(s);

          if (s.error) {
            statusCallback?.({ isPlaying: false, error: s.error, currentUrl });
            versePlayer?.setOnPlaybackStatusUpdate(onPlaybackStatus);
            return reject(new Error(s.error));
          }

          if (!started && s.isLoaded && s.isPlaying) {
            started = true;
          }

          if (started && s.didJustFinish) {
            // restore global status handler
            versePlayer?.setOnPlaybackStatusUpdate(onPlaybackStatus);
            return resolve();
          }
        } catch (e) {
          versePlayer?.setOnPlaybackStatusUpdate(onPlaybackStatus);
          return reject(e);
        }
      };

      versePlayer?.setOnPlaybackStatusUpdate(handler);
    });

    // Start first play
    if (__DEV__) {
      console.log('AudioUtils: Starting verse audio playback');
    }
    await versePlayer.playAsync();
    
    // FIX: Debounce status callback to avoid excessive updates
    callback?.({ 
      isPlaying: true, 
      currentUrl: url, 
      repeatCount: 0, 
      maxRepeats: isInfiniteLoop ? Infinity : maxRepeats, 
      isInfiniteLoop 
    });

    // FIX: Check abort signal in loop
    while (!abortSignal.aborted) {
      try {
        await waitForFinish();
      } catch (err) {
        // FIX: Check if error is due to abort
        if (abortSignal.aborted) {
          if (__DEV__) {
            console.log('AudioUtils: Playback aborted by user');
          }
          break;
        }
        console.error('AudioUtils: Error while waiting for finish:', err);
        await stopAudio();
        throw err;
      }

      // FIX: Check abort signal before replay
      if (abortSignal.aborted) break;

      if (isInfiniteLoop) {
        try {
          await player?.setPositionAsync(0);
          await player?.playAsync();
          // FIX: Only update status if not aborted
          if (!abortSignal.aborted) {
            statusCallback?.({ 
              isPlaying: true, 
              currentUrl, 
              repeatCount: Infinity, 
              maxRepeats: Infinity, 
              isInfiniteLoop: true 
            });
          }
        } catch (err) {
          if (!abortSignal.aborted) {
            console.error('AudioUtils: Failed to replay on infinite loop:', err);
            await stopAudio();
          }
          break;
        }
      } else {
        if (repeatCount < maxRepeats - 1) {
          repeatCount++;
          try {
            await player?.setPositionAsync(0);
            await player?.playAsync();
            if (!abortSignal.aborted) {
              statusCallback?.({ 
                isPlaying: true, 
                currentUrl, 
                repeatCount, 
                maxRepeats, 
                isInfiniteLoop: false 
              });
            }
          } catch (err) {
            if (!abortSignal.aborted) {
              console.error('AudioUtils: Failed to replay:', err);
              await stopAudio();
            }
            break;
          }
        } else {
          await stopAudio();
          break;
        }
      }
    }

    // FIX: Ensure cleanup even if aborted
    manualRepeatModeActive = false;
    
  } catch (error) {
    console.error('AudioUtils: Failed to play verse audio:', error);
    console.error('AudioUtils: Failed URL:', url);

    if (error instanceof Error) {
      console.error('AudioUtils: Error name:', error.name);
      console.error('AudioUtils: Error message:', error.message);
      console.error('AudioUtils: Error stack:', error.stack);
    }

    statusCallback?.({ 
      isPlaying: false, 
      error: `Failed to load or play audio: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      currentUrl: url 
    });

    // FIX: Comprehensive cleanup
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

async function playSurahAudioInternal(url: string, callback?: (status: AudioStatus) => void) {
  console.log(`AudioUtils: Starting surah audio with url: ${url}`);
  
  await stopSurahAudio();
  await initializeAudio();

  const { playbackSpeed } = useSettingsStore.getState();
  
  try {
    surahPlayer = new Audio.Sound();
    
    console.log('AudioUtils: Loading surah audio from URL:', url);
    await surahPlayer.loadAsync({ uri: url });
    console.log('AudioUtils: Surah audio loaded, checking status...');
    
    // FIX: Apply playback speed immediately after loading
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
        if (!isSurahManuallyPaused) {
          isPlayingSurah = status.isPlaying;
        }

        // FIX: Avoid redundant callbacks
        if (status.didJustFinish || status.error) {
          surahStatusCallback?.({
            isPlaying: isPlayingSurah,
            didJustFinish: status.didJustFinish,
            error: status.error,
          });
        }

        if (status.didJustFinish) {
          isSurahManuallyPaused = false;
          stopSurahAudio();
        }
      } else if (status.error) {
        isSurahManuallyPaused = false;
        surahStatusCallback?.({ isPlaying: false, error: status.error });
      }
    });

    if (__DEV__) {
      console.log('AudioUtils: Starting surah audio playback');
    }
    await surahPlayer.playAsync();
    
    callback?.({ 
      isPlaying: true, 
      currentUrl: url
    });
    
  } catch (error) {
    console.error('AudioUtils: Failed to play surah audio:', error);
    console.error('AudioUtils: Failed surah URL:', url);
    
    if (error instanceof Error) {
      console.error('AudioUtils: Surah error name:', error.name);
      console.error('AudioUtils: Surah error message:', error.message);
      console.error('AudioUtils: Surah error stack:', error.stack);
    }
    
    callback?.({ 
      isPlaying: false, 
      error: `Failed to load or play surah audio: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
    
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
  
  if (manualRepeatModeActive) {
    try {
      // FIX: Only forward status changes, not on every update
      if (status.didJustFinish || status.error) {
        statusCallback?.({
          isPlaying: !!status.isPlaying,
          didJustFinish: !!status.didJustFinish,
          currentUrl,
          repeatCount: isInfiniteLoop ? Infinity : repeatCount,
          maxRepeats: isInfiniteLoop ? Infinity : maxRepeats,
          isInfiniteLoop,
          error: status.error,
        });
      }
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
  // FIX: Abort any ongoing playback loop
  if (playbackAbortController) {
    playbackAbortController.abort();
    playbackAbortController = null;
  }

  try {
    // Only call stop/unload if sound is loaded — avoids noisy `sound is not loaded` warnings
    if (player) {
      try {
        const st = await player.getStatusAsync();
        if (st.isLoaded) {
          await player.stopAsync();
          await player.unloadAsync();
        }
      } catch (e) {
        // Be quiet on status errors — fallback to best effort unload
        try { await player.unloadAsync(); } catch (_) {}
      }
    }

    if (versePlayer) {
      try {
        const st2 = await versePlayer.getStatusAsync();
        if (st2.isLoaded) {
          await versePlayer.stopAsync();
          await versePlayer.unloadAsync();
        }
      } catch (e) {
        try { await versePlayer.unloadAsync(); } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('AudioUtils: Error during stop:', e);
  }
  
  player = null;
  versePlayer = null;
  isPlaying = false;
  isPlayingVerse = false;
  currentUrl = '';
  repeatCount = 0;
  maxRepeats = 1;
  isInfiniteLoop = false;
  manualRepeatModeActive = false;
  statusCallback?.({ isPlaying: false, currentUrl: '' });
}

export async function stopSurahAudio() {
  try {
    if (surahPlayer) {
      try {
        const st = await surahPlayer.getStatusAsync();
        if (st.isLoaded) {
          await surahPlayer.stopAsync();
          await surahPlayer.unloadAsync();
        }
      } catch (e) {
        try { await surahPlayer.unloadAsync(); } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('AudioUtils: Error during surah stop:', e);
  }
  
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
    if (__DEV__) {
      console.log('Pausing surah audio');
    }
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
        if (__DEV__) {
          console.log('Resuming surah audio');
        }
        
        // FIX: Reapply playback speed on resume
        const { playbackSpeed } = useSettingsStore.getState();
        if (playbackSpeed && playbackSpeed !== 1.0) {
          await surahPlayer.setRateAsync(playbackSpeed, true);
        }
        
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
  // FIX: Apply to both verse and surah players
  if (player) {
    try {
      const status = await player.getStatusAsync();
      if (status.isLoaded) {
        await player.setRateAsync(speed, true);
      }
    } catch (error) {
      console.error('Error setting verse playback speed:', error);
    }
  }
  
  if (surahPlayer) {
    try {
      const status = await surahPlayer.getStatusAsync();
      if (status.isLoaded) {
        await surahPlayer.setRateAsync(speed, true);
      }
    } catch (error) {
      console.error('Error setting surah playback speed:', error);
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

  if (__DEV__) {
    console.log(`Playing verse ${verse.verseNumber} from surah ${surah}:`, {
      verseNumber: verse.verseNumber,
      url
    });
  }

  await playAudio(url, repeats, cb);
}

export async function playSurah(surah: number, cb?: (status: AudioStatus) => void) {
  try {
    // Disable surah playback for Warsh layout because surah->page mapping differs
    // across layouts and the app intentionally disables full-surah audio for Warsh.
    try {
      const active = await LayoutService.getActiveLayoutId();
      if (active === 'warsh_15') {
        console.log('AudioUtils: Surah audio disabled for warsh_15 layout');
        cb?.({ isPlaying: false, error: 'Surah audio disabled for Warsh layout' });
        return;
      }
    } catch (e) {
      // If we can't determine the layout, proceed as normal — don't block audio.
    }
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

export const generateSurahAudioUrl = getSurahAudioUrl;

export const playSurahAudioWithFallback = async (surah: number, repeats: number = 1, cb?: (status: AudioStatus) => void) => {
  try {
    // Avoid playing full-surah audio when Warsh layout is active.
    try {
      const active = await LayoutService.getActiveLayoutId();
      if (active === 'warsh_15') {
        console.log('AudioUtils: Surah audio disabled for warsh_15 layout (playSurahAudioWithFallback)');
        cb?.({ isPlaying: false, error: 'Surah audio disabled for Warsh layout' });
        return;
      }
    } catch (e) {
      // If layout detection fails, keep trying normally.
    }
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