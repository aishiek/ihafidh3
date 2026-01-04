const assert = require('assert');
const { isSajdah, getAllSajdahRefs } = require('../utils/isSajdah');
const sajdahList = require('../assets/sajdah-list.json');

console.log('Running sajdah tests...');

// Test 1: exactly 15 entries
assert.strictEqual(sajdahList.length, 15, `Expected 15 sajdah entries but found ${sajdahList.length}`);
console.log('✅ Sajdah list contains 15 entries');

// Test 2: assert each canonical entry is detected by isSajdah
sajdahList.forEach(entry => {
  assert.strictEqual(isSajdah(entry.surah, entry.ayah), true, `Expected ${entry.ref} to be recognized as sajdah`);
});
console.log('✅ isSajdah recognizes every sajdah entry');

// Test 3: spot-check a non-sajdah verse
assert.strictEqual(isSajdah(1, 1), false, 'Expected 1:1 not to be a sajdah');
console.log('✅ Non-sajdah sample passes');

// Test 4: getAllSajdahRefs returns an array of 15 strings and contains a known ref
const refs = getAllSajdahRefs();
assert(Array.isArray(refs) && refs.length === 15, 'getAllSajdahRefs should return 15 refs');
assert(refs.includes('7:206'), 'Refs should include 7:206');
console.log('✅ getAllSajdahRefs returns the canonical refs');

console.log('All sajdah tests passed');

// Additional quick checks: ensure we added the SajdahIcon asset and modal supports 'sajdah' icon
const fs = require('fs');
const modalPath = require('path').resolve(__dirname, '../components/QuranThemedModal/index.tsx');
const modalSource = fs.readFileSync(modalPath, 'utf8');
assert(modalSource.includes('SajdahIcon'), 'QuranThemedModal should import/use SajdahIcon');
assert(modalSource.includes("case 'sajdah'"), "QuranThemedModal should handle the 'sajdah' icon case in IconFromKey");
console.log('✅ QuranThemedModal includes SajdahIcon and a `sajdah` handling case');

const sajdahAssetPath = require('path').resolve(__dirname, '../assets/svg/islamic-patterns/SajdahIcon.tsx');
assert(fs.existsSync(sajdahAssetPath), 'SajdahIcon asset should exist');
console.log('✅ SajdahIcon asset file exists');
