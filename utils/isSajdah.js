const sajdahList = require('../assets/sajdah-list.json');

// Use a Set for O(1) lookup instead of array search
const SAJDAH_VERSES = new Set(
  sajdahList.map(entry => `${entry.surah}:${entry.ayah}`)
);

function isSajdah(surah, ayah) {
  if (!surah || !ayah) return false;
  return SAJDAH_VERSES.has(`${surah}:${ayah}`);
}

function getAllSajdahRefs() {
  return sajdahList.map(e => e.ref);
}

module.exports = { isSajdah, getAllSajdahRefs };
