export interface TranslationLanguage {
  identifier: string;
  name: string;
  englishName: string;
  language: string;
  direction: 'ltr' | 'rtl';
}

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  // English (Default)
  {
    identifier: 'en.sahih',
    name: 'English',
    englishName: 'Saheeh International',
    language: 'en',
    direction: 'ltr'
  },

  // Tamil
  {
    identifier: 'ta.tamil',
    name: 'தமிழ்',
    englishName: 'Jan Turst Foundation',
    language: 'ta',
    direction: 'ltr'
  },

  // Urdu (single canonical)
  {
    identifier: 'ur.jalandhry',
    name: 'اردو',
    englishName: 'Fateh Muhammad Jalandhry',
    language: 'ur',
    direction: 'rtl'
  },

  // Bengali
  {
    identifier: 'bn.bengali',
    name: 'বাংলা',
    englishName: 'Muhiuddin Khan',
    language: 'bn',
    direction: 'ltr'
  },

  // Chinese
  {
    identifier: 'zh.jian',
    name: '中文',
    englishName: 'Ma Jian',
    language: 'zh',
    direction: 'ltr'
  },

  // Malayalam
  {
    identifier: 'ml.abdulhameed',
    name: 'മലയാളം',
    englishName: 'Cheriyamundam Abdul Hameed and Kunhi Mohammed Parappoor',
    language: 'ml',
    direction: 'ltr'
  },

  // German
  {
    identifier: 'de.aburida',
    name: 'Deutsch',
    englishName: 'Abu Rida Muhammad ibn Ahmad ibn Rassoul',
    language: 'de',
    direction: 'ltr'
  },

  // Spanish
  {
    identifier: 'es.cortes',
    name: 'Español',
    englishName: 'Julio Cortes',
    language: 'es',
    direction: 'ltr'
  },

  // French
  {
    identifier: 'fr.hamidullah',
    name: 'Français',
    englishName: 'Muhammad Hamidullah',
    language: 'fr',
    direction: 'ltr'
  },

  // Hindi
  {
    identifier: 'hi.hindi',
    name: 'हिन्दी',
    englishName: 'Suhel Farooq Khan and Saifur Rahman Nadwi',
    language: 'hi',
    direction: 'ltr'
  },

  // Indonesian
  {
    identifier: 'id.indonesian',
    name: 'Bahasa Indonesia',
    englishName: 'Unknown',
    language: 'id',
    direction: 'ltr'
  },

  // Russian
  {
    identifier: 'ru.kuliev',
    name: 'Русский',
    englishName: 'Elmir Kuliev',
    language: 'ru',
    direction: 'ltr'
  },

  // Turkish
  {
    identifier: 'tr.ates',
    name: 'Türkçe',
    englishName: 'Suleyman Ates',
    language: 'tr',
    direction: 'ltr'
  },

  // Malay
  {
    identifier: 'ms.basmeih',
    name: 'Bahasa Melayu',
    englishName: 'Abdullah Muhammad Basmeih',
    language: 'ms',
    direction: 'ltr'
  }
];

export const getTranslationLanguageByIdentifier = (identifier: string): TranslationLanguage | undefined => {
  return TRANSLATION_LANGUAGES.find(lang => lang.identifier === identifier);
};

export const getTranslationLanguagesByLanguage = (language: string): TranslationLanguage[] => {
  return TRANSLATION_LANGUAGES.filter(lang => lang.language === language);
};

export const getDefaultTranslationLanguage = (): TranslationLanguage => {
  return TRANSLATION_LANGUAGES.find(lang => lang.identifier === 'en.sahih') || TRANSLATION_LANGUAGES[0];
}; 