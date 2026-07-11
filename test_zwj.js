const NON_LEFT_JOINING = new Set([
  'ا', 'أ', 'إ', 'آ', 'ٱ', 
  'د', 'ذ', 
  'ر', 'ز', 
  'و', 'ؤ', 
  'ء', 
  'ة', 
  'ى'
]);

// Include all arabic combining marks (harakat, etc) to skip them when looking for the last base letter
const COMBINING_MARKS = /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06ED\u08D3-\u08FF]/g;

function connectsToLeft(text) {
  // Strip combining marks
  const bases = text.replace(COMBINING_MARKS, '');
  if (bases.length === 0) return false;
  
  const lastChar = bases[bases.length - 1];
  
  // If it's a space or non-arabic, it doesn't connect
  if (lastChar === ' ' || lastChar === '\u00A0' || lastChar === '\u200B') return false;
  
  // If it's in the non-left-joining set, it doesn't connect
  if (NON_LEFT_JOINING.has(lastChar)) return false;
  
  // Otherwise, assume it's a normal Arabic letter that connects to the left (e.g. ب, ت, ث, ن, م, etc.)
  // (Assuming the text is purely Arabic Quranic text)
  return true;
}

console.log("إِ connects to left?", connectsToLeft("إِ")); // false
console.log("نّ connects to left?", connectsToLeft("نّ")); // true
console.log("ءَامَن connects to left?", connectsToLeft("ءَامَن")); // true (ن connects)
console.log("ُوٓ connects to left?", connectsToLeft("ُوٓ")); // false (و doesn't connect)

