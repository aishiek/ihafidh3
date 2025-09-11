export interface JuzInfo {
  start: string; // format: "SurahName:verse"
  end: string;   // format: "SurahName:verse"
  surahs: string[]; // Surah names involved in the juz (for display/search)
}

// Juz mapping (1-30). Start/end follow the conventional divisions.
export const JUZ_MAPPING: Record<number, JuzInfo> = {
  1: { start: "Al-Fatihah:1", end: "Al-Baqarah:141", surahs: ["Al-Fatihah", "Al-Baqarah"] },
  2: { start: "Al-Baqarah:142", end: "Al-Baqarah:252", surahs: ["Al-Baqarah"] },
  3: { start: "Al-Baqarah:253", end: "Aal-Imran:92", surahs: ["Al-Baqarah", "Aal-Imran"] },
  4: { start: "Aal-Imran:93", end: "An-Nisa:23", surahs: ["Aal-Imran", "An-Nisa"] },
  5: { start: "An-Nisa:24", end: "An-Nisa:147", surahs: ["An-Nisa"] },
  6: { start: "An-Nisa:148", end: "Al-Ma'idah:81", surahs: ["An-Nisa", "Al-Ma'idah"] },
  7: { start: "Al-Ma'idah:82", end: "Al-An'am:110", surahs: ["Al-Ma'idah", "Al-An'am"] },
  8: { start: "Al-An'am:111", end: "Al-A'raf:87", surahs: ["Al-An'am", "Al-A'raf"] },
  9: { start: "Al-A'raf:88", end: "Al-Anfal:40", surahs: ["Al-A'raf", "Al-Anfal"] },
  10: { start: "Al-Anfal:41", end: "At-Tawbah:92", surahs: ["Al-Anfal", "At-Tawbah"] },
  11: { start: "At-Tawbah:93", end: "Hud:5", surahs: ["At-Tawbah", "Yunus", "Hud"] },
  12: { start: "Hud:6", end: "Yusuf:52", surahs: ["Hud", "Yusuf"] },
  13: { start: "Yusuf:53", end: "Ibrahim:52", surahs: ["Yusuf", "Ar-Ra'd", "Ibrahim"] },
  14: { start: "Al-Hijr:1", end: "An-Nahl:128", surahs: ["Al-Hijr", "An-Nahl"] },
  15: { start: "Al-Isra:1", end: "Al-Kahf:74", surahs: ["Al-Isra", "Al-Kahf"] },
  16: { start: "Al-Kahf:75", end: "Ta-Ha:135", surahs: ["Al-Kahf", "Maryam", "Ta-Ha"] },
  17: { start: "Al-Anbiya:1", end: "Al-Hajj:78", surahs: ["Al-Anbiya", "Al-Hajj"] },
  18: { start: "Al-Mu'minun:1", end: "Al-Furqan:20", surahs: ["Al-Mu'minun", "An-Nur", "Al-Furqan"] },
  19: { start: "Al-Furqan:21", end: "An-Naml:55", surahs: ["Al-Furqan", "Ash-Shu'ara", "An-Naml"] },
  20: { start: "An-Naml:56", end: "Al-Ankabut:45", surahs: ["An-Naml", "Al-Qasas", "Al-Ankabut"] },
  21: { start: "Al-Ankabut:46", end: "Al-Ahzab:30", surahs: ["Al-Ankabut", "Ar-Rum", "Luqman", "As-Sajdah", "Al-Ahzab"] },
  22: { start: "Al-Ahzab:31", end: "Ya-Sin:27", surahs: ["Al-Ahzab", "Saba", "Fatir", "Ya-Sin"] },
  23: { start: "Ya-Sin:28", end: "Az-Zumar:31", surahs: ["Ya-Sin", "As-Saffat", "Sad", "Az-Zumar"] },
  24: { start: "Az-Zumar:32", end: "Fussilat:46", surahs: ["Az-Zumar", "Ghafir", "Fussilat"] },
  25: { start: "Fussilat:47", end: "Al-Jathiyah:37", surahs: ["Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah"] },
  26: { start: "Al-Ahqaf:1", end: "Adh-Dhariyat:30", surahs: ["Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf", "Adh-Dhariyat"] },
  27: { start: "Adh-Dhariyat:31", end: "Al-Hadid:29", surahs: ["Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid"] },
  28: { start: "Al-Mujadilah:1", end: "At-Tahrim:12", surahs: ["Al-Mujadilah", "Al-Hashr", "Al-Mumtahanah", "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim"] },
  29: { start: "Al-Mulk:1", end: "Al-Mursalat:50", surahs: ["Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij", "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat"] },
  30: { start: "An-Naba:1", end: "An-Nas:6", surahs: ["An-Naba", "An-Nazi'at", "Abasa", "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad", "Ash-Shams", "Al-Layl", "Ad-Duhaa", "Ash-Sharh", "At-Tin", "Al-Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-Adiyat", "Al-Qari'ah", "At-Takathur", "Al-Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr", "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"] },
};

export default JUZ_MAPPING;


