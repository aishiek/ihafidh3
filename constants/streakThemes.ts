export interface StreakMilestoneTheme {
  milestoneIndex: number;
  tierName: string;
  primaryColor: string;
  secondaryColor: string;
  flameColors: [string, string, string, string]; // [darkBase, mid, bright, tip]
  textGradient: [string, string, string];        // [lightTop, mid, baseBottom]
  accentGradient: [string, string];              // [startColor, endColor]
  glowColor: string;
  rgba: string;                                  // 'r, g, b' for flexible opacity styling
  badgeEmoji: string;
  badgeTitle: string;
}

export const STREAK_MILESTONE_TIERS: {
  threshold: number;
  tierName: string;
  primaryColor: string;
  secondaryColor: string;
  flameColors: [string, string, string, string];
  textGradient: [string, string, string];
  accentGradient: [string, string];
  glowColor: string;
  rgba: string;
  badgeEmoji: string;
  badgeTitle: string;
}[] = [
  {
    threshold: 0, // 0 - 49
    tierName: 'Radiant Ember',
    primaryColor: '#FF6B35',
    secondaryColor: '#FFA040',
    flameColors: ['#B02600', '#FF4500', '#FF8C00', '#FFE066'],
    textGradient: ['#FFE066', '#FF8C00', '#B02600'],
    accentGradient: ['#FF8C00', '#FFE066'],
    glowColor: '#FF6B35',
    rgba: '255, 107, 53',
    badgeEmoji: '🔥',
    badgeTitle: 'JOURNEY IGNITED',
  },
  {
    threshold: 50, // 50 - 99
    tierName: 'Emerald Oasis',
    primaryColor: '#10B981',
    secondaryColor: '#34D399',
    flameColors: ['#047857', '#059669', '#10B981', '#6EE7B7'],
    textGradient: ['#D1FAE5', '#10B981', '#047857'],
    accentGradient: ['#059669', '#6EE7B7'],
    glowColor: '#10B981',
    rgba: '16, 185, 129',
    badgeEmoji: '🌿',
    badgeTitle: '50-DAY DEVOTION',
  },
  {
    threshold: 100, // 100 - 149
    tierName: 'Celestial Cyan',
    primaryColor: '#00E5FF',
    secondaryColor: '#38BDF8',
    flameColors: ['#007799', '#00ACC1', '#00E5FF', '#E0F7FA'],
    textGradient: ['#E0F7FA', '#00E5FF', '#007799'],
    accentGradient: ['#0097A7', '#00E5FF'],
    glowColor: '#00E5FF',
    rgba: '0, 229, 255',
    badgeEmoji: '💎',
    badgeTitle: 'CENTURY ACHIEVED',
  },
  {
    threshold: 150, // 150 - 199
    tierName: 'Royal Amethyst',
    primaryColor: '#C084FC',
    secondaryColor: '#E879F9',
    flameColors: ['#6B21A8', '#9333EA', '#C084FC', '#F5D0FE'],
    textGradient: ['#FAF5FF', '#C084FC', '#6B21A8'],
    accentGradient: ['#9333EA', '#E879F9'],
    glowColor: '#C084FC',
    rgba: '192, 132, 252',
    badgeEmoji: '🔮',
    badgeTitle: 'SPIRITUAL ELEVATION',
  },
  {
    threshold: 200, // 200 - 249
    tierName: 'Rose Radiance',
    primaryColor: '#FF2E93',
    secondaryColor: '#FB7185',
    flameColors: ['#9F1239', '#E11D48', '#FF2E93', '#FFE4E6'],
    textGradient: ['#FFE4E6', '#FF2E93', '#9F1239'],
    accentGradient: ['#E11D48', '#FDA4AF'],
    glowColor: '#FF2E93',
    rgba: '255, 46, 147',
    badgeEmoji: '🌹',
    badgeTitle: 'STEADFAST HEART',
  },
  {
    threshold: 250, // 250 - 299
    tierName: 'Aurora Lime',
    primaryColor: '#84CC16',
    secondaryColor: '#A3E635',
    flameColors: ['#3F6212', '#65A30D', '#84CC16', '#ECFCCB'],
    textGradient: ['#ECFCCB', '#84CC16', '#3F6212'],
    accentGradient: ['#65A30D', '#BEF264'],
    glowColor: '#84CC16',
    rgba: '132, 204, 22',
    badgeEmoji: '⚡',
    badgeTitle: 'QUARTER-MILLENNIUM',
  },
  {
    threshold: 300, // 300 - 349
    tierName: 'Cosmic Sapphire',
    primaryColor: '#38BDF8',
    secondaryColor: '#60A5FA',
    flameColors: ['#1E40AF', '#2563EB', '#38BDF8', '#EFF6FF'],
    textGradient: ['#EFF6FF', '#38BDF8', '#1E40AF'],
    accentGradient: ['#2563EB', '#93C5FD'],
    glowColor: '#38BDF8',
    rgba: '56, 189, 248',
    badgeEmoji: '🌌',
    badgeTitle: '300-DAY MASTERY',
  },
  {
    threshold: 350, // 350 - 399
    tierName: 'Celestial Platinum',
    primaryColor: '#E2E8F0',
    secondaryColor: '#F8FAFC',
    flameColors: ['#475569', '#94A3B8', '#E2E8F0', '#FFFFFF'],
    textGradient: ['#FFFFFF', '#E2E8F0', '#475569'],
    accentGradient: ['#94A3B8', '#FFFFFF'],
    glowColor: '#CBD5E1',
    rgba: '226, 232, 240',
    badgeEmoji: '✨',
    badgeTitle: 'PLATINUM DEVOTION',
  },
  {
    threshold: 400, // 400 - 449
    tierName: 'Ruby Blaze',
    primaryColor: '#FF3366',
    secondaryColor: '#FB7185',
    flameColors: ['#881337', '#E11D48', '#FF3366', '#FFE4E6'],
    textGradient: ['#FFE4E6', '#FF3366', '#881337'],
    accentGradient: ['#E11D48', '#FDA4AF'],
    glowColor: '#FF3366',
    rgba: '255, 51, 102',
    badgeEmoji: '☄️',
    badgeTitle: 'RUBY DEDICATION',
  },
  {
    threshold: 450, // 450 - 499
    tierName: 'Imperial Amber',
    primaryColor: '#F59E0B',
    secondaryColor: '#FBBF24',
    flameColors: ['#78350F', '#B45309', '#F59E0B', '#FEF3C7'],
    textGradient: ['#FEF3C7', '#F59E0B', '#78350F'],
    accentGradient: ['#B45309', '#FDE68A'],
    glowColor: '#F59E0B',
    rgba: '245, 158, 11',
    badgeEmoji: '🏆',
    badgeTitle: 'HALF-THOUSAND IMMINENT',
  },
  {
    threshold: 500, // 500+
    tierName: 'Golden Hafidh Crown',
    primaryColor: '#FFD700',
    secondaryColor: '#FDE047',
    flameColors: ['#785303', '#D4AF37', '#FFD700', '#FFFDF0'],
    textGradient: ['#FFFDF0', '#FFD700', '#785303'],
    accentGradient: ['#D4AF37', '#FEF08A'],
    glowColor: '#FFD700',
    rgba: '255, 215, 0',
    badgeEmoji: '👑',
    badgeTitle: 'LEGENDARY HAFIDH',
  },
];

export function getMilestoneBadge(streak: number): { emoji: string; title: string } {
  if (streak >= 500) return { emoji: '👑', title: 'LEGENDARY HAFIDH' };
  if (streak >= 450) return { emoji: '🏆', title: '450 DAYS UNSTOPPABLE' };
  if (streak >= 400) return { emoji: '☄️', title: 'RUBY DEDICATION' };
  if (streak >= 365) return { emoji: '🕋', title: '1 YEAR OF DEVOTION' };
  if (streak >= 350) return { emoji: '✨', title: '1 YEAR IMMINENT' };
  if (streak >= 300) return { emoji: '🌌', title: '300-DAY MASTERY' };
  if (streak >= 250) return { emoji: '⚡', title: 'QUARTER-MILLENNIUM' };
  if (streak >= 200) return { emoji: '🌹', title: 'STEADFAST HEART' };
  if (streak >= 180) return { emoji: '👑', title: 'HALF-YEAR HAFIDH' };
  if (streak >= 150) return { emoji: '🔮', title: 'SPIRITUAL ELEVATION' };
  if (streak >= 100) return { emoji: '🏆', title: 'CENTURY ACHIEVED' };
  if (streak >= 90) return { emoji: '💎', title: '100 DAYS IMMINENT' };
  if (streak >= 60) return { emoji: '🥇', title: 'TWO MONTHS STRONG' };
  if (streak >= 50) return { emoji: '🌿', title: '50-DAY MILESTONE' };
  if (streak >= 40) return { emoji: '💫', title: '40 DAYS STEADFAST' };
  if (streak >= 30) return { emoji: '🏅', title: '1 MONTH CHAMPION' };
  if (streak >= 21) return { emoji: '💎', title: '3 WEEKS DEVOTED' };
  if (streak >= 14) return { emoji: '🌟', title: '2 WEEKS STRONG' };
  if (streak >= 10) return { emoji: '⭐', title: 'TEN DAYS CONSISTENT' };
  if (streak >= 7) return { emoji: '🔥', title: '1 WEEK ON FIRE' };
  if (streak >= 4) return { emoji: '⚡', title: 'CONSISTENCY UNLOCKED' };
  if (streak >= 2) return { emoji: '✨', title: 'BUILDING MOMENTUM' };
  return { emoji: '🌱', title: 'DAY ONE STARTED' };
}

export function getStreakTheme(streak: number): StreakMilestoneTheme {
  const milestone = Math.min(10, Math.floor(Math.max(0, streak) / 50));
  const base = STREAK_MILESTONE_TIERS[milestone] || STREAK_MILESTONE_TIERS[0];
  const badge = getMilestoneBadge(streak);
  return {
    ...base,
    milestoneIndex: milestone,
    badgeEmoji: badge.emoji,
    badgeTitle: badge.title,
  };
}

export function getStreakColor(streak: number): string {
  return getStreakTheme(streak).primaryColor;
}
