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

// Surah-specific state
let surahStatusCallback: ((status: AudioStatus) => void) | null = null;
let isSurahManuallyPaused = false;

// Note: We now use local Bismillah file instead of remote URL

/* ---------- INIT ---------- */
export async function initializeAudio() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      playsInSilentModeIOS: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
    });
  } catch (err) {
    console.warn('[audio] Failed to initialize audio', err);
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

export async function generateVerseUrl(reciter: string, surah: number, ayah: number) {
  const globalAyah = calculateGlobalAyahId(surah, ayah);
  
  // For now, let's use the reliable islamic.network API to fix the immediate issue
  // We can switch to everyayah later after testing
  const url = `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyah}.mp3`;
  const fallbackUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyah}.mp3`;
  
  console.log(`AudioUtils: Generating URL for Surah ${surah}, Ayah ${ayah}, Global ID: ${globalAyah}`);
  console.log(`AudioUtils: Primary URL: ${url}`);
  
  const isAvailable = await checkAudioAvailability(url);
  const finalUrl = isAvailable ? url : fallbackUrl;
  
  console.log(`AudioUtils: Using ${isAvailable ? 'primary' : 'fallback'} URL: ${finalUrl}`);
  return finalUrl;
}

export async function generateSurahUrl(reciter: string, surah: number) {
  const url = `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${surah}.mp3`;
  return (await checkAudioAvailability(url)) ? url : `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surah}.mp3`;
}

/* ---------- CORE AUDIO ---------- */
export async function playAudio(url: string, repeats = 1, callback?: (status: AudioStatus) => void) {
  console.log(`AudioUtils: Starting playAudio with url: ${url}, repeats: ${repeats}`);
  
  await stopAudio(); // Only stop verse audio, not surah audio
  await initializeAudio();

  const { playbackSpeed, infiniteLoop } = useSettingsStore.getState();
  
  try {
    versePlayer = new Audio.Sound();
    player = versePlayer; // For backward compatibility
    
    console.log('AudioUtils: Loading verse audio from URL:', url);
    await versePlayer.loadAsync({ uri: url });
    
    // Wait for the audio to be fully loaded before setting rate
    const status = await versePlayer.getStatusAsync();
    if (status.isLoaded) {
      // Apply playback speed after audio is loaded
      if (playbackSpeed && playbackSpeed !== 1.0) {
        await versePlayer.setRateAsync(playbackSpeed, true);
      }
    }
    
    currentUrl = url;
    maxRepeats = repeats <= 0 ? 1 : Math.max(1, repeats);
    repeatCount = 0;
    isPlaying = true;
    isPlayingVerse = true;
    isInfiniteLoop = infiniteLoop || repeats <= 0;
    statusCallback = callback || null;

    versePlayer.setOnPlaybackStatusUpdate(onPlaybackStatus);

    console.log('AudioUtils: Starting verse audio playback');
    await versePlayer.playAsync();
    
    callback?.({ 
      isPlaying: true, 
      currentUrl: url, 
      repeatCount: 0, 
      maxRepeats: isInfiniteLoop ? Infinity : maxRepeats,
      isInfiniteLoop
    });
  } catch (error) {
    console.error('AudioUtils: Failed to play verse audio:', error);
    callback?.({ 
      isPlaying: false, 
      error: `Failed to load or play audio: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
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
    await surahPlayer.loadAsync({ uri: url });
    
    // Wait for the audio to be fully loaded before setting rate
    const status = await surahPlayer.getStatusAsync();
    if (status.isLoaded) {
      // Apply playback speed after audio is loaded
      if (playbackSpeed && playbackSpeed !== 1.0) {
        await surahPlayer.setRateAsync(playbackSpeed, true);
      }
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
    callback?.({ 
      isPlaying: false, 
      error: `Failed to load or play surah audio: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
    throw error;
  }
}

async function onPlaybackStatus(status: any) {
  if (!status) return;

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
  const url = verse.audioUrl || await generateVerseUrl(reciter, surah, verse.verseNumber);

  console.log(`Playing verse ${verse.verseNumber} from surah ${surah}:`, {
    verseNumber: verse.verseNumber,
    url
  });

  // Simple approach: just play the verse audio directly
  await playAudio(url, repeats, cb);
}



export async function playSurah(surah: number, cb?: (status: AudioStatus) => void) {
  const reciter = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
  const url = await generateSurahUrl(reciter, surah);
  await playSurahAudioInternal(url, cb);
}

// Alias for backward compatibility
export const generateSurahAudioUrl = generateSurahUrl;

// Updated to use separate surah audio context
export const playSurahAudioWithFallback = async (surah: number, repeats: number = 1, cb?: (status: AudioStatus) => void) => {
  const reciter = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
  const url = await generateSurahUrl(reciter, surah);
  await playSurahAudioInternal(url, cb);
};
