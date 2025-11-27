import { getJuz30Progress } from '@/utils/juzCalculations';

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  isUnlocked: boolean;
  progress: number;
  level: number;
  details?: string;
};

export function getBadgeStates(memorizedVerseIds: number[], completedJuz: number): Badge[] {
  const totalVerses = memorizedVerseIds.length;
  const juz30Progress = getJuz30Progress(memorizedVerseIds);
  const isJuz30Complete = juz30Progress.isComplete;

  const badges: Badge[] = [
    {
      id: 'seeker',
      name: 'Seeker',
      description: 'Beginning the Journey',
      icon: '🌱',
      requirement: 'Start memorizing verses',
      isUnlocked: totalVerses > 0,
      progress: totalVerses > 0 ? 100 : 0,
      level: 0
    },
    {
      id: 'awwal-noor',
      name: 'Awwal Noor',
      description: 'First Light',
      icon: '✨',
      requirement: 'Complete the 30th Juz (Juz Amma)',
      isUnlocked: isJuz30Complete,
      progress: juz30Progress.percentage,
      level: 1,
      details: `${juz30Progress.memorized}/${juz30Progress.total} verses memorized in Juz Amma`
    },
    {
      id: 'munir-al-darb',
      name: 'Munir Al-Darb',
      description: 'Illuminator of the Path',
      icon: '🕌',
      requirement: 'Complete any 3 Juz of the Quran',
      isUnlocked: completedJuz >= 3,
      progress: Math.min((completedJuz / 3) * 100, 100),
      level: 1.5,
      details: `${completedJuz}/3 Juz completed`
    },
    {
      id: 'hamil-al-hikmah',
      name: 'Hamil Al-Hikmah',
      description: 'Bearer of Wisdom',
      icon: '📜',
      requirement: 'Complete any 5 Juz of the Quran',
      isUnlocked: completedJuz >= 5,
      progress: Math.min((completedJuz / 5) * 100, 100),
      level: 2,
      details: `${completedJuz}/5 Juz completed`
    },
    {
      id: 'sahib-al-istiqaamah',
      name: 'Sahib Al-Istiqamah',
      description: 'Keeper of Steadfastness',
      icon: '🌙',
      requirement: 'Complete any 10 Juz of the Quran',
      isUnlocked: completedJuz >= 10,
      progress: Math.min((completedJuz / 10) * 100, 100),
      level: 2.5,
      details: `${completedJuz}/10 Juz completed`
    },
    {
      id: 'saari-fi-sabeelillah',
      name: 'Saari Fi Sabeelillah',
      description: 'Traveller in Allah\'s Path',
      icon: '🚶‍♂️',
      requirement: 'Complete any 15 Juz of the Quran',
      isUnlocked: completedJuz >= 15,
      progress: Math.min((completedJuz / 15) * 100, 100),
      level: 3,
      details: `${completedJuz}/15 Juz completed`
    },
    {
      id: 'sahib-al-azm',
      name: 'Sahib Al-Azm',
      description: 'Master of Determination',
      icon: '🏔️',
      requirement: 'Complete any 20 Juz of the Quran',
      isUnlocked: completedJuz >= 20,
      progress: Math.min((completedJuz / 20) * 100, 100),
      level: 3.5,
      details: `${completedJuz}/20 Juz completed`
    },
    {
      id: 'naasir-al-quran',
      name: 'Naasir Al-Quran',
      description: 'Defender of the Quran',
      icon: '⚔️',
      requirement: 'Complete any 23 Juz of the Quran',
      isUnlocked: completedJuz >= 23,
      progress: Math.min((completedJuz / 23) * 100, 100),
      level: 4,
      details: `${completedJuz}/23 Juz completed`
    },
    {
      id: 'rahiq-al-yaqeen',
      name: 'Rahiq Al-Yaqeen',
      description: 'Nectar of Certainity',
      icon: '📖✨',
      requirement: 'Complete any 25 Juz of the Quran',
      isUnlocked: completedJuz >= 25,
      progress: Math.min((completedJuz / 25) * 100, 100),
      level: 4.5,
      details: `${completedJuz}/25 Juz completed`
    },
    {
      id: 'hafidh-al-quran',
      name: 'Hafidh Al-Quran',
      description: 'Guardian of the Holy Quran',
      icon: '🏆',
      requirement: 'Complete all 6,236 verses of the Holy Quran',
      isUnlocked: totalVerses >= 6236,
      progress: Math.min((totalVerses / 6236) * 100, 100),
      level: 5,
      details: `${totalVerses}/6,236 verses memorized`
    }
  ];

  return badges;
}

export function calculateCurrentBadge(memorizedVerseIds: number[], completedJuz: number) {
  const badges = getBadgeStates(memorizedVerseIds, completedJuz);

  // Choose the unlocked badge with the highest level as the current badge
  const unlocked = badges.filter(b => b.isUnlocked);
  if (unlocked.length === 0) return badges[0]; // Seeker fallback

  unlocked.sort((a, b) => b.level - a.level);
  return unlocked[0];
}
