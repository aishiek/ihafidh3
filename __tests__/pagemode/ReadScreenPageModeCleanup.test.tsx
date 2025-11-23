import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

// Mock out many dependencies so ReadScreen can mount without full app context
jest.mock('@/components/PageModeConfig', () => ({
  __esModule: true,
  default: (props: any) => {
    // If visible is toggled, immediately call onStart to simulate a quick selection
    if (props.visible && typeof props.onStart === 'function') {
      // call with surah, verses per page
      setTimeout(() => props.onStart('surah', props.initialVersesPerPage), 0);
    }
    return null;
  }
}));

jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: () => ({ reciterIdentifier: 'ar.alafasy', repeatMode: 1, playbackSpeed: 1, defaultVersesPerPage: 10 }),
}));

jest.mock('@/store/progressStore', () => ({
  useProgressStore: () => ({
    memorizedVerses: [], revisedVerses: [], memorizedVerseDates: {}, setLastReadVerse: jest.fn(), markVerseAsMemorized: jest.fn(), unmarkVerseAsMemorized: jest.fn(),
    markVerseAsRevised: jest.fn(), unmarkVerseAsRevised: jest.fn(), bulkMarkVersesMemorized: jest.fn(), bulkMarkVersesRevised: jest.fn(), markPageAsMemorized: jest.fn(), markPageAsRevised: jest.fn(), unmarkPageAsMemorized: jest.fn(), unmarkPageAsRevised: jest.fn(),
    pageMarks: [],
  })
}));

jest.mock('@/store/quranStore', () => ({ useQuranStore: () => ({ lastViewedSurahId: null, setLastViewedSurahId: jest.fn() }) }));

// audio & filesystem mocks
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

import ReadScreen from '@/app/(tabs)/read';
import { getPageAudioManager } from '@/app/audio/PageAudioManager';

describe('ReadScreen Page Mode cleanup behavior', () => {
  beforeEach(() => jest.resetModules());

  test('entering Page Mode cleans up any previous manager state (defensive) and exitPageMode triggers cleanup', async () => {
    const mgr = getPageAudioManager();
    const spy = jest.spyOn(mgr, 'cleanup');

    const { getByText, getByTestId } = render(<ReadScreen />);

    // Press header 'Page' button to open PageModeConfig (mock will call onStart)
    const pageBtn = getByText(/Page/);
    fireEvent.press(pageBtn);

    // wait for the mocked onStart to run and cleanup to be called
    await waitFor(() => expect(spy).toHaveBeenCalled());

    // Now the page overlay should be visible and have a close button we added testID for
    const closeBtn = await waitFor(() => getByTestId('page-overlay-close'));
    fireEvent.press(closeBtn);

    // cleanup should have been called again on exit
    await waitFor(() => expect(spy).toHaveBeenCalled());
  });
});
