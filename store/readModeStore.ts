/**
 * store/readModeStore.ts
 *
 * Side-channel store for the landscape ↔ portrait handoff.
 *
 * ReadModeScreen writes here before calling router.back().
 * read.tsx reads here (via useEffect on verses/juzVerses) and
 * scrolls to the right position, then clears the values.
 *
 * Why a store and not router params?
 * router.back() carries no data in Expo Router. router.push() was
 * tried but fights the existing read.tsx navigation-param system
 * and breaks juz mode entirely. The store is the cleanest solution.
 */

import { create } from 'zustand';

interface ReadModeState {
    /**
     * The last verse the user was reading in landscape mode.
     * surahId  — the surah of that verse (updated per-verse in juz mode,
     *            so it reflects the actual visible surah, not the juz's
     *            first surah).
     * verseNumber — always a verseNumber (1-indexed within the surah),
     *               NEVER a verseId. read.tsx compares against v.verseNumber.
     */
    lastVisibleVerse: { surahId: number; verseNumber: number } | null;

    /**
     * Set when returning from juz mode so read.tsx knows to reload the
     * correct juz list before attempting scroll restoration.
     * Null when returning from surah mode.
     */
    lastVisibleJuz: number | null;

    isOrientationFree: boolean;

    /**
     * Set true in ReadModeScreen right before router.back() on portrait return.
     * read.tsx useFocusEffect checks this synchronously so it does not reset the tab
     * while lastVisibleVerse is still present — avoiding a race with clearHandoff().
     */
    pendingPortraitHandoff: boolean;

    /**
     * Incremented when the user taps the Recite tab while already on it.
     * read.tsx listens to this to reset back to the Surah/Juz list.
     */
    readTabResetTrigger: number;

    // Actions
    setLastVisibleVerse: (surahId: number, verseNumber: number) => void;
    setLastVisibleJuz: (juzNumber: number) => void;
    setIsOrientationFree: (isOrientationFree: boolean) => void;
    setPendingPortraitHandoff: (pending: boolean) => void;
    clearHandoff: () => void;
    triggerReadTabReset: () => void;
}

export const useReadModeStore = create<ReadModeState>((set) => ({
    lastVisibleVerse: null,
    lastVisibleJuz: null,
    isOrientationFree: false,
    pendingPortraitHandoff: false,
    readTabResetTrigger: 0,

    setLastVisibleVerse: (surahId, verseNumber) =>
        set({ lastVisibleVerse: { surahId, verseNumber } }),

    setLastVisibleJuz: (juzNumber) =>
        set({ lastVisibleJuz: juzNumber }),

    setIsOrientationFree: (isOrientationFree: boolean) =>
        set({ isOrientationFree }),

    setPendingPortraitHandoff: (pending: boolean) =>
        set({ pendingPortraitHandoff: pending }),

    /**
     * Call clearHandoff() after consuming both values in read.tsx.
     * Clears both fields atomically so the values are never consumed twice.
     */
    clearHandoff: () =>
        set({ lastVisibleVerse: null, lastVisibleJuz: null }),

    triggerReadTabReset: () =>
        set((state) => ({ readTabResetTrigger: state.readTabResetTrigger + 1 })),
}));