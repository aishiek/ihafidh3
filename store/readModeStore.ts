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

    // Actions
    setLastVisibleVerse: (surahId: number, verseNumber: number) => void;
    setLastVisibleJuz: (juzNumber: number) => void;
    clearHandoff: () => void;
}

export const useReadModeStore = create<ReadModeState>((set) => ({
    lastVisibleVerse: null,
    lastVisibleJuz: null,

    setLastVisibleVerse: (surahId, verseNumber) =>
        set({ lastVisibleVerse: { surahId, verseNumber } }),

    setLastVisibleJuz: (juzNumber) =>
        set({ lastVisibleJuz: juzNumber }),

    /**
     * Call clearHandoff() after consuming both values in read.tsx.
     * Clears both fields atomically so the values are never consumed twice.
     */
    clearHandoff: () =>
        set({ lastVisibleVerse: null, lastVisibleJuz: null }),
}));