import { useFocusEffect } from '@react-navigation/native';
import type { FlashListRef } from '@shopify/flash-list';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, Pause, Play, RefreshCw, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import JuzMemorization from '@/components/JuzMemorization';
import VerseItem from '@/components/VerseItem';
import { surahsData } from '@/data/surahs';
import { fetchVersesForJuz, fetchVersesForSurah, getDatabase, JuzVerse, logDatabaseTables } from '@/services/juzDbService';
import { useProgressStore } from '@/store/progressStore';
import { useQuranStore } from '@/store/quranStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Surah, Verse } from '@/types';
import {
    getAudioUrl,
    pauseAudio,
    pauseSurahAudio,
    playAudio,
    playSurahAudioWithFallback,
    resumeSurahAudio,
} from '@/utils/audioUtils';
import { getArabicFontFamily, getArabicTypographySizing } from '@/utils/fontUtils';
import { useThemeColor } from '@/utils/useThemeColor';
import { getAverageVerseHeight } from '@/utils/verseLayoutUtils';
import { AutoSizeText, ResizeTextMode } from 'react-native-auto-size-text';

// Constants
const MAX_CACHE_SIZE = 50;
const SURAH_ITEM_HEIGHT = 80;
const BULK_UPDATE_THRESHOLD = 10;

// No longer needed - Removed pagination-related constants and helpers
// Cache is now simple: just clear by surahId when needed

const clearSurahCacheById = (surahId: number) => {
  // Simple cache clear - not used anymore since we load all verses at once
  // Kept for potential future use
};

export default function ReadScreen() {
  const router = useRouter();
  const { primary } = useThemeColor();
  const { fontSizeArabic, fontSizeTranslation, showTranslation, arabicFont, translationLanguage } = useSettingsStore();
  const arabicTypography = getArabicTypographySizing(fontSizeArabic, arabicFont);
  const arabicFontFamily = getArabicFontFamily(arabicFont);

  const { surahId: paramSurahId, verseId: paramVerseId, source: paramSource, juzNumber: paramJuzNumber } = useLocalSearchParams<{
    surahId?: string;
    verseId?: string;
    source?: string;
    juzNumber?: string;
  }>();

  const {
    memorizedVerses,
    revisedVerses,
    memorizedVerseDates,
    setLastReadVerse,
    markVerseAsMemorized,
    unmarkVerseAsMemorized,
    markVerseAsRevised,
    unmarkVerseAsRevised,
    bulkMarkVersesMemorized,
    bulkMarkVersesRevised,
  } = useProgressStore();

  const lastViewedSurahId = useQuranStore((state) => state.lastViewedSurahId);
  const setLastViewedSurahId = useQuranStore((state) => state.setLastViewedSurahId);

  // UI State
  const [tab, setTab] = useState<'surah' | 'juz'>('surah');
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);
  const [navigationSource, setNavigationSource] = useState<'surahList' | 'juzList' | 'mustahabbah' | 'continueReading' | 'stats' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [verses, setVerses] = useState<Verse[]>([]);
  const [juzVerses, setJuzVerses] = useState<JuzVerse[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingSurah, setIsPlayingSurah] = useState(false);
  const [isSurahPaused, setIsSurahPaused] = useState(false);
  const [currentlyPlayingVerse, setCurrentlyPlayingVerse] = useState<{surahId: number, verseNumber: number} | null>(null);
  
  // CRITICAL FIX: Force FlashList to rebuild when verse data changes (Fix for recycling issues)
  const [verseListKey, setVerseListKey] = useState(0);
  const [juzListKey, setJuzListKey] = useState(0);

  // Loading
  // Loading
  const [isLoading, setIsLoading] = useState(false);
  const [isJuzLoading, setIsJuzLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [juzLoadingError, setJuzLoadingError] = useState<string | null>(null);

  // Go-to-verse modal
  const [goToModalVisible, setGoToModalVisible] = useState(false);
  const [goToInput, setGoToInput] = useState('');
  const [goToError, setGoToError] = useState<string | null>(null);
  const [goToSubmitting, setGoToSubmitting] = useState(false);

  // Progress modal
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressAction, setProgressAction] = useState<string | null>(null);
  const [progressCount, setProgressCount] = useState(0);

  // Progress store actions - badge celebrations now handled globally via CelebrationContext in _layout.tsx

  // Refs
  const flatListRef = useRef<FlashListRef<any>>(null);
  const versesRef = useRef<Verse[]>([]);
  const scrollOffsetRef = useRef(0);
  const isNavigatingBack = useRef(false);
  const suppressNextAutoOpen = useRef(false);
  const surahListRef = useRef<FlashListRef<any>>(null);
  const loadingLocks = useRef<Map<string, Promise<any>>>(new Map());

  // Memoized
  const filteredSurahs = useMemo(() => {
    if (!searchQuery) return surahsData;
    const query = searchQuery.toLowerCase();
    return surahsData.filter((surah) =>
      surah.englishName.toLowerCase().includes(query) ||
      (surah.englishNameTranslation?.toLowerCase() || '').includes(query) ||
      surah.name.toLowerCase().includes(query) ||
      surah.id.toString() === query
    );
  }, [searchQuery]);

  const averageVerseHeight = useMemo(() => {
    if (!verses.length) return 200;
    return getAverageVerseHeight(verses.slice(0, 10), {
      arabicFontSize: fontSizeArabic,
      showTranslation,
      translationFontSize: fontSizeTranslation,
    });
  }, [verses, fontSizeArabic, showTranslation, fontSizeTranslation]);

  const ESTIMATED_ITEM_HEIGHT = useMemo(() => {
    if (fontSizeArabic <= 24) return 140;
    if (fontSizeArabic <= 36) return 220;
    if (fontSizeArabic <= 52) return 320;
    return 450; // Very large fonts
  }, [fontSizeArabic]);

  // Helper functions
  const getSurahVerseRange = useCallback((surahObj: { id: number; versesCount: number }) => {
    let startVerseId = 0;
    for (let i = 1; i < surahObj.id; i++) {
      const prevSurah = surahsData.find((s) => s.id === i);
      if (prevSurah) startVerseId += prevSurah.versesCount;
    }
    const verseIds: number[] = [];
    for (let i = 1; i <= surahObj.versesCount; i++) {
      verseIds.push(startVerseId + i);
    }
    return verseIds;
  }, []);

  const calculateSurahProgress = useCallback(
    (surahId: number) => {
      let startVerseId = 0;
      for (let i = 1; i < surahId; i++) {
        const prevSurah = surahsData.find((s) => s.id === i);
        if (prevSurah) startVerseId += prevSurah.versesCount;
      }
      const surah = surahsData.find((s) => s.id === surahId);
      if (!surah) return { memorized: 0, progress: 0 };
      const startVerse = startVerseId + 1;
      const endVerse = startVerseId + surah.versesCount;
      const memorizedInSurah = memorizedVerses.filter(
        (id) => id >= startVerse && id <= endVerse
      ).length;
      return { memorized: memorizedInSurah, progress: (memorizedInSurah / surah.versesCount) * 100 };
    },
    [memorizedVerses]
  );

  const getProgressColor = (progress: number): string => {
    if (progress === 0) return '#666666';
    if (progress === 100) return '#4CAF50';
    return '#FF9800';
  };

  const formatDate = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getSurahCompletionDate = (surahId: number): Date | null => {
    const surah = surahsData.find((s) => s.id === surahId);
    if (!surah) return null;
    const allIds = getSurahVerseRange({ id: surah.id, versesCount: surah.versesCount });
    const memSet = new Set(memorizedVerses);
    if (!allIds.every((id) => memSet.has(id))) return null;
    let latest: Date | null = null;
    for (const id of allIds) {
      const ds = memorizedVerseDates?.[id];
      if (ds) {
        const d = new Date(ds);
        if (!latest || d > latest) latest = d;
      }
    }
    return latest;
  };

  const surahStatus = useMemo(() => {
    if (!selectedSurah) return { isMemorized: false, isRevised: false };
    const allVerseIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    const memorizedSet = new Set(memorizedVerses);
    const revisedSet = new Set(revisedVerses.map((v: any) => v.verseId));
    return {
      isMemorized: allVerseIds.every((id) => memorizedSet.has(id)),
      isRevised: allVerseIds.every((id) => revisedSet.has(id)),
    };
  }, [selectedSurah, memorizedVerses, revisedVerses, getSurahVerseRange]);

  const isSurahMemorizedGlobally = useMemo(() => {
    if (!selectedSurah) return false;
    const allIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    return allIds.length > 0 && allIds.every((id) => memorizedVerses.includes(id));
  }, [selectedSurah, memorizedVerses, getSurahVerseRange]);

  const isSurahRevisedGlobally = useMemo(() => {
    if (!selectedSurah) return false;
    const allIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    return allIds.length > 0 && allIds.every((id) => revisedVerses.some((rv) => rv.verseId === id));
  }, [selectedSurah, revisedVerses, getSurahVerseRange]);

  // Async loaders - Enhanced with robust retry logic and error handling
  const loadInitialVerses = useCallback(
    async (surah: Surah, retryCount = 0) => {
      const lockKey = `surah_${surah.id}_${translationLanguage}`;
      if (loadingLocks.current.has(lockKey)) return loadingLocks.current.get(lockKey);

      const loadPromise = (async () => {
        setIsLoading(true);
        setLoadingError(null);

        try {
          console.log(`[read] Loading verses for ${surah.name} (attempt ${retryCount + 1}/3)...`);
          
          // Load ALL verses from local DB at once (same as Juz implementation)
          const allVersesFromDB = await fetchVersesForSurah(surah.id);
          
          // Validate DB returned data
          if (!allVersesFromDB || allVersesFromDB.length === 0) {
            throw new Error(`No verses returned from database for ${surah.name}`);
          }
          
          const reciterIdentifier = useSettingsStore.getState().reciterIdentifier;
          
          let mappedVerses: Verse[] = allVersesFromDB.map((v: any) => ({
            id: v.verse_id,
            surahId: v.chapter_id,
            verseNumber: v.verse_number,
            arabicText: v.ayah,
            translation: v.translation || '', // English from local DB
            transliteration: v.transliteration || undefined,
            pageNumber: v.page_id ? Number(v.page_id) : undefined,
            juzNumber: v.part_id ? Number(v.part_id) : undefined,
            audioUrl: getAudioUrl(reciterIdentifier, v.chapter_id || surah.id, v.verse_number),
          }));

          // PERFORMANCE FIX: Local DB already has translations!
          // Removed API call that was causing 3-10 second delays for non-English languages
          // The AlQurandb.sqlite3 database contains English translations (collection_id = 2)
          // For Tamil/Malay/other languages, use the translation services instead of API
          // This matches the Juz implementation which loads instantly

          // Set ALL verses at once - FlatList handles virtualization automatically
          setVerses(mappedVerses);
          setVerseListKey(prev => prev + 1); // Force FlashList rebuild on data change
          setLastReadVerse(mappedVerses[0]);
          
        } catch (err: any) {
          console.error(`[read] Failed to load verses for ${surah.name}, attempt ${retryCount + 1}:`, err);
          
          // CRITICAL: Retry for ANY error on Android, not just database errors
          // Android can have various initialization timing issues
          if (retryCount < 2) {
            console.log(`[read] Retrying loadInitialVerses for ${surah.name} (attempt ${retryCount + 2}/3)...`);
            // Exponential backoff: 600ms, 1200ms
            const delay = 600 * (retryCount + 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            loadingLocks.current.delete(lockKey);
            return loadInitialVerses(surah, retryCount + 1);
          }
          
          // All retries exhausted - show error to user
          const errorMessage = `Failed to load verses for ${surah.name}`;
          setLoadingError(errorMessage);
          setVerses([]);
          
          // Show critical error alert to user
          Alert.alert(
            '❌ Failed to Load Verses',
            `Cannot load ${surah.name} after 3 attempts.\n\nPlease try:\n1. Restart the app\n2. Check device storage\n3. Reinstall if problem persists\n\nError: ${err?.message || 'Unknown error'}`,
            [
              {
                text: 'Try Again',
                onPress: () => {
                  // Reset and try one more time
                  loadingLocks.current.delete(lockKey);
                  loadInitialVerses(surah, 0);
                },
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
          
          console.error('[read] All retry attempts exhausted for', surah.name, err);
        } finally {
          setIsLoading(false);
        }
      })();

      loadingLocks.current.set(lockKey, loadPromise);
      try {
        await loadPromise;
      } finally {
        loadingLocks.current.delete(lockKey);
      }
    },
    [translationLanguage, setLastReadVerse]
  );

  const handleMoveToVerse = useCallback(
    (verseNumber: number): boolean => {
      if (!verses.length) return false;
      const verseIndex = verses.findIndex((v) => v.verseNumber === verseNumber);
      if (verseIndex >= 0) {
        flatListRef.current?.scrollToIndex({
          index: verseIndex,
          animated: true,
          viewPosition: 0.2,
          viewOffset: 100,
        });
        return true;
      }
      return false;
    },
    [verses]
  );

  // Event handlers
  const handleBackToSurahs = useCallback(() => {
    if (isNavigatingBack.current) return;
    isNavigatingBack.current = true;
    
    try {
      // Stop any playback
      setIsPlayingAudio(false);
      setIsPlayingSurah(false);
      setIsSurahPaused(false);
      
      // If viewing verses (either Surah or Juz), go back to list view
      if (selectedSurah || selectedJuz !== null) {
        console.log('[read] Back from verses to list view - clearing params');
        // CRITICAL: Clear URL params to allow fresh navigation next time
        router.replace('/(tabs)/read');
        setSelectedJuz(null);
        setSelectedSurah(null);
        setVerses([]);
        setJuzVerses([]);
        setNavigationSource(null);
      } 
      // If already on list view (no selection), navigate to home tab
      else {
        console.log('[read] Back from list view to home tab');
        router.replace('/(tabs)/');
      }
      
      setTimeout(() => {
        isNavigatingBack.current = false;
      }, 300);
    } catch (e) {
      console.error('[read] handleBackToSurahs error', e);
      isNavigatingBack.current = false;
    }
  }, [router, selectedSurah, selectedJuz]);

  const handleVersePlayAudio = useCallback(
    async (surahNum: number, verseNum: number, _globalId?: number, repeats?: number, isInfinite?: boolean) => {
      try {
        const verse = versesRef.current?.find((v) => v.surahId === surahNum && v.verseNumber === verseNum);
        const reciterIdentifier = useSettingsStore.getState().reciterIdentifier;
        const url = (verse && (verse as any).audioUrl) || getAudioUrl(reciterIdentifier, surahNum, verseNum);
        const repeatCountToUse = typeof repeats === 'number' ? repeats : 1;
        const infinite = !!isInfinite;

        if (isPlayingAudio && currentlyPlayingVerse?.surahId === surahNum && currentlyPlayingVerse?.verseNumber === verseNum) {
          await pauseAudio();
          setIsPlayingAudio(false);
          setCurrentlyPlayingVerse(null);
        } else {
          // Stop any currently playing audio first
          if (isPlayingAudio) {
            await pauseAudio();
          }
          
          await playAudio(url, repeatCountToUse, (status) => {
            if (status?.isPlaying) {
              setIsPlayingAudio(true);
              setCurrentlyPlayingVerse({surahId: surahNum, verseNumber: verseNum});
            }
            if (status?.didJustFinish && !infinite && (status.repeatCount ?? 0) >= (status.maxRepeats ?? 1)) {
              setIsPlayingAudio(false);
              setCurrentlyPlayingVerse(null);
            }
          });
          setIsPlayingAudio(true);
          setCurrentlyPlayingVerse({surahId: surahNum, verseNumber: verseNum});
        }
      } catch (e) {
        console.error('Audio playback failed:', e);
        setIsPlayingAudio(false);
        setCurrentlyPlayingVerse(null);
      }
    },
    [isPlayingAudio, currentlyPlayingVerse]
  );

  const handleToggleSurahAudio = useCallback(async () => {
    if (!selectedSurah) return;
    try {
      if (isPlayingSurah) {
        await pauseSurahAudio();
        setIsPlayingSurah(false);
        setIsSurahPaused(true);
      } else if (isSurahPaused) {
        await resumeSurahAudio();
        setIsPlayingSurah(true);
        setIsSurahPaused(false);
      } else {
        await playSurahAudioWithFallback(selectedSurah.id, 1, (status: any) => {
          if (status?.didJustFinish) {
            setIsPlayingSurah(false);
            setIsSurahPaused(false);
          } else if (status?.isPlaying) {
            setIsPlayingSurah(true);
            setIsSurahPaused(false);
          } else if (status?.isPaused) {
            setIsPlayingSurah(false);
            setIsSurahPaused(true);
          } else if (status?.error) {
            setIsPlayingSurah(false);
            setIsSurahPaused(false);
          }
        });
        setIsPlayingSurah(true);
        setIsSurahPaused(false);
      }
    } catch (e) {
      console.error('Surah audio playback failed:', e);
      setIsPlayingSurah(false);
      setIsSurahPaused(false);
    }
  }, [selectedSurah, isPlayingSurah, isSurahPaused]);

  const handleSurahMemorizeToggle = useCallback(async () => {
    if (!selectedSurah) return;
    const surahVerseIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    try {
      if (isSurahMemorizedGlobally) {
        await bulkMarkVersesMemorized(surahVerseIds, false);
        surahVerseIds.forEach((id) => {
          if (memorizedVerses.includes(id)) unmarkVerseAsMemorized(id);
        });
      } else {
        await bulkMarkVersesMemorized(surahVerseIds, true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update memorization status.');
    }
  }, [selectedSurah, isSurahMemorizedGlobally, bulkMarkVersesMemorized, getSurahVerseRange, memorizedVerses, unmarkVerseAsMemorized]);

  const handleSurahRevisionToggle = useCallback(async () => {
    if (!selectedSurah) return;
    const surahVerseIds = getSurahVerseRange({
      id: selectedSurah.id,
      versesCount: selectedSurah.versesCount,
    });
    try {
      if (isSurahRevisedGlobally) {
        surahVerseIds.forEach((verseId) => unmarkVerseAsRevised(verseId));
      } else {
        await bulkMarkVersesRevised(surahVerseIds);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update revision status.');
    }
  }, [selectedSurah, isSurahRevisedGlobally, bulkMarkVersesRevised, unmarkVerseAsRevised, getSurahVerseRange]);

  const handleSurahPress = (surah: Surah) => {
    setNavigationSource('surahList');
    setSelectedSurah(surah);
    setLastViewedSurahId(surah.id);
    loadInitialVerses(surah);
  };

  const handleSelectJuz = async (juz: number, retryCount = 0) => {
    setNavigationSource('juzList');
    setSelectedJuz(juz);
    setIsJuzLoading(true);
    setJuzLoadingError(null);
    
    try {
      console.log(`[read] Loading Juz ${juz} (attempt ${retryCount + 1}/3)...`);
      const versesData = await fetchVersesForJuz(juz);
      
      // Validate DB returned data
      if (!versesData || versesData.length === 0) {
        throw new Error(`No verses returned from database for Juz ${juz}`);
      }
      
      console.log(`[read] Successfully loaded ${versesData.length} verses for Juz ${juz}`);
      setJuzVerses(versesData);
      setJuzListKey(prev => prev + 1); // Force FlashList rebuild on data change
      setIsJuzLoading(false);
      
    } catch (err: any) {
      console.error(`[read] Failed to load Juz ${juz}, attempt ${retryCount + 1}:`, err);
      
      // CRITICAL: Retry for ANY error on Android
      if (retryCount < 2) {
        console.log(`[read] Retrying Juz ${juz} load (attempt ${retryCount + 2}/3)...`);
        // Exponential backoff: 600ms, 1200ms
        const delay = 600 * (retryCount + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        setIsJuzLoading(false);
        return handleSelectJuz(juz, retryCount + 1);
      }
      
      // All retries exhausted
      setIsJuzLoading(false);
      const errorMessage = `Failed to load Juz ${juz}. Please try again.`;
      setJuzLoadingError(errorMessage);
      
      // Show critical error alert to user
      Alert.alert(
        '❌ Failed to Load Juz',
        `Cannot load Juz ${juz} after 3 attempts.\n\nPlease try:\n1. Restart the app\n2. Check device storage\n3. Reinstall if problem persists\n\nError: ${err?.message || 'Unknown error'}`,
        [
          {
            text: 'Try Again',
            onPress: () => handleSelectJuz(juz, 0),
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleMarkAllMemorized = async () => {
    if (!selectedSurah) return;
    const allIds = getSurahVerseRange(selectedSurah);
    const memorizedSet = new Set(memorizedVerses);
    const isMarking = !surahStatus.isMemorized;
    const toUpdate = allIds.filter((id) => isMarking ? !memorizedSet.has(id) : memorizedSet.has(id));

    if (!toUpdate.length) {
      Alert.alert('No Changes', 'All verses are already in the desired state.');
      return;
    }

    setProgressAction(isMarking ? 'mark-memorized' : 'unmark-memorized');
    setProgressModalVisible(true);
    setProgressCount(0);

    try {
      await bulkMarkVersesMemorized(toUpdate, isMarking);
      const BATCH_SIZE = 50;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        isMarking
          ? batch.forEach((id) => markVerseAsMemorized(id))
          : batch.forEach((id) => unmarkVerseAsMemorized(id));
        setProgressCount(Math.min(i + BATCH_SIZE, toUpdate.length));
        await new Promise((r) => setTimeout(r, 25));
      }
      
      // Celebration now handled globally via CelebrationContext in _layout.tsx
    } catch (error) {
      Alert.alert('Error', 'Failed to update verses.');
    } finally {
      setProgressModalVisible(false);
      setProgressAction(null);
    }
  };

  const handleMarkAllRevised = async () => {
    if (!selectedSurah) return;
    const allIds = getSurahVerseRange(selectedSurah);
    const revisedSet = new Set(revisedVerses.map((v) => v.verseId));
    const isMarking = !surahStatus.isRevised;
    const toUpdate = allIds.filter((id) => isMarking ? !revisedSet.has(id) : revisedSet.has(id));

    if (!toUpdate.length) {
      Alert.alert('No Changes', 'All verses are already in the desired state.');
      return;
    }

    setProgressAction(isMarking ? 'mark-revised' : 'unmark-revised');
    setProgressModalVisible(true);
    setProgressCount(0);

    try {
      const BATCH_SIZE = 50;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        isMarking
          ? batch.forEach((id) => markVerseAsRevised(id))
          : batch.forEach((id) => unmarkVerseAsRevised(id));
        setProgressCount(Math.min(i + BATCH_SIZE, toUpdate.length));
        await new Promise((r) => setTimeout(r, 25));
      }
      
      // Celebration now handled globally via CelebrationContext in _layout.tsx
    } catch (error) {
      Alert.alert('Error', 'Failed to update revisions.');
    } finally {
      setProgressModalVisible(false);
      setProgressAction(null);
    }
  };

  // Render helpers
  const renderVerseOptimized = useCallback(
    ({ item: verse }: { item: Verse }) => {
      const isPlaying = currentlyPlayingVerse !== null && 
                        currentlyPlayingVerse.surahId === verse.surahId && 
                        currentlyPlayingVerse.verseNumber === verse.verseNumber;
      return (
        <VerseItem
          verse={verse}
          onPlayAudio={handleVersePlayAudio}
          surahMemorizedGlobally={isSurahMemorizedGlobally}
          surahRevisedGlobally={isSurahRevisedGlobally}
          onSurahMemorizeToggle={handleSurahMemorizeToggle}
          onSurahRevisionToggle={handleSurahRevisionToggle}
          moveToVerse={handleMoveToVerse}
          source={tab === 'juz' ? 'juzList' : 'surahList'}
          isCurrentlyPlaying={isPlaying}
        />
      );
    },
    [handleVersePlayAudio, isSurahMemorizedGlobally, isSurahRevisedGlobally, handleSurahMemorizeToggle, handleSurahRevisionToggle, handleMoveToVerse, tab, currentlyPlayingVerse]
  );

  const renderSurahItem = ({ item }: { item: Surah }) => {
    const prog = calculateSurahProgress(item.id);
    const color = getProgressColor(prog.progress);
    const revelation = item.revelationType === 'Medinan' ? 'Madani' : 'Makki';
    const showKhatm = Math.round(prog.progress) === 100;
    const completionDate = showKhatm ? getSurahCompletionDate(item.id) : null;

    return (
      <Pressable
        style={[styles.surahCard, { backgroundColor: '#333333', borderColor: '#555555', borderWidth: 1 }]}
        onPress={() => handleSurahPress(item)}
      >
        <View style={[styles.surahNumber, { backgroundColor: primary }]}>
          <Text style={styles.surahNumberText}>{item.id}</Text>
        </View>
        <View style={styles.surahInfo}>
          <Text style={styles.surahName}>{item.name}</Text>
          <Text style={styles.surahEnglish}>{item.englishName}</Text>
          <View style={styles.surahDetailsRow}>
            <Text style={styles.surahDetails}>
              {item.versesCount} verses • <Text style={{ color: '#4CAF50' }}>{revelation}</Text>
            </Text>
            {showKhatm && completionDate && (
              <Text style={styles.khatamDate}>{formatDate(completionDate)} : ختم</Text>
            )}
          </View>
        </View>
        <View style={[styles.progressPill, { backgroundColor: color }]}>
          <Text style={styles.progressText}>{Math.round(prog.progress)}%</Text>
        </View>
      </Pressable>
    );
  };

  const renderFooter = () => null; // No pagination footer needed

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No verses found</Text>
    </View>
  );

  const renderProgressModal = () => (
    <Modal transparent visible={progressModalVisible} animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#222', borderRadius: 12, padding: 24, alignItems: 'center', width: '80%' }}>
          <Text style={{ color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            {progressAction === 'mark-memorized' && 'Marking Memorized...'}
            {progressAction === 'unmark-memorized' && 'Unmarking Memorized...'}
            {progressAction === 'mark-revised' && 'Marking Revised...'}
            {progressAction === 'unmark-revised' && 'Unmarking Revised...'}
          </Text>
          <View style={{ width: 180, height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden', marginVertical: 16 }}>
            <View
              style={{
                width: `${Math.max(5, Math.round((progressCount / (selectedSurah?.versesCount || 1)) * 100))}%`,
                height: '100%',
                backgroundColor: primary,
                borderRadius: 4,
              }}
            />
          </View>
          <Text style={{ color: '#aaa', fontSize: 14 }}>
            {progressCount} / {selectedSurah?.versesCount || 0} verses
          </Text>
        </View>
      </View>
    </Modal>
  );

  // Effects
  useEffect(() => {
    versesRef.current = verses;
  }, [verses]);

  // Badge celebrations now handled globally in _layout.tsx via CelebrationContext
  // No need for local callback registration

  // REMOVED: Auto-open lastViewedSurahId on tab click
  // This conflicted with direct Read tab navigation (should show Surah List)
  // Continue Reading card already passes surahId as param, handled by line 690's useEffect

  useEffect(() => {
    if (selectedSurah) {
      setVerses([]);
      loadInitialVerses(selectedSurah);
    }
  }, [translationLanguage, selectedSurah, loadInitialVerses]);

  useEffect(() => {
    if (!selectedSurah) {
      // No cache to clear - verses are loaded fresh each time
      return;
    }
    const hasVerses = verses.length > 0;
    const hasTajweed = hasVerses && verses.every((v: any) => !!v.tajweedText);
    const needsTajweed = arabicFont === 'tajweed';
    if ((needsTajweed && !hasTajweed) || (!needsTajweed && hasTajweed)) {
      setVerses([]);
      loadInitialVerses(selectedSurah);
    }
  }, [arabicFont, selectedSurah, translationLanguage, loadInitialVerses]);

  // Navigation: Handle route params for surahId/verseId (e.g., from Mustahabbah or Continue Reading)
  useEffect(() => {
    const sid = paramSurahId ? Number(paramSurahId) : undefined;
    const vid = paramVerseId ? Number(paramVerseId) : undefined;
    if (sid && !Number.isNaN(sid)) {
      const surah = surahsData.find((s) => s.id === sid);
      if (surah && !suppressNextAutoOpen.current) {
        console.log('[read] Processing navigation params for surah', sid, 'source:', paramSource);
        
        // Track where user came from for back button behavior
        if (paramSource === 'mustahabbah') {
          setNavigationSource('mustahabbah');
        } else if (paramSource === 'stats') {
          setNavigationSource('stats');
        } else if (paramSource === 'continueReading' || !paramSource) {
          // Continue Reading doesn't pass source, or no source = from home
          setNavigationSource('continueReading');
        }
        
        setSelectedSurah(surah);
        setLastViewedSurahId(surah.id);
        if (vid && !Number.isNaN(vid)) {
          // targetVerseRef.current = vid;
        }
        loadInitialVerses(surah);
      }
    }
  }, [paramSurahId, paramVerseId, paramSource, setLastViewedSurahId, loadInitialVerses]);

  // Navigation: Handle Juz navigation from bookmarks
  useEffect(() => {
    const juzNum = paramJuzNumber ? Number(paramJuzNumber) : undefined;
    const vid = paramVerseId ? Number(paramVerseId) : undefined;
    
    if (juzNum && !Number.isNaN(juzNum) && !suppressNextAutoOpen.current) {
      console.log('[read] Processing Juz navigation params - juzNumber:', juzNum, 'verseId:', vid);
      
      // CRITICAL: Switch to Juz tab FIRST, then load verses
      setTab('juz');
      handleSelectJuz(juzNum);
    }
  }, [paramJuzNumber]);

  // Scroll to specific verse in Juz mode after verses are loaded
  useEffect(() => {
    const vid = paramVerseId ? Number(paramVerseId) : undefined;
    console.log('[read] Juz scroll effect - vid:', vid, 'juzVerses.length:', juzVerses.length, 'tab:', tab);
    
    if (!vid || Number.isNaN(vid) || !juzVerses.length || tab !== 'juz') {
      console.log('[read] Juz scroll effect - conditions not met, skipping');
      return;
    }

    const verseIndex = juzVerses.findIndex((v) => v.verse_id === vid);
    console.log('[read] Juz scroll effect - searching for verse_id:', vid, 'found at index:', verseIndex);
    
    if (verseIndex >= 0) {
      // Add delay to ensure FlashList is fully mounted and measured
      setTimeout(() => {
        try {
          console.log('[read] Attempting to scroll to Juz verse index:', verseIndex);
          flatListRef.current?.scrollToIndex({
            index: verseIndex,
            animated: false,
            viewPosition: 0.1,
          });
          console.log('[read] Successfully scrolled to Juz verse index:', verseIndex);
        } catch (e) {
          console.error('[read] Juz auto-scroll to verse failed:', e);
        }
      }, 800); // Slightly longer delay for Juz verses
    } else {
      console.log('[read] Juz scroll effect - verse not found in juzVerses array');
    }
  }, [juzVerses, paramVerseId, tab]);

  // Scroll to specific verse after loading (for bookmarks, AyahOfTheDay, etc.)
  useEffect(() => {
    const vid = paramVerseId ? Number(paramVerseId) : undefined;
    if (!vid || Number.isNaN(vid) || !verses.length) return;

    const verseIndex = verses.findIndex((v) => v.id === vid);
    
    if (verseIndex >= 0) {
      // Add delay to ensure FlashList is fully mounted and measured
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index: verseIndex,
            animated: false, // Use instant scroll for accuracy
            viewPosition: 0.1,
          });
        } catch (e) {
          console.error('[read] Auto-scroll to verse failed:', e);
        }
      }, 500); // Increased delay for FlashList to measure items
    }
  }, [verses, paramVerseId]);

  // Cleanup audio when surah changes
  useEffect(() => {
    if (!selectedSurah) return;
    (async () => {
      try {
        await pauseSurahAudio();
      } catch {}
      setIsPlayingSurah(false);
      setIsSurahPaused(false);
    })();
  }, [selectedSurah?.id]);

  // Pre-initialize database on component mount to avoid race conditions
  useEffect(() => {
    (async () => {
      try {
        await getDatabase();
        console.log('[read] Database pre-initialized successfully');
      } catch (err) {
        console.error('[read] Database pre-initialization failed:', err);
      }
    })();
  }, []);

  // Reset to Surah list whenever Recite tab gains focus (UNLESS direct navigation with params)
  useFocusEffect(
    React.useCallback(() => {
      // CRITICAL: Check params FIRST to determine if this is direct navigation
      // Check for BOTH paramSurahId (Surah bookmarks) AND paramJuzNumber (Juz bookmarks)
      const hasNavigationParams = (paramSurahId || paramJuzNumber) && !suppressNextAutoOpen.current;
      
      console.log('[read] Tab gained focus - hasParams:', hasNavigationParams, 'params:', { paramSurahId, paramJuzNumber, paramVerseId, paramSource }, 'current state:', { selectedSurah: selectedSurah?.id, selectedJuz, tab });
      
      // CRITICAL: Only reset if this is a TAB CLICK (no params), not direct navigation
      if (!hasNavigationParams) {
        console.log('[read] Tab click detected (no params) - resetting to Surah list');
        
        // Stop any playing audio
        (async () => {
          try {
            await pauseSurahAudio();
            await pauseAudio();
          } catch (err) {
            console.error('[read] Error stopping audio:', err);
          }
        })();
        
        // Reset all state to show Surah list
        setSelectedSurah(null);
        setSelectedJuz(null);
        setVerses([]);
        setJuzVerses([]);
        setNavigationSource(null);
        setTab('surah');
        setIsPlayingAudio(false);
        setIsPlayingSurah(false);
        setIsSurahPaused(false);
      } else {
        console.log('[read] Direct navigation detected (has params) - preserving state');
      }
      
      // Cleanup function
      return () => {
        console.log('[read] Tab lost focus');
      };
    }, [paramSurahId, paramJuzNumber, paramVerseId, paramSource])
  );

  useEffect(() => {
    logDatabaseTables();
  }, []);

  // Render
  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
      {renderProgressModal()}

      <Modal visible={goToModalVisible} transparent animationType="slide" onRequestClose={() => setGoToModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: '#222', borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Text style={{ color: '#FFD700', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Go to Verse</Text>
            {selectedJuz != null && (
              <Text style={{ color: '#FFD700', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
                Format: surah:verse (e.g., 2:255)
              </Text>
            )}
            <TextInput
              style={{ width: '100%', color: '#fff', fontSize: 16, backgroundColor: '#333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderWidth: 1, borderColor: '#555' }}
              placeholder={selectedJuz != null ? "e.g., 2:255 or 110" : "Enter verse number"}
              placeholderTextColor="#888"
              value={goToInput}
              onChangeText={setGoToInput}
              keyboardType={selectedJuz != null ? "default" : "numeric"}
              autoFocus
              editable={!goToSubmitting}
            />
            {selectedJuz != null && (
              <Text style={{ color: '#888', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
                Enter surah:verse (e.g., 2:251) or verse position (e.g., 110)
              </Text>
            )}
            {goToError && <Text style={{ color: '#ff5252', fontSize: 14, marginBottom: 8 }}>{goToError}</Text>}
            <View style={{ flexDirection: 'row', width: '100%', marginTop: 8 }}>
              <Pressable
                style={{ flex: 1, backgroundColor: '#444', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginRight: 4 }}
                onPress={() => { setGoToModalVisible(false); setGoToInput(''); setGoToError(null); }}
                disabled={goToSubmitting}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, backgroundColor: '#FFD700', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginLeft: 4 }}
                onPress={async () => {
                  if (!selectedSurah && selectedJuz == null) return;
                  
                  setGoToSubmitting(true);
                  setGoToError(null);
                  
                  let idx = -1;
                  
                  // SURAH MODE: Simple verse number
                  if (selectedSurah) {
                    const num = parseInt(goToInput, 10);
                    
                    if (isNaN(num) || num < 1 || num > selectedSurah.versesCount) {
                      setGoToError(`Enter verse 1-${selectedSurah.versesCount}`);
                      setGoToSubmitting(false);
                      return;
                    }
                    
                    idx = verses.findIndex((v) => v.verseNumber === num);
                    
                    if (idx === -1) {
                      setGoToError('Verse not found. Check the verse number.');
                      setGoToSubmitting(false);
                      return;
                    }
                  }
                  
                  // JUZ MODE: Supports both formats:
                  // 1. Surah:verse format (e.g., 2:255)
                  // 2. Simple verse position within juz (e.g., 110 for 110th verse in the juz)
                  else if (selectedJuz != null) {
                    const input = goToInput.trim();
                    
                    // Check if input contains ':' for surah:verse format
                    if (input.includes(':')) {
                      // FORMAT 1: surah:verse (e.g., 2:255)
                      const parts = input.split(':');
                      if (parts.length !== 2) {
                        setGoToError('Use format: surah:verse (e.g., 2:255) or verse number (e.g., 110)');
                        setGoToSubmitting(false);
                        return;
                      }
                      
                      const surahNum = parseInt(parts[0].trim(), 10);
                      const verseNum = parseInt(parts[1].trim(), 10);
                      
                      if (isNaN(surahNum) || isNaN(verseNum) || surahNum < 1 || surahNum > 114 || verseNum < 1) {
                        setGoToError('Invalid surah or verse number');
                        setGoToSubmitting(false);
                        return;
                      }
                      
                      console.log('[read] Go to verse in Juz mode (surah:verse):', { surahNum, verseNum, selectedJuz });
                      
                      // Find verse by BOTH chapter_id AND verse_number
                      idx = juzVerses.findIndex((v) => v.chapter_id === surahNum && v.verse_number === verseNum);
                      
                      console.log('[read] Search result: idx =', idx, 'for', surahNum + ':' + verseNum);
                      
                      if (idx === -1) {
                        // Check if the surah exists in this juz at all
                        const surahExistsInJuz = juzVerses.some((v) => v.chapter_id === surahNum);
                        if (!surahExistsInJuz) {
                          setGoToError(`Surah ${surahNum} is not in Juz ${selectedJuz}`);
                        } else {
                          // Surah exists but verse doesn't
                          const versesInSurah = juzVerses.filter((v) => v.chapter_id === surahNum);
                          if (versesInSurah.length > 0) {
                            const minVerse = Math.min(...versesInSurah.map(v => v.verse_number));
                            const maxVerse = Math.max(...versesInSurah.map(v => v.verse_number));
                            setGoToError(`Surah ${surahNum} in Juz ${selectedJuz} has verses ${minVerse}-${maxVerse}`);
                          } else {
                            setGoToError(`Verse ${surahNum}:${verseNum} not found in Juz ${selectedJuz}`);
                          }
                        }
                        setGoToSubmitting(false);
                        return;
                      }
                    } else {
                      // FORMAT 2: Simple verse position within juz (e.g., 110)
                      const versePosition = parseInt(input, 10);
                      
                      if (isNaN(versePosition) || versePosition < 1) {
                        setGoToError('Enter a valid verse number or surah:verse format');
                        setGoToSubmitting(false);
                        return;
                      }
                      
                      // Convert 1-based position to 0-based index
                      idx = versePosition - 1;
                      
                      if (idx < 0 || idx >= juzVerses.length) {
                        setGoToError(`Enter verse 1-${juzVerses.length} or use surah:verse format`);
                        setGoToSubmitting(false);
                        return;
                      }
                      
                      // Get the actual verse info for user feedback
                      const targetVerse = juzVerses[idx];
                      console.log('[read] Go to verse position', versePosition, 'in Juz', selectedJuz, 
                        '-> Surah', targetVerse.chapter_id, 'Verse', targetVerse.verse_number);
                    }
                  }
                  
                  console.log('[read] Found verse at index', idx, '- attempting scroll');
                  
                  // Scroll to verse (only if idx is valid)
                  if (idx !== -1 && idx >= 0) {
                    try {
                      console.log('[read] Executing scrollToIndex for index:', idx);
                      flatListRef.current?.scrollToIndex({ 
                        index: idx, 
                        animated: true,
                        viewPosition: 0.2 
                      });
                      
                      // Close modal after successful scroll initiation
                      setGoToModalVisible(false);
                      setGoToInput('');
                      setGoToError(null);
                    } catch (e) {
                      console.error('[read] Scroll failed:', e);
                      // Fallback to scrollToOffset if scrollToIndex fails
                      const offset = idx * (averageVerseHeight || 200);
                      flatListRef.current?.scrollToOffset({ offset, animated: true });
                      
                      // Close modal after fallback scroll
                      setGoToModalVisible(false);
                      setGoToInput('');
                      setGoToError(null);
                    }
                  } else {
                    console.error('[read] Invalid index for scroll:', idx);
                    setGoToError('Invalid verse index');
                  }
                  
                  setGoToSubmitting(false);
                }}
                disabled={goToSubmitting}
              >
                <Text style={{ color: '#222', fontSize: 16, fontWeight: '600' }}>Go</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={handleBackToSurahs} style={{ marginRight: 12 }}>
            <ArrowLeft size={28} color="#FFD700" />
          </TouchableOpacity>
          {selectedSurah ? (
            <View style={[styles.headerTitleContainer, { alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <AutoSizeText
                  numberOfLines={1}
                  mode={ResizeTextMode.min_font_size}
                  fontSize={20}
                  minFontSize={12}
                  style={styles.headerTitle}
                >
                  {`${selectedSurah.id}. ${selectedSurah.englishName}`}
                </AutoSizeText>
                <TouchableOpacity
                  onPress={handleToggleSurahAudio}
                  style={{
                    marginLeft: 10,
                    backgroundColor: isPlayingSurah ? '#FFD700' : '#333333',
                    borderRadius: 22,
                    width: 42,
                    height: 42,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isPlayingSurah ? '#FFD700' : '#555555',
                  }}
                  activeOpacity={0.8}
                >
                  {isPlayingSurah ? <Pause size={22} color="#1a1a1a" /> : <Play size={22} color="#FFD700" />}
                </TouchableOpacity>
                <Pressable
                  onPress={() => setGoToModalVisible(true)}
                  style={{ marginLeft: 8, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ArrowRight size={18} color="#000" />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 8, marginTop: 6 }}>
                <Text style={{ color: '#ffffff', fontSize: 12 }}>
                  {selectedSurah.revelationType === 'Medinan' ? 'Madani' : 'Makki'}
                </Text>
                <AutoSizeText
                  numberOfLines={1}
                  mode={ResizeTextMode.min_font_size}
                  fontSize={arabicTypography.fontSize}
                  minFontSize={14}
                  style={[styles.headerSubtitle, { fontFamily: arabicFontFamily, lineHeight: arabicTypography.lineHeight, textAlign: 'center', color: '#ffffff' }]}
                >
                  {selectedSurah.arabicName}
                </AutoSizeText>
                <Text style={{ color: '#ffffff', fontSize: 12 }}>{selectedSurah.versesCount} verses</Text>
              </View>
            </View>
          ) : selectedJuz != null ? (
            <View style={[styles.headerTitleContainer, { alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <AutoSizeText
                  numberOfLines={1}
                  mode={ResizeTextMode.min_font_size}
                  fontSize={20}
                  minFontSize={12}
                  style={styles.headerTitle}
                >
                  {`Juz ${selectedJuz}`}
                </AutoSizeText>
                <Pressable
                  onPress={() => setGoToModalVisible(true)}
                  style={{ marginLeft: 8, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ArrowRight size={18} color="#000" />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 8, marginTop: 6 }}>
                <Text style={{ color: '#888888', fontSize: 12 }}>{juzVerses.length} verses</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.headerTitle}>Recite Qur'an in measured and rhythmic tone!</Text>
          )}
        </View>

        {selectedSurah && (
          <View style={styles.headerActions}>
            <Pressable 
              style={({ pressed }) => [
                styles.actionButton, 
                {
                  backgroundColor: surahStatus.isMemorized ? '#4CAF50' : '#1a1a1a',
                  borderColor: surahStatus.isMemorized ? '#4CAF50' : '#444444',
                  borderWidth: surahStatus.isMemorized ? 2 : 1,
                  opacity: pressed ? 0.7 : 1,
                  shadowColor: surahStatus.isMemorized ? '#4CAF50' : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: surahStatus.isMemorized ? 3 : 0,
                }
              ]} 
              onPress={handleMarkAllMemorized}
            >
              <Check size={16} color="#ffffff" />
              <Text style={[styles.actionButtonText, { marginLeft: 6 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {surahStatus.isMemorized ? 'All Memorized' : 'Mark All Verses'}
              </Text>
              <View style={{ 
                marginLeft: 4, 
                padding: 4, 
                borderRadius: 12,
                backgroundColor: surahStatus.isMemorized ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                width: 22,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {surahStatus.isMemorized && <ArrowLeft size={14} color="#ffffff" />}
              </View>
            </Pressable>
            
            <Pressable 
              style={({ pressed }) => [
                styles.actionButton, 
                {
                  backgroundColor: surahStatus.isRevised ? '#FF9800' : '#1a1a1a',
                  borderColor: surahStatus.isRevised ? '#FF9800' : '#444444',
                  borderWidth: surahStatus.isRevised ? 2 : 1,
                  opacity: pressed ? 0.7 : 1,
                  shadowColor: surahStatus.isRevised ? '#FF9800' : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: surahStatus.isRevised ? 3 : 0,
                }
              ]} 
              onPress={handleMarkAllRevised}
            >
              <RefreshCw size={16} color="#ffffff" />
              <Text style={[styles.actionButtonText, { marginLeft: 6 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {surahStatus.isRevised ? 'All Revised' : 'Mark All Revised'}
              </Text>
              <View style={{ 
                marginLeft: 4, 
                padding: 4, 
                borderRadius: 12,
                backgroundColor: surahStatus.isRevised ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                width: 22,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {surahStatus.isRevised && <ArrowLeft size={14} color="#ffffff" />}
              </View>
            </Pressable>
          </View>
        )}
      </View>

      {!selectedSurah && selectedJuz == null && navigationSource !== 'mustahabbah' && navigationSource !== 'stats' && (
        <View style={[styles.searchBarContainer, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <View style={[styles.searchInputWrapper, { flex: 1 }]}>
            <Search size={20} color="#888888" />
            <TextInput
              style={[styles.searchInput, { color: '#ffffff' }]}
              placeholder="Search"
              placeholderTextColor="#888888"
              value={searchQuery}
              onChangeText={setSearchQuery}
              editable={tab !== 'juz'}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={18} color="#888888" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => setTab('surah')} style={[styles.tabButton, tab === 'surah' && { backgroundColor: primary }]}>
            <Text style={[styles.tabText, tab === 'surah' && styles.tabTextActive]}>Surah</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('juz')} style={[styles.tabButton, tab === 'juz' && { backgroundColor: primary }]}>
            <Text style={[styles.tabText, tab === 'juz' && styles.tabTextActive]}>Juz</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
        {selectedSurah ? (
          <View style={[styles.versesContainer, { backgroundColor: '#1a1a1a' }]}>
            {isLoading ? (
              <View style={[styles.loadingContainer, { backgroundColor: '#1a1a1a' }]}>
                <ActivityIndicator size="large" color={primary} />
                <Text style={[styles.loadingText, { color: '#ffffff' }]}>Loading verses...</Text>
              </View>
            ) : loadingError ? (
              <View style={[styles.errorContainer, { backgroundColor: '#1a1a1a' }]}>
                <Text style={[styles.errorText, { color: '#ff5252' }]}>{loadingError}</Text>
                <Pressable style={[styles.retryButton, { backgroundColor: primary }]} onPress={() => loadInitialVerses(selectedSurah)}>
                  <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <FlashList
                key={`verse-list-${verseListKey}`}
                ref={flatListRef}
                data={verses}
                renderItem={renderVerseOptimized}
                keyExtractor={(item: any) => `verse-${item.id}-${item.surahId}-${item.verseNumber}`}
                estimatedItemSize={200}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.verseList}
              />
            )}
          </View>
        ) : selectedJuz != null ? (
          <View style={[styles.versesContainer, { backgroundColor: '#1a1a1a' }]}>
            {isJuzLoading ? (
              <View style={[styles.loadingContainer, { backgroundColor: '#1a1a1a' }]}>
                <ActivityIndicator size="large" color={primary} />
                <Text style={[styles.loadingText, { color: '#ffffff' }]}>Loading verses...</Text>
              </View>
            ) : juzLoadingError ? (
              <View style={[styles.errorContainer, { backgroundColor: '#1a1a1a' }]}>
                <Text style={[styles.errorText, { color: '#ff5252' }]}>{juzLoadingError}</Text>
                <Pressable style={[styles.retryButton, { backgroundColor: primary }]} onPress={() => handleSelectJuz(selectedJuz)}>
                  <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <FlashList
                key={`juz-list-${juzListKey}`}
                ref={flatListRef}
                data={juzVerses}
                keyExtractor={(item: any, index: number) => `juz-${item.verse_id}-${item.chapter_id}-${item.verse_number}`}
                estimatedItemSize={200}
                renderItem={({ item, index }: { item: any; index: number }) => {
                  const isPlaying = currentlyPlayingVerse !== null && 
                                    currentlyPlayingVerse.surahId === item.chapter_id && 
                                    currentlyPlayingVerse.verseNumber === item.verse_number;
                  return (
                    <VerseItem
                      verse={{
                        id: item.verse_id,
                        surahId: item.chapter_id,
                        verseNumber: item.verse_number,
                        arabicText: item.ayah,
                        translation: item.translation || '',
                        transliteration: item.transliteration || undefined,
                        pageNumber: item.page_id ? Number(item.page_id) : undefined,
                        juzNumber: item.part_id ? Number(item.part_id) : undefined,
                      }}
                      onPlayAudio={handleVersePlayAudio}
                      surahMemorizedGlobally={false}
                      surahRevisedGlobally={false}
                      onSurahMemorizeToggle={() => {}}
                      onSurahRevisionToggle={() => {}}
                      source={'juzList'}
                      isCurrentlyPlaying={isPlaying}
                      juzSequenceNumber={index + 1}
                      totalJuzVerses={juzVerses.length}
                    />
                  );
                }}
                contentContainerStyle={[styles.versesContent, { backgroundColor: '#1a1a1a' }]}
              />
            )}
          </View>
        ) : tab === 'surah' ? (
          <FlashList
            ref={surahListRef}
            data={filteredSurahs}
            renderItem={renderSurahItem}
            keyExtractor={(item: any) => `surah-${item.id}`}
            contentContainerStyle={[styles.surahListContent, { backgroundColor: '#1a1a1a' }]}
          />
        ) : (
          <JuzMemorization onOpenJuz={handleSelectJuz} />
        )}
      </View>
      
      {/* CelebrationModal removed - now handled globally in _layout.tsx */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  headerContainer: { paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#1a1a1a' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff' },
  headerSubtitle: { fontSize: 16, color: '#888888', marginTop: 2 },
  headerActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 8 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#505050', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginHorizontal: 4 },
  actionButtonActive: { backgroundColor: '#4CAF50' },
  actionButtonRevised: { backgroundColor: '#FF9800' },
  actionButtonText: { color: '#ffffff', marginLeft: 8, fontSize: 14, fontWeight: '500' },
  versesContainer: { flex: 1, backgroundColor: '#1a1a1a' },
  versesContent: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#ffffff' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#1a1a1a' },
  errorText: { fontSize: 16, textAlign: 'center', marginBottom: 16, color: '#ff5252' },
  retryButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  retryButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  surahListContent: { padding: 16, backgroundColor: '#1a1a1a' },
  surahCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 12, borderRadius: 12, backgroundColor: '#333333', borderColor: '#555555', borderWidth: 1, elevation: 2 },
  surahNumber: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  surahNumberText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  surahInfo: { flex: 1, marginLeft: 12 },
  surahName: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  surahEnglish: { fontSize: 14, color: '#888888' },
  surahDetailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  surahDetails: { fontSize: 14, color: '#888888' },
  progressPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  progressText: { color: '#ffffff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  loadingMoreText: { marginTop: 8, fontSize: 14, color: '#888888' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#888888' },
  searchBarContainer: { padding: 16, paddingTop: 8, paddingBottom: 16, backgroundColor: '#1a1a1a' },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 0, height: 36 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0, color: '#ffffff' },
  clearButton: { marginLeft: 8, padding: 2 },
  tabButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#333333' },
  tabText: { color: '#888888', fontWeight: '600' },
  tabTextActive: { color: '#ffffff' },
  khatamDate: { color: '#4CAF50', fontFamily: 'ScheherazadeNew-Regular', fontSize: 12, textAlign: 'right', marginLeft: 8 },
  verseList: { padding: 16, paddingBottom: 100 },
});