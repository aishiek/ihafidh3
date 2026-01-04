import { calculateCurrentBadge, getBadgeStates } from '@/utils/badgeUtils';

describe('Badge calculations', () => {
  test('Awwal Noor unlocks when Juz 30 complete', () => {
    // Create a mock memorized list that fully covers Juz 30 using juzCalculations
    const { getJuzVerseRange } = require('@/utils/juzCalculator');
    const range = getJuzVerseRange(30);
    expect(range.total).toBeGreaterThan(0);

    const verses: number[] = [];
    for (let id = range.startVerseId; id <= range.endVerseId; id++) verses.push(id);

    const badges = getBadgeStates(verses, 0);
    const awwal = badges.find(b => b.id === 'awwal-noor');
    expect(awwal).toBeDefined();
    expect(awwal!.isUnlocked).toBe(true);

    const current = calculateCurrentBadge(verses, 0);
    // Current badge should be at least the Awwal Noor level (1)
    expect(current.level).toBeGreaterThanOrEqual(1);
  });

  test('Completing 3 Juz unlocks 3-juz badge', () => {
    const { getJuzVerseRange } = require('@/utils/juzCalculator');
    let verses: number[] = [];
    for (let j = 1; j <= 3; j++) {
      const r = getJuzVerseRange(j);
      for (let id = r.startVerseId; id <= r.endVerseId; id++) verses.push(id);
    }

    const badges = getBadgeStates(verses, 3);
    const munir = badges.find(b => b.id === 'munir-al-darb');
    expect(munir).toBeDefined();
    expect(munir!.isUnlocked).toBe(true);
  });
});
