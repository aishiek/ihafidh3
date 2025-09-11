import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        
        const updatedBadges = badges.map(badge => {
          if (!badge.unlocked && completedJuz >= badge.requirement) {
            const unlockedBadge = {
              ...badge,
              unlocked: true,
              unlockedDate: today,
            };
            
            if (!unlockedBadges.includes(badge.id)) {
              newlyUnlocked.push(unlockedBadge);
            }
            
            return unlockedBadge;
          }
          return badge;
        });
        
        if (newlyUnlocked.length > 0) {
          const newUnlockedIds = [...unlockedBadges, ...newlyUnlocked.map(b => b.id)];
          set({ badges: updatedBadges, unlockedBadges: newUnlockedIds });
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
    }),
    {
      name: 'badge-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
); 