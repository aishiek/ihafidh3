import { surahsData } from '@/data/surahs';
import type { DuaStatus, QuranicDua } from '@/types/duas';

/**
 * Convert surah:verse to global verse ID
 * Matches the format used in progressStore
 */
export function getVerseId(surahNumber: number, verseNumber: number): number {
    let startVerseId = 0;

    for (let i = 1; i < surahNumber; i++) {
        const surah = surahsData.find(s => s.id === i);
        if (surah) {
            startVerseId += surah.versesCount;
        }
    }

    return startVerseId + verseNumber;
}

/**
 * Get dua status based on memorization and revision state
 */
export function getDuaStatus(
    surahNumber: number,
    verseNumber: number,
    memorizedVerses: number[],
    revisedVerses: Array<{ verseId: number; revisionDate: string }>
): DuaStatus {
    const verseId = getVerseId(surahNumber, verseNumber);

    const isMemorized = memorizedVerses.includes(verseId);
    const isRevised = revisedVerses.some(v => v.verseId === verseId);

    if (isMemorized && isRevised) return 'perfect';
    if (isMemorized) return 'memorized';
    if (isRevised) return 'revised';
    return 'new';
}

/**
 * Get surah name from surah number
 */
export function getSurahName(surahNumber: number): string {
    const surah = surahsData.find(s => s.id === surahNumber);
    return surah?.name || `Surah ${surahNumber}`;
}

/**
 * Get surah English name from surah number
 */
export function getSurahEnglishName(surahNumber: number): string {
    const surah = surahsData.find(s => s.id === surahNumber);
    return surah?.englishName || `Surah ${surahNumber}`;
}

/**
 * Calculate dua statistics
 */
export function calculateDuaStats(
    duas: QuranicDua[],
    memorizedVerses: number[],
    revisedVerses: Array<{ verseId: number; revisionDate: string }>
) {
    const duaVerseIds = duas.map(dua => getVerseId(dua.surahNumber, dua.verseNumber));

    const memorized = duaVerseIds.filter(id => memorizedVerses.includes(id)).length;

    const revised = duaVerseIds.filter(id =>
        revisedVerses.some(v => v.verseId === id) &&
        !memorizedVerses.includes(id) // Don't double count
    ).length;

    const pending = duas.length - memorized - revised;

    return {
        memorized,
        revised,
        pending,
        total: duas.length
    };
}
