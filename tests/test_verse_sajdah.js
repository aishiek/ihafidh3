const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Quick static checks: ensure VerseItem renders SajdahIcon inline and wires up QuranThemedModal
const verseItemPath = path.resolve(__dirname, '../components/VerseItem.tsx');
const source = fs.readFileSync(verseItemPath, 'utf8');

assert(source.includes('SajdahIcon'), 'VerseItem should include the SajdahIcon import/usage');
assert(source.includes('QuranThemedModal'), 'VerseItem should include QuranThemedModal usage for displaying sajdah info');

console.log('✅ VerseItem contains SajdahIcon and QuranThemedModal wiring');

// Also sanity-check that the pressable state variable exists so modal can be toggled
assert(source.includes('showSajdahModal'), 'VerseItem should maintain showSajdahModal state');
console.log('✅ showSajdahModal state variable present');

console.log('All verse sajdah checks passed');
