// Lightweight Tafsir API client for Quran.com v4 with language preference and English fallback
// No external deps; includes small cache, timeout handling, and HTML cleanup.

const QURAN_API = 'https://api.quran.com/api/v4';

import { getTamilTafsir } from './localTamilTafsir';
export interface TafsirResult {
  resourceId: number;
  resourceName: string;
  verseKey: string; // e.g., "1:1"
  text: string; // plain text (HTML cleaned)
}

// Known tafsir resources by language preference (ordered by desirability)
// Source: https://api.quran.com/api/v4/resources/tafsirs (IDs may evolve; keep fallback robust)
const TAFSIR_CANDIDATES: Record<string, Array<{ id: number; name: string }>> = {
  en: [
    { id: 169, name: 'Ibn Kathir (Abridged)' },
    { id: 168, name: "Ma'arif al-Qur'an" },
    { id: 817, name: 'Tazkirul Quran (Wahiduddin Khan)' },
  ],
  bn: [
    { id: 165, name: 'Tafsir Ahsanul Bayaan' },
    { id: 166, name: 'Tafsir Abu Bakr Zakaria' },
  ],
  ur: [
    { id: 159, name: 'Bayan ul Quran (Dr. Israr)' },
    { id: 160, name: 'Tafsir Ibn Kathir (Urdu)' },
  ],
  ar: [
    { id: 14, name: 'Tafsir Ibn Kathir (Arabic)' },
    { id: 15, name: 'Tafsir al-Tabari' },
    { id: 90, name: 'Al-Qurtubi' },
  ],
};

const ENGLISH_DEFAULT = { id: 169, name: 'Ibn Kathir (Abridged)' };

// Very small in-memory cache: key -> TafsirResult
const cache = new Map<string, TafsirResult>();

function getLangPrefix(language: string | undefined): string {
  if (!language) return 'en';
  const prefix = language.split('.')[0]?.toLowerCase() || 'en';
  return prefix;
}

function isTamilLanguage(language: string | undefined): boolean {
  const p = getLangPrefix(language);
  return p === 'ta' || p.startsWith('ta');
}

function getCandidates(language: string | undefined): Array<{ id: number; name: string }> {
  const prefix = getLangPrefix(language);
  const byLang = TAFSIR_CANDIDATES[prefix];
  if (byLang && byLang.length) return byLang;
  return [ENGLISH_DEFAULT];
}

function htmlToText(html: string): string {
  try {
    let text = html;
    // Remove script and style blocks first
    text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
    // Convert common block/line tags to newlines BEFORE stripping tags
    text = text
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/?p[^>]*>/gi, '\n')
      .replace(/<\/?div[^>]*>/gi, '\n')
      .replace(/<\/?li[^>]*>/gi, '\n• ')
      .replace(/<\/?h[1-6][^>]*>/gi, '\n');
    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode a subset of HTML entities
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&hellip;': '...',
      '&mdash;': '\u2014',
      '&ndash;': '\u2013',
      '&rsquo;': "'",
      '&lsquo;': "'",
      '&rdquo;': '"',
      '&ldquo;': '"',
    };
    text = text.replace(/&[a-zA-Z0-9#]+;/g, (match) => entities[match] || match);
    // Normalize whitespace: collapse spaces and excessive newlines, then trim
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
    text = text.trim();
    return text;
  } catch {
    return String(html ?? '');
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(t);
  }
}

async function tryFetchTafsir(tafsirId: number, surah: number, verse: number): Promise<TafsirResult | null> {
  const verseKey = `${surah}:${verse}`;
  const url = `${QURAN_API}/tafsirs/${tafsirId}/by_ayah/${encodeURIComponent(verseKey)}`;
  try {
    const resp = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 8000);
    if (!resp.ok) return null;
    const data = await resp.json();
    // Response shape example (subject to change): { tafsir: { id, resource_id, resource_name, verse_key, text } }
    const tafsir = data?.tafsir || data?.tafsirs?.[0] || data; // be lenient
    const rawText = tafsir?.text ?? '';
    const cleaned = htmlToText(String(rawText));
    // If the cleaned text is empty or suspiciously short, treat as invalid to allow fallback
    if (!cleaned || cleaned.trim().length < 20) {
      return null;
    }
    const result: TafsirResult = {
      resourceId: Number(tafsir?.resource_id ?? tafsir?.resourceId ?? tafsirId),
      resourceName: String(tafsir?.resource_name ?? tafsir?.resourceName ?? ''),
      verseKey: String(tafsir?.verse_key ?? verseKey),
      text: cleaned,
    };
    // Some responses omit resource name; patch from known list
    if (!result.resourceName) {
      const found = Object.values(TAFSIR_CANDIDATES).flat().find((t) => t.id === result.resourceId);
      if (found) result.resourceName = found.name;
    }
    return result;
  } catch {
    return null;
  }
}

export async function fetchTafsirByAyah(
  surahNumber: number,
  verseNumber: number,
  userLanguage?: string,
  options?: { forceRefresh?: boolean }
): Promise<TafsirResult | null> {
  const cacheKey = `${surahNumber}:${verseNumber}:${getLangPrefix(userLanguage)}`;
  if (!options?.forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  // If the requested language is Tamil, prefer the local DB first
  try {
    if (isTamilLanguage(userLanguage)) {
      const local = await getTamilTafsir(surahNumber, verseNumber);
      if (local) {
        cache.set(cacheKey, local);
        return local;
      }
      // If local lookup failed, fall back to API below
    }
  } catch (e) {
    console.warn('[tafsirApi] local Tamil tafsir lookup failed', e);
  }

  // Try user-language candidates first, then English fallback list if needed.
  const candidates = getCandidates(userLanguage);
  const englishFallback = TAFSIR_CANDIDATES['en'];

  // Merge, ensuring English appear if not already included
  const allCandidates = [
    ...candidates,
    ...englishFallback.filter((e) => !candidates.some((c) => c.id === e.id)),
  ];

  for (const c of allCandidates) {
    const res = await tryFetchTafsir(c.id, surahNumber, verseNumber);
    if (res && res.text) {
      cache.set(cacheKey, res);
      return res;
    }
  }

  return null;
}
