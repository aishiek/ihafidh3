import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';

const QURAN_COM_API = 'https://api.quran.com/api/v4';
const ALIF_TAJWID_API = 'https://api.alif.my.id/alquran';

// Pass through Quranic marks and let the font render them natively.
// Strip U+0640 (Arabic Tatweel/Kashida) when used as carrier before combining marks.
// Strip U+25CC (dotted-circle placeholder) which has no semantic meaning.
export function normalizeTajweedSource(text: string): string {
  if (!text) return '';
  // Strip tatweel when followed by combining marks (lookahead)
  let normalized = text.replace(/\u0640(?=[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06ED\u08D3-\u08FF])/g, '');
  // Strip dotted-circle placeholder
  normalized = normalized.replace(/\u25CC/g, '');
  return normalized;
}

type TajweedByVerseKey = Record<string, string>;

// ---------------------------------------------------------------------------
// Chapter cache: memory -> disk -> network.
//
// Tajweed markup is NOT in the local SQLite DB (AlQurandb.sqlite3 has the plain
// Uthmani text only), so every chapter has to come from quran.com the first time.
// Previously the cache was an in-memory Map with a 1-hour TTL, which meant every
// cold start re-fetched every chapter the user opened -- the main cause of the
// long "loading" on the Read tab.
//
// The markup is static scripture: it never changes. So the only reason to
// invalidate is a change to how we parse or store it, which CACHE_VERSION covers.
// Bump CACHE_VERSION to force every device to re-fetch.
const CACHE_VERSION = 1;

const chapterCache = new Map<number, TajweedByVerseKey>();
const inFlight = new Map<number, Promise<TajweedByVerseKey>>();

const DISK_CACHE_DIR = FileSystem?.documentDirectory
  ? `${FileSystem.documentDirectory}tajweed-cache/`
  : null;

let diskDirReady: Promise<void> | null = null;
async function ensureDiskCacheDir(): Promise<boolean> {
  if (!DISK_CACHE_DIR) return false;
  if (!diskDirReady) {
    diskDirReady = (async () => {
      const info = await FileSystem.getInfoAsync(DISK_CACHE_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(DISK_CACHE_DIR, { intermediates: true });
      }
    })();
  }
  try {
    await diskDirReady;
    return true;
  } catch {
    diskDirReady = null; // let a later call retry
    return false;
  }
}

function diskPathFor(chapterNumber: number): string | null {
  return DISK_CACHE_DIR ? `${DISK_CACHE_DIR}chapter-${chapterNumber}.v${CACHE_VERSION}.json` : null;
}

async function readChapterFromDisk(chapterNumber: number): Promise<TajweedByVerseKey | null> {
  const path = diskPathFor(chapterNumber);
  if (!path) return null;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(path));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as TajweedByVerseKey;
  } catch {
    return null; // corrupt or unreadable -> treat as a miss, refetch
  }
}

async function writeChapterToDisk(chapterNumber: number, data: TajweedByVerseKey): Promise<void> {
  const path = diskPathFor(chapterNumber);
  if (!path) return;
  try {
    if (!(await ensureDiskCacheDir())) return;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(data));
  } catch (e) {
    // Cache writes are best-effort; a failure must never break rendering.
    console.warn('[tajweed] disk cache write failed:', e);
  }
}

/** Remove every cached chapter from disk. Exposed for a future "clear cache" setting. */
export async function clearTajweedDiskCache(): Promise<void> {
  chapterCache.clear();
  if (!DISK_CACHE_DIR) return;
  try {
    const info = await FileSystem.getInfoAsync(DISK_CACHE_DIR);
    if (info.exists) await FileSystem.deleteAsync(DISK_CACHE_DIR, { idempotent: true });
  } catch (e) {
    console.warn('[tajweed] disk cache clear failed:', e);
  }
  diskDirReady = null;
}

export function quranComTajweedHtmlToRnTajweedMarkup(input: string): string {
  if (!input) return '';

  // TajweedVerse expects full named markup like: [madda_normal]TEXT[/madda_normal]
  // Quran.com returns HTML like: <tajweed class=madda_normal>ـٰ</tajweed>
  // We convert directly, preserving class names
  const classToRuleName: Record<string, string> = {
    // Hamzat Wasl
    ham_wasl: 'ham_wasl',
    hamza_wasl: 'ham_wasl',
    hamzat_wasl: 'ham_wasl',

    // Lam Shamsiyyah
    laam_shamsiyah: 'laam_shamsiyah',
    lam_shamsiyah: 'lam_shamsiyah',
    laam_shamsiyyah: 'laam_shamsiyah',
    lam_shamsiyyah: 'lam_shamsiyah',

    // Silent letters
    silent: 'silent',
    slnt: 'silent',

    // Madd
    madda_normal: 'madda_normal',
    madda_permissible: 'madda_permissible',
    madda_necessary: 'madda_necessary',
    madda_obligatory: 'madda_obligatory',

    // Qalqalah
    qalqalah: 'qalaqala',
    qalqala: 'qalaqala',
    qalaqah: 'qalaqala',
    qlq: 'qalaqala',

    // Ikhfa
    ikhfa_shafawi: 'ikhfa_shafawi',
    ikhafa_shafawi: 'ikhfa_shafawi',
    ikhfa: 'ikhfa',
    ikhafa: 'ikhfa',
    ikhf_shfw: 'ikhfa_shafawi',
    ikhf: 'ikhfa',

    // Idgham families
    idgham_shafawi: 'idgham_shafawi',
    idghaam_shafawi: 'idgham_shafawi',
    idgham_w_ghunnah: 'idgham_w_ghunnah',
    idgham_w_ghunna: 'idgham_w_ghunnah',
    idgham_ghunnah: 'idgham_w_ghunnah',
    idgham_ghunna: 'idgham_w_ghunnah',
    idgham_wo_ghunnah: 'idgham_wo_ghunnah',
    idgham_wo_ghunna: 'idgham_wo_ghunnah',
    idgham_mutajanisayn: 'idgham_mutajanisayn',
    idgham_mutaqaribayn: 'idgham_mutaqaribayn',
    idghm_shfw: 'idgham_shafawi',
    idgh_ghn: 'idgham_w_ghunnah',
    idgh_w_ghn: 'idgham_w_ghunnah',
    idgh_mus: 'idgham_mutajanisayn',
    // Generic idgham
    idgham: 'idgham_w_ghunnah',
    idghaam: 'idgham_w_ghunnah',

    // Iqlab
    iqlab: 'iqlab',
    iqlb: 'iqlab',

    // Ghunnah
    ghunnah: 'ghunnah',
    ghunna: 'ghunnah',
    ghn: 'ghunnah',
  };

  const unknownClasses = new Set<string>();

  // Replace each tajweed span with rn-tajweed-verse markup.
  // Format: [ruleName]TEXT[/ruleName]
  let out = input.replace(
    /<tajweed\s+class\s*=\s*"?([^\s">]+)"?\s*>([\s\S]*?)<\/tajweed>/g,
    (_m, cls, inner) => {
      const className = String(cls);
      const ruleName = classToRuleName[className];
      const cleanedInner = String(inner).replace(/<[^>]+>/g, '');
      if (!ruleName) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          if (!unknownClasses.has(className) && unknownClasses.size < 25) {
            unknownClasses.add(className);
            console.warn('[tajweed] Unknown Quran.com tajweed class:', className);
          }
        }
        return cleanedInner;
      }
      return `[${ruleName}]${cleanedInner}[/${ruleName}]`;
    }
  );

  // Remove Quran.com end markers like: <span class=end>١</span>
  // We replace with the decorative marker (U+06DD) and remove the raw digit
  // so TajweedText can manually overlay the correct number with perfect alignment.
  out = out.replace(/<span\s+class\s*=\s*"?end"?\s*>\s*([^<]*?)\s*<\/span>/g, '\u06DD');

  // Drop any other tags defensively
  out = out.replace(/<[^>]+>/g, '');

  return out;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number = 8000): Promise<any> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(to);
  }
}

export async function fetchUthmaniTajweedByChapter(chapterNumber: number): Promise<TajweedByVerseKey> {
  // 1. memory
  const mem = chapterCache.get(chapterNumber);
  if (mem) return mem;

  // De-duplicate concurrent requests for the same chapter. The Juz view asks for
  // several chapters at once and can otherwise fire the same fetch more than once.
  const existing = inFlight.get(chapterNumber);
  if (existing) return existing;

  const job = (async (): Promise<TajweedByVerseKey> => {
    // 2. disk
    const fromDisk = await readChapterFromDisk(chapterNumber);
    if (fromDisk) {
      chapterCache.set(chapterNumber, fromDisk);
      return fromDisk;
    }

    // 3. network
    const url = `${QURAN_COM_API}/quran/verses/uthmani_tajweed?chapter_number=${chapterNumber}`;
    const json = await fetchJsonWithTimeout(url);

    const verses: Array<{ verse_key: string; text_uthmani_tajweed: string }> = json?.verses || [];
    const map: TajweedByVerseKey = {};
    for (const v of verses) {
      if (v?.verse_key && typeof v.text_uthmani_tajweed === 'string') {
        map[v.verse_key] = v.text_uthmani_tajweed;
      }
    }

    chapterCache.set(chapterNumber, map);
    void writeChapterToDisk(chapterNumber, map); // best-effort, not awaited
    return map;
  })();

  inFlight.set(chapterNumber, job);
  try {
    return await job;
  } finally {
    inFlight.delete(chapterNumber);
  }
}

export async function fetchUthmaniTajweedRnMarkupByChapter(chapterNumber: number): Promise<TajweedByVerseKey> {
  const raw = await fetchUthmaniTajweedByChapter(chapterNumber);
  const out: TajweedByVerseKey = {};
  for (const [k, v] of Object.entries(raw)) {
    const markup = quranComTajweedHtmlToRnTajweedMarkup(v);
    out[k] = normalizeTajweedSource(markup);
  }
  return out;
}

export async function fetchUthmaniTajweedRnMarkupByKey(verseKey: string): Promise<string | null> {
  const [chapterStr] = verseKey.split(':');
  const chapterNumber = Number(chapterStr);
  if (!chapterNumber || Number.isNaN(chapterNumber)) return null;

  const map = await fetchUthmaniTajweedRnMarkupByChapter(chapterNumber);
  return map[verseKey] || null;
}

type AlifTajwidVerse = {
  nomor?: number;
  ayat?: number;
  verse?: number;
  teks?: string;
  text?: string;
  tajwid?: string;
  tajwidText?: string;
};

function extractAlifVerseArray(json: any): AlifTajwidVerse[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as AlifTajwidVerse[];
  if (Array.isArray(json.data)) return json.data as AlifTajwidVerse[];
  if (Array.isArray(json.ayat)) return json.ayat as AlifTajwidVerse[];
  if (Array.isArray(json.verses)) return json.verses as AlifTajwidVerse[];
  return [];
}

function extractAlifTajwidHtml(v: AlifTajwidVerse): string {
  return (
    (typeof v.tajwid === 'string' && v.tajwid) ||
    (typeof v.tajwidText === 'string' && v.tajwidText) ||
    (typeof v.teks === 'string' && v.teks) ||
    (typeof v.text === 'string' && v.text) ||
    ''
  );
}

function extractAlifVerseNumber(v: AlifTajwidVerse): number | null {
  const n = (v.ayat ?? v.verse ?? v.nomor) as any;
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export async function fetchAlifTajwidRnMarkupByChapter(chapterNumber: number): Promise<TajweedByVerseKey> {
  const url = `${ALIF_TAJWID_API}/${chapterNumber}/tajwid`;
  const json = await fetchJsonWithTimeout(url);

  const verses = extractAlifVerseArray(json);
  const out: TajweedByVerseKey = {};

  // Some APIs may omit verse numbers; fall back to 1..N order.
  for (let idx = 0; idx < verses.length; idx++) {
    const v = verses[idx];
    const verseNum = extractAlifVerseNumber(v) ?? idx + 1;
    const key = `${chapterNumber}:${verseNum}`;

    const html = extractAlifTajwidHtml(v);
    const markup = quranComTajweedHtmlToRnTajweedMarkup(html);
    out[key] = normalizeTajweedSource(markup);
  }

  return out;
}

export async function fetchTajwidRnMarkupByChapter(chapterNumber: number): Promise<TajweedByVerseKey> {
  // Debug/test path: try Alif first (different source), fall back to Quran.com.
  try {
    return await fetchAlifTajwidRnMarkupByChapter(chapterNumber);
  } catch (e) {
    console.warn('[tajweed] Alif tajwid fetch failed; falling back to Quran.com:', e);
    return await fetchUthmaniTajweedRnMarkupByChapter(chapterNumber);
  }
}

// ---- one-time offline prefetch ------------------------------------------------
const PREFETCH_FLAG_KEY = `tajweed_prefetch_done_v${CACHE_VERSION}`;
let prefetchRunning = false;

async function isChapterOnDisk(ch: number): Promise<boolean> {
  const p = diskPathFor(ch);
  if (!p) return false;
  try {
    return (await FileSystem.getInfoAsync(p)).exists;
  } catch {
    return false;
  }
}

/**
 * Download every chapter's tajweed markup into the disk cache once, on wifi only.
 * Makes tajweed mode fully offline without bundling the dataset into the app.
 *
 * Safe to call on every launch: it no-ops once complete, skips chapters already on
 * disk, and gives up quietly on any failure so the next launch resumes where it
 * stopped. Deliberately sequential with a small gap — this is background work and
 * must never compete with the verses the user is actually reading.
 */
export async function prefetchAllTajweedChapters(): Promise<void> {
  if (prefetchRunning) return;
  try {
    if (await AsyncStorage.getItem(PREFETCH_FLAG_KEY)) return; // already done
    const net = await NetInfo.fetch();
    if (!net.isConnected || net.type !== 'wifi') return;       // wifi only
    prefetchRunning = true;

    let cached = 0;
    for (let ch = 1; ch <= 114; ch++) {
      if (await isChapterOnDisk(ch)) { cached++; continue; }
      try {
        await fetchUthmaniTajweedByChapter(ch);
        chapterCache.delete(ch); // keep it on disk, don't hold ~4MB in RAM
        cached++;
      } catch {
        // leave this chapter for the next launch
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    if (cached === 114) await AsyncStorage.setItem(PREFETCH_FLAG_KEY, '1');
  } catch {
    // best-effort: never surface prefetch problems to the user
  } finally {
    prefetchRunning = false;
  }
}
