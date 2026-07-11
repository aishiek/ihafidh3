import { parseTajweedHTML } from './utils/QuranTajweedParser';
import { sanitizeRunsForSkia, startsWithCombiningMark } from './components/TajweedText';

const text = "يَ<tajweed class=madda_obligatory>ـٰٓ</tajweed>أَيُّهَا";

function normalizeForMushaf(t: string): string {
  let normalized = t.replace(/\u0640(?=[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06ED\u08D3-\u08FF])/g, '');
  normalized = normalized.replace(/\u25CC/g, '');
  return normalized;
}

const mushafText = normalizeForMushaf(text);
console.log("mushafText:", mushafText);
const segments = parseTajweedHTML(mushafText, { enableAlgorithmic: true, enableStopRules: false });
console.log("segments:", segments);

