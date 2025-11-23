import { render } from '@testing-library/react-native';
import React from 'react';

// Mocks
jest.mock('@/assets/database/QuranDatabase', () => ({ cacheAudioFile: jest.fn().mockResolvedValue(true), getCachedAudioPath: jest.fn().mockResolvedValue(null) }));
jest.mock('@/utils/audioCache', () => ({ ensureAudioCacheDir: jest.fn().mockResolvedValue(true) }));
jest.mock('@/utils/audioUtils', () => ({
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

import { getPageAudioManager } from '@/app/audio/PageAudioManager';
import PageAudioControls from '@/app/pagemode/PageAudioControls';

describe('PageAudioControls (unmount behavior)', () => {
  beforeEach(() => jest.resetModules());

  test('unmounting PageAudioControls does NOT call cleanup() on the shared manager', async () => {
    const mgr = getPageAudioManager();
    const spy = jest.spyOn(mgr, 'cleanup');

    const verses = [{ surahNumber: 1, ayahNumber: 1, id: 'v1' }];

    const { unmount } = render(<PageAudioControls verses={verses} reciterId="mock" />);

    // Unmount the component — cleanup() should NOT be called by the component
    unmount();

    expect(spy).not.toHaveBeenCalled();
  });
});
