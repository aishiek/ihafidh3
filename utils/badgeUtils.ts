import { surahsData } from '@/data/surahs';

export function calculateCurrentBadge(memorizedVerses: number[], completedJuz: number) {
  // Check for specific 30th Juz completion (Surah 78-114)
  const juz30SurahIds = Array.from({ length: 37 }, (_, i) => 78 + i); // Surah 78 to 114
  let juz30VerseCount = 0;
  let juz30TotalVerses = 0;

  juz30SurahIds.forEach(surahId => {
    const surah = surahsData.find(s => s.id === surahId);
    if (surah) {
      juz30TotalVerses += surah.versesCount;
      let startVerseId = 0;
      for (let i = 1; i < surahId; i++) {
        const prevSurah = surahsData.find(s => s.id === i);
        if (prevSurah) startVerseId += prevSurah.versesCount;
      }
      const startVerse = startVerseId + 1;
      const endVerse = startVerseId + surah.versesCount;
      const memorizedInSurah = memorizedVerses.filter(id => id >= startVerse && id <= endVerse).length;
      juz30VerseCount += memorizedInSurah;
    }
  });

  const isJuz30Complete = juz30VerseCount === juz30TotalVerses;

  if (memorizedVerses.length >= 6236) {
    return {
      name: 'Hafidh Al-Quran',
      description: 'Guardian of the Holy Quran',
      icon: '🏆',
      level: 5
    };
  } else if (completedJuz >= 23) {
    return {
      name: 'Naasir al-Quran',
      description: 'Defender of the Quran',
      icon: '⚔️',
      level: 4
    };
  } else if (completedJuz >= 15) {
    return {
      name: 'Saari Fi Sabeelillah',
      description: 'Traveller in Allah\'s Path',
      icon: '🚶‍♂️',
      level: 3
    };
  } else if (completedJuz >= 5) {
    return {
      name: 'Hamil al-Hikmah',
      description: 'Bearer of Wisdom',
      icon: '📜',
      level: 2
    };
  } else if (isJuz30Complete) {
    return {
      name: 'Awwal Noor',
      description: 'First Light',
      icon: '✨',
      level: 1
    };
  } else {
    return {
      name: 'Seeker',
      description: 'Beginning the Journey',
      icon: '🌱',
      level: 0
    };
  }
}
