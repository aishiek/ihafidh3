/**
 * Tajweed Color Scheme
 * Based on standard color-coded Quran Mushafs
 */

export const TAJWEED_COLORS = {
  // Noon Sakinah & Tanween Rules
  ghunnah: '#FFD700',           // Gold/Yellow - Noon/Meem Mushaddad (stressed)
  ikhfa: '#FFB6C1',             // Light Pink - Ikhfa (concealment with ghunnah)
  idgham_with_ghunnah: '#00C853', // Green - Idgham with ghunnah (ينمو)
  idgham_no_ghunnah: '#4DD0E1', // Light Blue/Cyan - Idgham without ghunnah (لر)
  iqlab: '#007AFF',             // Blue - Iqlab (conversion to meem)
  // Note: Izhar (clarity) uses default color - no special highlighting
  
  // Meem Sakinah Rules
  ikhfa_shafawi: '#DDA0DD',     // Plum - Ikhfa Shafawi (مْ before ب)
  idgham_shafawi: '#96CEB4',    // Light Green - Idgham Shafawi (مْ before م)
  
  // Other Rules
  qalqalah: '#FF3B30',          // Red - Qalqalah (echo on قطبجد)
  madd: '#FFA500',              // Orange - Madd (elongation)
  silent_letters: '#AAAAAA',    // Gray - Silent letters
  default: '#FFFFFF'            // White - Default text color
} as const;

export type TajweedRule = keyof typeof TAJWEED_COLORS;
