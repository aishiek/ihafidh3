import { surahsData } from '@/data/surahs';

// Definitive per-juz cumulative last-verse-id table (Uthmani standard, 6236 total verses)
export const JUZ_BOUNDARIES: readonly number[] = [
  148,  // Juz 1  (Al-Fatiha:1 – Al-Baqarah:141)
  259,  // Juz 2  (Al-Baqarah:142 – Al-Baqarah:252)
  384,  // Juz 3  (Al-Baqarah:253 – Al-Imran:91)
  519,  // Juz 4  (Al-Imran:92 – An-Nisa:23)
  640,  // Juz 5  (An-Nisa:24 – An-Nisa:147)
  755,  // Juz 6  (An-Nisa:148 – Al-Maidah:81)
  868,  // Juz 7  (Al-Maidah:82 – Al-Anam:110)
  996,  // Juz 8  (Al-Anam:111 – Al-Araf:87)
  1125, // Juz 9  (Al-Araf:88 – Al-Anfal:40)
  1240, // Juz 10 (Al-Anfal:41 – At-Tawbah:92)
  1361, // Juz 11 (At-Tawbah:93 – Hud:5)
  1482, // Juz 12 (Hud:6 – Yusuf:52)
  1609, // Juz 13 (Yusuf:53 – Ibrahim:52)
  1741, // Juz 14 (Al-Hijr:1 – An-Nahl:128)
  1802, // Juz 15 (Al-Isra:1 – Al-Kahf:74)  [Al-Isra starts at cumulative 1742]
  1901, // Juz 16 (Al-Kahf:75 – Ta-Ha:135)
  2029, // Juz 17 (Al-Anbiya:1 – Al-Hajj:78)
  2140, // Juz 18 (Al-Muminun:1 – Al-Furqan:20)
  2254, // Juz 19 (Al-Furqan:21 – An-Naml:55)
  2396, // Juz 20 (An-Naml:56 – Al-Ankabut:44)
  2519, // Juz 21 (Al-Ankabut:45 – Al-Ahzab:30)
  2637, // Juz 22 (Al-Ahzab:31 – Ya-Sin:27)
  2760, // Juz 23 (Ya-Sin:28 – Az-Zumar:31)
  2882, // Juz 24 (Az-Zumar:32 – Fussilat:46)
  3002, // Juz 25 (Fussilat:47 – Al-Jathiyah:37)
  3114, // Juz 26 (Al-Ahqaf:1 – Adh-Dhariyat:30)
  3185, // Juz 27 (Adh-Dhariyat:31 – Al-Hadid:29)
  3314, // Juz 28 (Al-Mujadila:1 – At-Tahrim:12)
  3416, // Juz 29 (Al-Mulk:1 – Al-Mursalat:50)
  6236, // Juz 30 (An-Naba:1 – An-Nas:6)
] as const;

/** Returns the 1-based juz number (1–30) for a given cumulative verse ID. O(30) lookup. */
export function getJuzFromVerseId(verseId: number): number {
  for (let i = 0; i < JUZ_BOUNDARIES.length; i++) {
    if (verseId <= JUZ_BOUNDARIES[i]) return i + 1;
  }
  return 30; // fallback: anything beyond 6236 is treated as Juz 30
}

interface SurahMeta {
  name: string;
  versesCount: number;
  primaryJuz: number;
}

// Build precomputed lookups once at module load
const SURAH_META: Record<number, SurahMeta> = {};
const JUZ_META: Record<number, { versesCount: number; surahCount: number; surahs: Set<number> }> = {};

for (let i = 1; i <= 30; i++) {
  JUZ_META[i] = { versesCount: 0, surahCount: 0, surahs: new Set() };
}

let startId = 0;
for (const s of surahsData) {
  const firstVerseId = startId + 1;
  const primaryJuz = getJuzFromVerseId(firstVerseId);
  
  SURAH_META[s.id] = {
    name: s.name, // The transliteration (e.g. "Al-Baqarah")
    versesCount: s.versesCount,
    primaryJuz,
  };

  // Assign verses to their respective Juz to compute juz metadata
  for (let v = 1; v <= s.versesCount; v++) {
    const verseId = startId + v;
    const juzId = getJuzFromVerseId(verseId);
    
    if (JUZ_META[juzId]) {
      JUZ_META[juzId].versesCount++;
      JUZ_META[juzId].surahs.add(s.id);
    }
  }

  startId += s.versesCount;
}

// Compute final surah counts per juz
for (let i = 1; i <= 30; i++) {
  if (JUZ_META[i]) {
    JUZ_META[i].surahCount = JUZ_META[i].surahs.size;
  }
}

/** Get the canonical English name of a surah (e.g. "Al-Baqarah") */
export function getSurahName(surahId: number): string {
  return SURAH_META[surahId]?.name || 'unknown';
}

export function getSurahVerseCount(surahId: number): number {
  return SURAH_META[surahId]?.versesCount || 0;
}

/** Get the juz number where this surah starts */
export function getPrimaryJuz(surahId: number): number {
  return SURAH_META[surahId]?.primaryJuz || 0;
}

export function getJuzVerseCount(juzId: number): number {
  return JUZ_META[juzId]?.versesCount || 0;
}

export function getJuzSurahCount(juzId: number): number {
  return JUZ_META[juzId]?.surahCount || 0;
}
