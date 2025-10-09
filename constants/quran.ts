// Global Quran-related constants
// Total number of verses (ayas) in the Qur'an
export const TOTAL_VERSES = 6236 as const;

// Helper: clamp a verse count into the valid domain
export const clampVerseCount = (n: number) => {
  if (n < 0) return 0;
  if (n > TOTAL_VERSES) return TOTAL_VERSES;
  return n;
};

// Percentage utility based on TOTAL_VERSES
export const verseCountToPercent = (count: number) => {
  const safe = clampVerseCount(count);
  return (safe / TOTAL_VERSES) * 100;
};
