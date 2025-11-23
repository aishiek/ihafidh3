/**
 * Unit tests for PageAudioManager singleton & lifecycle
 */

// Mocks for dependencies
jest.mock('../../assets/database/QuranDatabase', () => ({ cacheAudioFile: jest.fn().mockResolvedValue(true), getCachedAudioPath: jest.fn().mockResolvedValue(null) }));
jest.mock('../../utils/audioCache', () => ({ ensureAudioCacheDir: jest.fn().mockResolvedValue(true) }));
jest.mock('../../utils/audioUtils', () => ({
  getAudioUrl: jest.fn((r: any, s: number, v: number) => `http://mock/${s}-${v}.mp3`),
  playAudio: jest.fn().mockResolvedValue(true),
  pauseAudio: jest.fn().mockResolvedValue(true),
  resumeAudio: jest.fn().mockResolvedValue(true),
  stopAudio: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-file-system', () => ({
  downloadAsync: jest.fn().mockResolvedValue({ status: 200, uri: 'file:///tmp/audio.mp3' }),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(true),
  documentDirectory: 'file:///tmp/',
  cacheDirectory: 'file:///tmp/cache/',
}));

// Mock expo-av so PageAudioManager's dedicated Audio.Sound resolves quickly
let __playCalls = 0;
jest.mock('expo-av', () => {
  class MockSound {
    private handler: ((status: any) => void) | null = null;

    async loadAsync() { return Promise.resolve(); }
    setOnPlaybackStatusUpdate(fn: (s: any) => void) { this.handler = fn; }
    async playAsync() {
      // simulate an immediate start and finish
      if (this.handler) {
        this.handler({ isLoaded: true, isPlaying: true });
        this.handler({ isLoaded: true, isPlaying: false, didJustFinish: true });
      }
      __playCalls++;
      return Promise.resolve();
    }
    async getStatusAsync() { return { isLoaded: true, isPlaying: false }; }
    async stopAsync() { return Promise.resolve(); }
    async unloadAsync() { return Promise.resolve(); }
  }

  return { Audio: { Sound: MockSound }, __playCallsRef: { get: () => __playCalls, reset: () => { __playCalls = 0; } } };
});

describe('PageAudioManager (singleton & lifecycle)', () => {
  beforeEach(() => {
    // reset singleton state by requiring module anew (simple approach)
    jest.resetModules();
  });

  test('getPageAudioManager returns same instance (singleton)', () => {
    const { getPageAudioManager: g1 } = require('../../app/audio/PageAudioManager');
    const a = g1();
    const b = g1();
    expect(a).toBe(b);
  });

  test('stop() does not delete downloaded audio files (cleanup keeps separate)', async () => {
    const { getPageAudioManager: g } = require('../../app/audio/PageAudioManager');
    const mgr = g();

    // Provide a fake verse and download
    const verses = [{ surahNumber: 1, ayahNumber: 1, id: 'test-1' }];
    const res = await mgr.downloadPageAudio(verses, 'mock');
    expect(res.length).toBeGreaterThan(0);

    // stop should not clear audioFiles (so playPage should still be available)
    await mgr.stop();

    // now trying to play should work since audioFiles are present
    await expect(mgr.playPage(1)).resolves.toBeUndefined();
  });

  test('cleanup() clears audio files and prevents subsequent play', async () => {
    const { getPageAudioManager: g } = require('../../app/audio/PageAudioManager');
    const mgr = g();

    const verses = [{ surahNumber: 1, ayahNumber: 2, id: 'test-2' }];
    await mgr.downloadPageAudio(verses, 'mock');

    // cleanup should clear internal state
    await mgr.cleanup();

    // playPage should now reject because audioFiles are empty
    await expect(mgr.playPage(1)).rejects.toThrow(/No audio files loaded/);
  });

  test('playPage honors per-verse repeat count (playAsync called correct number of times)', async () => {
    const { getPageAudioManager: g } = require('../../app/audio/PageAudioManager');
    const { __playCallsRef } = require('expo-av');

    // reset mocked play counter
    __playCallsRef.reset();

    const mgr = g();
    const verses = [{ surahNumber: 1, ayahNumber: 3, id: 'test-3' }];
    await mgr.downloadPageAudio(verses, 'mock');

    // Repeat three times
    await mgr.playPage(3);

    expect(__playCallsRef.get()).toBe(3);
  });

  test('playPage honors global infiniteLoop setting (stoppable)', async () => {
    const { getPageAudioManager: g } = require('../../app/audio/PageAudioManager');
    const { __playCallsRef } = require('expo-av');
    const { useSettingsStore } = require('../../store/settingsStore');

    // reset mocked play counter
    __playCallsRef.reset();
    // enable infinite loop in settings
    useSettingsStore.getState().setInfiniteLoop(true);

    const mgr = g();
    const verses = [{ surahNumber: 1, ayahNumber: 4, id: 'test-4' }];
    await mgr.downloadPageAudio(verses, 'mock');

    // Start page playback which should treat the verse as infinite.
    const p = mgr.playPage(); // default param will be interpreted using settings

    // Allow some microtasks to run so playAsync is invoked a couple of times
    await new Promise((r) => setTimeout(r, 0));

    // stop manager — should abort the infinite loop
    await mgr.stop();

    // Wait for the play promise to settle
    await expect(p).resolves.toBeUndefined();

    // We expect at least 2 play cycles occurred before we stopped
    expect(__playCallsRef.get()).toBeGreaterThanOrEqual(2);

    // reset infiniteLoop for other tests
    useSettingsStore.getState().setInfiniteLoop(false);
  });
});
