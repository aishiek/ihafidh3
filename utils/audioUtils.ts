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
    console.log('AudioUtils: Initializing audio mode...');
    
    // Use proper audio mode settings for reliable audio streaming
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true, // Enable background audio
      interruptionModeIOS: InterruptionModeIOS.DoNotMix, // Proper audio session control
      playsInSilentModeIOS: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix, // Proper Android audio session
      shouldDuckAndroid: false, // Don't duck other audio
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

export async function generateVerseUrl(reciter: string, surah: number, ayah: number) {
  const globalAyah = calculateGlobalAyahId(surah, ayah);
  
  // Primary: Use cdn.islamic.network (now working again)
  const primaryUrl = `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyah}.mp3`;
  const fallbackCdnUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyah}.mp3`;
  
  // Backup: Use everyayah.com format as secondary fallback
  const surahPadded = surah.toString().padStart(3, '0');
  const ayahPadded = ayah.toString().padStart(3, '0');
  const reciterMap: Record<string, string> = {
    'ar.alafasy': 'Alafasy_128kbps',
    'ar.abdulbasitmurattal': 'Abdul_Basit_Murattal_192kbps',
    'ar.abdurrahmaansudais': 'Abdurrahman_As-Sudais_192kbps',
    'ar.shaatri': 'As-Shaatri_128kbps',
    'ar.hanirifai': 'Hani_Ar-Rifai_192kbps'
  };
  const everyayahReciter = reciterMap[reciter] || 'Alafasy_128kbps';
  const everyayahFallbackUrl = `https://everyayah.com/data/${everyayahReciter}/${surahPadded}${ayahPadded}.mp3`;
  
  console.log(`AudioUtils: Generating URL for Surah ${surah}, Ayah ${ayah}, Global ID: ${globalAyah}`);
  console.log(`AudioUtils: Primary URL (cdn.islamic.network): ${primaryUrl}`);
  
  // Test primary URL first
  try {
    const isPrimaryAvailable = await checkAudioAvailability(primaryUrl);
    if (isPrimaryAvailable) {
      console.log(`AudioUtils: Using primary cdn.islamic.network URL: ${primaryUrl}`);
      return primaryUrl;
    }
    
    // Try fallback with default reciter on same CDN
    console.log(`AudioUtils: Primary reciter not available, trying fallback reciter...`);
    const isFallbackAvailable = await checkAudioAvailability(fallbackCdnUrl);
    if (isFallbackAvailable) {
      console.log(`AudioUtils: Using fallback cdn.islamic.network URL: ${fallbackCdnUrl}`);
      return fallbackCdnUrl;
    }
    
    // Finally try everyayah.com as backup CDN
    console.log(`AudioUtils: cdn.islamic.network not available, trying everyayah.com backup...`);
    const isEveryayahAvailable = await checkAudioAvailability(everyayahFallbackUrl);
    if (isEveryayahAvailable) {
      console.log(`AudioUtils: Using everyayah.com backup URL: ${everyayahFallbackUrl}`);
      return everyayahFallbackUrl;
    }
    
    // If all else fails, return primary URL anyway (let the audio player handle the error)
    console.warn(`AudioUtils: All CDNs unavailable, returning primary URL: ${primaryUrl}`);
    return primaryUrl;
    
  } catch (error) {
    console.warn(`AudioUtils: Error checking URL availability, using primary URL:`, error);
    return primaryUrl;
  }
}

export async function generateSurahUrl(reciter: string, surah: number) {
  const primaryUrl = `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${surah}.mp3`;
  const fallbackUrl = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surah}.mp3`;
  
  console.log(`AudioUtils: Generating surah URL for Surah ${surah}`);
  console.log(`AudioUtils: Primary surah URL: ${primaryUrl}`);
  
  try {
    const isPrimaryAvailable = await checkAudioAvailability(primaryUrl);
    if (isPrimaryAvailable) {
      console.log(`AudioUtils: Using primary surah URL: ${primaryUrl}`);
      return primaryUrl;
    }
    
    console.log(`AudioUtils: Primary surah reciter not available, trying fallback...`);
    const isFallbackAvailable = await checkAudioAvailability(fallbackUrl);
    if (isFallbackAvailable) {
      console.log(`AudioUtils: Using fallback surah URL: ${fallbackUrl}`);
      return fallbackUrl;
    }
    
    // Return primary URL anyway if fallback also fails
    console.warn(`AudioUtils: Both surah URLs failed, returning primary: ${primaryUrl}`);
    return primaryUrl;
    
  } catch (error) {
    console.warn(`AudioUtils: Error checking surah URL availability, using primary:`, error);
    return primaryUrl;
  }
}

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
    
    // Direct loading without timeout or network test
    await versePlayer.loadAsync({ uri: url });
    
    console.log('AudioUtils: Audio loaded successfully, checking status...');
    const loadStatus = await versePlayer.getStatusAsync();
    
    if (!loadStatus.isLoaded) {
      throw new Error('Audio failed to load properly');
    }
    
    console.log('AudioUtils: Audio is loaded, setting up playback...');
    
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

    versePlayer.setOnPlaybackStatusUpdate(onPlaybackStatus);

    // Ensure volume is set and audio is ready
    await versePlayer.setVolumeAsync(1.0);
    
    console.log('AudioUtils: Starting verse audio playback');
    console.log('AudioUtils: Final pre-play status check...');
    const prePlayStatus = await versePlayer.getStatusAsync();
    console.log('AudioUtils: Pre-play status:', prePlayStatus.isLoaded ? 'LOADED' : 'NOT LOADED');
    
    await versePlayer.playAsync();
    
    // Verify playback started
    setTimeout(async () => {
      const playStatus = await versePlayer?.getStatusAsync();
      if (playStatus && playStatus.isLoaded && 'isPlaying' in playStatus) {
        console.log('AudioUtils: Post-play status:', playStatus.isPlaying ? 'PLAYING' : 'NOT PLAYING');
      } else {
        console.log('AudioUtils: Post-play status: UNKNOWN or ERROR');
      }
    }, 500);
    
    callback?.({ 
      isPlaying: true, 
      currentUrl: url, 
      repeatCount: 0, 
      maxRepeats: isInfiniteLoop ? Infinity : maxRepeats,
      isInfiniteLoop
    });
  } catch (error) {
    console.error('AudioUtils: Failed to play verse audio:', error);
    console.error('AudioUtils: Failed URL:', url);
    
    // Detailed error logging to understand the real issue
    if (error instanceof Error) {
      console.error('AudioUtils: Error name:', error.name);
      console.error('AudioUtils: Error message:', error.message);
      console.error('AudioUtils: Error stack:', error.stack);
    }
    
    callback?.({ 
      isPlaying: false, 
      error: `Failed to load or play audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
      currentUrl: url
    });
    
    // Clean up state
    isPlaying = false;
    isPlayingVerse = false;
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
  try {
    const reciter = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
    const url = await generateSurahUrl(reciter, surah);
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
export const generateSurahAudioUrl = generateSurahUrl;

// Updated to use separate surah audio context
export const playSurahAudioWithFallback = async (surah: number, repeats: number = 1, cb?: (status: AudioStatus) => void) => {
  try {
    const reciter = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
    const url = await generateSurahUrl(reciter, surah);
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
