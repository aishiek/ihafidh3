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

const chapterCache = new Map<number, { expiresAt: number; data: TajweedByVerseKey }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

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
  out = out.replace(/<span\s+class\s*=\s*"?end"?\s*>\s*([^<]*?)\s*<\/span>/g, '$1');

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
  const cached = chapterCache.get(chapterNumber);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = `${QURAN_COM_API}/quran/verses/uthmani_tajweed?chapter_number=${chapterNumber}`;
  const json = await fetchJsonWithTimeout(url);

  const verses: Array<{ verse_key: string; text_uthmani_tajweed: string }> = json?.verses || [];
  const map: TajweedByVerseKey = {};
  for (const v of verses) {
    if (v?.verse_key && typeof v.text_uthmani_tajweed === 'string') {
      map[v.verse_key] = v.text_uthmani_tajweed;
    }
  }

  chapterCache.set(chapterNumber, { expiresAt: Date.now() + CACHE_TTL_MS, data: map });
  return map;
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
