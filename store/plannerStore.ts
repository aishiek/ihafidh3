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
  // UI: selected surah and mode for planner stats
  selectedSurahId?: number | null;
  mode?: 'surah' | 'verse';
  // verse-level stats persisted by month: yyyy-MM -> { globalVerseId: { planned?: boolean; completed?: boolean } }
  verseStatsByMonth: Record<string, Record<number, { planned?: boolean; completed?: boolean }>>;
  addPlan: (date: string, entry: Omit<PlannerEntry, 'id' | 'createdAt'> & { id?: string }) => void;
  updatePlan: (date: string, id: string, updates: Partial<Omit<PlannerEntry, 'id' | 'createdAt'>>) => void;
  removePlan: (date: string, id: string) => void;
  clearDateIfEmpty: (date: string) => void;
  setSelectedSurahId: (id?: number|null) => void;
  setMode: (m: 'surah'|'verse') => void;
  // record or update a verse stat for a given month
  recordVerseStat: (monthKey: string, verseGlobalId: number, data: { planned?: boolean; completed?: boolean }) => void;
  clearVerseStatsForMonth: (monthKey: string) => void;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      plansByDate: {},
      selectedSurahId: null,
      mode: 'surah',
      verseStatsByMonth: {},
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
      setSelectedSurahId: (id?: number|null) => set((s) => ({ ...s, selectedSurahId: id ?? null })),
      setMode: (m: 'surah'|'verse') => set((s) => ({ ...s, mode: m })),
      recordVerseStat: (monthKey: string, verseGlobalId: number, data: { planned?: boolean; completed?: boolean }) => {
        set((state) => {
          const copy = { ...(state.verseStatsByMonth || {}) } as Record<string, Record<number, { planned?: boolean; completed?: boolean }>>;
          if (!copy[monthKey]) copy[monthKey] = {};
          const entry = { ...(copy[monthKey][verseGlobalId] || {}), ...data };
          copy[monthKey][verseGlobalId] = entry;
          return { verseStatsByMonth: copy };
        });
      },
      clearVerseStatsForMonth: (monthKey: string) => set((state) => ({ verseStatsByMonth: { ...(state.verseStatsByMonth || {}) } })),
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
          // Migrate keys from yyyy-MM-dd to dd-MM-yyyy if needed
          const keys = Object.keys(state.plansByDate);
          let changed = false;
          const newMap: Record<string, PlannerEntry[]> = { ...state.plansByDate };
          for (const k of keys) {
            // detect yyyy-MM-dd
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
            if (m) {
              const yyyy = m[1], mm = m[2], dd = m[3];
              const newKey = `${dd}-${mm}-${yyyy}`;
              if (!newMap[newKey]) newMap[newKey] = newMap[k];
              delete newMap[k];
              changed = true;
            }
          }
          if (changed) {
            // Assign back; persist middleware will write it on next set
            state.plansByDate = newMap;
          }
        }
      },
    }
  )
);
