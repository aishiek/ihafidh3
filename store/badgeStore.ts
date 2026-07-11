import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Badge {
  id: string;
  name: string;
  arabicName: string;
  description: string;
  icon: string;
  requirement: number; // Number of juz completed
  color: string;
  unlocked: boolean;
  unlockedDate: string | null;
}

interface BadgeState {
  badges: Badge[];
  unlockedBadges: string[];
  
  checkAndUnlockBadges: (completedJuz: number) => Badge[];
  resyncBadgesWithProgress: (actualCompletedJuz: number) => Badge[];
  getBadgeById: (id: string) => Badge | undefined;
  getUnlockedBadges: () => Badge[];
  getLockedBadges: () => Badge[];
  getNextBadge: (completedJuz: number) => Badge | undefined;
}

const initialBadges: Badge[] = [
  {
    id: 'awwal-noor',
    name: 'First Light',
    arabicName: 'أول النور',
    description: 'Completed Juz Amma (30th Juz) of the Holy Quran',
    icon: '🌟',
    requirement: 1, // Just 1 juz (the 30th)
    color: '#FFD700',
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: 'munir-al-darb',
    name: 'Munir al-Darb',
    arabicName: 'منير الدرب',
    description: 'Complete any 3 Juz of the Holy Quran',
    icon: '🕌',
    requirement: 3,
    color: '#65C3BA',
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: 'hamil-hikmah',
    name: 'Bearer of Wisdom',
    arabicName: 'حامل الحكمة',
    description: 'Completed 5 Juz of the Holy Quran',
    icon: '📖',
    requirement: 5,
    color: '#C0C0C0',
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: 'sahib-istiqaamah',
    name: 'Sahib al-Istiqamah',
    arabicName: 'صاحب الاستقامة',
    description: 'Complete any 10 Juz of the Holy Quran',
    icon: '🌙',
    requirement: 10,
    color: '#8EC5FC',
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: 'saari-sabeelillah',
    name: "Traveller in Allah's Path",
    arabicName: 'ساري في سبيل الله',
    description: 'Completed 15 Juz of the Holy Quran',
    icon: '🛤️',
    requirement: 15,
    color: '#CD7F32',
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: 'sahib-azm',
    name: 'Sahib al-Azm',
    arabicName: 'صاحب العزم',
    description: 'Complete any 20 Juz of the Holy Quran',
    icon: '🏔️',
    requirement: 20,
    color: '#9B8AFB',
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: 'naasir-quran',
    name: 'Defender of the Quran',
    arabicName: 'ناصر القرآن',
    description: 'Completed 23 Juz of the Holy Quran',
    icon: '🛡️',
    requirement: 23,
    color: '#FF6347',
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: 'rahiq-yaqeen',
    name: 'Rahiq Al-Yaqeen',
    arabicName: 'رحيق اليقين',
    description: 'Complete any 25 Juz of the Holy Quran',
    icon: '📖✨',
    requirement: 25,
    color: '#F6AE2D',
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: 'hafidh-quran',
    name: 'Hafidh Al-Quran',
    arabicName: 'حافظ القرآن',
    description: 'Memorized all 6236 verses - Completed the entire Holy Quran',
    icon: '👑',
    requirement: 30,
    color: '#4169E1',
    unlocked: false,
    unlockedDate: null,
  },
];

export const useBadgeStore = create<BadgeState>()(
  persist(
    (set, get) => ({
      badges: initialBadges,
      unlockedBadges: [],
      
      checkAndUnlockBadges: (completedJuz: number) => {
        const { badges, unlockedBadges } = get();
        const newlyUnlocked: Badge[] = [];
        const today = new Date().toISOString();
        
        if (__DEV__) if (__DEV__) if (__DEV__) console.log('[badgeStore] Checking badges - completedJuz:', completedJuz);
        
        const updatedBadges = badges.map(badge => {
          if (!badge.unlocked && completedJuz >= badge.requirement) {
            if (__DEV__) if (__DEV__) if (__DEV__) console.log('[badgeStore] Unlocking badge:', badge.name, 'requirement:', badge.requirement);
            const unlockedBadge = {
              ...badge,
              unlocked: true,
              unlockedDate: today,
            };

            // Increment community badge stats for every newly unlocked badge
            const { incrementBadgeUnlock, incrementHafidhCompletion } = require('@/services/communityStatsService');
            incrementBadgeUnlock(badge.id);
            // Also keep the global hafidh counter for the global milestones tile
            if (badge.id === 'hafidh-quran') {
              incrementHafidhCompletion();
            }
            
            if (!unlockedBadges.includes(badge.id)) {
              newlyUnlocked.push(unlockedBadge);
            }
            
            return unlockedBadge;
          } else if (badge.unlocked && completedJuz >= badge.requirement) {
            if (__DEV__) if (__DEV__) if (__DEV__) console.log('[badgeStore] Badge already unlocked:', badge.name);
          }
          return badge;
        });
        
        if (newlyUnlocked.length > 0) {
          if (__DEV__) if (__DEV__) if (__DEV__) console.log('[badgeStore] Newly unlocked badges:', newlyUnlocked.map(b => b.name));
          const newUnlockedIds = [...unlockedBadges, ...newlyUnlocked.map(b => b.id)];
          set({ badges: updatedBadges, unlockedBadges: newUnlockedIds });
        } else {
          if (__DEV__) if (__DEV__) if (__DEV__) console.log('[badgeStore] No new badges to unlock');
        }
        
        return newlyUnlocked;
      },
      
      getBadgeById: (id: string) => {
        return get().badges.find(badge => badge.id === id);
      },
      
      getUnlockedBadges: () => {
        return get().badges.filter(badge => badge.unlocked);
      },
      
      getLockedBadges: () => {
        return get().badges.filter(badge => !badge.unlocked);
      },
      
      getNextBadge: (completedJuz: number) => {
        const lockedBadges = get().getLockedBadges();
        return lockedBadges
          .sort((a, b) => a.requirement - b.requirement)
          .find(badge => badge.requirement > completedJuz);
      },
      
      /**
       * Force re-sync all badges based on current actual progress.
       * This is useful when badge calculation logic changes or to fix stale badge states.
       */
      resyncBadgesWithProgress: (actualCompletedJuz: number) => {
        const { badges } = get();
        const today = new Date().toISOString();
        const newUnlockedIds: string[] = [];
        
        if (__DEV__) if (__DEV__) console.log('[badgeStore] Re-syncing badges with actual progress:', actualCompletedJuz, 'Juz');
        
        const resyncedBadges = badges.map(badge => {
          const shouldBeUnlocked = actualCompletedJuz >= badge.requirement;
          
          if (shouldBeUnlocked && !badge.unlocked) {
            // Badge should be unlocked but isn't - unlock it
            if (__DEV__) if (__DEV__) console.log('[badgeStore] Re-syncing: Unlocking badge', badge.name);
            newUnlockedIds.push(badge.id);
            return {
              ...badge,
              unlocked: true,
              unlockedDate: today,
            };
          } else if (!shouldBeUnlocked && badge.unlocked) {
            // Badge is unlocked but shouldn't be - lock it
            if (__DEV__) if (__DEV__) console.log('[badgeStore] Re-syncing: Locking badge', badge.name);
            return {
              ...badge,
              unlocked: false,
              unlockedDate: null,
            };
          } else if (shouldBeUnlocked && badge.unlocked) {
            // Badge is correctly unlocked
            newUnlockedIds.push(badge.id);
            if (__DEV__) if (__DEV__) console.log('[badgeStore] Re-syncing: Badge correctly unlocked', badge.name);
          }
          
          return badge;
        });
        
        set({ badges: resyncedBadges, unlockedBadges: newUnlockedIds });
        if (__DEV__) if (__DEV__) console.log('[badgeStore] Re-sync complete. Unlocked badges:', newUnlockedIds.length);
        
        return resyncedBadges.filter(b => b.unlocked);
      },
    }),
    {
      name: 'badge-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
); 