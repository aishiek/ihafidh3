import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { surahsData } from '@/data/surahs'; // Use existing surahsData
import { Verse } from '@/types'; // Assuming Verse type is here

// Types (re-defined or imported as needed)
interface Surah {
  id: number; // Use id to match surahsData
  name: string;
  englishName: string; // Add englishName to match existing data
  versesCount: number;
}

interface DailyRevisionStats {
  date: string;
  targetVerses: number;
  completedVerses: number;
  isCompleted: boolean;
}

interface WeeklyRevisionStats {
  weekStart: string;
  selectedSurahs: number[]; // Array of surah IDs
  surahProgress: { [surahId: number]: { completed: number; total: number } };
  isCompleted: boolean;
}

// Utility functions
const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getWeekStart = (date: Date = new Date()): string => {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - startOfWeek.getDay());
  return startOfWeek.toISOString().split('T')[0];
};

// Define default states
const defaultDailyStats: DailyRevisionStats = {
  date: getCurrentDate(),
  targetVerses: 10, // Default target
  completedVerses: 0,
  isCompleted: false,
};

const defaultWeeklyStats: WeeklyRevisionStats = {
  weekStart: getWeekStart(),
  selectedSurahs: [],
  surahProgress: {},
  isCompleted: false,
};

// Use a simple object to hold state and functions
/* Commenting out the direct object approach as the hook is used instead
const revisionState: { 
    dailyStats: DailyRevisionStats; 
    weeklyStats: WeeklyRevisionStats; 
    verses: Verse[]; 
    markVerseForRevision: (verseId: number) => void; 
    updateDailyTarget: (newTarget: number) => void; 
    updateWeeklySurahs: (newSurahs: number[]) => void;
    loadRevisionData: () => Promise<void>;
    saveRevisionData: () => Promise<void>;
} = {
    dailyStats: defaultDailyStats,
    weeklyStats: defaultWeeklyStats,
    verses: [],
    markVerseForRevision: () => {},
    updateDailyTarget: () => {},
    updateWeeklySurahs: () => {},
    loadRevisionData: async () => {},
    saveRevisionData: async () => {},
};
*/

export const useRevisionLogic = () => {
  const [dailyStats, setDailyStats] = useState<DailyRevisionStats>(defaultDailyStats);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyRevisionStats>(defaultWeeklyStats);
  const [verses, setVerses] = useState<Verse[]>([]);

  // Load data on component mount
  useEffect(() => {
    loadRevisionData();
  }, []);

  // Save data whenever stats change
  useEffect(() => {
    saveRevisionData();
  }, [dailyStats, weeklyStats, verses]); // Also save verses state

  const loadRevisionData = async () => {
    try {
      const dailyData = await AsyncStorage.getItem('dailyRevisionStats');
      const weeklyData = await AsyncStorage.getItem('weeklyRevisionStats');
      const versesData = await AsyncStorage.getItem('verses');

      if (dailyData) {
        const parsed = JSON.parse(dailyData);
        // Reset if it's a new day
        if (parsed.date !== getCurrentDate()) {
          setDailyStats({
            ...parsed,
            date: getCurrentDate(),
            completedVerses: 0,
            isCompleted: false,
          });
        } else {
          setDailyStats(parsed);
        }
      } else {
          setDailyStats(defaultDailyStats);
      }

      if (weeklyData) {
        const parsed = JSON.parse(weeklyData);
        // Reset if it's a new week
        if (parsed.weekStart !== getWeekStart()) {
          setWeeklyStats({
            ...parsed,
            weekStart: getWeekStart(),
            selectedSurahs: parsed.selectedSurahs || [], // Ensure selectedSurahs is array
            surahProgress: {}, // Reset weekly progress
            isCompleted: false,
          });
        } else {
           // Re-calculate surah progress on load based on revised verses this week
           const updatedProgress: { [surahId: number]: { completed: number; total: number } } = {};
           const loadedVerses: Verse[] = versesData ? JSON.parse(versesData) : [];

           (parsed.selectedSurahs || []).forEach((surahId: number) => {
               const surah = surahsData.find(s => s.id === surahId);
               if (surah) {
                   const revisedCount = loadedVerses.filter(v =>
                       // Use surahNumber from the loaded verse data
                       v.surahNumber === surahId &&
                       v.isMarkedForRevision &&
                       v.lastRevisedDate &&
                       v.lastRevisedDate >= getWeekStart()
                   ).length;
                   updatedProgress[surahId] = { completed: revisedCount, total: surah.versesCount };
               }
           });
           
           const allCompleted = (parsed.selectedSurahs || []).every((surahId: number) => {
               const progress = updatedProgress[surahId];
               return progress && progress.completed >= progress.total;
           });

          setWeeklyStats({
             ...parsed,
             selectedSurahs: parsed.selectedSurahs || [],
             surahProgress: updatedProgress,
             isCompleted: allCompleted,
          });
        }
      } else {
          setWeeklyStats(defaultWeeklyStats);
      }

      if (versesData) {
        setVerses(JSON.parse(versesData));
      } else {
          setVerses([]);
      }
       console.log('Revision data loaded.', { dailyStats: dailyData, weeklyStats: weeklyData, versesCount: versesData ? JSON.parse(versesData).length : 0 });

    } catch (error) {
      console.error('Error loading revision data:', error);
    }
  };

  const saveRevisionData = async () => {
    try {
      await AsyncStorage.setItem('dailyRevisionStats', JSON.stringify(dailyStats));
      await AsyncStorage.setItem('weeklyRevisionStats', JSON.stringify(weeklyStats));
      await AsyncStorage.setItem('verses', JSON.stringify(verses));
       console.log('Revision data saved.', { dailyStats, weeklyStats, versesCount: verses.length });
    } catch (error) {
      console.error('Error saving revision data:', error);
    }
  };

  const markVerseForRevision = (verseId: number) => {
    const today = getCurrentDate();
    const thisWeek = getWeekStart();

    setVerses(prev => {
        const newVerses = prev.map(verse =>
          verse.id === verseId
            ? { ...verse, isMarkedForRevision: true, lastRevisedDate: today }
            : verse
        );
         // Ensure the verse has surahNumber before finding it
        const revisedVerse = newVerses.find(v => v.id === verseId && v.surahNumber !== undefined);

        // Update daily stats (always increment)
        setDailyStats(prevDaily => {
          const newCompleted = prevDaily.completedVerses + 1;
          return {
            ...prevDaily,
            completedVerses: newCompleted,
            isCompleted: newCompleted >= prevDaily.targetVerses,
          };
        });

        // Update weekly stats (only if target surah)
        setWeeklyStats(prevWeekly => {
          const newProgress = { ...prevWeekly.surahProgress };
          let newIsCompleted = prevWeekly.isCompleted; // Keep previous completion status by default

          if (revisedVerse && prevWeekly.selectedSurahs.includes(revisedVerse.surahNumber)) {
              if (!newProgress[revisedVerse.surahNumber]) {
                const surah = surahsData.find(s => s.id === revisedVerse.surahNumber);
                 // Use versesCount from surahsData
                newProgress[revisedVerse.surahNumber] = { completed: 0, total: surah?.versesCount || 0 };
              }

              // Increment completed count for the specific surah
              newProgress[revisedVerse.surahNumber].completed += 1;

              // Check if all selected surahs are completed after this update
              const allSelectedSurahsFullyCompleted = prevWeekly.selectedSurahs.length > 0 && prevWeekly.selectedSurahs.every(surahId => {
                const progress = newProgress[surahId];
                const surah = surahsData.find(s => s.id === surahId);
                // Ensure progress exists and completed count matches total verses
                return progress && surah && progress.completed >= surah.versesCount;
              });

              newIsCompleted = allSelectedSurahsFullyCompleted;
          }
            console.log('State after weekly stats update:', { selectedSurahs: prevWeekly.selectedSurahs, surahProgress: newProgress, isCompleted: newIsCompleted });

          return {
            ...prevWeekly,
            surahProgress: newProgress,
            isCompleted: newIsCompleted,
          };
        });
        
        console.log('Verses state after markVerseForRevision:', newVerses.length);
        return newVerses;
    });
  };

  const updateDailyTarget = (newTarget: number) => {
    setDailyStats(prev => ({
      ...prev,
      targetVerses: newTarget,
      isCompleted: prev.completedVerses >= newTarget,
    }));
     console.log('Daily target updated:', newTarget);
  };

  const updateWeeklySurahs = (newSurahs: number[]) => {
    const newProgress: { [key: number]: { completed: number; total: number } } = {};
     const currentVerses = verses; // Use the current verses state
     const weekStart = getWeekStart();

    newSurahs.forEach(surahId => {
      const surah = surahsData.find(s => s.id === surahId);
      if (surah) {
        // Count already revised verses for this surah *this week*
        const revisedCount = currentVerses.filter(v =>
          // Use surahNumber from the verse data
          v.surahNumber === surahId &&
          v.isMarkedForRevision &&
          v.lastRevisedDate &&
          v.lastRevisedDate >= weekStart // Check if revised *this week*
        ).length;

        newProgress[surahId] = { completed: revisedCount, total: surah.versesCount };
      }
    });

    const allCompleted = newSurahs.length > 0 && newSurahs.every(surahId => {
      const progress = newProgress[surahId];
       const surah = surahsData.find(s => s.id === surahId);
      // Ensure progress exists and completed count matches total verses
      return progress && surah && progress.completed >= surah.versesCount;
    });
    
     console.log('Updating weekly surahs selection:', newSurahs, ', calculated progress:', newProgress, ', isCompleted:', allCompleted);

    setWeeklyStats(prev => ({
      ...prev,
      selectedSurahs: newSurahs,
      surahProgress: newProgress,
      isCompleted: allCompleted,
    }));
  };

  // Return state and update functions
  return { dailyStats, weeklyStats, verses, markVerseForRevision, updateDailyTarget, updateWeeklySurahs, loadRevisionData };
};

// Export necessary components and utilities as well if they are used elsewhere
// For now, only the hook is intended for external use by VerseItem.
export { getCurrentDate, getWeekStart }; 