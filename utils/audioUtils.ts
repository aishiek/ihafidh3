import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useSettingsStore } from '@/store/settingsStore';
import { getReciterByIdentifier } from '@/constants/reciters';
import type { Verse } from '@/types';

let sound: Audio.Sound | null = null;
// First declaration at line 6
let isPlaying = false; // Restore explicit isPlaying state
let repeatCount = 0;
let maxRepeats = 1;
let currentAudioUrl = '';
let onPlaybackStatusUpdate: ((status: any) => void) | null = null;
const BISMILLAH_URL = 'https://verses.quran.com/Bismillah.mp3';

// Initialize audio mode
export async function initializeAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
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

// Clear audio cache and reset state when reciter changes
export function clearAudioCache(): void {
  // Reset all state variables
  if (sound) {
    sound.unloadAsync().catch(console.error);
    sound = null;
  }
  isPlaying = false;
  currentAudioUrl = '';
  repeatCount = 0;
  maxRepeats = 1;
  
  // Notify UI of state change
  if (onPlaybackStatusUpdate) {
    onPlaybackStatusUpdate({ 
      isPlaying: false,
      currentUrl: '',
      cacheCleared: true
    });
  }
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

export async function playAudio(
  audioUrl: string, 
  repeats = 1, 
  statusCallback?: (status: any) => void
): Promise<void> {
  try {
    // If already playing the same audio, don't restart
    if (isPlaying && currentAudioUrl === audioUrl) {
      return;
    }
    
    // Clean up any existing audio completely
    await stopAudio();
    
    // Set up new audio state
    currentAudioUrl = audioUrl;
    maxRepeats = repeats;
    repeatCount = 0;
    onPlaybackStatusUpdate = statusCallback || null;
    
    // Validate audio URL
    if (!audioUrl || audioUrl.trim() === '') {
      throw new Error('Audio URL is not available');
    }
    
    // Check audio availability first
    const availability = await checkAudioAvailability(audioUrl);
    if (!availability.available) {
      throw new Error(availability.error || 'Audio not available');
    }
    
    // Initialize audio mode
    await initializeAudio();
    
    // Set playing state BEFORE creating sound to prevent double-clicks
    isPlaying = true;
    
    // Immediately notify UI that we're starting playback
    if (onPlaybackStatusUpdate) {
      onPlaybackStatusUpdate({ 
        isPlaying: true, 
        isLoading: true,
        currentUrl: audioUrl 
      });
    }
    
    // Load and play the audio
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: audioUrl },
      { 
        shouldPlay: true,
        progressUpdateIntervalMillis: 100,
        positionMillis: 0,
        volume: 1.0,
        rate: 1.0,
        shouldCorrectPitch: true,
      },
      onPlaybackStatusUpdateHandler
    );
    
    sound = newSound;
    
  } catch (error: unknown) {
    console.error('Failed to play audio:', error);
    // Reset state on error and notify UI
    isPlaying = false;
    currentAudioUrl = '';
    if (onPlaybackStatusUpdate) {
      onPlaybackStatusUpdate({ 
        isPlaying: false, 
        error: getFriendlyErrorMessage(error),
        currentUrl: '' 
      });
    }
    throw error;
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

    // Load and play Bismillah once
    const { sound: bismiSound } = await Audio.Sound.createAsync(
      { uri: BISMILLAH_URL },
      {
        shouldPlay: true,
        progressUpdateIntervalMillis: 100,
        positionMillis: 0,
        volume: 1.0,
        rate: 1.0,
        shouldCorrectPitch: true,
      }
    );

    bismiSound.setOnPlaybackStatusUpdate(async (status: any) => {
      if (status?.didJustFinish) {
        try {
          await bismiSound.unloadAsync();
        } catch {}
        // Now play the actual verse with repeats and proper callbacks
        await playAudio(verseAudioUrl, repeats, statusCallback);
      }
      if (status?.error) {
        // Fallback: try to play verse directly
        await playAudio(verseAudioUrl, repeats, statusCallback);
      }
    });
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

export async function stopAudio(): Promise<void> {
  // Set state first to prevent race conditions
  isPlaying = false;
  
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
    sound = null;
  }
  
  // Clean up all state
  currentAudioUrl = '';
  repeatCount = 0;
  maxRepeats = 1;
  
  // Notify UI
  if (onPlaybackStatusUpdate) {
    onPlaybackStatusUpdate({ 
      isPlaying: false,
      currentUrl: '' 
    });
  }
}

export async function pauseAudio(): Promise<void> {
  if (sound && isPlaying) {
    try {
      await sound.pauseAsync();
      isPlaying = false; // Update state immediately
      
      if (onPlaybackStatusUpdate) {
        onPlaybackStatusUpdate({ 
          isPlaying: false, 
          isPaused: true,
          currentUrl: currentAudioUrl 
        });
      }
    } catch (error) {
      console.error('Failed to pause audio:', error);
    }
  }
}

export async function resumeAudio(): Promise<void> {
  if (sound && !isPlaying) {
    try {
      await sound.playAsync();
      isPlaying = true; // Update state immediately
      
      if (onPlaybackStatusUpdate) {
        onPlaybackStatusUpdate({ 
          isPlaying: true, 
          isPaused: false,
          currentUrl: currentAudioUrl 
        });
      }
    } catch (error) {
      console.error('Failed to resume audio:', error);
    }
  }
}

function onPlaybackStatusUpdateHandler(status: any) {
  // Update our internal state based on actual playback status
  if (status.isLoaded) {
    isPlaying = status.isPlaying;
  }
  
  // Always forward status to callback with enhanced info
  if (onPlaybackStatusUpdate) {
    onPlaybackStatusUpdate({
      ...status,
      currentUrl: currentAudioUrl,
      repeatCount: repeatCount,
      maxRepeats: maxRepeats
    });
  }
  
  // Handle playback errors
  if (status.error) {
    console.error('Audio playback error:', status.error);
    isPlaying = false;
    if (onPlaybackStatusUpdate) {
      onPlaybackStatusUpdate({
        ...status,
        isPlaying: false,
        currentUrl: '',
        error: getFriendlyErrorMessage(status.error)
      });
    }
    return;
  }
  
  // Handle playback completion
  if (status.didJustFinish) {
    repeatCount++;
    
    if (repeatCount < maxRepeats) {
      // Play again for repeat
      sound?.replayAsync().catch(console.error);
    } else {
      // Done with all repeats
      cleanupAfterCompletion();
    }
  }
}

// Handle completion cleanup
function cleanupAfterCompletion(): void {
  isPlaying = false;
  
  // Unload the sound to free resources
  if (sound) {
    sound.unloadAsync().catch(console.error);
    sound = null;
  }
  
  // Reset state
  const wasPlayingUrl = currentAudioUrl;
  currentAudioUrl = '';
  repeatCount = 0;
  maxRepeats = 1;
  
  // CRITICAL: Notify UI that playback is completely finished
  if (onPlaybackStatusUpdate) {
    onPlaybackStatusUpdate({ 
      isPlaying: false,
      didJustFinish: true,
      currentUrl: '',
      playbackComplete: true,
      wasPlayingUrl: wasPlayingUrl // Include for UI reference
    });
  }
}

// Clean up audio resources
export async function cleanupAudio(): Promise<void> {
  await stopAudio();
}

// Generate full surah audio URL
export function generateSurahAudioUrl(surahNumber: number, reciterIdentifier?: string): string {
  try {
    const reciter = reciterIdentifier || useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
    return `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${surahNumber}.mp3`;
  } catch (error) {
    console.error('Error generating surah audio URL:', error);
    // Safe fallback to Alafasy
    return `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surahNumber}.mp3`;
  }
}

// Play full surah audio
export async function playSurahAudio(surahNumber: number, onStatusUpdate?: (status: any) => void): Promise<void> {
  try {
    const audioUrl = generateSurahAudioUrl(surahNumber);
    await playAudio(audioUrl, 1, onStatusUpdate);
  } catch (error) {
    console.error('Error playing surah audio:', error);
    throw error;
  }
}