import { getJuz30Progress } from '@/utils/juzCalculations';

export function calculateCurrentBadge(memorizedVerseIds: number[], completedJuz: number) {
  // Use the new Juz 30 calculation
  const juz30Progress = getJuz30Progress(memorizedVerseIds);
  const isJuz30Complete = juz30Progress.isComplete;

  if (memorizedVerseIds.length >= 6236) {
    return {
      name: 'Hafidh Al-Quran',
      description: 'Guardian of the Holy Quran',
      icon: '🏆',
      level: 5
    };
  } else if (completedJuz >= 30) {
    return {
      name: 'Hafidh Al-Quran',
      description: 'Guardian of the Holy Quran',
      icon: '🏆',
      level: 5
    };
  } else if (completedJuz >= 25) {
    return {
      name: 'Rahiq Al-Yaqeen',
      description: 'Nectar of Certainity',
      icon: '📖✨',
      level: 4.5
    };
  } else if (completedJuz >= 23) {
    return {
      name: 'Naasir al-Quran',
      description: 'Defender of the Quran',
      icon: '⚔️',
      level: 4
    };
  } else if (completedJuz >= 20) {
    return {
      name: 'Sahib al-Azm',
      description: 'Master of Determination',
      icon: '🏔️',
      level: 3.5
    };
  } else if (completedJuz >= 15) {
    return {
      name: 'Saari Fi Sabeelillah',
      description: 'Traveller in Allah\'s Path',
      icon: '🚶‍♂️',
      level: 3
    };
  } else if (completedJuz >= 10) {
    return {
      name: 'Sahib al-Istiqamah',
      description: 'Keeper of Steadfastness',
      icon: '🌙',
      level: 2.5
    };
  } else if (completedJuz >= 5) {
    return {
      name: 'Hamil al-Hikmah',
      description: 'Bearer of Wisdom',
      icon: '📜',
      level: 2
    };
  } else if (completedJuz >= 3) {
    return {
      name: 'Munir al-Darb',
      description: 'Illuminator of the Path',
      icon: '🕌',
      level: 1.5
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
