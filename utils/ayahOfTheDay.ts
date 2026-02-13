// Shared Ayah of the Day selection utilities

// Curated list of verses that work well for cards - researched from popular Quran apps
// These verses are meaningful, inspirational, and have concise translations that fit well in cards
export const CARD_FRIENDLY_VERSES: Array<{ surahId: number; verseNumber: number }> = [
  // Al-Baqarah
  { surahId: 2, verseNumber: 45 },
  { surahId: 2, verseNumber: 112 },
  { surahId: 2, verseNumber: 115 },
  { surahId: 2, verseNumber: 152 },
  { surahId: 2, verseNumber: 153 },
  { surahId: 2, verseNumber: 155 },
  { surahId: 2, verseNumber: 156 },
  { surahId: 2, verseNumber: 165 },
  { surahId: 2, verseNumber: 177 },
  { surahId: 2, verseNumber: 186 },
  { surahId: 2, verseNumber: 195 },
  { surahId: 2, verseNumber: 201 },
  { surahId: 2, verseNumber: 208 },
  { surahId: 2, verseNumber: 214 },
  { surahId: 2, verseNumber: 216 },
  { surahId: 2, verseNumber: 222 },
  { surahId: 2, verseNumber: 249 },
  { surahId: 2, verseNumber: 255 },
  { surahId: 2, verseNumber: 257 },
  { surahId: 2, verseNumber: 261 },
  { surahId: 2, verseNumber: 277 },
  { surahId: 2, verseNumber: 285 },
  { surahId: 2, verseNumber: 286 },

  // Aal-Imran
  { surahId: 3, verseNumber: 8 },
  { surahId: 3, verseNumber: 26 },
  { surahId: 3, verseNumber: 27 },
  { surahId: 3, verseNumber: 31 },
  { surahId: 3, verseNumber: 92 },
  { surahId: 3, verseNumber: 103 },
  { surahId: 3, verseNumber: 133 },
  { surahId: 3, verseNumber: 134 },
  { surahId: 3, verseNumber: 139 },
  { surahId: 3, verseNumber: 145 },
  { surahId: 3, verseNumber: 147 },
  { surahId: 3, verseNumber: 154 },
  { surahId: 3, verseNumber: 159 },
  { surahId: 3, verseNumber: 160 },
  { surahId: 3, verseNumber: 173 },
  { surahId: 3, verseNumber: 185 },
  { surahId: 3, verseNumber: 191 },
  { surahId: 3, verseNumber: 200 },

  // An-Nisa
  { surahId: 4, verseNumber: 17 },
  { surahId: 4, verseNumber: 36 },
  { surahId: 4, verseNumber: 58 },
  { surahId: 4, verseNumber: 79 },
  { surahId: 4, verseNumber: 86 },
  { surahId: 4, verseNumber: 110 },
  { surahId: 4, verseNumber: 123 },
  { surahId: 4, verseNumber: 135 },
  { surahId: 4, verseNumber: 147 },
  { surahId: 4, verseNumber: 149 },

  // Al-Ma'idah
  { surahId: 5, verseNumber: 3 },
  { surahId: 5, verseNumber: 8 },
  { surahId: 5, verseNumber: 16 },
  { surahId: 5, verseNumber: 27 },
  { surahId: 5, verseNumber: 32 },
  { surahId: 5, verseNumber: 90 },
  { surahId: 5, verseNumber: 100 },

  // Al-An'am
  { surahId: 6, verseNumber: 12 },
  { surahId: 6, verseNumber: 54 },
  { surahId: 6, verseNumber: 59 },
  { surahId: 6, verseNumber: 99 },
  { surahId: 6, verseNumber: 103 },
  { surahId: 6, verseNumber: 141 },
  { surahId: 6, verseNumber: 151 },
  { surahId: 6, verseNumber: 160 },
  { surahId: 6, verseNumber: 162 },

  // Al-A'raf
  { surahId: 7, verseNumber: 23 },
  { surahId: 7, verseNumber: 31 },
  { surahId: 7, verseNumber: 56 },
  { surahId: 7, verseNumber: 96 },
  { surahId: 7, verseNumber: 156 },
  { surahId: 7, verseNumber: 180 },
  { surahId: 7, verseNumber: 204 },

  // Al-Anfal
  { surahId: 8, verseNumber: 2 },
  { surahId: 8, verseNumber: 29 },
  { surahId: 8, verseNumber: 45 },
  { surahId: 8, verseNumber: 46 },

  // At-Tawbah
  { surahId: 9, verseNumber: 40 },
  { surahId: 9, verseNumber: 51 },
  { surahId: 9, verseNumber: 129 },

  // Yunus
  { surahId: 10, verseNumber: 44 },
  { surahId: 10, verseNumber: 57 },
  { surahId: 10, verseNumber: 58 },
  { surahId: 10, verseNumber: 62 },
  { surahId: 10, verseNumber: 109 },

  // Hud
  { surahId: 11, verseNumber: 6 },
  { surahId: 11, verseNumber: 56 },
  { surahId: 11, verseNumber: 90 },
  { surahId: 11, verseNumber: 112 },
  { surahId: 11, verseNumber: 114 },

  // Yusuf
  { surahId: 12, verseNumber: 21 },
  { surahId: 12, verseNumber: 53 },
  { surahId: 12, verseNumber: 64 },
  { surahId: 12, verseNumber: 83 },
  { surahId: 12, verseNumber: 87 },

  // Ar-Ra'd
  { surahId: 13, verseNumber: 9 },
  { surahId: 13, verseNumber: 11 },
  { surahId: 13, verseNumber: 22 },
  { surahId: 13, verseNumber: 28 },

  // Ibrahim
  { surahId: 14, verseNumber: 7 },
  { surahId: 14, verseNumber: 27 },
  { surahId: 14, verseNumber: 34 },
  { surahId: 14, verseNumber: 42 },
  { surahId: 14, verseNumber: 52 },

  // Al-Hijr
  { surahId: 15, verseNumber: 49 },
  { surahId: 15, verseNumber: 56 },
  { surahId: 15, verseNumber: 85 },

  // An-Nahl
  { surahId: 16, verseNumber: 18 },
  { surahId: 16, verseNumber: 90 },
  { surahId: 16, verseNumber: 97 },
  { surahId: 16, verseNumber: 125 },
  { surahId: 16, verseNumber: 126 },
  { surahId: 16, verseNumber: 128 },

  // Al-Isra
  { surahId: 17, verseNumber: 9 },
  { surahId: 17, verseNumber: 23 },
  { surahId: 17, verseNumber: 24 },
  { surahId: 17, verseNumber: 36 },
  { surahId: 17, verseNumber: 37 },
  { surahId: 17, verseNumber: 53 },
  { surahId: 17, verseNumber: 80 },
  { surahId: 17, verseNumber: 81 },
  { surahId: 17, verseNumber: 82 },

  // Al-Kahf
  { surahId: 18, verseNumber: 7 },
  { surahId: 18, verseNumber: 10 },
  { surahId: 18, verseNumber: 28 },
  { surahId: 18, verseNumber: 46 },
  { surahId: 18, verseNumber: 49 },
  { surahId: 18, verseNumber: 110 },

  // Maryam
  { surahId: 19, verseNumber: 64 },
  { surahId: 19, verseNumber: 96 },

  // Ta-Ha
  { surahId: 20, verseNumber: 25 },
  { surahId: 20, verseNumber: 44 },
  { surahId: 20, verseNumber: 82 },
  { surahId: 20, verseNumber: 114 },
  { surahId: 20, verseNumber: 132 },

  // Al-Anbiya
  { surahId: 21, verseNumber: 30 },
  { surahId: 21, verseNumber: 35 },
  { surahId: 21, verseNumber: 87 },
  { surahId: 21, verseNumber: 92 },

  // Al-Hajj
  { surahId: 22, verseNumber: 77 },
  { surahId: 22, verseNumber: 78 },

  // Al-Mu’minun
  { surahId: 23, verseNumber: 1 },
  { surahId: 23, verseNumber: 2 },
  { surahId: 23, verseNumber: 99 },
  { surahId: 23, verseNumber: 118 },

  // An-Nur
  { surahId: 24, verseNumber: 2 },
  { surahId: 24, verseNumber: 21 },
  { surahId: 24, verseNumber: 22 },
  { surahId: 24, verseNumber: 26 },
  { surahId: 24, verseNumber: 30 },
  { surahId: 24, verseNumber: 31 },
  { surahId: 24, verseNumber: 35 },

  // Al-Furqan
  { surahId: 25, verseNumber: 58 },
  { surahId: 25, verseNumber: 63 },
  { surahId: 25, verseNumber: 65 },
  { surahId: 25, verseNumber: 67 },
  { surahId: 25, verseNumber: 70 },
  { surahId: 25, verseNumber: 74 },

  // Ash-Shu'ara
  { surahId: 26, verseNumber: 80 },

  // An-Naml
  { surahId: 27, verseNumber: 62 },
  { surahId: 27, verseNumber: 92 },

  // Al-Qasas
  { surahId: 28, verseNumber: 56 },
  { surahId: 28, verseNumber: 60 },
  { surahId: 28, verseNumber: 77 },

  // Al-Ankabut
  { surahId: 29, verseNumber: 2 },
  { surahId: 29, verseNumber: 5 },
  { surahId: 29, verseNumber: 45 },
  { surahId: 29, verseNumber: 64 },
  { surahId: 29, verseNumber: 69 },

  // Ar-Rum
  { surahId: 30, verseNumber: 41 },
  { surahId: 30, verseNumber: 54 },
  { surahId: 30, verseNumber: 60 },

  // Luqman
  { surahId: 31, verseNumber: 13 },
  { surahId: 31, verseNumber: 17 },
  { surahId: 31, verseNumber: 18 },
  { surahId: 31, verseNumber: 19 },
  { surahId: 31, verseNumber: 22 },

  // As-Sajdah
  { surahId: 32, verseNumber: 16 },

  // Al-Ahzab
  { surahId: 33, verseNumber: 3 },
  { surahId: 33, verseNumber: 21 },
  { surahId: 33, verseNumber: 35 },
  { surahId: 33, verseNumber: 41 },
  { surahId: 33, verseNumber: 43 },
  { surahId: 33, verseNumber: 70 },

  // Fatir
  { surahId: 35, verseNumber: 3 },
  { surahId: 35, verseNumber: 10 },
  { surahId: 35, verseNumber: 15 },
  { surahId: 35, verseNumber: 28 },
  { surahId: 35, verseNumber: 29 },

  // Ya-Sin
  { surahId: 36, verseNumber: 40 },
  { surahId: 36, verseNumber: 58 },
  { surahId: 36, verseNumber: 82 },
  { surahId: 36, verseNumber: 83 },

  // Sad
  { surahId: 38, verseNumber: 24 },
  { surahId: 38, verseNumber: 29 },

  // Az-Zumar
  { surahId: 39, verseNumber: 9 },
  { surahId: 39, verseNumber: 10 },
  { surahId: 39, verseNumber: 18 },
  { surahId: 39, verseNumber: 41 },
  { surahId: 39, verseNumber: 42 },
  { surahId: 39, verseNumber: 53 },
  { surahId: 39, verseNumber: 54 },

  // Ghafir
  { surahId: 40, verseNumber: 7 },
  { surahId: 40, verseNumber: 44 },
  { surahId: 40, verseNumber: 60 },
  { surahId: 40, verseNumber: 65 },

  // Fussilat
  { surahId: 41, verseNumber: 30 },
  { surahId: 41, verseNumber: 33 },
  { surahId: 41, verseNumber: 34 },
  { surahId: 41, verseNumber: 44 },
  { surahId: 41, verseNumber: 53 },

  // Ash-Shura
  { surahId: 42, verseNumber: 11 },
  { surahId: 42, verseNumber: 15 },
  { surahId: 42, verseNumber: 25 },
  { surahId: 42, verseNumber: 40 },
  { surahId: 42, verseNumber: 43 },
  { surahId: 42, verseNumber: 49 },

  // Az-Zukhruf
  { surahId: 43, verseNumber: 36 },

  // Ad-Dukhan
  { surahId: 44, verseNumber: 38 },

  // Al-Jathiyah
  { surahId: 45, verseNumber: 14 },
  { surahId: 45, verseNumber: 22 },

  // Al-Ahqaf
  { surahId: 46, verseNumber: 15 },

  // Muhammad
  { surahId: 47, verseNumber: 7 },

  // Al-Fath
  { surahId: 48, verseNumber: 4 },
  { surahId: 48, verseNumber: 29 },

  // Al-Hujurat
  { surahId: 49, verseNumber: 6 },
  { surahId: 49, verseNumber: 10 },
  { surahId: 49, verseNumber: 11 },
  { surahId: 49, verseNumber: 12 },
  { surahId: 49, verseNumber: 13 },
  { surahId: 49, verseNumber: 15 },

  // Qaf
  { surahId: 50, verseNumber: 16 },
  { surahId: 50, verseNumber: 18 },
  { surahId: 50, verseNumber: 45 },

  // Adh-Dhariyat
  { surahId: 51, verseNumber: 18 },
  { surahId: 51, verseNumber: 50 },
  { surahId: 51, verseNumber: 56 },

  // At-Tur
  { surahId: 52, verseNumber: 21 },
  { surahId: 52, verseNumber: 48 },

  // Ar-Rahman
  { surahId: 55, verseNumber: 13 },
  { surahId: 55, verseNumber: 26 },
  { surahId: 55, verseNumber: 27 },
  { surahId: 55, verseNumber: 60 },
  { surahId: 55, verseNumber: 78 },

  // Al-Waqi'ah
  { surahId: 56, verseNumber: 60 },

  // Al-Hadid
  { surahId: 57, verseNumber: 3 },
  { surahId: 57, verseNumber: 4 },
  { surahId: 57, verseNumber: 12 },
  { surahId: 57, verseNumber: 18 },
  { surahId: 57, verseNumber: 20 },
  { surahId: 57, verseNumber: 21 },
  { surahId: 57, verseNumber: 22 },
  { surahId: 57, verseNumber: 28 },

  // Al-Mujadilah
  { surahId: 58, verseNumber: 7 },
  { surahId: 58, verseNumber: 11 },

  // Al-Hashr
  { surahId: 59, verseNumber: 10 },
  { surahId: 59, verseNumber: 18 },
  { surahId: 59, verseNumber: 21 },
  { surahId: 59, verseNumber: 22 },
  { surahId: 59, verseNumber: 23 },
  { surahId: 59, verseNumber: 24 },

  // As-Saff
  { surahId: 61, verseNumber: 13 },

  // At-Taghabun
  { surahId: 64, verseNumber: 11 },
  { surahId: 64, verseNumber: 17 },

  // At-Talaq
  { surahId: 65, verseNumber: 3 },

  // At-Tahrim
  { surahId: 66, verseNumber: 8 },

  // Al-Mulk
  { surahId: 67, verseNumber: 2 },
  { surahId: 67, verseNumber: 3 },
  { surahId: 67, verseNumber: 13 },
  { surahId: 67, verseNumber: 14 },
  { surahId: 67, verseNumber: 15 },

  // Al-Qalam
  { surahId: 68, verseNumber: 4 },
  { surahId: 68, verseNumber: 52 },

  // Al-Muzzammil
  { surahId: 73, verseNumber: 20 },

  // Al-Muddaththir
  { surahId: 74, verseNumber: 7 },

  // Al-Insan
  { surahId: 76, verseNumber: 7 },
  { surahId: 76, verseNumber: 8 },
  { surahId: 76, verseNumber: 25 },

  // Abasa
  { surahId: 80, verseNumber: 11 },

  // Al-Buruj
  { surahId: 85, verseNumber: 14 },

  // Al-A'la
  { surahId: 87, verseNumber: 14 },

  // Al-Fajr ending
  { surahId: 89, verseNumber: 27 },
  { surahId: 89, verseNumber: 28 },
  { surahId: 89, verseNumber: 29 },
  { surahId: 89, verseNumber: 30 },

  // Al-Balad
  { surahId: 90, verseNumber: 17 },

  // Ash-Shams
  { surahId: 91, verseNumber: 9 },

  // Al-Layl
  { surahId: 92, verseNumber: 18 },

  // Ad-Duha
  { surahId: 93, verseNumber: 3 },
  { surahId: 93, verseNumber: 5 },
  { surahId: 93, verseNumber: 11 },

  // Ash-Sharh
  { surahId: 94, verseNumber: 1 },
  { surahId: 94, verseNumber: 5 },
  { surahId: 94, verseNumber: 6 },
  { surahId: 94, verseNumber: 7 },
  { surahId: 94, verseNumber: 8 },

  // At-Tin
  { surahId: 95, verseNumber: 4 },

  // Al-Ma'un
  { surahId: 107, verseNumber: 5 },
];

// Deterministic daily verse selection from curated list
export function getTodayCardVerse(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - date.getTimezoneOffset()) * 60000);
  const dayOfYear = Math.floor(diff / 86400000); // 1..366
  const index = (dayOfYear - 1) % CARD_FRIENDLY_VERSES.length;
  return CARD_FRIENDLY_VERSES[index];
}
