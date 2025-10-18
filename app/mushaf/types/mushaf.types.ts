export interface MushafInfo {
  name: string;
  number_of_pages: number;
  lines_per_page: number;
  font_name: string;
}

export interface MushafPageRow {
  page_number: number;
  line_number?: number;
  line_type?: string;
  is_centered?: number;
  first_word_id?: number;
  last_word_id?: number;
  surah_number?: number;
  surah_start_verse?: number | null;
  surah_end_verse?: number | null;
}

export interface MushafWordLayout {
  key: string; // e.g. "2:255:1"
  surah: number;
  verse: number;
  word: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  tajweedColor?: string;
}

export interface MushafPageLayout {
  pageNumber: number;
  imageUri: string;
  words: MushafWordLayout[];
  totalWords: number;
  timestamp: number;
}
