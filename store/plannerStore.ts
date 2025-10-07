import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface PlannerEntry {
  id: string; // unique id
  surahId: number; // 1-114
  startVerse: number; // 1-based verse number within surah
  endVerse: number; // inclusive
  note?: string;
  createdAt: string; // ISO date-time
}

export interface PlannerState {
  // yyyy-MM-dd -> entries
  plansByDate: Record<string, PlannerEntry[]>;
  addPlan: (date: string, entry: Omit<PlannerEntry, 'id' | 'createdAt'> & { id?: string }) => void;
  updatePlan: (date: string, id: string, updates: Partial<Omit<PlannerEntry, 'id' | 'createdAt'>>) => void;
  removePlan: (date: string, id: string) => void;
  clearDateIfEmpty: (date: string) => void;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      plansByDate: {},
      addPlan: (date, entry) => {
        set((state) => {
          const list = state.plansByDate[date] || [];
          const id = entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const newEntry: PlannerEntry = {
            id,
            surahId: entry.surahId,
            startVerse: entry.startVerse,
            endVerse: entry.endVerse,
            note: entry.note,
            createdAt: new Date().toISOString(),
          };
          return {
            plansByDate: {
              ...state.plansByDate,
              [date]: [...list, newEntry],
            },
          };
        });
      },
      updatePlan: (date, id, updates) => {
        set((state) => {
          const list = state.plansByDate[date] || [];
          const newList = list.map((p) => (p.id === id ? { ...p, ...updates } : p));
          return { plansByDate: { ...state.plansByDate, [date]: newList } };
        });
      },
      removePlan: (date, id) => {
        set((state) => {
          const list = state.plansByDate[date] || [];
          const newList = list.filter((p) => p.id !== id);
          const newPlans = { ...state.plansByDate } as Record<string, PlannerEntry[]>;
          if (newList.length > 0) {
            newPlans[date] = newList;
          } else {
            delete newPlans[date];
          }
          return { plansByDate: newPlans };
        });
      },
      clearDateIfEmpty: (date) => {
        set((state) => {
          const list = state.plansByDate[date] || [];
          if (list.length === 0) {
            const copy = { ...state.plansByDate } as Record<string, PlannerEntry[]>;
            delete copy[date];
            return { plansByDate: copy };
          }
          return state;
        });
      },
    }),
    {
      name: 'hifdh-planner-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.plansByDate = state.plansByDate || {};
        }
      },
    }
  )
);
