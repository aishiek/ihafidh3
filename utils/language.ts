export function isArabicLanguage(lang: string | undefined | null) {
  if (!lang) return false;
  const base = lang.split('.')[0].toLowerCase();
  return base === 'ar' || base === 'arabic' || base === 'ar.sa' || base.startsWith('ar');
}

export function isTamilLanguage(lang: string | undefined | null) {
  if (!lang) return false;
  const base = lang.split('.')[0].toLowerCase();
  return base === 'ta' || base === 'tamil' || base.startsWith('ta');
}
