export interface LayoutMetadata {
  layout_id: string;
  layout_name: string;
  layout_name_ar: string;
  total_pages: number;
  lines_per_page: number;
  narration: string;
  region: string;
  description: string;
  downloaded: boolean;
  dbFileName: string;
  fileSize: number;  // in MB
  imageSource?: string; // Attribution for GPL compliance
  imageFormat?: 'jpg' | 'png'; // Image file format
}

export interface PageLayout {
  page_number: number;
  line_number: number;
  line_type: 'surah_name' | 'ayah' | 'basmallah' | 'separator';
  is_centered: boolean;
  first_word_id: number | null;
  last_word_id: number | null;
  surah_number: number | null;
}

export const AVAILABLE_LAYOUTS: LayoutMetadata[] = [
  {
    layout_id: 'indopak_15',
    layout_name: 'Indo-Pak 15 Lines',
    layout_name_ar: 'مصحف الهند - 15 سطر',
    total_pages: 610,
    lines_per_page: 15,
    narration: 'Hafs',
    region: 'South Asia',
    description: 'Popular in India, Pakistan, and Bangladesh',
    downloaded: false, // Checked dynamically
    dbFileName: 'qpc-v1-15-lines.db',
    fileSize: 300,
    imageFormat: 'png',
  },
  {
    layout_id: 'madina_15',
    layout_name: 'Madina 15 Lines',
    layout_name_ar: 'مصحف المدينة - 15 سطر',
    total_pages: 604,
    lines_per_page: 15,
    narration: 'Hafs',
    region: 'Saudi Arabia',
    description: 'Official Madina Mushaf - King Fahd Complex',
    downloaded: false,
    dbFileName: 'qpc-hafs-15-lines.db',
    fileSize: 250,
    imageSource: 'QuranHub/quran-pages-images (GPL-3.0)',
    imageFormat: 'jpg',
  },
  {
    layout_id: 'warsh_15',
    layout_name: 'Warsh 15 Lines',
    layout_name_ar: 'مصحف الورش - 15 سطر',
    total_pages: 604,
    lines_per_page: 15,
    narration: 'Warsh',
    region: 'North Africa',
    description: 'Warsh narration - used in North Africa',
    downloaded: false,
    dbFileName: 'qpc-nastaleeq-15-lines.db',
    fileSize: 250,
    imageSource: 'QuranHub/quran-pages-images (GPL-3.0)',
    imageFormat: 'jpg',
  },
  {
    layout_id: 'tajweed',
    layout_name: 'Tajweed Colored',
    layout_name_ar: 'مصحف التجويد الملون',
    total_pages: 604,
    lines_per_page: 15,
    narration: 'Hafs',
    region: 'International',
    description: 'Color-coded Tajweed rules for learning',
    downloaded: false,
    dbFileName: 'qpc-hafs-15-lines.db', // Uses same DB as Madina
    fileSize: 200,
    imageSource: 'QuranHub/quran-pages-images (GPL-3.0)',
    imageFormat: 'jpg',
  },
];
