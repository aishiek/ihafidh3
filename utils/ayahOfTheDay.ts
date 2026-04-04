// Shared Ayah of the Day selection utilities

import dailyAyahList from '../data/daily_ayah_list.json';

// Curated list of verses that work well for cards - researched from popular Quran apps
// These verses are meaningful, inspirational, and have concise translations that fit well in cards
export const CARD_FRIENDLY_VERSES: Array<{ surahId: number; verseNumber: number }> = dailyAyahList;

// Deterministic daily verse selection from curated list
export function getTodayCardVerse(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - date.getTimezoneOffset()) * 60000);
  const dayOfYear = Math.floor(diff / 86400000); // 1..366
  const index = (dayOfYear - 1) % CARD_FRIENDLY_VERSES.length;
  return CARD_FRIENDLY_VERSES[index];
}
