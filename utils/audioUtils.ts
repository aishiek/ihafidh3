import { Audio } from 'expo-av';
import { useSettingsStore } from '@/store/settingsStore';
import type { Verse } from '@/types';

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
};

let player: Audio.Sound | null = null;
let isPlaying = false;
let repeatCount = 0;
let maxRepeats = 1;
let currentUrl = '';
let statusCallback: ((status: AudioStatus) => void) | null = null;

const BISMILLAH_URL = 'https://verses.quran.com/Bismillah.mp3';

/* ---------- INIT ---------- */
export async function initializeAudio() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS,
      playsInSilentModeIOS: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
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
  const url = `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyah}.mp3`;
  return (await checkAudioAvailability(url)) ? url : `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyah}.mp3`;
}

export async function generateSurahUrl(reciter: string, surah: number) {
  const url = `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${surah}.mp3`;
  return (await checkAudioAvailability(url)) ? url : `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surah}.mp3`;
}

/* ---------- CORE AUDIO ---------- */
async function playAudio(url: string, repeats = 1, callback?: (status: AudioStatus) => void) {
  await stopAudio();
  await initializeAudio();

  player = new Audio.Sound();
  await player.loadAsync({ uri: url });
  currentUrl = url;
  maxRepeats = Math.max(1, repeats);
  repeatCount = 0;
  isPlaying = true;
  statusCallback = callback || null;

  player.setOnPlaybackStatusUpdate(onPlaybackStatus);

  await player.playAsync();
  callback?.({ isPlaying: true, currentUrl: url });
}

async function onPlaybackStatus(status: any) {
  if (!status) return;

  if (status.isLoaded) {
    isPlaying = status.isPlaying;

    statusCallback?.({
      isPlaying,
      currentUrl,
      repeatCount,
      maxRepeats,
      didJustFinish: status.didJustFinish,
    });

    if (status.didJustFinish) {
      if (repeatCount < maxRepeats - 1) {
        repeatCount++;
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
    await player?.stopAsync();
    await player?.unloadAsync();
  } catch {}
  player = null;
  isPlaying = false;
  currentUrl = '';
  repeatCount = 0;
  maxRepeats = 1;
  statusCallback?.({ isPlaying: false, currentUrl: '' });
}

export async function pauseAudio() {
  if (player && isPlaying) {
    await player.pauseAsync();
    isPlaying = false;
    statusCallback?.({ isPlaying: false, isPaused: true, currentUrl });
  }
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

  const shouldPlayBismillah = verse.hasBismillahPrefix || (surah !== 9 && verse.verseNumber === 1);

  if (shouldPlayBismillah) {
    await playBismillahThenVerse(url, repeats, cb);
  } else {
    await playAudio(url, repeats, cb);
  }
}

async function playBismillahThenVerse(url: string, repeats = 1, cb?: (status: AudioStatus) => void) {
  await stopAudio();
  await initializeAudio();

  const bismi = new Audio.Sound();
  await bismi.loadAsync({ uri: BISMILLAH_URL });
  bismi.setOnPlaybackStatusUpdate(async (status: any) => {
    if (status.didJustFinish) {
      await bismi.stopAsync();
      await bismi.unloadAsync();
      await playAudio(url, repeats, cb);
    }
  });

  await bismi.playAsync();
}

export async function playSurah(surah: number, cb?: (status: AudioStatus) => void) {
  const reciter = useSettingsStore.getState().reciterIdentifier || 'ar.alafasy';
  const url = await generateSurahUrl(reciter, surah);
  await playAudio(url, 1, cb);
}
