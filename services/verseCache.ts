type CacheKey = string; // `${surah}:${verse}:${lang}`
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<CacheKey, CacheEntry<any>>();

export function cacheSet<T>(surah: number, verse: number, lang: string, value: T) {
  const key = `${surah}:${verse}:${lang}`;
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
}

export function cacheGet<T>(surah: number, verse: number, lang: string): T | null {
  const key = `${surah}:${verse}:${lang}`;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.value as T;
}

export function cacheInvalidateAll() { cache.clear(); }
