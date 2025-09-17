import { useSettingsStore } from '@/store/settingsStore';
import type { Verse } from '@/types';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let player: any | null = null;
let isPlaying = false; // Restore explicit isPlaying state
let repeatCount = 0;
let maxRepeats = 1;
let currentAudioUrl = '';
let onPlaybackStatusUpdate: ((status: any) => void) | null = null;
const BISMILLAH_URL = 'https://verses.quran.com/Bismillah.mp3';

// Initialize audio mode
export async function initializeAudio(): Promise<void> {
  try {
    if (typeof setAudioModeAsync === 'function') {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'mixWithOthers',
        interruptionModeAndroid: 'duckOthers'
      }).catch(e => console.warn('[audio] setAudioModeAsync failed', e));
    }
  } catch (error) {
    console.error('Failed to initialize audio:', error);
  }
}

// Generate audio URL for a verse based on reciter (using only alquran.cloud API)
export function generateAudioUrl(surahNumber: number, verseNumber: number): string {
  try {
    // Get current reciter from settings store
    const reciterIdentifier = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
    
    // Always use alquran.cloud API for reliability
    const globalAyahId = calculateGlobalAyahId(surahNumber, verseNumber);
    return `https://cdn.islamic.network/quran/audio/128/${reciterIdentifier}/${globalAyahId}.mp3`;
  } catch (error) {
    console.error('Error generating audio URL:', error);
    // Safe fallback to Alafasy on alquran.cloud
    const globalAyahId = calculateGlobalAyahId(surahNumber, verseNumber);
    return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyahId}.mp3`;
  }
}

// NEW: Generate surah-level audio URL using current reciter, fallback to Alafasy
export function generateSurahAudioUrl(surahNumber: number): string {
  try {
    const reciterIdentifier = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
    // islamic.network provides full-surah mp3s on this path
    return `https://cdn.islamic.network/quran/audio/128/${reciterIdentifier}/${surahNumber}.mp3`;
  } catch (error) {
    console.error('Error generating surah audio URL:', error);
    return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${surahNumber}.mp3`;
  }
}

// Generate fallback audio URL with a different reciter
export function generateFallbackAudioUrl(surahNumber: number, verseNumber: number): string {
  const globalAyahId = calculateGlobalAyahId(surahNumber, verseNumber);
  // Use Alafasy as fallback - most reliable reciter
  return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyahId}.mp3`;
}

// Enhanced playAudio with fallback support
export async function playAudioWithFallback(
  audioUrl: string, 
  surahNumber: number,
  verseNumber: number,
  repeats = 1, 
  statusCallback?: (status: any) => void
): Promise<void> {
  try {
    // Try the original URL first
    await playAudio(audioUrl, repeats, statusCallback);
  } catch (error) {
    console.log('Primary audio failed, trying fallback reciter...');
    
    // Try fallback reciter
    try {
      const fallbackUrl = generateFallbackAudioUrl(surahNumber, verseNumber);
      await playAudio(fallbackUrl, repeats, statusCallback);
      
      // Notify user about fallback
      if (statusCallback) {
        statusCallback({ 
          isPlaying: true,
          fallbackUsed: true,
          message: 'Using fallback reciter (Alafasy)'
        });
      }
    } catch (fallbackError) {
      console.error('Fallback audio also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// Generate audio URL for a specific reciter (used by Quran API service)
export function generateSharedAudioUrl(surahNumber: number, verseNumber: number, reciterIdentifier: string): string {
  try {
    // Always use alquran.cloud API for reliability - no more everyayah.com
    const globalAyahId = calculateGlobalAyahId(surahNumber, verseNumber);
    return `https://cdn.islamic.network/quran/audio/128/${reciterIdentifier}/${globalAyahId}.mp3`;
  } catch (error) {
    console.error('Error generating shared audio URL:', error);
    // Safe fallback to Alafasy on alquran.cloud
    const globalAyahId = calculateGlobalAyahId(surahNumber, verseNumber);
    return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyahId}.mp3`;
  }
}

// Calculate global ayah index (1..6236) for islamic.network audio
function calculateGlobalAyahId(surahNumber: number, verseNumber: number): number {
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
  let id = 0;
  for (let i = 1; i < surahNumber; i++) id += counts[i - 1];
  return id + verseNumber;
}

// Get current playing state - this was the main issue!
export function getPlayingState(): { isPlaying: boolean; currentUrl: string } {
  return {
    isPlaying: isPlaying, // Use explicit isPlaying state, not sound existence
    currentUrl: currentAudioUrl
  };
}

// Check if audio URL is available before attempting to play
export async function checkAudioAvailability(audioUrl: string): Promise<{ available: boolean; error?: string }> {
  try {
    const response = await fetch(audioUrl, { method: 'HEAD' });
    if (response.ok) {
      return { available: true };
    } else if (response.status === 404) {
      return { 
        available: false, 
        error: 'Selected Reciter Audio Unavailable, Please choose another!' 
      };
    } else {
      return { 
        available: false, 
        error: `Audio unavailable (${response.status})` 
      };
    }
  } catch (error) {
    return { 
      available: false, 
      error: 'Network error - please check your connection' 
    };
  }
}

// Enhanced error handling for common audio errors
function getFriendlyErrorMessage(error: any): string {
  if (typeof error === 'string') {
    if (error.includes('404') || error.includes('Not Found')) {
      return 'Selected Reciter Audio Unavailable, Please choose another!';
    }
    if (error.includes('Network') || error.includes('connection')) {
      return 'Network error - please check your connection';
    }
    return error;
  }
  
  if (error?.message) {
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      return 'Selected Reciter Audio Unavailable, Please choose another!';
    }
    if (error.message.includes('Network') || error.message.includes('connection')) {
      return 'Network error - please check your connection';
    }
    return error.message;
  }
  
  return 'Audio playback error - please try again';
}

// Play audio using expo-audio
export async function playAudio(
  audioUrl: string,
  repeats = 1,
  statusCallback?: (status: any) => void
): Promise<void> {
  try {
    if (!createAudioPlayer) throw new Error('Audio module unavailable');
    if (isPlaying && currentAudioUrl === audioUrl) return;
    await stopAudio();
    currentAudioUrl = audioUrl;
    maxRepeats = repeats;
    repeatCount = 0;
    onPlaybackStatusUpdate = statusCallback || null;
    if (!audioUrl || audioUrl.trim() === '') throw new Error('Audio URL is not available');
    const availability = await checkAudioAvailability(audioUrl);
    if (!availability.available) throw new Error(availability.error || 'Audio not available');
    await initializeAudio();
    isPlaying = true;
    if (onPlaybackStatusUpdate) onPlaybackStatusUpdate({ isPlaying: true, isLoading: true, currentUrl: audioUrl });
    try {
      player = createAudioPlayer(audioUrl, { updateInterval: 100, downloadFirst: false });
    } catch (e) {
      console.warn('[audio] createAudioPlayer failed', e);
      throw e;
    }
    if (player?.addListener) {
      try { (player as any).addListener((status: any) => onPlaybackStatusUpdateHandler(mapStatus(status))); } catch {}
    }
    await player?.play?.();
  } catch (error) {
    console.error('Failed to play audio:', error);
    isPlaying = false;
    currentAudioUrl = '';
    if (onPlaybackStatusUpdate) {
      onPlaybackStatusUpdate({ isPlaying: false, error: getFriendlyErrorMessage(error), currentUrl: '' });
    }
    throw error;
  }
}

function mapStatus(status: any) {
  if (!status) return status;
  return {
    isLoaded: status.isLoaded,
    isPlaying: status.isPlaying,
    didJustFinish: status.didJustFinish,
    positionMillis: (status.currentTime ?? 0) * 1000,
    durationMillis: (status.duration ?? 0) * 1000,
    error: status.error
  };
}

function onPlaybackStatusUpdateHandler(status: any) {
  if (!onPlaybackStatusUpdate) return;
  onPlaybackStatusUpdate({ isPlaying, currentUrl: currentAudioUrl, ...status });
  if (status?.didJustFinish) {
    repeatCount++;
    if (repeatCount < maxRepeats) {
      try {
        player?.seek(0);
        player?.play();
      } catch (e) { console.error(e); }
    } else {
      stopAudio().catch(console.error);
    }
  }
}

// Play Bismillah once, then play the verse audio with repeat logic
export async function playBismillahThenVerse(
  verseAudioUrl: string,
  repeats = 1,
  statusCallback?: (status: any) => void
): Promise<void> {
  try {
    // Stop any current playback
    await stopAudio();

    // Initialize audio mode
    await initializeAudio();

    let bismiPlayer = createAudioPlayer(BISMILLAH_URL, { updateInterval: 100 });
    (bismiPlayer as any).addListener(async (status: any) => {
      const mapped = mapStatus(status);
      if (mapped?.didJustFinish) {
        try { (bismiPlayer as any)?.release(); } catch {}
        await playAudio(verseAudioUrl, repeats, statusCallback);
      }
      if (mapped?.error) {
        await playAudio(verseAudioUrl, repeats, statusCallback);
      }
    });
    await bismiPlayer.play();
  } catch (error) {
    // If anything fails, just attempt to play the verse directly
    await playAudio(verseAudioUrl, repeats, statusCallback);
  }
}

// Convenience: decide whether to include Bismillah, then play verse
export async function playVerseWithOptionalBismillah(
  verse: Verse,
  repeats = 1,
  statusCallback?: (status: any) => void
): Promise<void> {
  const surahId = verse.surahId || verse.surahNumber || 0;
  const shouldIncludeBismillah = Boolean(verse.hasBismillahPrefix) || (surahId !== 9 && verse.verseNumber === 1);
  const url = verse.audioUrl || generateAudioUrl(surahId, verse.verseNumber);
  if (!url) return;
  if (shouldIncludeBismillah) {
    return playBismillahThenVerse(url, repeats, statusCallback);
  }
  return playAudio(url, repeats, statusCallback);
}

// NEW: Play full surah audio using current reciter with robust fallback
export async function playSurahAudio(
  surahNumber: number,
  statusCallback?: (status: any) => void
): Promise<void> {
  const primaryUrl = generateSurahAudioUrl(surahNumber);
  try {
    await playAudio(primaryUrl, 1, statusCallback);
  } catch (e) {
    // Fallback to Alafasy full-surah URL
    const fallbackUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${surahNumber}.mp3`;
    await playAudio(fallbackUrl, 1, statusCallback);
    if (statusCallback) statusCallback({ isPlaying: true, fallbackUsed: true, message: 'Using fallback reciter (Alafasy)' });
  }
}

export async function stopAudio(): Promise<void> {
  isPlaying = false;
  try { player?.pause?.(); player?.release?.(); } catch (e) { console.error('Failed to stop audio:', e); }
  player = null;
  currentAudioUrl = '';
  repeatCount = 0;
  maxRepeats = 1;
  if (onPlaybackStatusUpdate) onPlaybackStatusUpdate({ isPlaying: false, currentUrl: '' });
}

export async function pauseAudio(): Promise<void> {
  if (player && isPlaying) {
    try {
      await player.pause?.();
      isPlaying = false;
      if (onPlaybackStatusUpdate) onPlaybackStatusUpdate({ isPlaying: false, isPaused: true, currentUrl: currentAudioUrl });
    } catch (e) { console.error('Failed to pause audio:', e); }
  }
}

export async function resumeAudio(): Promise<void> {
  if (player && !isPlaying) {
    try {
      await player.play?.();
      isPlaying = true;
      if (onPlaybackStatusUpdate) onPlaybackStatusUpdate({ isPlaying: true, isPaused: false, currentUrl: currentAudioUrl });
    } catch (e) { console.error('Failed to resume audio:', e); }
  }
}

// Unified cache / state clear for expo-audio implementation
export function clearAudioCache(): void {
  try { player?.pause?.(); player?.release?.(); } catch (e) { console.error('Failed to clear audio cache:', e); }
  player = null;
  isPlaying = false;
  currentAudioUrl = '';
  repeatCount = 0;
  maxRepeats = 1;
  if (onPlaybackStatusUpdate) onPlaybackStatusUpdate({ isPlaying: false, currentUrl: '', cacheCleared: true });
}