export interface QuranicDua {
    id: string;
    surahNumber: number;
    verseNumber: number;
    verseNumberEnd?: number; // For multi-verse duas
    category: 'Rabbana' | 'Prophetic';
    subcategory?: 'Knowledge' | 'Family' | 'Hardship' | 'Protection';
    theme: string;
    juz: number;
    arabicSnippet: string;
    prophet?: string;
    context?: string;
    tags?: string[];
}

export type DuaStatus = 'new' | 'memorized' | 'revised' | 'perfect';

export interface DuaStats {
    memorized: number;
    revised: number;
    pending: number;
    total: number;
}
