// TypeScript file: juz-hizb-calculator.ts

export interface AyahReference {
    surah: number; // Surah number (1-114)
    ayah: number;  // Ayah number
}

export interface JuzInfo {
    juz: number;
    start: AyahReference;
}

export interface HizbInfo {
    hizb: number;
    part: 1 | 2; // Each Hizb is half a Juz
    start: AyahReference;
}

// Simplified list of starting points for each Juz (you can expand it for precise Ayah breakdown)
export const juzList: JuzInfo[] = [
    { juz: 1, start: { surah: 1, ayah: 1 } },
    { juz: 2, start: { surah: 2, ayah: 142 } },
    { juz: 3, start: { surah: 2, ayah: 253 } },
    { juz: 4, start: { surah: 3, ayah: 93 } },
    { juz: 5, start: { surah: 4, ayah: 24 } },
    { juz: 6, start: { surah: 4, ayah: 148 } },
    { juz: 7, start: { surah: 5, ayah: 82 } },
    { juz: 8, start: { surah: 6, ayah: 111 } },
    { juz: 9, start: { surah: 7, ayah: 88 } },
    { juz: 10, start: { surah: 8, ayah: 41 } },
    { juz: 11, start: { surah: 9, ayah: 93 } },
    { juz: 12, start: { surah: 11, ayah: 6 } },
    { juz: 13, start: { surah: 12, ayah: 53 } },
    { juz: 14, start: { surah: 15, ayah: 1 } },
    { juz: 15, start: { surah: 17, ayah: 1 } },
    { juz: 16, start: { surah: 18, ayah: 75 } },
    { juz: 17, start: { surah: 21, ayah: 1 } },
    { juz: 18, start: { surah: 23, ayah: 1 } },
    { juz: 19, start: { surah: 25, ayah: 21 } },
    { juz: 20, start: { surah: 27, ayah: 56 } },
    { juz: 21, start: { surah: 29, ayah: 46 } },
    { juz: 22, start: { surah: 33, ayah: 31 } },
    { juz: 23, start: { surah: 36, ayah: 28 } },
    { juz: 24, start: { surah: 39, ayah: 32 } },
    { juz: 25, start: { surah: 41, ayah: 47 } },
    { juz: 26, start: { surah: 46, ayah: 1 } },
    { juz: 27, start: { surah: 51, ayah: 31 } },
    { juz: 28, start: { surah: 58, ayah: 1 } },
    { juz: 29, start: { surah: 67, ayah: 1 } },
    { juz: 30, start: { surah: 78, ayah: 1 } },
];

// Generate Hizb info (60 parts, each half a Juz)
export const generateHizbList = (): HizbInfo[] => {
    const hizbs: HizbInfo[] = [];
    for (let i = 0; i < juzList.length; i++) {
        const juz = juzList[i];
        const nextJuz = juzList[i + 1] || { start: { surah: 114, ayah: 6 } }; // fallback to last verse
        const hizb1: HizbInfo = {
            hizb: i + 1,
            part: 1,
            start: juz.start,
        };
        const hizb2: HizbInfo = {
            hizb: i + 1,
            part: 2,
            // Approximate midpoint (can refine with Quranic DB)
            start: {
                surah: Math.floor((juz.start.surah + nextJuz.start.surah) / 2),
                ayah: 1,
            },
        };
        hizbs.push(hizb1, hizb2);
    }
    return hizbs;
};

// Utility to find Juz by Surah and Ayah
export function findJuz(surah: number, ayah: number): number | null {
    for (let i = juzList.length - 1; i >= 0; i--) {
        const j = juzList[i];
        if (
            surah > j.start.surah ||
            (surah === j.start.surah && ayah >= j.start.ayah)
        ) {
            return j.juz;
        }
    }
    return null;
}

// Utility to find Hizb (approximate logic)
export function findHizb(surah: number, ayah: number): string | null {
    const hizbs = generateHizbList();
    for (let i = hizbs.length - 1; i >= 0; i--) {
        const h = hizbs[i];
        if (
            surah > h.start.surah ||
            (surah === h.start.surah && ayah >= h.start.ayah)
        ) {
            return `Hizb ${h.hizb} (${h.part === 1 ? 'first half' : 'second half'})`;
        }
    }
    return null;
} 